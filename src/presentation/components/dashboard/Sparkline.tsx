import React from 'react';
import type { SparklinePoint } from '../../../core/use-cases/buildCycleSparkline';

interface Props {
  points: SparklinePoint[];
  label: string;
  width?: number;
  height?: number;
  className?: string;
}

/** Minimal SVG line over real cumulative values. Renders nothing with fewer than 2 points. */
export default function Sparkline({ points, label, width = 120, height = 36, className }: Props) {
  if (points.length < 2) return null;
  const values = points.map(p => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 2;
  const coords = points.map((p, index) => {
    const x = pad + (index / (points.length - 1)) * (width - pad * 2);
    const y = height - pad - ((p.value - min) / span) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      preserveAspectRatio="none"
    >
      <polyline points={coords.join(' ')} fill="none" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" className="stroke-primary" />
    </svg>
  );
}
