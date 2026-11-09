/**
 * Property groups: listings that are physically the same place.
 *
 * Some properties are listed several ways, e.g. "Harbor 101" (2 BR) and
 * "Harbor 102" (3 BR) can each be booked, or together as "Harbor 101 & 102"
 * (5 BR). Booking one blocks the others, so each listing on its own shows
 * misleading numbers: the revenue goal usually sits only on the combined
 * listing, and cross-blocked nights are dropped from each listing's
 * occupancy.
 *
 * A group lists its members in mira_app.app_property_groups, one row per
 * listing:
 *   member_role = 'unit'      a physical unit
 *   member_role = 'combined'  a listing that books several units at once;
 *                             units_covered says how many
 * Several combined listings can share units (e.g. "Oak 12 & 14" and
 * "Oak 10, 12, 14").
 *
 * Property metrics (per month or quarter):
 *   revenue, goal          sum of every member
 *   booked unit-nights     unit nights + combined nights × units covered
 *   owner-blocked nights   unit blocked nights not explained by combined
 *                          bookings (estimate: never below zero)
 *   available unit-nights  units × days − owner-blocked nights
 *   occupancy              booked unit-nights ÷ available unit-nights
 *   ADR / RevPAR           revenue per booked / available unit-night
 *                          (so RevPAR = ADR × occupancy holds)
 * Same-time-last-year occupancy and ADR need booked nights STLY, which the
 * source view doesn't have, so they are left empty for properties.
 */

export const PROPERTY_GROUPS_TABLE = '`pbm-pl-data-bank.mira_app.app_property_groups`';
const LISTING_VIEW = '`pbm-pl-data-bank.mira_analytics.vw_listing_performance`';
const DIM_LISTINGS = '`pbm-pl-data-bank.mira_core.dim_listings`';

// Filter values for a whole property look like "property:<group_id>" so they
// can never collide with a listing name (the property is often named after
// its combined listing).
export const PROPERTY_PREFIX = 'property:';
export const isPropertyKey     = (v) => typeof v === 'string' && v.startsWith(PROPERTY_PREFIX);
export const propertyIdFromKey = (v) => v.slice(PROPERTY_PREFIX.length);
export const propertyKey       = (id) => `${PROPERTY_PREFIX}${id}`;

/**
 * CTEs (no leading WITH, no trailing comma) that end in `prop_rows`: one row
 * per property per period, using the same column names as the listings route.
 *
 *   clientWhere  SQL condition on client_name, e.g. 'client_name IN UNNEST(@clientNames)'
 *   grain        'month' | 'quarter'
 *   groupsSql    membership source; tests pass an inline SELECT
 */
