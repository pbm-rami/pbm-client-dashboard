'use client';

import { useState } from 'react';

// ─── Formatters ──────────────────────────────────────────────
const fmt$ = (v) => v == null ? '—' : '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtPct = (v) => v == null ? '—' : Number(v).toFixed(1) + '%';
const fmtDate = (v) => {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return v; }
};

// ─── Table building blocks ────────────────────────────────────
function GroupHeader({ label, colSpan }) {
  return (
    <th
      colSpan={colSpan}
      className="text-center py-1.5 px-3 text-[10px] font-bold tracking-widest text-[#e4cf8b] border-b border-[#383b40] border-r border-r-[#4a4e55]"
    >
      {label}
    </th>
  );
}

function ColHeader({ label, align = 'right' }) {
  return (
    <th className={`py-2 px-3 text-${align} text-[10px] tracking-wide text-slate-400 whitespace-nowrap`}>
      {label}
    </th>
  );
}

// ─── Main component ───────────────────────────────────────────
export default function ListingPerformanceTable({ data, allMonthsData }) {
  const [showAllMonths, setShowAllMonths] = useState(false);

  // Active dataset: all months or current month
  const activeData = showAllMonths ? (allMonthsData || []) : (data || []);

  if (!activeData || activeData.length === 0) {
    return (
      <div className="bg-[#2a2c30] border border-[#383b40] rounded-xl p-6">
        <h2 className="text-[#e4cf8b] text-sm font-semibold tracking-widest mb-2">LISTING PERFORMANCE</h2>
        <p className="text-slate-500 text-sm">No data for the selected filters.</p>
      </div>
    );
  }

  // ── Totals helpers ────────────────────────────────────────
  const sum = (field) => activeData.reduce((s, r) => s + (Number(r[field]) || 0), 0);
  const avg = (field) => {
    const vals = activeData.filter(r => r[field] != null && !isNaN(r[field]));
    return vals.length ? vals.reduce((s, r) => s + Number(r[field]), 0) / vals.length : null;
  };

  return (
    <div className="bg-[#2a2c30] border border-[#383b40] rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
        <h2 className="text-[#e4cf8b] text-sm font-semibold tracking-widest">LISTING PERFORMANCE</h2>
        {/* Toggle: Current Month ↔ All Months */}
        <div className="flex items-center self-start sm:self-auto bg-[#212327] border border-[#383b40] rounded-lg p-0.5 text-xs">
          <button
            onClick={() => setShowAllMonths(false)}
            className={`px-3 py-1 rounded-md transition-colors ${!showAllMonths ? 'bg-[#383b40] text-white' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Current Month
          </button>
          <button
            onClick={() => setShowAllMonths(true)}
            className={`px-3 py-1 rounded-md transition-colors ${showAllMonths ? 'bg-[#383b40] text-white' : 'text-slate-500 hover:text-slate-300'}`}
          >
            All Months
          </button>
        </div>
      </div>
      <p className="text-slate-500 text-xs mb-4">
        {showAllMonths
          ? 'All months by listing · scroll right for all columns'
          : 'Full per-listing breakdown for the selected month · scroll right for all columns'}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">

          {/* ── Group header row ─────────────────────────────── */}
          <thead>
            <tr className="bg-[#1c1e22]">
              {/* Listing — sticky */}
              <th className="text-left py-1.5 px-3 text-[10px] font-bold tracking-widest text-[#e4cf8b] border-b border-[#383b40] border-r border-r-[#4a4e55] sticky left-0 bg-[#1c1e22] z-10 whitespace-nowrap">
                LISTING
              </th>

              {/* DATE: 2 cols — Last Booked Date + Year & Month */}
              <GroupHeader label="DATE" colSpan={2} />

              {/* REVENUE: 7 cols — Goal | Net Current/STLY/LY | Gross Current/STLY/LY */}
              <GroupHeader label="REVENUE" colSpan={7} />

              {/* OCCUPANCY: 6 cols — Current / STLY / LY | Market Current / STLY / LY */}
              <GroupHeader label="OCCUPANCY" colSpan={6} />

              {/* ADR: 6 cols — Rental Current / STLY / LY | Market Current / STLY / LY */}
              <GroupHeader label="ADR" colSpan={6} />

              {/* REVPAR: 3 cols — Current/STLY/LY */}
              <GroupHeader label="REVPAR" colSpan={3} />

              {/* POTENTIAL REVENUE: 3 cols — Available / Unbookable / Blocked */}
              <GroupHeader label="POTENTIAL REVENUE" colSpan={3} />

              {/* PICKUP: 5 cols — Nights 30D* | Rev 7D/8-14D/15-30D/31-60D */}
              <GroupHeader label="PICKUP" colSpan={5} />
            </tr>

            {/* ── Column label row ──────────────────────────── */}
            <tr className="border-b border-[#383b40] bg-[#212327]">
              {/* Listing — sticky */}
              <th className="text-left py-2 px-3 text-[10px] tracking-wide text-slate-400 sticky left-0 bg-[#212327] z-10 whitespace-nowrap">
                NAME
              </th>

              {/* DATE */}
              <ColHeader label="LAST BOOKED" />
              <ColHeader label="YEAR & MONTH" />

              {/* REVENUE */}
              <ColHeader label="GOAL" />
              <ColHeader label="RENTAL REV" />
              <ColHeader label="RENTAL STLY" />
              <ColHeader label="RENTAL LY" />
              <ColHeader label="TOTAL REV" />
              <ColHeader label="TOTAL STLY" />
              <ColHeader label="TOTAL LY" />

              {/* OCCUPANCY */}
              <ColHeader label="OCC %" />
              <ColHeader label="OCC STLY" />
              <ColHeader label="OCC LY" />
              <ColHeader label="MKT OCC" />
              <ColHeader label="MKT STLY" />
              <ColHeader label="MKT LY" />

              {/* ADR */}
              <ColHeader label="RENTAL ADR" />
              <ColHeader label="ADR STLY" />
              <ColHeader label="ADR LY" />
              <ColHeader label="MKT ADR" />
              <ColHeader label="MKT STLY" />
              <ColHeader label="MKT LY" />

              {/* REVPAR */}
              <ColHeader label="RENTAL REVPAR" />
              <ColHeader label="REVPAR STLY" />
              <ColHeader label="REVPAR LY" />

              {/* POTENTIAL REVENUE */}
              <ColHeader label="AVAIL & BOOKABLE" />
              <ColHeader label="UNBOOKABLE" />
              <ColHeader label="BLOCKED" />

              {/* PICKUP */}
              <ColHeader label="NTS 30D" />
              <ColHeader label="REV 7D" />
              <ColHeader label="REV 8-14D" />
              <ColHeader label="REV 15-30D" />
              <ColHeader label="REV 31-60D" />
            </tr>
          </thead>

          {/* ── Data rows ─────────────────────────────────────── */}
          <tbody>
            {activeData.map((row, i) => (
              <tr
                key={i}
                className="border-b border-[#383b40] hover:bg-[#32353a] transition-colors"
              >
                {/* Listing name — sticky */}
                <td className="py-2.5 px-3 text-white font-medium text-xs sticky left-0 bg-[#2a2c30] z-10 whitespace-nowrap hover:bg-[#32353a]">
                  {row.listing_name}
                </td>

                {/* DATE */}
                <td className="py-2.5 px-3 text-right text-slate-300 text-xs whitespace-nowrap">{fmtDate(row.last_booked_date)}</td>
                <td className="py-2.5 px-3 text-right text-slate-400 text-xs whitespace-nowrap">{row.month_label ?? '—'}</td>

                {/* REVENUE */}
                <td className="py-2.5 px-3 text-right text-[#e4cf8b] text-xs">{fmt$(row.rental_revenue_goal)}</td>
                <td className="py-2.5 px-3 text-right text-white font-semibold text-xs">{fmt$(row.rental_revenue)}</td>
                <td className="py-2.5 px-3 text-right text-slate-300 text-xs">{fmt$(row.rental_revenue_stly)}</td>
                <td className="py-2.5 px-3 text-right text-slate-400 text-xs">{fmt$(row.rental_revenue_ly)}</td>
                <td className="py-2.5 px-3 text-right text-slate-300 text-xs">{fmt$(row.total_revenue)}</td>
                <td className="py-2.5 px-3 text-right text-slate-400 text-xs">{fmt$(row.total_revenue_stly)}</td>
                <td className="py-2.5 px-3 text-right text-slate-400 text-xs">{fmt$(row.total_revenue_ly)}</td>

                {/* OCCUPANCY */}
                <td className="py-2.5 px-3 text-right text-slate-200 text-xs">{fmtPct(row.occupancy_pct)}</td>
                <td className="py-2.5 px-3 text-right text-slate-300 text-xs">{fmtPct(row.occupancy_pct_stly)}</td>
                <td className="py-2.5 px-3 text-right text-slate-400 text-xs">{fmtPct(row.occupancy_pct_ly)}</td>
                <td className="py-2.5 px-3 text-right text-slate-400 text-xs">{fmtPct(row.market_occupancy_pct)}</td>
                <td className="py-2.5 px-3 text-right text-slate-400 text-xs">{fmtPct(row.market_occupancy_pct_stly)}</td>
                {/* Market Occ LY — not yet in Monthly Perf Dashboard source */}
                <td className="py-2.5 px-3 text-right text-slate-600 text-xs">—</td>

                {/* ADR */}
                <td className="py-2.5 px-3 text-right text-slate-200 text-xs">{fmt$(row.rental_adr)}</td>
                <td className="py-2.5 px-3 text-right text-slate-300 text-xs">{fmt$(row.adr_stly)}</td>
                <td className="py-2.5 px-3 text-right text-slate-400 text-xs">{fmt$(row.adr_ly)}</td>
                <td className="py-2.5 px-3 text-right text-slate-400 text-xs">{fmt$(row.market_adr)}</td>
                <td className="py-2.5 px-3 text-right text-slate-400 text-xs">{fmt$(row.market_adr_stly)}</td>
                {/* Market ADR LY — not yet confirmed in Monthly Perf Dashboard source */}
                <td className="py-2.5 px-3 text-right text-slate-600 text-xs">—</td>

                {/* REVPAR */}
                <td className="py-2.5 px-3 text-right text-slate-200 text-xs">{fmt$(row.rental_revpar)}</td>
                <td className="py-2.5 px-3 text-right text-slate-300 text-xs">{fmt$(row.revpar_stly)}</td>
                <td className="py-2.5 px-3 text-right text-slate-400 text-xs">{fmt$(row.revpar_ly)}</td>

                {/* POTENTIAL REVENUE */}
                <td className="py-2.5 px-3 text-right text-[#e4cf8b] text-xs">{fmt$(row.available_bookable_potential_revenue)}</td>
                {/* Unbookable Potential Revenue — not yet in Monthly Perf Dashboard source */}
                <td className="py-2.5 px-3 text-right text-slate-600 text-xs">—</td>
                <td className="py-2.5 px-3 text-right text-red-400 font-semibold text-xs">
                  {fmt$(row.blocked_potential_revenue ?? row.potential_revenue_lost)}
                </td>

                {/* PICKUP */}
                {/* Booked Nights 30D count — not yet in PriceLabs sync */}
                <td className="py-2.5 px-3 text-right text-slate-600 text-xs">—</td>
                <td className="py-2.5 px-3 text-right text-[#e4cf8b] text-xs">{fmt$(row.pickup_7d)}</td>
                <td className="py-2.5 px-3 text-right text-[#e4cf8b] text-xs">{fmt$(row.pickup_8_14d)}</td>
                <td className="py-2.5 px-3 text-right text-[#e4cf8b] text-xs">{fmt$(row.pickup_15_30d)}</td>
                <td className="py-2.5 px-3 text-right text-[#e4cf8b] text-xs">{fmt$(row.pickup_31_60d)}</td>
              </tr>
            ))}
          </tbody>

          {/* ── Totals / Averages row ─────────────────────────── */}
          <tfoot>
            <tr className="border-t-2 border-[#4a4e55] bg-[#1c1e22] font-semibold">
              <td className="py-3 px-3 text-[#e4cf8b] text-xs font-bold tracking-wider sticky left-0 bg-[#1c1e22] z-10">
                TOTALS / AVG
              </td>

              {/* DATE */}
              <td className="py-3 px-3 text-right text-slate-600 text-xs">—</td>
              <td className="py-3 px-3 text-right text-slate-600 text-xs">—</td>

              {/* REVENUE totals */}
              <td className="py-3 px-3 text-right text-[#e4cf8b] text-xs">{fmt$(sum('rental_revenue_goal'))}</td>
              <td className="py-3 px-3 text-right text-white text-xs">{fmt$(sum('rental_revenue'))}</td>
              <td className="py-3 px-3 text-right text-slate-300 text-xs">{fmt$(sum('rental_revenue_stly'))}</td>
              <td className="py-3 px-3 text-right text-slate-400 text-xs">{fmt$(sum('rental_revenue_ly'))}</td>
              <td className="py-3 px-3 text-right text-slate-300 text-xs">{fmt$(sum('total_revenue'))}</td>
              <td className="py-3 px-3 text-right text-slate-400 text-xs">{fmt$(sum('total_revenue_stly'))}</td>
              <td className="py-3 px-3 text-right text-slate-400 text-xs">{fmt$(sum('total_revenue_ly'))}</td>

              {/* OCCUPANCY averages */}
              <td className="py-3 px-3 text-right text-slate-200 text-xs">{fmtPct(avg('occupancy_pct'))}</td>
              <td className="py-3 px-3 text-right text-slate-300 text-xs">{fmtPct(avg('occupancy_pct_stly'))}</td>
              <td className="py-3 px-3 text-right text-slate-400 text-xs">{fmtPct(avg('occupancy_pct_ly'))}</td>
              <td className="py-3 px-3 text-right text-slate-400 text-xs">{fmtPct(avg('market_occupancy_pct'))}</td>
              <td className="py-3 px-3 text-right text-slate-400 text-xs">{fmtPct(avg('market_occupancy_pct_stly'))}</td>
              <td className="py-3 px-3 text-right text-slate-600 text-xs">—</td>

              {/* ADR averages */}
              <td className="py-3 px-3 text-right text-slate-200 text-xs">{fmt$(avg('rental_adr'))}</td>
              <td className="py-3 px-3 text-right text-slate-300 text-xs">{fmt$(avg('adr_stly'))}</td>
              <td className="py-3 px-3 text-right text-slate-400 text-xs">{fmt$(avg('adr_ly'))}</td>
              <td className="py-3 px-3 text-right text-slate-400 text-xs">{fmt$(avg('market_adr'))}</td>
              <td className="py-3 px-3 text-right text-slate-400 text-xs">{fmt$(avg('market_adr_stly'))}</td>
              <td className="py-3 px-3 text-right text-slate-600 text-xs">—</td>

              {/* REVPAR averages */}
              <td className="py-3 px-3 text-right text-slate-200 text-xs">{fmt$(avg('rental_revpar'))}</td>
              <td className="py-3 px-3 text-right text-slate-300 text-xs">{fmt$(avg('revpar_stly'))}</td>
              <td className="py-3 px-3 text-right text-slate-400 text-xs">{fmt$(avg('revpar_ly'))}</td>

              {/* POTENTIAL REVENUE totals */}
              <td className="py-3 px-3 text-right text-[#e4cf8b] text-xs">{fmt$(sum('available_bookable_potential_revenue'))}</td>
              <td className="py-3 px-3 text-right text-slate-600 text-xs">—</td>
              <td className="py-3 px-3 text-right text-red-400 text-xs">
                {fmt$(sum('blocked_potential_revenue') || sum('potential_revenue_lost'))}
              </td>

              {/* PICKUP totals */}
              <td className="py-3 px-3 text-right text-slate-600 text-xs">—</td>
              <td className="py-3 px-3 text-right text-[#e4cf8b] text-xs">{fmt$(sum('pickup_7d'))}</td>
              <td className="py-3 px-3 text-right text-[#e4cf8b] text-xs">{fmt$(sum('pickup_8_14d'))}</td>
              <td className="py-3 px-3 text-right text-[#e4cf8b] text-xs">{fmt$(sum('pickup_15_30d'))}</td>
              <td className="py-3 px-3 text-right text-[#e4cf8b] text-xs">{fmt$(sum('pickup_31_60d'))}</td>
            </tr>
          </tfoot>

        </table>
      </div>

      {/* ── Data gap note ────────────────────────────────────── */}
      <p className="text-slate-600 text-[10px] mt-4 leading-relaxed">
        <span className="text-slate-500 font-semibold">Showing — :</span>{' '}
        Market Occ LY · Market ADR LY · Unbookable Potential Revenue · Booked Nights Pickup 30D
        — not yet available in the Monthly Performance Dashboard report.
      </p>
    </div>
  );
}
