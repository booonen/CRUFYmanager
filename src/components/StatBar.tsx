interface StatBarProps {
  label: string;
  value: number;
  dim?: boolean;
}

export function StatBar({ label, value, dim }: StatBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  const tone = colorForValue(pct);
  return (
    <div className="stat-bar" style={{ opacity: dim ? 0.4 : 1 }}>
      <div className="stat-bar__head">
        <span className="stat-bar__label">{label}</span>
        <span className="stat-bar__value mono" style={{ color: tone }}>
          {value}
        </span>
      </div>
      <div className="stat-bar__track">
        <div className="stat-bar__fill" style={{ width: `${pct}%`, background: tone }} />
      </div>
    </div>
  );
}

function colorForValue(value: number): string {
  if (value >= 85) return '#2d8c3a';
  if (value >= 75) return '#55c07a';
  if (value >= 65) return '#a3a838';
  if (value >= 55) return '#d4c43c';
  if (value >= 45) return '#e0a855';
  if (value >= 35) return '#e05555';
  return '#a83434';
}
