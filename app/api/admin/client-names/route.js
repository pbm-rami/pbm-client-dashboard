export const dynamic = 'force-dynamic';

import { BigQuery } from '@google-cloud/bigquery';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/client';

const bigquery = new BigQuery({
  projectId:   process.env.GCP_PROJECT_ID,
  credentials: JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON),
});

/**
 * GET /api/admin/client-names
 * Returns distinct client_name values from vw_client_performance.
 * Used to populate the BigQuery client dropdown in the admin UI.
 * Admin only.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const [rows] = await bigquery.query({
      query: `
        SELECT DISTINCT client_name
        FROM \`pbm-pl-data-bank.mira_analytics.vw_client_performance\`
        WHERE client_name IS NOT NULL
        ORDER BY client_name ASC
      `,
      location: 'US',
    });
    return Response.json({ data: rows.map(r => r.client_name) });
  } catch (error) {
    console.error('Admin client-names GET error:', error);
    return Response.json({ error: error.message, data: [] }, { status: 500 });
  }
}
