export const dynamic = 'force-dynamic';

import { BigQuery } from '@google-cloud/bigquery';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { isAdmin, canViewAllClients } from '@/lib/client';

const bigquery = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON),
});

/**
 * GET /api/clients
 *
 * Admin-only endpoint.  Returns one row per active client with:
 *  - client metadata (from dim_clients via vw_client_performance)
 *  - latest month's KPIs (revenue, pct_to_goal, occupancy, ADR, RevPAR)
 *
 * Used by the /clients admin list page to render client cards.
 *
 * Access control: returns 403 for non-admin sessions.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!canViewAllClients(session)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Pull the most recent month's data for every client.
    // RANK() partitioned by client ensures we get exactly one row per client
    // (the latest month that has either revenue or a goal set).
    const query = `
      WITH ranked AS (
        SELECT
          client_name,
          FORMAT_DATE('%Y-%m', report_month)   AS month_key,
          FORMAT_DATE('%b %Y', report_month)   AS month_label,
          report_month,
          active_listings,
          total_bedrooms,
          total_rental_revenue,
          total_revenue_goal,
          pct_to_goal,
          total_rental_revenue_stly,
          rental_revenue_vs_stly_pct,
          avg_occupancy_pct,
          avg_market_occupancy_pct,
          avg_adr,
          avg_market_adr,
          avg_revpar,
          avg_market_revpar,
          RANK() OVER (
            PARTITION BY client_name
            ORDER BY report_month DESC
          ) AS rn
        FROM \`pbm-pl-data-bank.mira_analytics.vw_client_performance\`
        WHERE (total_rental_revenue > 0 OR total_revenue_goal > 0)
      )
      SELECT
        * EXCEPT (rn),
        CASE
          WHEN pct_to_goal >= 100 THEN 'green'
          WHEN pct_to_goal >= 85  THEN 'yellow'
          ELSE                         'red'
        END AS goal_color
      FROM ranked
      WHERE rn = 1
      ORDER BY client_name ASC
    `;

    const [rows] = await bigquery.query({ query, location: 'US' });

    const data = rows.map(r => ({
      ...r,
      report_month: r.report_month?.value ?? r.report_month,
    }));

    return Response.json({ data });
  } catch (error) {
    console.error('Clients route error:', error);
    return Response.json({ error: error.message, data: [] }, { status: 500 });
  }
}
