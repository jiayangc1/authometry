"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function RequestChart({
  data,
}: {
  data: Array<{ time: string; successful: number; denied: number; failed: number }>;
}) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Authorization requests over time">
      <ResponsiveContainer height="100%" width="100%">
        <AreaChart data={data} margin={{ left: -18, right: 8, top: 12, bottom: 0 }}>
          <defs>
            <linearGradient id="successArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="time"
            fontSize={11}
            stroke="var(--text-tertiary)"
            tickLine={false}
            tickMargin={10}
          />
          <YAxis
            axisLine={false}
            fontSize={11}
            stroke="var(--text-tertiary)"
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              boxShadow: "0 8px 24px rgba(0,0,0,.08)",
              fontSize: 12,
            }}
          />
          <Area
            dataKey="successful"
            fill="url(#successArea)"
            stroke="var(--chart-1)"
            strokeWidth={1.75}
            type="monotone"
          />
          <Area
            dataKey="denied"
            fill="transparent"
            stroke="var(--warning)"
            strokeWidth={1.5}
            type="monotone"
          />
          <Area
            dataKey="failed"
            fill="transparent"
            stroke="var(--danger)"
            strokeWidth={1.5}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
