export const dynamic = 'force-dynamic';

import { BigQuery } from '@google-cloud/bigquery';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getClientName } from '@/lib/client';

const bigquery = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON),
});

export async function GET(request) {
  try {
    const session    = await getServerSession(authOptions);
    const clientName = getClientName(session, request);

    let query = `
      SELECT
        FORMAT_DATE('%Y-%m', report_month)   AS month_key,
        FORMAT_DATE('%b %Y', report_month)   AS month_label,
        report_month,
        total_rental_revenue,
        total_revenue,
        total_rental_revenue_stly,
        total_rental_revenue_ly,
        total_revenue_goal,
        pct_to_goal,
        rental_revenue_vs_stly_pct,
        rental_revenue_vs_ly_pct,
        avg_occupancy_pct,
        avg_occupancy_pct_stly,
        avg_occupancy_pct_ly,
        avg_market_occupancy_pct,
        occ_vs_stly_pct,
        occ_vs_ly_pct,
        avg_adr,
        avg_adr_stly,
        avg_adr_ly,
        avg_market_adr,
        adr_vs_market_pct,
        avg_revpar,
        avg_revpar_stly,
        avg_revpar_ly,
        avg_market_revpar,
        revpar_vs_stly_pct,
        revpar_vs_market_pct
      FROM \`pbm-pl-data-bank.mira_analytics.vw_client_performance\`
      WHERE 1=1
    `;

    const params = {};

    if (clientName) {
      query += ` AND client_name = @clientName`;
      params.clientName = clientName;
    }

    query += ` ORDER BY report_month ASC`;

    const [rows] = await bigquery.query({
      query,
      location: 'US',
      params,
    });

    const data = rows.map(r => ({
      ...r,
      report_month: r.report_month?.value ?? r.report_month,
    }));

    return Response.json({ data });
  } catch (error) {
    console.error('Trends route error:', error);
    return Response.json({ error: error.message, data: [] }, { status: 500 });
  }
}
