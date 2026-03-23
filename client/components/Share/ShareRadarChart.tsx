interface ShareRadarChartProps {
  size: number;
  labels: string[];
  values: number[];
  fill?: string;
  stroke?: string;
  gridStroke?: string;
  className?: string;
}

function wrapRadarLabelLines(label: string, maxCharsPerLine: number): string[] {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [label];
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxCharsPerLine) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      cur = w.length > maxCharsPerLine ? `${w.slice(0, maxCharsPerLine - 1)}…` : w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
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
    return <div className={className} style={{ width: size, height: size }} aria-hidden />;
  }

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.26;
  const labelR = size * 0.46;
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
      <line key={`spoke-${i}`} x1={cx} y1={cy} x2={x} y2={y} stroke={gridStroke} strokeWidth={1} />
    );
  });

  const maxChars = n >= 6 ? 10 : n >= 5 ? 11 : 12;
  const fs = Math.max(6.5, size * 0.024);
  const lineHeight = fs * 1.12;

  const labelEls = labels.map((label, i) => {
    const a = angleAt(i);
    const lx = cx + Math.cos(a) * labelR;
    const ly = cy + Math.sin(a) * labelR;
    const lines = wrapRadarLabelLines(label, maxChars);
    const blockHalf = ((lines.length - 1) * lineHeight) / 2;
    return (
      <g key={`lb-${i}`}>
        {lines.map((line, li) => (
          <text
            key={li}
            x={lx}
            y={ly - blockHalf + li * lineHeight}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fill: '#c8d4f0',
              fontSize: fs,
              fontFamily: 'system-ui, Segoe UI, sans-serif',
              fontWeight: 600,
              letterSpacing: '0.03em',
            }}
          >
            {line}
          </text>
        ))}
      </g>
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
        <polygon key={`grid-${gi}`} points={pts} fill="none" stroke={gridStroke} strokeWidth={1} />
      ))}
      {spokes}
      <polygon
        points={polyPoints}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {labelEls}
    </svg>
  );
}
