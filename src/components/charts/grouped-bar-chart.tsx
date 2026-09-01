'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { usd } from '@/lib/format';
import { AXIS_TICK, ChartFrame, ChartTooltip, GRID_STROKE, compactAxis, seriesColor } from './chart-kit';

export interface GroupedSeries {
  key: string;
  label: string;
  stackId?: string;
}

export function GroupedBarChart({
  data,
  series,
  categoryKey,
  height = 260,
  referenceLabel,
}: {
  data: Array<Record<string, string | number>>;
  series: GroupedSeries[];
  categoryKey: string;
  height?: number;
  referenceLabel?: string;
}) {
  return (
    <div>
      <ChartFrame height={height}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis
              dataKey={categoryKey}
              tick={AXIS_TICK}
              axisLine={{ stroke: GRID_STROKE }}
              tickLine={false}
              interval={0}
            />
            <YAxis
              tick={AXIS_TICK}
              tickFormatter={compactAxis}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip
              cursor={{ fill: 'rgba(27,59,95,0.05)' }}
              content={<ChartTooltip formatter={(value) => usd(value)} />}
            />
            {series.map((entry, index) => (
              <Bar
                key={entry.key}
                dataKey={entry.key}
                name={entry.label}
                stackId={entry.stackId}
                fill={seriesColor(index)}
                barSize={series.length > 2 ? 18 : 28}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        {series.map((entry, index) => (
          <span key={entry.key} className="flex items-center gap-1.5 text-[11.5px] text-ink-3">
            <span
              aria-hidden
              className="inline-block h-2 w-2"
              style={{ background: seriesColor(index) }}
            />
            {entry.label}
          </span>
        ))}
        {referenceLabel && <span className="text-[11px] text-ink-4">{referenceLabel}</span>}
      </div>
    </div>
  );
}
