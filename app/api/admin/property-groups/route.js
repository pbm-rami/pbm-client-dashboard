export const dynamic = 'force-dynamic';

import { BigQuery } from '@google-cloud/bigquery';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/client';
import { randomUUID } from 'crypto';
import {
  PROPERTY_GROUPS_TABLE,
  propertyGroupsTableExists,
  propertyListSql,
  suggestPropertyGroups,
  validatePropertyGroup,
} from '@/lib/property-groups';

const bigquery = new BigQuery({
  projectId:   process.env.GCP_PROJECT_ID,
  credentials: JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON),
});

const DIM_LISTINGS = '`pbm-pl-data-bank.mira_core.dim_listings`';

async function clientListings(clientName) {
  const [rows] = await bigquery.query({
    query: `
      SELECT CAST(listing_id AS STRING) AS listing_id, listing_name,
             no_of_bedrooms AS bedroom_count, listing_status
      FROM ${DIM_LISTINGS}
      WHERE client_name = @clientName AND listing_name IS NOT NULL
      ORDER BY listing_name`,
    params:   { clientName },
    location: 'US',
  });
  return rows;
}

/**
 * GET /api/admin/property-groups?client=<client_name>
 * Saved property groups, suggested groups (from listing names) and the
 * client's listings for the manual form. Admin only.
 */
export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const clientName = new URL(request.url).searchParams.get('client')?.trim();
  if (!clientName) return Response.json({ error: 'client is required' }, { status: 400 });

  try {
    const tableReady = await propertyGroupsTableExists(bigquery);
    const [listings, groups] = await Promise.all([
      clientListings(clientName),
      tableReady
        ? bigquery.query({ query: propertyListSql({ clientWhere: 'client_name = @clientName' }), params: { clientName }, location: 'US' }).then(([r]) => r)
        : Promise.resolve([]),
    ]);

    const grouped = new Set(groups.flatMap(g => g.members.map(m => m.listing_id)));
    const suggestions = suggestPropertyGroups(listings.filter(l => !grouped.has(l.listing_id)));

    return Response.json({ data: { table_ready: tableReady, groups, suggestions, listings } });
  } catch (error) {
    console.error('Admin property-groups GET error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/property-groups
 * Body: { group_id?, client_name, property_name, members: [{ listing_id, member_role, units_covered }] }
 * Creates a group, or replaces an existing one when group_id is given. Admin only.
 */
export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await request.json();
    const clientName   = String(body.client_name ?? '').trim();
    const propertyName = String(body.property_name ?? '').trim();
    const members = (Array.isArray(body.members) ? body.members : []).map(m => ({
      listing_id:    String(m.listing_id ?? '').trim(),
      member_role:   m.member_role,
      units_covered: m.member_role === 'combined' ? Number(m.units_covered) : null,
    }));

    const invalid = validatePropertyGroup({ property_name: propertyName, client_name: clientName, members });
    if (invalid) return Response.json({ error: invalid }, { status: 400 });

    if (!(await propertyGroupsTableExists(bigquery))) {
      return Response.json({ error: 'The property groups table has not been created yet (see sql/app_property_groups.sql).' }, { status: 503 });
    }

    // Every member must be one of this client's listings…
    const own = new Set((await clientListings(clientName)).map(l => l.listing_id));
    const foreign = members.filter(m => !own.has(m.listing_id));
    if (foreign.length) return Response.json({ error: `Not a ${clientName} listing: ${foreign.map(m => m.listing_id).join(', ')}` }, { status: 400 });

    // …and not already in another property.
    const groupId = String(body.group_id ?? '').trim() || randomUUID();
    const [taken] = await bigquery.query({
      query: `SELECT listing_id, property_name FROM ${PROPERTY_GROUPS_TABLE}
              WHERE listing_id IN UNNEST(@ids) AND group_id != @groupId`,
      params:   { ids: members.map(m => m.listing_id), groupId },
      location: 'US',
    });
    if (taken.length) {
      return Response.json({ error: `Already in another property: ${taken.map(t => `${t.listing_id} (${t.property_name})`).join(', ')}` }, { status: 409 });
    }

    // Replace the group's rows in one transaction.
    await bigquery.query({
      query: `
        BEGIN TRANSACTION;
        DELETE FROM ${PROPERTY_GROUPS_TABLE} WHERE group_id = @groupId;
        INSERT INTO ${PROPERTY_GROUPS_TABLE}
          (group_id, property_name, client_name, listing_id, member_role, units_covered, created_at, created_by)
        SELECT @groupId, @propertyName, @clientName, id, @roles[OFFSET(i)], NULLIF(@covered[OFFSET(i)], 0),
               CURRENT_TIMESTAMP(), @createdBy
        FROM UNNEST(@ids) AS id WITH OFFSET i;
        COMMIT TRANSACTION;`,
      params: {
        groupId,
        propertyName,
        clientName,
        ids:       members.map(m => m.listing_id),
        roles:     members.map(m => m.member_role),
        covered:   members.map(m => m.units_covered ?? 0),   // 0 → NULL for units
        createdBy: session.user?.email ?? '',
      },
      location: 'US',
    });

    return Response.json({ data: { group_id: groupId } }, { status: body.group_id ? 200 : 201 });
  } catch (error) {
    console.error('Admin property-groups POST error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
