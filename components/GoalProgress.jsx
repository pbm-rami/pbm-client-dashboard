'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell, ResponsiveContainer, LabelList } from 'recharts';

const goalColor = (pct) => {
  if (pct == null) return '#64748b';
  if (pct >= 100) return '#10b981';
  if (pct >= 85) return '#e4cf8b';
  return '#ef4444';
};

const fmt$ = (v) => v == null ? '—' : '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 });

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const gap = (d.rental_revenue_goal ?? 0) - (d.rental_revenue ?? 0);
  return (
    <div className="bg-[#212327] border border-[#383b40] rounded-lg p-3 text-xs">
      <p className="text-white font-semibold mb-1">{d.listing_name}</p>
      <p className="text-slate-300">Revenue: <span className="text-white">{fmt$(d.rental_revenue)}</span></p>
      <p className="text-slate-300">Goal: <span className="text-white">{fmt$(d.rental_revenue_goal)}</span></p>
      <p className="text-slate-300">Gap: <span className={gap > 0 ? 'text-red-400' : 'text-emerald-400'}>{fmt$(gap)}</span></p>
    </div>
  );
};

export default function GoalProgress({ data }) {
  if (!data || data.length === 0) return null;

  // Truncate long listing names for Y axis
  const chartData = data.map(d => ({
    ...d,
    short_name: d.listing_name.length > 18 ? d.listing_name.slice(0, 16) + '…' : d.listing_name,
    pct: d.pct_to_goal ?? 0,
  }));

  const chartHeight = Math.max(300, chartData.length * 32);

  return (
    <div className="bg-[#2a2c30] border border-[#383b40] rounded-xl p-6 mb-6">
      <h2 className="text-[#e4cf8b] text-sm font-semibold tracking-widest mb-1">LISTING GOAL PROGRESS</h2>
      <p className="text-slate-500 text-xs mb-6">Rental revenue vs goal for selected month</p>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 60, left: 140, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#383b40" />
          <XAxis
            type="number"
            domain={[0, 120]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fill: '#e2e8f0', fontSize: 11 }}
            axisLine={{ stroke: '#383b40' }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="short_name"
            tick={{ fill: '#e2e8f0', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={135}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <ReferenceLine x={100} stroke="#64748b" strokeDasharray="4 4" label={{ value: '100%', fill: '#e2e8f0', fontSize: 10, position: 'top' }} />
          <Bar dataKey="pct" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={goalColor(entry.pct)} />
            ))}
            <LabelList
              dataKey="pct"
              position="right"
              formatter={(v) => `${Number(v).toFixed(1)}%`}
              style={{ fill: '#e2e8f0', fontSize: 11 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
