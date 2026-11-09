export const dynamic = 'force-dynamic';

import { BigQuery } from '@google-cloud/bigquery';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/client';
import { PROPERTY_GROUPS_TABLE, propertyGroupsTableExists } from '@/lib/property-groups';

const bigquery = new BigQuery({
  projectId:   process.env.GCP_PROJECT_ID,
  credentials: JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON),
});

/**
 * DELETE /api/admin/property-groups/[id]
 * Ungroups a property (its listings go back to being shown on their own).
 * Listing data is untouched. Admin only.
 */
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  try {
    if (!(await propertyGroupsTableExists(bigquery))) return Response.json({ success: true });
    await bigquery.query({
      query:    `DELETE FROM ${PROPERTY_GROUPS_TABLE} WHERE group_id = @id`,
      params:   { id: params.id },
      location: 'US',
    });
    return Response.json({ success: true });
  } catch (error) {
    console.error('Admin property-groups DELETE error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