export function propertyRowsCtes({
  clientWhere = 'TRUE',
  grain       = 'month',
  groupsSql   = `SELECT group_id, property_name, client_name, listing_id, member_role, units_covered FROM ${PROPERTY_GROUPS_TABLE}`,
} = {}) {
  const periodExpr = grain === 'quarter'
    ? 'DATE_TRUNC(report_month, QUARTER)'
    : 'report_month';
  const labelExpr = grain === 'quarter'
    ? `CONCAT('Q', CAST(EXTRACT(QUARTER FROM period_start) AS STRING), ' ', CAST(EXTRACT(YEAR FROM period_start) AS STRING))`
    : `FORMAT_DATE('%b %Y', period_start)`;
  const keyExpr = grain === 'quarter'
    ? `CONCAT(CAST(EXTRACT(YEAR FROM period_start) AS STRING), '-Q', CAST(EXTRACT(QUARTER FROM period_start) AS STRING))`
    : `FORMAT_DATE('%Y-%m', period_start)`;

  return `
  pg AS (
    SELECT
      group_id, property_name, client_name, CAST(listing_id AS STRING) AS listing_id, member_role,
      -- A combined night books every unit it covers; a unit night books one.
      IF(member_role = 'combined', GREATEST(COALESCE(units_covered, 2), 1), 1) AS weight
    FROM (${groupsSql})
    WHERE ${clientWhere}
  ),
  pg_meta AS (
    SELECT
      pg.group_id,
      ANY_VALUE(pg.property_name)                              AS property_name,
      ANY_VALUE(pg.client_name)                                AS client_name,
      COUNTIF(pg.member_role = 'unit')                         AS unit_count,
      SUM(IF(pg.member_role = 'unit', d.no_of_bedrooms, 0))    AS bedroom_count
    FROM pg
    LEFT JOIN ${DIM_LISTINGS} d ON CAST(d.listing_id AS STRING) = pg.listing_id
    GROUP BY pg.group_id
  ),
  pg_month AS (
    SELECT
      pg.group_id,
      src.report_month,
      DATE_DIFF(DATE_ADD(src.report_month, INTERVAL 1 MONTH), src.report_month, DAY) AS days,
      ANY_VALUE(src.market)                                   AS market,
      ANY_VALUE(src.city_name)                                AS city_name,
      ANY_VALUE(src.analyst_name)                             AS analyst_name,
      SUM(src.rental_revenue)                                 AS rental_revenue,
      SUM(src.rental_revenue_goal)                            AS rental_revenue_goal,
      SUM(src.rental_revenue_stly)                            AS rental_revenue_stly,
      SUM(src.rental_revenue_ly)                              AS rental_revenue_ly,
      SUM(src.total_revenue)                                  AS total_revenue,
      SUM(src.revenue_stly)                                   AS total_revenue_stly,
      SUM(src.revenue_last_year)                              AS total_revenue_ly,
      SUM(COALESCE(src.booked_nights, 0) * pg.weight)         AS booked_unit_nights,
      SUM(COALESCE(src.booked_nights_ly, 0) * pg.weight)      AS booked_unit_nights_ly,
      SUM(IF(pg.member_role = 'unit', COALESCE(src.blocked_nights, 0), 0))                 AS unit_blocked,
      SUM(IF(pg.member_role = 'combined', COALESCE(src.booked_nights, 0) * pg.weight, 0))  AS combined_unit_nights,
      AVG(IF(pg.member_role = 'unit', src.market_occupancy_pct, NULL))       AS market_occupancy_pct,
      AVG(IF(pg.member_role = 'unit', src.market_occupancy_pct_stly, NULL))  AS market_occupancy_pct_stly,
      AVG(IF(pg.member_role = 'unit', src.market_adr, NULL))                 AS market_adr,
      AVG(IF(pg.member_role = 'unit', src.market_adr_stly, NULL))            AS market_adr_stly,
      AVG(IF(pg.member_role = 'unit', src.market_revpar, NULL))              AS market_revpar,
      SUM(IF(pg.member_role = 'unit', src.available_bookable_potential_revenue, 0)) AS available_bookable_potential_revenue,
      SUM(src.pickup_7d)                                      AS pickup_7d,
      SUM(src.pickup_8_14d)                                   AS pickup_8_14d,
      SUM(src.pickup_15_30d)                                  AS pickup_15_30d,
      SUM(src.pickup_31_60d)                                  AS pickup_31_60d,
      MAX(src.last_booked_date)                               AS last_booked_date,
      AVG(src.avg_los)                                        AS avg_los,
      AVG(src.avg_booking_window)                             AS avg_booking_window
    FROM ${LISTING_VIEW} src
    JOIN pg ON CAST(src.listing_id AS STRING) = pg.listing_id
    GROUP BY pg.group_id, src.report_month
  ),
  pg_period AS (
    SELECT
      m.group_id,
      ${periodExpr}                                           AS period_start,
      ANY_VALUE(m.market)                                     AS market,
      ANY_VALUE(m.city_name)                                  AS city_name,
      ANY_VALUE(m.analyst_name)                               AS analyst_name,
      SUM(m.days)                                             AS days,
      SUM(m.rental_revenue)                                   AS rental_revenue,
      SUM(m.rental_revenue_goal)                              AS rental_revenue_goal,
      SUM(m.rental_revenue_stly)                              AS rental_revenue_stly,
      SUM(m.rental_revenue_ly)                                AS rental_revenue_ly,
      SUM(m.total_revenue)                                    AS total_revenue,
      SUM(m.total_revenue_stly)                               AS total_revenue_stly,
      SUM(m.total_revenue_ly)                                 AS total_revenue_ly,
      SUM(m.booked_unit_nights)                               AS booked_unit_nights,
      SUM(m.booked_unit_nights_ly)                            AS booked_unit_nights_ly,
      -- Unit blocks beyond what combined bookings explain = owner/maintenance blocks.
      SUM(GREATEST(m.unit_blocked - m.combined_unit_nights, 0)) AS owner_blocked,
      AVG(m.market_occupancy_pct)                             AS market_occupancy_pct,
      AVG(m.market_occupancy_pct_stly)                        AS market_occupancy_pct_stly,
      AVG(m.market_adr)                                       AS market_adr,
      AVG(m.market_adr_stly)                                  AS market_adr_stly,
      AVG(m.market_revpar)                                    AS market_revpar,
      SUM(m.available_bookable_potential_revenue)             AS available_bookable_potential_revenue,
      SUM(m.pickup_7d)                                        AS pickup_7d,
      SUM(m.pickup_8_14d)                                     AS pickup_8_14d,
      SUM(m.pickup_15_30d)                                    AS pickup_15_30d,
      SUM(m.pickup_31_60d)                                    AS pickup_31_60d,
      MAX(m.last_booked_date)                                 AS last_booked_date,
      AVG(m.avg_los)                                          AS avg_los,
      AVG(m.avg_booking_window)                               AS avg_booking_window
    FROM pg_month m
    GROUP BY m.group_id, period_start
  ),
  pg_calc AS (
    SELECT
      p.*,
      meta.property_name,
      meta.client_name,
      meta.unit_count,
      meta.bedroom_count,
      meta.unit_count * p.days                                AS capacity_unit_nights,
      meta.unit_count * p.days - p.owner_blocked              AS available_unit_nights
    FROM pg_period p
    JOIN pg_meta meta USING (group_id)
  ),
  prop_rows AS (
    SELECT
      TRUE                                                    AS is_property,
      group_id                                                AS property_id,
      property_name,
      'property'                                              AS property_role,
      property_name                                           AS listing_name,
      CONCAT('${PROPERTY_PREFIX}', group_id)                  AS listing_id,
      unit_count,
      bedroom_count,
      market,
      city_name,
      client_name,
      analyst_name,
      period_start                                            AS report_month,
      ${labelExpr}                                            AS month_label,
      ${keyExpr}                                              AS month_key,
      last_booked_date,

      rental_revenue_goal,
      ROUND(SAFE_DIVIDE(rental_revenue, NULLIF(rental_revenue_goal, 0)) * 100, 1) AS pct_to_goal,
      rental_revenue,
      rental_revenue_stly,
      rental_revenue_ly,
      total_revenue,
      total_revenue_stly,
      total_revenue_ly,
      ROUND(SAFE_DIVIDE(rental_revenue - rental_revenue_stly, rental_revenue_stly) * 100, 1) AS revenue_vs_stly_pct,
      ROUND(SAFE_DIVIDE(rental_revenue - rental_revenue_ly,   rental_revenue_ly)   * 100, 1) AS revenue_vs_ly_pct,

      ROUND(SAFE_DIVIDE(booked_unit_nights, NULLIF(available_unit_nights, 0)) * 100, 1)   AS occupancy_pct,
      CAST(NULL AS FLOAT64)                                   AS occupancy_pct_stly,
      ROUND(SAFE_DIVIDE(booked_unit_nights_ly, NULLIF(capacity_unit_nights, 0)) * 100, 1) AS occupancy_pct_ly,
      market_occupancy_pct,
      market_occupancy_pct_stly,
      CAST(NULL AS FLOAT64)                                   AS occ_vs_stly_pct,
      ROUND(SAFE_DIVIDE(booked_unit_nights, NULLIF(available_unit_nights, 0)) * 100 - market_occupancy_pct, 2) AS occ_vs_market,

      ROUND(SAFE_DIVIDE(rental_revenue, NULLIF(booked_unit_nights, 0)), 2)                AS rental_adr,
      CAST(NULL AS FLOAT64)                                   AS adr_stly,
      ROUND(SAFE_DIVIDE(rental_revenue_ly, NULLIF(booked_unit_nights_ly, 0)), 2)          AS adr_ly,
      market_adr,
      market_adr_stly,
      ROUND(SAFE_DIVIDE(SAFE_DIVIDE(rental_revenue, NULLIF(booked_unit_nights, 0)) - market_adr, market_adr) * 100, 1) AS adr_vs_market_pct,
      ROUND(SAFE_DIVIDE(SAFE_DIVIDE(rental_revenue, NULLIF(booked_unit_nights, 0)), market_adr), 2)                    AS adr_index,

      ROUND(SAFE_DIVIDE(rental_revenue, NULLIF(available_unit_nights, 0)), 2)             AS rental_revpar,
      ROUND(SAFE_DIVIDE(rental_revenue_stly, NULLIF(capacity_unit_nights, 0)), 2)         AS revpar_stly,
      ROUND(SAFE_DIVIDE(rental_revenue_ly, NULLIF(capacity_unit_nights, 0)), 2)           AS revpar_ly,
      market_revpar,
      ROUND(SAFE_DIVIDE(
        SAFE_DIVIDE(rental_revenue, NULLIF(available_unit_nights, 0)) - SAFE_DIVIDE(rental_revenue_stly, NULLIF(capacity_unit_nights, 0)),
        SAFE_DIVIDE(rental_revenue_stly, NULLIF(capacity_unit_nights, 0))) * 100, 1)       AS revpar_vs_stly_pct,
      ROUND(SAFE_DIVIDE(SAFE_DIVIDE(rental_revenue, NULLIF(available_unit_nights, 0)), market_revpar), 2) AS revpar_index,

      available_bookable_potential_revenue,
      -- Only owner blocks count as lost revenue; cross-blocks were sold.
      ROUND(owner_blocked * SAFE_DIVIDE(rental_revenue, NULLIF(booked_unit_nights, 0)), 2) AS blocked_potential_revenue,

      booked_unit_nights                                      AS booked_nights,
      owner_blocked                                           AS blocked_nights,

      pickup_7d, pickup_8_14d, pickup_15_30d, pickup_31_60d,
      avg_los,
      avg_booking_window
    FROM pg_calc
  )`;
}

