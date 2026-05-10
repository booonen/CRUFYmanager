interface OvrBadgeProps {
  value: number;
  size?: 'sm' | 'md' | 'lg';
}

export function OvrBadge({ value, size = 'md' }: OvrBadgeProps) {
  const tier = ovrTier(value);
  const cls = ['ovr-badge', `ovr-badge--${size}`, `ovr-badge--t${tier}`].join(' ');
  return <span className={cls}>{value}</span>;
}

function ovrTier(value: number): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  if (value >= 85) return 1;
  if (value >= 75) return 2;
  if (value >= 65) return 3;
  if (value >= 55) return 4;
  if (value >= 45) return 5;
  if (value >= 35) return 6;
  return 7;
}
