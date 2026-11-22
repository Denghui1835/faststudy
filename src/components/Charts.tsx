export function Donut({
  size = 116,
  stroke = 13,
  parts,
  center,
  label,
}: {
  size?: number;
  stroke?: number;
  parts: { value: number; color: string }[];
  center: string;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = parts.reduce((n, p) => n + p.value, 0) || 1;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flex: 'none' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f0ece2" strokeWidth={stroke} />
      {parts.map((p, i) => {
        const len = (p.value / total) * c;
        const el = (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={p.color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${Math.max(0, len - 3)} ${c}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
        offset += len;
        return el;
      })}
      <text
        x="50%"
        y={label ? '47%' : '52%'}
        dominantBaseline="middle"
        textAnchor="middle"
        className="donut-center"
        fill="#1b2b4b"
      >
        {center}
      </text>
      {label && (
        <text x="50%" y="63%" dominantBaseline="middle" textAnchor="middle" fontSize="10" fill="#93a0b5">
          {label}
        </text>
      )}
    </svg>
  );
}

export function Radar({
  size = 200,
  axes,
}: {
  size?: number;
  axes: { name: string; value: number }[];
}) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.34;
  const n = axes.length;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i: number, radius: number) => [cx + Math.cos(angle(i)) * radius, cy + Math.sin(angle(i)) * radius];

  const grid = [0.25, 0.5, 0.75, 1];
  const poly = axes.map((a, i) => pt(i, Math.max(0.06, Math.min(1, a.value)) * R).join(',')).join(' ');

  return (
    <svg width="100%" height={size} viewBox={`0 0 ${size} ${size}`}>
      {grid.map((g, gi) => (
        <polygon
          key={gi}
          points={axes.map((_, i) => pt(i, R * g).join(',')).join(' ')}
          fill="none"
          stroke="#efeade"
          strokeWidth={1}
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#efeade" strokeWidth={1} />;
      })}
      <polygon points={poly} fill="rgba(59,107,245,.16)" stroke="#3b6bf5" strokeWidth={2} />
      {axes.map((a, i) => {
        const [x, y] = pt(i, R + 18);
        return (
          <text
            key={a.name}
            x={x}
            y={y}
            fontSize="10"
            fill="#93a0b5"
            textAnchor={Math.abs(x - cx) < 8 ? 'middle' : x > cx ? 'start' : 'end'}
            dominantBaseline="middle"
          >
            {a.name}
          </text>
        );
      })}
    </svg>
  );
}

export function Mountains() {
  return (
    <svg className="mountains" viewBox="0 0 600 160" preserveAspectRatio="none">
      <defs>
        <linearGradient id="m1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fb0d4" stopOpacity=".55" />
          <stop offset="1" stopColor="#4a6b95" stopOpacity=".15" />
        </linearGradient>
        <linearGradient id="m2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#365074" stopOpacity=".85" />
          <stop offset="1" stopColor="#22344f" stopOpacity=".6" />
        </linearGradient>
      </defs>
      <path d="M0 118 L90 62 L150 96 L232 40 L318 104 L392 66 L470 110 L540 74 L600 108 L600 160 L0 160 Z" fill="url(#m1)" />
      <path d="M0 140 L70 106 L128 128 L210 88 L286 132 L360 104 L440 138 L520 112 L600 140 L600 160 L0 160 Z" fill="url(#m2)" />
    </svg>
  );
}

export function Spark({ values, color = '#3b6bf5' }: { values: number[]; color?: string }) {
  const max = Math.max(1, ...values);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 34 }}>
      {values.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${Math.max(8, (v / max) * 100)}%`,
            background: i === values.length - 1 ? color : '#dbe4ff',
            borderRadius: 4,
          }}
        />
      ))}
    </div>
  );
}
