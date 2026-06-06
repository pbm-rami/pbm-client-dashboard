'use client';

const fmt$ = (v) => v == null ? '—' : '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtPct = (v) => v == null ? '—' : Number(v).toFixed(1) + '%';
const fmtNum = (v) => v == null ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtDate = (v) => {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return v; }
};

function GoalBadge({ pct }) {
  if (pct == null) return <span className="text-slate-500">—</span>;
  const color = pct >= 100 ? 'bg-emerald-900 text-emerald-400' : pct >= 85 ? 'bg-yellow-900 text-yellow-400' : 'bg-red-900 text-red-400';
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${color}`}>{fmtPct(pct)}</span>;
}

export default function ListingsTable({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-[#2a2c30] border border-[#383b40] rounded-xl p-6 mb-6">
        <h2 className="text-[#e4cf8b] text-sm font-semibold tracking-widest mb-4">LISTING DETAIL</h2>
        <p className="text-slate-500 text-sm">No listing data for the selected filters.</p>
      </div>
    );
  }

  // Totals for the performance section
  const totalBlockedNights    = data.reduce((s, r) => s + (Number(r.blocked_nights)          || 0), 0);
  const totalPotentialLost    = data.reduce((s, r) => s + (Number(r.potential_revenue_lost)   || 0), 0);
  const totalBookedRevenue    = data.reduce((s, r) => s + (Number(r.rental_revenue)            || 0), 0);
  const totalBookedNights     = data.reduce((s, r) => s + (Number(r.booked_nights)             || 0), 0);

  return (
    <div className="flex flex-col gap-6 mb-6">

      {/* ── Table 1: Listing Detail ─────────────────────────────── */}
      <div className="bg-[#2a2c30] border border-[#383b40] rounded-xl p-6">
        <h2 className="text-[#e4cf8b] text-sm font-semibold tracking-widest mb-4">LISTING DETAIL</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#383b40] text-slate-400 text-xs tracking-wider">
                <th className="text-left py-2 pr-4">LISTING</th>
                <th className="text-center py-2 px-2">BR</th>
                <th className="text-right py-2 px-3">NET REV</th>
                <th className="text-center py-2 px-3">GOAL %</th>
                <th className="text-right py-2 px-3">OCC</th>
                <th className="text-right py-2 px-3">ADR</th>
                <th className="text-right py-2 px-3">REVPAR</th>
                <th className="text-right py-2 px-3">VS STLY</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => {
                const vsStly = row.revenue_vs_stly_pct;
                const vsColor = vsStly == null ? 'text-slate-400' : vsStly >= 0 ? 'text-emerald-400' : 'text-red-400';
                return (
                  <tr key={i} className="border-b border-[#383b40] hover:bg-[#20203a] transition-colors">
                    <td className="py-3 pr-4 text-white font-medium">{row.listing_name}</td>
                    <td className="py-3 px-2 text-center text-slate-300">{row.bedroom_count ?? '—'}</td>
                    <td className="py-3 px-3 text-right text-white font-semibold">{fmt$(row.rental_revenue)}</td>
                    <td className="py-3 px-3 text-center"><GoalBadge pct={row.pct_to_goal} /></td>
                    <td className="py-3 px-3 text-right text-slate-200">{fmtPct(row.occupancy_pct)}</td>
                    <td className="py-3 px-3 text-right text-slate-200">{fmt$(row.rental_adr)}</td>
                    <td className="py-3 px-3 text-right text-slate-200">{fmt$(row.rental_revpar)}</td>
                    <td className={`py-3 px-3 text-right text-sm ${vsColor}`}>
                      {vsStly != null ? (vsStly >= 0 ? '+' : '') + fmtPct(vsStly) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Table 2: Listing Performance (Blocked / Last Booked / Lost Rev) */}
      <div className="bg-[#2a2c30] border border-[#383b40] rounded-xl p-6">
        <h2 className="text-[#e4cf8b] text-sm font-semibold tracking-widest mb-1">LISTING PERFORMANCE</h2>
        <p className="text-slate-500 text-xs mb-4">Blocked nights, last booking activity, and potential revenue lost</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#383b40] text-slate-400 text-xs tracking-wider">
                <th className="text-left py-2 pr-4">LISTING</th>
                <th className="text-right py-2 px-3">BOOKED NIGHTS</th>
                <th className="text-right py-2 px-3">BLOCKED NIGHTS</th>
                <th className="text-right py-2 px-3">UNBOOKABLE DATES</th>
                <th className="text-right py-2 px-3">LAST BOOKED</th>
                <th className="text-right py-2 px-3">POTENTIAL REV LOST</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="border-b border-[#383b40] hover:bg-[#20203a] transition-colors">
                  <td className="py-3 pr-4 text-white font-medium">{row.listing_name}</td>
                  <td className="py-3 px-3 text-right text-emerald-400 font-semibold">{fmtNum(row.booked_nights)}</td>
                  <td className="py-3 px-3 text-right text-[#e4cf8b]">{fmtNum(row.blocked_nights)}</td>
                  <td className="py-3 px-3 text-right text-slate-300">{fmtNum(row.blocked_nights)}</td>
                  <td className="py-3 px-3 text-right text-slate-400 text-xs">{fmtDate(row.last_booked_date)}</td>
                  <td className="py-3 px-3 text-right text-red-400 font-semibold">{fmt$(row.potential_revenue_lost)}</td>
                </tr>
              ))}
            </tbody>

            {/* ── Totals Row ─────────────────────────────────────── */}
            <tfoot>
              <tr className="border-t-2 border-[#242628] bg-[#1c1e22]">
                <td className="py-3 pr-4 text-[#e4cf8b] text-xs font-bold tracking-wider">TOTALS</td>
                <td className="py-3 px-3 text-right text-emerald-400 font-bold text-sm">{fmtNum(totalBookedNights)}</td>
                <td className="py-3 px-3 text-right text-[#e4cf8b] font-bold text-sm">{fmtNum(totalBlockedNights)}</td>
                <td className="py-3 px-3 text-right text-slate-300 font-bold text-sm">{fmtNum(totalBlockedNights)}</td>
                <td className="py-3 px-3 text-right text-slate-500 text-xs">—</td>
                <td className="py-3 px-3 text-right text-red-400 font-bold text-sm">{fmt$(totalPotentialLost)}</td>
              </tr>
              <tr className="bg-[#1c1e22]">
                <td colSpan={2} className="pb-3 pr-4">
                  <span className="text-slate-500 text-xs">TOTAL BOOKED REVENUE</span>
                  <span className="ml-3 text-white font-bold text-base">{fmt$(totalBookedRevenue)}</span>
                </td>
                <td colSpan={4} className="pb-3 px-3 text-right">
                  <span className="text-slate-500 text-xs">TOTAL LOST REVENUE OPPORTUNITY</span>
                  <span className="ml-3 text-red-400 font-bold text-base">{fmt$(totalPotentialLost)}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

    </div>
  );
}
