export const dynamic = 'force-dynamic';

import { BigQuery } from '@google-cloud/bigquery';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getClientNames } from '@/lib/client';
import { propertyGroupsTableExists, propertyListSql, propertyKey } from '@/lib/property-groups';

const bigquery = new BigQuery({
  projectId:   process.env.GCP_PROJECT_ID,
  credentials: JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON),
});

/**
 * GET /api/properties
 * Property groups (combined + unit listings) in the caller's client scope,
 * for the dashboard's listing filter. Empty until groups are saved in
 * /admin/properties (or before the table exists).
 */
export async function GET(request) {
  try {
    const session     = await getServerSession(authOptions);
    const clientNames = getClientNames(session, request);
    if (Array.isArray(clientNames) && clientNames.length === 0) return Response.json({ data: [] });
    if (!(await propertyGroupsTableExists(bigquery)))          return Response.json({ data: [] });

    const [rows] = await bigquery.query({
      query:    propertyListSql({ clientWhere: clientNames ? 'client_name IN UNNEST(@clientNames)' : 'TRUE' }),
      params:   clientNames ? { clientNames } : {},
      location: 'US',
    });

    return Response.json({ data: rows.map(r => ({ ...r, key: propertyKey(r.property_id) })) });
  } catch (error) {
    console.error('Properties route error:', error);
    return Response.json({ error: error.message, data: [] }, { status: 500 });
  }
}
