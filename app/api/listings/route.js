export const dynamic = 'force-dynamic';

import { BigQuery } from '@google-cloud/bigquery';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getClientNames } from '@/lib/client';
import {
  PROPERTY_GROUPS_TABLE,
  isPropertyKey,
  propertyIdFromKey,
  propertyGroupsTableExists,
  propertyRowsCtes,
} from '@/lib/property-groups';

const bigquery = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON),
});

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const month   = searchParams.get('month');    // "YYYY-MM" or a quarter key like "2026-Q1"
    const listing = searchParams.get('listing');  // listing name, "property:<id>", or empty

    const session    = await getServerSession(authOptions);
    const clientNames = getClientNames(session, request);
    // Empty array = this login resolves to no client scope (see lib/client.js).
    // Fail closed: return no data rather than an unfiltered query.
    if (Array.isArray(clientNames) && clientNames.length === 0) {
      return Response.json({ data: [] });
    }


    // A quarter option in the dashboard dropdown passes a key like
    // "2026-Q1" instead of "2026-01" — route to the quarterly sibling
    // view in that case so the Listings Table doesn't come back empty.
    const isQuarter  = !!(month && /^\d{4}-Q[1-4]$/.test(month));
    const sourceView = isQuarter
      ? 'vw_listing_performance_quarterly'
      : 'vw_listing_performance';

    // max_booked: ensures last_booked_date always reflects the most recent
    // booking across ALL months, not just the filtered month/quarter —
    // always sourced from the monthly view regardless of grain.
    // lp: main CTE with all fields; joins max_booked so last_booked_date
    // is always accurate regardless of which period is selected.
    const clientFilter = clientNames
      ? `WHERE client_name IN UNNEST(@clientNames)`
      : `WHERE 1=1`;
    const clientWhere = clientNames ? 'client_name IN UNNEST(@clientNames)' : 'TRUE';

    // ── Property groups (see lib/property-groups.js) ──────────────────────
    // listing=property:<id> selects a whole property: its combined numbers
    // plus its member listings. Every listing row is also labelled with the
    // property it belongs to, so units can say their goal is on the property.
    const groupsReady = await propertyGroupsTableExists(bigquery);
    const propertyId  = isPropertyKey(listing) ? propertyIdFromKey(listing) : null;
    if (propertyId && !groupsReady) return Response.json({ data: [], property: null });

    const propertyCtes = propertyId
      ? propertyRowsCtes({
          clientWhere,
          grain:     isQuarter ? 'quarter' : 'month',
          groupsSql: `SELECT group_id, property_name, client_name, listing_id, member_role, units_covered
                      FROM ${PROPERTY_GROUPS_TABLE} WHERE group_id = @propertyId`,
        })
      : null;
    const propertySelect = `
      SELECT
        *,
        CASE
          WHEN pct_to_goal >= 100 THEN 'green'
          WHEN pct_to_goal >= 85  THEN 'yellow'
          ELSE                         'red'
        END AS goal_color,
        blocked_potential_revenue AS potential_revenue_lost
      FROM prop_rows`;
    const tidy = (rows) => rows.map(r => ({
      ...r,
      report_month:     r.report_month?.value     ?? r.report_month,
      last_booked_date: r.last_booked_date?.value ?? r.last_booked_date,
    }));

    // Whole property, all months → the property's own trend rows.
    if (propertyId && !month) {
      const [rows] = await bigquery.query({
        query:    `WITH ${propertyCtes} ${propertySelect} ORDER BY report_month ASC`,
        params:   { ...(clientNames ? { clientNames } : {}), propertyId },
        location: 'US',
      });
      return Response.json({ data: tidy(rows) });
    }

    const memberCte = groupsReady
      ? `,
      pgm AS (
        SELECT CAST(listing_id AS STRING) AS listing_id, group_id AS property_id, property_name,
               member_role AS property_role
        FROM ${PROPERTY_GROUPS_TABLE}
        WHERE ${clientWhere}
      )`
      : '';
    const memberCols = groupsReady
      ? 'pgm.property_id, pgm.property_name, pgm.property_role,'
      : 'CAST(NULL AS STRING) AS property_id, CAST(NULL AS STRING) AS property_name, CAST(NULL AS STRING) AS property_role,';
    const memberJoin = groupsReady ? 'LEFT JOIN pgm ON pgm.listing_id = CAST(lp.listing_id AS STRING)' : '';

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
          ${isQuarter
            ? `src.month_label                                AS month_label,
          src.month_key                                  AS month_key,`
            : `FORMAT_DATE('%b %Y', src.report_month)          AS month_label,
          FORMAT_DATE('%Y-%m', src.report_month)          AS month_key,`}
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

        FROM \`pbm-pl-data-bank.mira_analytics.${sourceView}\` src
        LEFT JOIN max_booked mb ON src.listing_name = mb.listing_name
        ${clientFilter}
      )${memberCte}
      SELECT
        lp.*,
        ${memberCols}
        CASE
          WHEN pct_to_goal >= 100 THEN 'green'
          WHEN pct_to_goal >= 85  THEN 'yellow'
          ELSE                         'red'
        END  AS goal_color,
        -- Backward-compatible alias
        blocked_potential_revenue AS potential_revenue_lost
      FROM lp
      ${memberJoin}
      WHERE 1=1
    `;

    const params = clientNames ? { clientNames } : {};

    if (month) {
      query += ` AND month_key = @month`;
      params.month = month;
    }

    if (propertyId) {
      query += ` AND CAST(lp.listing_id AS STRING) IN (
        SELECT CAST(listing_id AS STRING) FROM ${PROPERTY_GROUPS_TABLE} WHERE group_id = @propertyId)`;
      params.propertyId = propertyId;
    } else if (listing && listing !== 'all' && listing !== '') {
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

    // Whole property, one period → member rows for the tables, plus the
    // property's combined row for Key Metrics.
    if (propertyId) {
      const [prop] = await bigquery.query({
        query:    `WITH ${propertyCtes} ${propertySelect} WHERE month_key = @month`,
        params:   { ...(clientNames ? { clientNames } : {}), propertyId, month },
        location: 'US',
      });
      return Response.json({ data: tidy(rows), property: tidy(prop)[0] ?? null });
    }

    return Response.json({ data: tidy(rows) });
  } catch (error) {
    console.error('Listings route error:', error);
    return Response.json({ error: error.message, data: [] }, { status: 500 });
  }
}