/**
 * SQL listing each property in scope with its members (for the filter and
 * for labelling member rows).
 */
export function propertyListSql({ clientWhere = 'TRUE' } = {}) {
  return `
    SELECT
      g.group_id                                   AS property_id,
      ANY_VALUE(g.property_name)                   AS property_name,
      ANY_VALUE(g.client_name)                     AS client_name,
      ARRAY_AGG(STRUCT(
        CAST(g.listing_id AS STRING) AS listing_id,
        d.listing_name               AS listing_name,
        g.member_role                AS member_role,
        g.units_covered              AS units_covered,
        d.no_of_bedrooms             AS bedroom_count
      ) ORDER BY g.member_role DESC, d.listing_name) AS members
    FROM (SELECT * FROM ${PROPERTY_GROUPS_TABLE} WHERE ${clientWhere}) g
    LEFT JOIN ${DIM_LISTINGS} d ON CAST(d.listing_id AS STRING) = CAST(g.listing_id AS STRING)
    GROUP BY g.group_id
    ORDER BY property_name`;
}

// ── Table availability ────────────────────────────────────────────────────
// The table is created separately (sql/app_property_groups.sql). Until it
// exists, every property feature quietly behaves as "no groups" instead of
// breaking the dashboard. The answer is cached per server instance.
let _tableCheck = { at: 0, exists: false };
const TABLE_CHECK_TTL_MS = 5 * 60 * 1000;

