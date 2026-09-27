"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

type Point = { time: string; successful: number; denied: number; failed: number };

const series = [
  { key: "successful", label: "Successful", color: "var(--chart-1)" },
  { key: "denied", label: "Denied", color: "var(--warning-solid)" },
  { key: "failed", label: "Failed", color: "var(--danger-solid)" },
] as const;

function ChartTooltip({ active, payload, label }: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as Point | undefined;
  if (!point) return null;
  return (
    <div className="min-w-40 animate-[fade-in_var(--motion-fast)_var(--ease-out)] rounded-[var(--radius-card)] bg-[var(--surface-raised)] p-2.5 text-xs shadow-[var(--shadow-menu)]">
      <p className="technical-value mb-1.5 text-[var(--text-secondary)]">{label}</p>
      {series.map((item) => (
        <p className="flex items-center gap-2 py-0.5" key={item.key}>
          <i className="size-2 rounded-[2px]" style={{ background: item.color }} />
          <span className="flex-1 text-[var(--text-secondary)]">{item.label}</span>
          <span className="font-medium tabular-nums">{point[item.key]}</span>
        </p>
      ))}
    </div>
  );
}

export function RequestChart({ data }: { data: Point[] }) {
  const total = data.reduce(
    (sum, point) => sum + point.successful + point.denied + point.failed,
    0,
  );
  return (
    <div
      aria-label={`Authorization requests over time: ${total} total`}
      className="h-64 w-full"
      role="img"
    >
      <ResponsiveContainer height="100%" width="100%">
        <AreaChart data={data} margin={{ left: -12, right: 12, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="successArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.16} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="time"
            fontSize={11}
            minTickGap={24}
            stroke="var(--text-tertiary)"
            tickLine={false}
            tickMargin={10}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            fontSize={11}
            stroke="var(--text-tertiary)"
            tickLine={false}
            width={40}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: "var(--border-strong)", strokeDasharray: "3 3" }}
          />
          <Area
            activeDot={{ r: 3.5, strokeWidth: 2, stroke: "var(--surface-raised)" }}
            animationDuration={600}
            dataKey="successful"
            fill="url(#successArea)"
            stroke="var(--chart-1)"
            strokeWidth={1.75}
            type="monotone"
          />
          <Area
            activeDot={{ r: 3.5, strokeWidth: 2, stroke: "var(--surface-raised)" }}
            animationDuration={600}
            dataKey="denied"
            fill="transparent"
            stroke="var(--warning-solid)"
            strokeWidth={1.5}
            type="monotone"
          />
          <Area
            activeDot={{ r: 3.5, strokeWidth: 2, stroke: "var(--surface-raised)" }}
            animationDuration={600}
            dataKey="failed"
            fill="transparent"
            stroke="var(--danger-solid)"
            strokeWidth={1.5}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
