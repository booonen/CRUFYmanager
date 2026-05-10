import type { Position } from '../domain/player';

interface PositionPillProps {
  position: Position;
}

export function PositionPill({ position }: PositionPillProps) {
  const group = position === 'GK' ? 'GK' : (position.split('-')[0] ?? 'MID');
  const label = position === 'GK' ? 'GK' : (position.split('-')[1] ?? position);
  return (
    <span className={`pos-pill pos-pill--${group.toLowerCase()}`} title={position}>
      {label}
    </span>
  );
}