export async function propertyGroupsTableExists(bigquery) {
  if (_tableCheck.exists) return true;   // once it exists it stays
  if (Date.now() - _tableCheck.at < TABLE_CHECK_TTL_MS) return false;
  try {
    const [exists] = await bigquery.dataset('mira_app').table('app_property_groups').exists();
    _tableCheck = { at: Date.now(), exists };
  } catch (err) {
    console.error('[property-groups] table check failed:', err.message);
    _tableCheck = { at: Date.now(), exists: false };
  }
  return _tableCheck.exists;
}

// ── Suggestions ───────────────────────────────────────────────────────────
// Finds likely combined listings from names, for an admin to confirm:
//   "Harbor 101 & 102"   → units "Harbor 101" + "Harbor 102"
//   "Oak 10, 12, 14"     → three "Oak ##" units
//   "Elm Street Duplex"  → the other "Elm Street …" listings
// Combined listings that share units are merged into one property.
// Bedroom totals are compared as a confidence check, never as a filter.

const numberTokens = (name) => String(name).match(/\b\d{2,5}[A-Za-z]?\b/g) || [];
const firstWord    = (name) => String(name).trim().split(/\s+/)[0]?.toLowerCase() ?? '';
const isMultiName  = (name) => /[&,+]|\band\b/i.test(String(name));
const isDuplexName = (name) => /\bduplex\b/i.test(String(name));

/**
 * listings: [{ listing_id, listing_name, bedroom_count }] for ONE client,
 *           excluding listings already in a saved group.
 * Returns:  [{ key, property_name, members: [...], checks: [...] }]
 */
