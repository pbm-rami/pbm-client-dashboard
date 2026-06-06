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
      <span className="text-slate-600 hover:text-slate-400 text-[10px]">ⓘ</span>
      <span className="absolute left-0 bottom-full mb-1 z-50 w-52 bg-[#1c1e22] border border-[#383b40] text-slate-300 text-[10px] rounded-lg px-3 py-2 shadow-xl leading-relaxed hidden group-hover:block">
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
        tooltip="Net rental income received after deducting OTA/channel commissions and cleaning fees. This is the amount paid out to the property owner."
      />
      <MetricRow
        label="Gross Revenue"
        value={fmt$(isListing ? l?.total_revenue : p?.total_revenue)}
        tooltip="Total revenue collected from guests including rental income, cleaning fees, and any additional charges before deductions. Used for goal tracking."
      />
      <MetricRow label="Revenue Goal" value={fmt$(isListing ? l?.rental_revenue_goal : p?.total_revenue_goal)} />
      <MetricRow
        label="% to Goal"
        value={fmtPct(goalPct)}
        valueClass={goalColor}
      />
      <MetricRow
        label="Revenue vs LY"
        value={fmtDelta(isListing ? l?.revenue_vs_ly_pct : p?.rental_revenue_vs_ly_pct)}
        valueClass={deltaClass(isListing ? l?.revenue_vs_ly_pct : p?.rental_revenue_vs_ly_pct)}
      />
      <MetricRow
        label="Revenue vs STLY"
        value={fmtDelta(isListing ? l?.revenue_vs_stly_pct : p?.rental_revenue_vs_stly_pct)}
        valueClass={deltaClass(isListing ? l?.revenue_vs_stly_pct : p?.rental_revenue_vs_stly_pct)}
      />

      {/* OCCUPANCY */}
      <SectionHeader title="OCCUPANCY & RATES" />
      <MetricRow label="Occupancy" value={fmtPct(isListing ? l?.occupancy_pct : p?.avg_occupancy_pct)} />
      <MetricRow
        label="Occ vs STLY"
        value={fmtDelta(isListing ? l?.occ_vs_stly_pct : p?.occ_vs_stly_pct)}
        valueClass={deltaClass(isListing ? l?.occ_vs_stly_pct : p?.occ_vs_stly_pct)}
      />
      <MetricRow
        label="Occ vs Market"
        value={fmtDelta(isListing ? l?.occ_vs_market : p?.avg_occ_vs_market, 'pp')}
        valueClass={deltaClass(isListing ? l?.occ_vs_market : p?.avg_occ_vs_market)}
      />
      <MetricRow label="Market Occ" value={fmtPct(isListing ? l?.market_occupancy_pct : p?.avg_market_occupancy_pct)} valueClass="text-slate-300" />
      <MetricRow label="ADR" value={fmt$(isListing ? l?.rental_adr : p?.avg_adr)} />
      <MetricRow
        label="ADR vs Market"
        value={fmtDelta(isListing ? l?.adr_vs_market_pct : p?.adr_vs_market_pct)}
        valueClass={deltaClass(isListing ? l?.adr_vs_market_pct : p?.adr_vs_market_pct)}
      />
      <MetricRow label="Market ADR" value={fmt$(isListing ? l?.market_adr : p?.avg_market_adr)} valueClass="text-slate-300" />
      <MetricRow label="ADR Index" value={fmtIdx(adrIdx)} valueClass={adrIdxColor} />
      <MetricRow label="RevPAR" value={fmt$(isListing ? l?.rental_revpar : p?.avg_revpar)} />
      <MetricRow
        label="RevPAR vs STLY"
        value={fmtDelta(isListing ? l?.revpar_vs_stly_pct : p?.revpar_vs_stly_pct)}
        valueClass={deltaClass(isListing ? l?.revpar_vs_stly_pct : p?.revpar_vs_stly_pct)}
      />
      <MetricRow
        label="RevPAR vs Market"
        value={fmtDelta(isListing ? null : p?.revpar_vs_market_pct)}
        valueClass={deltaClass(isListing ? null : p?.revpar_vs_market_pct)}
      />
      <MetricRow label="Market RevPAR" value={fmt$(isListing ? l?.market_revpar : p?.avg_market_revpar)} valueClass="text-slate-300" />
      <MetricRow label="RevPAR Index" value={fmtIdx(revparIdx)} valueClass={revparIdxColor} />

      {/* INVENTORY */}
      <SectionHeader title="INVENTORY" />
      <MetricRow label="Blocked Nights" value={fmtNum(isListing ? l?.blocked_nights : p?.total_blocked_nights)} />
      {isListing && (
        <MetricRow label="Last Booked" value={fmtDate(l?.last_booked_date)} valueClass="text-slate-300" />
      )}
      <MetricRow
        label="Potential Lost"
        value={fmt$(isListing ? l?.potential_revenue_lost : p?.total_potential_revenue_lost)}
        valueClass="text-red-400"
      />

      <p className="text-slate-600 text-xs mt-4 pt-3 border-t border-[#383b40]">
        Net excludes fees &amp; taxes. Gross used for target comparison.
      </p>
    </div>
  );
}
