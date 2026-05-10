interface OvrBadgeProps {
  value: number;
  size?: 'sm' | 'md' | 'lg';
}

export function OvrBadge({ value, size = 'md' }: OvrBadgeProps) {
  const tier = ovrTier(value);
  const cls = ['ovr-badge', `ovr-badge--${size}`, `ovr-badge--${tier}`].join(' ');
  return <span className={cls}>{value}</span>;
}

function ovrTier(value: number): 'low' | 'mid' | 'high' | 'elite' {
  if (value >= 85) return 'elite';
  if (value >= 75) return 'high';
  if (value >= 60) return 'mid';
  return 'low';
}
