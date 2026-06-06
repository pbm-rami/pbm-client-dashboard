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

    // CTE pulls all fields from the generic client view,
    // adds month_key and month_label so downstream components
    // don't need to know the underlying date field is a DATE.
    let query = `
      WITH cp AS (
        SELECT
          client_name,
          FORMAT_DATE('%Y-%m', report_month)   AS month_key,
          FORMAT_DATE('%b %Y', report_month)   AS month_label,
          report_month,
          active_listings,
          total_bedrooms,
          total_rental_revenue,
          total_revenue,
          total_revenue_goal,
          pct_to_goal,
          total_rental_revenue_stly,
          rental_revenue_vs_stly_pct,
          total_rental_revenue_ly,
          rental_revenue_vs_ly_pct,
          avg_occupancy_pct,
          avg_occupancy_pct_stly,
          avg_market_occupancy_pct,
          occ_vs_stly_pct,
          avg_occ_vs_market,
          avg_adr,
          avg_adr_stly,
          avg_market_adr,
          adr_vs_market_pct,
          avg_adr_index,
          avg_revpar,
          avg_revpar_stly,
          avg_market_revpar,
          revpar_vs_stly_pct,
          revpar_vs_market_pct,
          avg_revpar_index,
          total_booked_nights,
          total_blocked_nights,
          total_potential_revenue_lost,
          pickup_7d,
          pickup_8_14d,
          pickup_15_30d,
          pickup_31_60d
        FROM \`pbm-pl-data-bank.mira_analytics.vw_client_performance\`
        WHERE 1=1
    `;

    const params = {};

    // Admin with no ?client= sees all clients; otherwise filter by name
    if (clientName) {
      query += ` AND client_name = @clientName`;
      params.clientName = clientName;
    }

    query += `
      )
      SELECT
        *,
        -- goal_color: convenience field used by some future components
        CASE
          WHEN pct_to_goal >= 100 THEN 'green'
          WHEN pct_to_goal >= 85  THEN 'yellow'
          ELSE                         'red'
        END                           AS goal_color,
        -- revenue_gap: how far short (or ahead) of goal
        ROUND(total_revenue_goal - total_rental_revenue, 2) AS revenue_gap
      FROM cp
      ORDER BY report_month DESC
    `;

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
    console.error('KPI route error:', error);
    return Response.json({ error: error.message, data: [] }, { status: 500 });
  }
}
