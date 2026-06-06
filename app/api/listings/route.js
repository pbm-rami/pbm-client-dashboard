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
    const { searchParams } = new URL(request.url);
    const month   = searchParams.get('month');    // YYYY-MM
    const listing = searchParams.get('listing');  // listing name or empty

    const session    = await getServerSession(authOptions);
    const clientName = getClientName(session, request);

    // max_booked: ensures last_booked_date always reflects the most recent
    // booking across ALL months, not just the filtered month.
    // lp: main CTE with all fields; joins max_booked so last_booked_date
    // is always accurate regardless of which month is selected.
    const clientFilter = clientName
      ? `WHERE client_name = @clientName`
      : `WHERE 1=1`;

    let query = `
      WITH max_booked AS (
        SELECT
          listing_name,
          MAX(last_booked_date) AS last_booked_date_max
        FROM \`pbm-pl-data-bank.mira_analytics.vw_listing_performance\`
        ${clientFilter}
        GROUP BY listing_name
      ),
      lp AS (
        SELECT
          -- Identity
          src.listing_name,
          src.listing_id,
          src.no_of_bedrooms                              AS bedroom_count,
          src.market,
          src.city_name,
          src.client_name,
          src.analyst_name,
          src.report_month,
          FORMAT_DATE('%b %Y', src.report_month)          AS month_label,
          FORMAT_DATE('%Y-%m', src.report_month)          AS month_key,
          -- Always use the max last_booked_date across all months
          COALESCE(mb.last_booked_date_max, src.last_booked_date) AS last_booked_date,

          -- Revenue
          src.rental_revenue_goal,
          src.pct_to_goal,
          src.rental_revenue,
          src.rental_revenue_stly,
          src.rental_revenue_ly,
          src.total_revenue,
          src.revenue_stly                                AS total_revenue_stly,
          src.revenue_last_year                           AS total_revenue_ly,
          src.rental_revenue_vs_stly_pct                  AS revenue_vs_stly_pct,
          src.rental_revenue_vs_ly_pct                    AS revenue_vs_ly_pct,

          -- Occupancy
          src.occupancy_pct,
          src.occupancy_pct_stly,
          src.occupancy_pct_ly,
          src.market_occupancy_pct,
          src.market_occupancy_pct_stly,
          src.occ_vs_stly_pct,
          src.occ_vs_market,

          -- ADR
          src.adr                                         AS rental_adr,
          src.adr_stly,
          src.adr_ly,
          src.market_adr,
          src.market_adr_stly,
          src.adr_vs_market_pct,
          src.adr_index,

          -- RevPAR
          src.revpar                                      AS rental_revpar,
          src.rental_revpar_stly                          AS revpar_stly,
          src.revpar_ly,
          src.market_revpar,
          src.revpar_vs_stly_pct,
          src.revpar_index,

          -- Potential Revenue (actuals from Monthly Perf Dashboard)
          src.available_bookable_potential_revenue,
          src.blocked_potential_revenue,

          -- Night counts
          src.booked_nights,
          src.blocked_nights,

          -- Pickup
          src.pickup_7d,
          src.pickup_8_14d,
          src.pickup_15_30d,
          src.pickup_31_60d,

          -- Booking behavior
          src.avg_los,
          src.avg_booking_window

        FROM \`pbm-pl-data-bank.mira_analytics.vw_listing_performance\` src
        LEFT JOIN max_booked mb ON src.listing_name = mb.listing_name
        ${clientFilter}
      )
      SELECT
        *,
        CASE
          WHEN pct_to_goal >= 100 THEN 'green'
          WHEN pct_to_goal >= 85  THEN 'yellow'
          ELSE                         'red'
        END  AS goal_color,
        -- Backward-compatible alias
        blocked_potential_revenue AS potential_revenue_lost
      FROM lp
      WHERE 1=1
    `;

    const params = clientName ? { clientName } : {};

    if (month) {
      query += ` AND month_key = @month`;
      params.month = month;
    }

    if (listing && listing !== 'all' && listing !== '') {
      query += ` AND listing_name = @listing`;
      params.listing = listing;
    }

    // Sort by date ASC for single-listing trend charts; by revenue DESC for table
    if (listing && listing !== 'all' && listing !== '' && !month) {
      query += ` ORDER BY report_month ASC`;
    } else if (!month) {
      // All months, no specific listing — sort by listing name then month for the all-months table
      query += ` ORDER BY listing_name ASC, report_month ASC`;
    } else {
      query += ` ORDER BY rental_revenue DESC`;
    }

    const [rows] = await bigquery.query({
      query,
      location: 'US',
      params,
    });

    const data = rows.map(r => ({
      ...r,
      report_month:     r.report_month?.value     ?? r.report_month,
      last_booked_date: r.last_booked_date?.value ?? r.last_booked_date,
    }));

    return Response.json({ data });
  } catch (error) {
    console.error('Listings route error:', error);
    return Response.json({ error: error.message, data: [] }, { status: 500 });
  }
}
