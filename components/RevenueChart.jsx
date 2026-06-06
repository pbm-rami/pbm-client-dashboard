'use client';

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';

const fmt$ = (v) => v == null ? '$0' : '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtK = (v) => {
  if (v == null) return '$0';
  const n = Number(v);
  if (n >= 1000) return '$' + (n / 1000).toFixed(0) + 'k';
  return '$' + n.toFixed(0);
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#212327] border border-[#383b40] rounded-lg p-3 text-xs min-w-[180px]">
      <p className="text-[#e4cf8b] font-semibold mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex justify-between gap-4 mb-1">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="text-white font-medium">{fmt$(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function RevenueChart({ data, selectedMonth, isListingMode, listingName }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-[#2a2c30] border border-[#383b40] rounded-xl p-6">
        <p className="text-slate-500 text-sm">No trend data available</p>
      </div>
    );
  }

  // Field names differ between portfolio (vw_es_trends) and listing (vw_es_listings) views
  const netField   = isListingMode ? 'rental_revenue'       : 'total_rental_revenue';
  const goalField  = isListingMode ? 'rental_revenue_goal'  : 'total_revenue_goal';
  const stlyField  = isListingMode ? 'rental_revenue_stly'  : 'total_rental_revenue_stly';
  const lyField    = isListingMode ? 'rental_revenue_ly'    : 'total_rental_revenue_ly';
  const grossField = isListingMode ? 'total_revenue'        : 'total_revenue';  // same in both

  const total2026Net   = data.reduce((s, r) => s + (Number(r[netField])   || 0), 0);
  const total2026Gross = data.reduce((s, r) => s + (Number(r[grossField]) || 0), 0);

  const label = isListingMode ? listingName : 'Portfolio';
  const subLabel = isListingMode
    ? `${listingName?.toUpperCase()} — MONTHLY NET REVENUE`
    : 'MONTHLY NET REVENUE — JAN–DEC 2026';

  return (
    <div className="bg-[#2a2c30] border border-[#383b40] rounded-xl p-4 sm:p-6">
      <p className="text-[#e4cf8b] text-xs font-semibold tracking-widest mb-1">
        {isListingMode ? 'LISTING REVENUE' : 'PORTFOLIO REVENUE'}
      </p>
      <p className="text-white text-lg font-bold mb-3">Rental Revenue Overview</p>

      {/* YTD summary row */}
      <div className="flex flex-wrap gap-6 mb-5">
        <div>
          <p className="text-slate-500 text-xs">2026 GROSS YTD</p>
          <p className="text-[#e4cf8b] text-2xl font-bold">{fmt$(total2026Gross)}</p>
        </div>
        <div>
          <p className="text-slate-500 text-xs">2026 NET YTD</p>
          <p className="text-white text-2xl font-bold">{fmt$(total2026Net)}</p>
        </div>
      </div>

      <p className="text-slate-500 text-xs tracking-wider mb-3">{subLabel}</p>

      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#383b40" vertical={false} />
          <XAxis
            dataKey="month_label"
            tick={{ fill: '#e2e8f0', fontSize: 10 }}
            axisLine={{ stroke: '#383b40' }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={fmtK}
            tick={{ fill: '#e2e8f0', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={45}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
            iconType="circle"
            iconSize={8}
          />
          <Bar dataKey={netField} name="Net Revenue" radius={[3, 3, 0, 0]} maxBarSize={32}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.month_key === selectedMonth ? '#e4cf8b' : '#e4cf8b'}
              />
            ))}
          </Bar>
          <Line
            type="monotone"
            dataKey={goalField}
            name="Goal"
            stroke="#f97316"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey={stlyField}
            name="STLY"
            stroke="#60a5fa"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey={lyField}
            name="Final LY"
            stroke="#64748b"
            strokeWidth={1.5}
            strokeDasharray="3 3"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
