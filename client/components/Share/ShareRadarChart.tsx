/** SVG radar / spider chart: values are normalized relative to the largest value in the set. */

interface ShareRadarChartProps {
  size: number;
  labels: string[];
  values: number[];
  fill?: string;
  stroke?: string;
  gridStroke?: string;
  className?: string;
}

export function ShareRadarChart({
  size,
  labels,
  values,
  fill = 'rgba(91, 124, 255, 0.32)',
  stroke = 'rgba(140, 180, 255, 0.95)',
  gridStroke = 'rgba(255, 255, 255, 0.12)',
  className,
}: ShareRadarChartProps) {
  const n = labels.length;
  if (n < 3 || values.length !== n) {
    return (
      <div
        className={className}
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.3;
  const labelR = size * 0.42;
  const vmax = Math.max(...values.map((v) => (Number.isFinite(v) ? Math.abs(v) : 0)), 1e-9);
  const norm = values.map((v) => {
    const t = Number.isFinite(v) ? Math.abs(v) / vmax : 0;
    return Math.min(1, Math.max(0.12, t));
  });

  const angleAt = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;

  const pt = (i: number, r: number): [number, number] => {
    const a = angleAt(i);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };

  const polyPoints = norm
    .map((t, i) => {
      const [x, y] = pt(i, t * maxR);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const gridLevels = [0.35, 0.65, 1];
  const gridPolygons = gridLevels.map((g) => {
    const pts = Array.from({ length: n }, (_, i) => {
      const [x, y] = pt(i, g * maxR);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return pts;
  });

  const spokes = Array.from({ length: n }, (_, i) => {
    const [x, y] = pt(i, maxR);
    return (
      <line
        key={`spoke-${i}`}
        x1={cx}
        y1={cy}
        x2={x}
        y2={y}
        stroke={gridStroke}
        strokeWidth={1}
      />
    );
  });

  const labelEls = labels.map((label, i) => {
    const a = angleAt(i);
    const lx = cx + Math.cos(a) * labelR;
    const ly = cy + Math.sin(a) * labelR;
    const short = label.length > 11 ? `${label.slice(0, 10)}…` : label;
    const fs = Math.max(7, size * 0.028);
    return (
      <text
        key={`lb-${i}`}
        x={lx}
        y={ly}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{
          fill: '#c8d4f0',
          fontSize: fs,
          fontFamily: 'system-ui, Segoe UI, sans-serif',
          fontWeight: 600,
          letterSpacing: '0.04em',
        }}
      >
        {short}
      </text>
    );
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-hidden
    >
      {gridPolygons.map((pts, gi) => (
        <polygon
          key={`grid-${gi}`}
          points={pts}
          fill="none"
          stroke={gridStroke}
          strokeWidth={1}
        />
      ))}
      {spokes}
      <polygon points={polyPoints} fill={fill} stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" />
      {labelEls}
    </svg>
  );
}
