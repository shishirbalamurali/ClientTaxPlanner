'use client';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { usd } from '@/lib/format';
import { ChartFrame, ChartTooltip, Legend, seriesColor } from './chart-kit';

export interface ShareSegment {
  label: string;
  value: number;
}

/**
 * A single stacked bar. Used where the point is the mix rather than the
 * absolute size of each component.
 */
export function StackedShareChart({
  segments,
  height = 62,
  legend = 'share',
}: {
  segments: ShareSegment[];
  height?: number;
  legend?: 'share' | 'amount';
}) {
  const rows = segments.filter((segment) => segment.value > 0);
  const total = rows.reduce((sum, segment) => sum + segment.value, 0);
  const datum = Object.fromEntries(rows.map((segment) => [segment.label, segment.value]));

  return (
    <div>
      <ChartFrame height={height}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={[datum]} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <XAxis type="number" hide domain={[0, total]} />
            <YAxis type="category" hide />
            <Tooltip
              cursor={false}
              content={<ChartTooltip formatter={(value) => usd(value)} />}
            />
            {rows.map((segment, index) => (
              <Bar
                key={segment.label}
                dataKey={segment.label}
                name={segment.label}
                stackId="mix"
                fill={seriesColor(index)}
                barSize={26}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
      <Legend
        items={rows.map((segment, index) => ({
          label: segment.label,
          color: seriesColor(index),
          value:
            legend === 'amount'
              ? usd(segment.value)
              : `${((segment.value / total) * 100).toFixed(1)}%`,
        }))}
      />
    </div>
  );
}