export function suggestPropertyGroups(listings) {
  const all = listings.map(l => ({
    ...l,
    listing_id: String(l.listing_id),
    nums:  numberTokens(l.listing_name),
    first: firstWord(l.listing_name),
  }));

  // 1. Find each combined listing's units.
  const candidates = [];
  for (const c of all) {
    let units = null;
    if (isMultiName(c.listing_name) && c.nums.length >= 2) {
      const matches = c.nums.map(n => all.filter(u =>
        u !== c && u.first === c.first && u.nums.length === 1 && u.nums[0] === n && !isMultiName(u.listing_name)));
      if (matches.every(m => m.length === 1)) units = matches.flat();
    } else if (isDuplexName(c.listing_name)) {
      const prefix = c.listing_name.replace(/\s*\bduplex\b.*$/i, '').trim().toLowerCase();
      if (prefix) {
        const found = all.filter(u => u !== c && !isDuplexName(u.listing_name)
          && u.listing_name.toLowerCase().startsWith(`${prefix} `));
        if (found.length >= 2) units = found;
      }
    }
    if (units) candidates.push({ combined: c, units });
  }

  // 2. Merge combined listings that share a unit (nested combinations).
  const merged = [];
  for (const cand of candidates) {
    const ids = new Set(cand.units.map(u => u.listing_id));
    const overlapping = merged.filter(g => [...g.unitIds].some(id => ids.has(id)));
    const target = overlapping[0] ?? { unitIds: new Set(), units: new Map(), combos: [] };
    for (const other of overlapping.slice(1)) {          // join groups bridged by this candidate
      other.unitIds.forEach(id => target.unitIds.add(id));
      other.units.forEach((u, id) => target.units.set(id, u));
      target.combos.push(...other.combos);
      merged.splice(merged.indexOf(other), 1);
    }
    cand.units.forEach(u => { target.unitIds.add(u.listing_id); target.units.set(u.listing_id, u); });
    target.combos.push(cand);
    if (!overlapping.length) merged.push(target);
  }

  // 3. Shape for the admin page.
  return merged.map(g => {
    const combos = [...g.combos].sort((a, b) => b.units.length - a.units.length);
    const units  = [...g.units.values()].sort((a, b) => a.listing_name.localeCompare(b.listing_name));
    return {
      key: combos.map(c => c.combined.listing_id).sort().join('+'),
      property_name: combos[0].combined.listing_name,
      members: [
        ...units.map(u => ({ listing_id: u.listing_id, listing_name: u.listing_name, bedroom_count: u.bedroom_count ?? null, member_role: 'unit', units_covered: null })),
        ...combos.map(c => ({ listing_id: c.combined.listing_id, listing_name: c.combined.listing_name, bedroom_count: c.combined.bedroom_count ?? null, member_role: 'combined', units_covered: c.units.length })),
      ],
      checks: combos.map(c => {
        const unitBedrooms = c.units.reduce((s, u) => s + (Number(u.bedroom_count) || 0), 0);
        return {
          listing_name: c.combined.listing_name,
          combined_bedrooms: c.combined.bedroom_count ?? null,
          unit_bedrooms: unitBedrooms,
          bedrooms_match: Number(c.combined.bedroom_count) === unitBedrooms,
        };
      }),
    };
  });
}

// ── Validation for saving a group ─────────────────────────────────────────
/** Returns an error message, or null when the group can be saved. */
export function validatePropertyGroup({ property_name, client_name, members }) {
  if (!String(property_name ?? '').trim()) return 'Property name is required.';
  if (!String(client_name ?? '').trim())   return 'Client is required.';
  if (!Array.isArray(members) || members.length < 2) return 'A property needs at least two listings.';
  const ids = members.map(m => String(m.listing_id ?? '').trim());
  if (ids.some(id => !id)) return 'Every member needs a listing.';
  if (new Set(ids).size !== ids.length) return 'A listing can only appear once in a property.';
  const units    = members.filter(m => m.member_role === 'unit');
  const combined = members.filter(m => m.member_role === 'combined');
  if (units.length + combined.length !== members.length) return 'Each listing must be a unit or a combined listing.';
  if (units.length < 2)   return 'A property needs at least two unit listings.';
  if (combined.length < 1) return 'A property needs at least one combined listing.';
  for (const c of combined) {
    const n = Number(c.units_covered);
    if (!Number.isInteger(n) || n < 2 || n > units.length) {
      return `Units covered must be between 2 and ${units.length}.`;
    }
  }
  return null;
}
