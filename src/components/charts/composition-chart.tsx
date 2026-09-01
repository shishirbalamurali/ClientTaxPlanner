'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { usd } from '@/lib/format';
import { AXIS_TICK, ChartFrame, ChartTooltip, GRID_STROKE, compactAxis, seriesColor } from './chart-kit';

export interface CompositionDatum {
  label: string;
  value: number;
}

/** Horizontal bars ordered by size: the readable default for a handful of categories. */
export function CompositionChart({
  data,
  height,
}: {
  data: CompositionDatum[];
  height?: number;
}) {
  const rows = data.filter((row) => row.value !== 0).sort((a, b) => b.value - a.value);
  const plotHeight = height ?? Math.max(140, rows.length * 32 + 34);

  return (
    <ChartFrame height={plotHeight}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 4 }}>
          <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
          <XAxis
            type="number"
            tick={AXIS_TICK}
            tickFormatter={compactAxis}
            axisLine={{ stroke: GRID_STROKE }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={140}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(27,59,95,0.05)' }}
            content={<ChartTooltip formatter={(value) => usd(value)} />}
          />
          <Bar dataKey="value" name="Amount" barSize={16} isAnimationActive={false}>
            {rows.map((row, index) => (
              <Cell key={row.label} fill={seriesColor(index)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
