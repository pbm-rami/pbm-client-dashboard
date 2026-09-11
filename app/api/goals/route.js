export const dynamic = 'force-dynamic';

import { BigQuery } from '@google-cloud/bigquery';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getClientNames } from '@/lib/client';

const bigquery = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON),
});

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // YYYY-MM

    const session    = await getServerSession(authOptions);
    const clientNames = getClientNames(session, request);
    // Empty array = this login resolves to no client scope (see lib/client.js).
    // Fail closed: return no data rather than an unfiltered query.
    if (Array.isArray(clientNames) && clientNames.length === 0) {
      return Response.json({ data: [] });
    }


    let query = `
      SELECT
        listing_name,
        FORMAT_DATE('%Y-%m', report_month) AS month_key,
        rental_revenue,
        rental_revenue_goal,
        pct_to_goal
      FROM \`pbm-pl-data-bank.mira_analytics.vw_listing_performance\`
      WHERE 1=1
    `;

    const params = {};

    if (clientNames) {
      query += ` AND client_name IN UNNEST(@clientNames)`;
      params.clientNames = clientNames;
    }

    if (month) {
      query += ` AND FORMAT_DATE('%Y-%m', report_month) = @month`;
      params.month = month;
    }

    query += ` ORDER BY pct_to_goal DESC`;

    const [rows] = await bigquery.query({ query, location: 'US', params });

    return Response.json({ data: rows });
  } catch (error) {
    console.error('Goals route error:', error);
    return Response.json({ error: error.message, data: [] }, { status: 500 });
  }
}
