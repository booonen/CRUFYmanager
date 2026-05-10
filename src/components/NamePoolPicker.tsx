import { useMemo } from 'react';
import { listPools } from '../generation/nameGen';

interface NamePoolPickerProps {
  value: string;
  onChange: (poolCode: string) => void;
  className?: string;
}

/** Dropdown for explicitly choosing which name pool to draw from. */
export function NamePoolPicker({ value, onChange, className }: NamePoolPickerProps) {
  const pools = useMemo(() => listPools(), []);
  return (
    <select
      className={className ?? 'input'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {pools.map((p) => (
        <option key={p.code} value={p.code}>
          {p.displayName}
        </option>
      ))}
    </select>
  );
}
