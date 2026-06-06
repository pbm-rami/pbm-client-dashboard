'use client';

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const fmtK = (v) => {
  const n = Number(v);
  if (n >= 1000) return '$' + (n / 1000).toFixed(0) + 'k';
  return '$' + n.toFixed(0);
};
const fmtPct = (v) => Number(v).toFixed(1) + '%';
const fmt$ = (v) => '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 });

const CustomTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#212327] border border-[#383b40] rounded-lg p-3 text-xs min-w-[180px]">
      <p className="text-amber-400 font-semibold mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex justify-between gap-3 mb-0.5">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="text-white">{formatter ? formatter(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

// line2Key / line2Name / line2Color are optional — renders a third line when provided
function TrendCard({
  title, data,
  barKey, barName,
  lineKey, lineName,
  line2Key, line2Name, line2Color = '#f87171',
  tickFormatter, tooltipFormatter,
}) {
  return (
    <div className="bg-[#2a2c30] border border-[#383b40] rounded-xl p-5">
      <p className="text-[#e4cf8b] text-xs font-semibold tracking-widest mb-4">{title}</p>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#383b40" vertical={false} />
          <XAxis
            dataKey="month_label"
            tick={{ fill: '#e2e8f0', fontSize: 9 }}
            axisLine={{ stroke: '#383b40' }}
            tickLine={false}
            interval={1}
          />
          <YAxis
            tickFormatter={tickFormatter}
            tick={{ fill: '#e2e8f0', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            width={46}
          />
          <Tooltip
            content={(props) => <CustomTooltip {...props} formatter={tooltipFormatter} />}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          />
          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} iconType="circle" iconSize={7} />
          <Bar dataKey={barKey} name={barName} fill="#e4cf8b" radius={[2, 2, 0, 0]} maxBarSize={24} />
          <Line
            type="monotone"
            dataKey={lineKey}
            name={lineName}
            stroke="#60a5fa"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
          />
          {line2Key && (
            <Line
              type="monotone"
              dataKey={line2Key}
              name={line2Name}
              stroke={line2Color}
              strokeWidth={1.5}
              strokeDasharray="2 2"
              dot={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function TrendCharts({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-[#2a2c30] border border-[#383b40] rounded-xl p-6 mb-6">
        <p className="text-slate-500 text-sm">No trend data available</p>
      </div>
    );
  }

  return (
    <div className="print-trends-grid grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">

      {/* Revenue vs STLY — bar=current, line1=STLY pace, line2=LY Final */}
      <TrendCard
        title="REVENUE VS STLY"
        data={data}
        barKey="total_rental_revenue"
        barName="Revenue"
        lineKey="total_rental_revenue_stly"
        lineName="STLY"
        line2Key="total_rental_revenue_ly"
        line2Name="LY Final"
        tickFormatter={fmtK}
        tooltipFormatter={fmt$}
      />

      {/* Occupancy vs STLY — bar=current, line1=STLY, line2=LY Final */}
      <TrendCard
        title="OCCUPANCY VS STLY"
        data={data}
        barKey="avg_occupancy_pct"
        barName="Occupancy"
        lineKey="avg_occupancy_pct_stly"
        lineName="STLY"
        line2Key="avg_occupancy_pct_ly"
        line2Name="LY Final"
        tickFormatter={fmtPct}
        tooltipFormatter={(v) => Number(v).toFixed(1) + '%'}
      />

      {/* RevPAR vs Market — bar=current, line1=Market */}
      <TrendCard
        title="REVPAR VS MARKET"
        data={data}
        barKey="avg_revpar"
        barName="RevPAR"
        lineKey="avg_market_revpar"
        lineName="Market"
        tickFormatter={fmtK}
        tooltipFormatter={fmt$}
      />

    </div>
  );
}
