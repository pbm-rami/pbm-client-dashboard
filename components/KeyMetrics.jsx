'use client';

const fmt$ = (v) =>
  v == null ? '—' : '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtPct = (v, decimals = 1) =>
  v == null ? '—' : Number(v).toFixed(decimals) + '%';

const fmtIdx = (v) =>
  v == null ? '—' : Number(v).toFixed(2);

const fmtNum = (v) =>
  v == null ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 });

const fmtDate = (v) => {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return v; }
};

// Tooltip on hover for metric labels
function InfoTooltip({ text }) {
  return (
    <span className="relative group ml-1 cursor-help">
      <span className="text-slate-400 hover:text-white text-[10px]">ⓘ</span>
      <span className="absolute left-0 bottom-full mb-1 z-50 w-64 bg-[#1c1e22] border border-[#383b40] text-slate-300 text-[10px] rounded-lg px-3 py-2 shadow-xl leading-relaxed hidden group-hover:block">
        {text}
      </span>
    </span>
  );
}

function MetricRow({ label, value, valueClass = 'text-white', tooltip }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#383b40] last:border-0">
      <span className="text-slate-400 text-xs tracking-wider uppercase flex items-center">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </span>
      <span className={`text-sm font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}

function deltaClass(v) {
  if (v == null) return 'text-slate-400';
  return Number(v) >= 0 ? 'text-emerald-400' : 'text-red-400';
}

function fmtDelta(v, suffix = '%') {
  if (v == null) return '—';
  const n = Number(v);
  return (n >= 0 ? '+' : '') + n.toFixed(1) + suffix;
}

function SectionHeader({ title }) {
  return (
    <p className="text-[#e4cf8b] text-xs font-semibold tracking-widest mt-4 mb-1 pt-2 border-t border-[#383b40] first:border-0 first:pt-0 first:mt-0">
      {title}
    </p>
  );
}

export default function KeyMetrics({ portfolioData: p, listingData: l, mode = 'portfolio', listingName }) {
  const isListing = mode === 'listing' && l;

  if (!p && !l) {
    return (
      <div className="bg-[#2a2c30] border border-[#383b40] rounded-xl p-5 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Select a month to view metrics</p>
      </div>
    );
  }

  // Goal color for pct_to_goal
  const goalPct = isListing ? l?.pct_to_goal : p?.pct_to_goal;
  const goalColor = goalPct == null ? 'text-slate-400' : goalPct >= 100 ? 'text-emerald-400' : goalPct >= 85 ? 'text-yellow-400' : 'text-red-400';

  // ADR index color
  const adrIdx = isListing ? l?.adr_index : p?.avg_adr_index;
  const adrIdxColor = adrIdx == null ? 'text-slate-400' : Number(adrIdx) >= 100 ? 'text-emerald-400' : 'text-red-400';

  const revparIdx = isListing ? l?.revpar_index : p?.avg_revpar_index;
  const revparIdxColor = revparIdx == null ? 'text-slate-400' : Number(revparIdx) >= 100 ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="bg-[#2a2c30] border border-[#383b40] rounded-xl p-5">
      {/* Panel title */}
      <p className="text-[#e4cf8b] text-xs font-semibold tracking-widest mb-1">
        {isListing ? 'LISTING METRICS' : 'KEY METRICS'}
      </p>
      {isListing && (
        <p className="text-white font-bold text-base mb-3">{listingName}</p>
      )}

      {/* REVENUE */}
      <SectionHeader title="REVENUE" />
      <MetricRow
        label="Rental Revenue (Net)"
        value={fmt$(isListing ? l?.rental_revenue : p?.total_rental_revenue)}
        tooltip="Nightly revenue excluding fees/taxes. Used for Goal Tracking."
      />
      <MetricRow
        label="Gross Revenue"
        value={fmt$(isListing ? l?.total_revenue : p?.total_revenue)}
        tooltip="Rental revenue + fees + taxes (excludes channel commissions)."
      />
      <MetricRow
        label="Revenue Goal"
        value={fmt$(isListing ? l?.rental_revenue_goal : p?.total_revenue_goal)}
        tooltip="The target rental revenue your property could generate. It is the product of your Average Daily Rate (ADR) and booked nights."
      />
      <MetricRow
        label="% to Goal"
        value={fmtPct(goalPct)}
        valueClass={goalColor}
        tooltip="Progress toward the revenue goal shown as a percentage."
      />
      <MetricRow
        label="Revenue vs LY"
        value={fmtDelta(isListing ? l?.revenue_vs_ly_pct : p?.rental_revenue_vs_ly_pct)}
        valueClass={deltaClass(isListing ? l?.revenue_vs_ly_pct : p?.rental_revenue_vs_ly_pct)}
        tooltip="Comparison of current rental revenue against the same period last year (LY), showing revenue growth or decline as a percentage or dollar value."
      />
      <MetricRow
        label="Revenue vs STLY"
        value={fmtDelta(isListing ? l?.revenue_vs_stly_pct : p?.rental_revenue_vs_stly_pct)}
        valueClass={deltaClass(isListing ? l?.revenue_vs_stly_pct : p?.rental_revenue_vs_stly_pct)}
        tooltip="Comparison of current rental revenue versus the Same Time Last Year (STLY) booking pace, measuring how revenue is performing relative to where it stood at the same point before arrival dates."
      />

      {/* OCCUPANCY */}
      <SectionHeader title="OCCUPANCY & RATES" />
      <MetricRow
        label="Occupancy"
        value={fmtPct(isListing ? l?.occupancy_pct : p?.avg_occupancy_pct)}
        tooltip="The percentage of available nights that were booked during the selected time period."
      />
      <MetricRow
        label="Occ vs STLY"
        value={fmtDelta(isListing ? l?.occ_vs_stly_pct : p?.occ_vs_stly_pct)}
        valueClass={deltaClass(isListing ? l?.occ_vs_stly_pct : p?.occ_vs_stly_pct)}
        tooltip="Comparison of current occupancy against occupancy at the Same Time Last Year, helping evaluate booking pace relative to prior-year performance."
      />
      <MetricRow
        label="Occ vs Market"
        value={fmtDelta(isListing ? l?.occ_vs_market : p?.avg_occ_vs_market, 'pp')}
        valueClass={deltaClass(isListing ? l?.occ_vs_market : p?.avg_occ_vs_market)}
        tooltip="Comparison of your property's occupancy rate against the occupancy rate of your selected market or competitive set."
      />
      <MetricRow
        label="Market Occ"
        value={fmtPct(isListing ? l?.market_occupancy_pct : p?.avg_market_occupancy_pct)}
        valueClass="text-slate-300"
        tooltip="Average occupancy rate of your selected market or competitive set during the selected time period."
      />
      <MetricRow
        label="ADR"
        value={fmt$(isListing ? l?.rental_adr : p?.avg_adr)}
        tooltip="The average rental revenue earned per booked night during the selected period. Calculated as Revenue ÷ Length of Stay."
      />
      <MetricRow
        label="ADR vs Market"
        value={fmtDelta(isListing ? l?.adr_vs_market_pct : p?.adr_vs_market_pct)}
        valueClass={deltaClass(isListing ? l?.adr_vs_market_pct : p?.adr_vs_market_pct)}
        tooltip="Comparison of your property's Average Daily Rate (ADR) against the market ADR, indicating whether rates are positioned above or below competitors."
      />
      <MetricRow
        label="Market ADR"
        value={fmt$(isListing ? l?.market_adr : p?.avg_market_adr)}
        valueClass="text-slate-300"
        tooltip="Average Daily Rate (ADR) achieved by the selected market or competitive set for the chosen period."
      />
      <MetricRow
        label="ADR Index"
        value={fmtIdx(adrIdx)}
        valueClass={adrIdxColor}
        tooltip="Measures how your ADR compares to the market. Calculated as (Rental ADR ÷ Market ADR) × 100. Above 100 means your ADR exceeds the market average; below 100 means it trails."
      />
      <MetricRow
        label="RevPAR"
        value={fmt$(isListing ? l?.rental_revpar : p?.avg_revpar)}
        tooltip="Revenue generated per available night in the selected period, combining occupancy and pricing performance. Calculated as ADR × Occupancy."
      />
      <MetricRow
        label="RevPAR vs STLY"
        value={fmtDelta(isListing ? l?.revpar_vs_stly_pct : p?.revpar_vs_stly_pct)}
        valueClass={deltaClass(isListing ? l?.revpar_vs_stly_pct : p?.revpar_vs_stly_pct)}
        tooltip="Comparison of current RevPAR versus the Same Time Last Year (STLY) booking pace, measuring how overall revenue performance compares relative to prior-year pacing."
      />
      <MetricRow
        label="RevPAR vs Market"
        value={fmtDelta(isListing ? null : p?.revpar_vs_market_pct)}
        valueClass={deltaClass(isListing ? null : p?.revpar_vs_market_pct)}
        tooltip="Comparison of your property's RevPAR against the market RevPAR, indicating overall revenue performance relative to competitors."
      />
      <MetricRow
        label="Market RevPAR"
        value={fmt$(isListing ? l?.market_revpar : p?.avg_market_revpar)}
        valueClass="text-slate-300"
        tooltip="The market's Revenue Per Available Room (RevPAR) used to benchmark your performance against your selected competitive set."
      />
      <MetricRow
        label="RevPAR Index"
        value={fmtIdx(revparIdx)}
        valueClass={revparIdxColor}
        tooltip="Measures how your RevPAR compares to the market. Calculated as (Rental RevPAR ÷ Market RevPAR) × 100. Above 100 means your property is outperforming the market; below 100 means performance trails the market average."
      />

      {/* INVENTORY */}
      <SectionHeader title="INVENTORY" />
      <MetricRow
        label="Blocked Nights"
        value={fmtNum(isListing ? l?.blocked_nights : p?.total_blocked_nights)}
        tooltip="Total number of nights unavailable for booking due to owner stays, maintenance, operational holds, or manually blocked dates."
      />
      {isListing && (
        <MetricRow label="Last Booked" value={fmtDate(l?.last_booked_date)} valueClass="text-slate-300" />
      )}
      <MetricRow
        label="Potential Lost"
        value={fmt$(isListing ? l?.potential_revenue_lost : p?.total_potential_revenue_lost)}
        valueClass="text-red-400"
        tooltip="Estimated rental revenue opportunity lost due to blocked nights or unavailable inventory, calculated based on expected occupancy and projected ADR for those dates."
      />

      <p className="text-slate-600 text-xs mt-4 pt-3 border-t border-[#383b40]">
        Net excludes fees &amp; taxes. Gross used for target comparison.
      </p>
    </div>
  );
}
