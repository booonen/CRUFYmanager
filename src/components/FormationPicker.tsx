import type { Formation } from '../domain/manager';

const FORMATIONS: Formation[] = [
  '4-4-2',
  '4-3-3',
  '4-2-3-1',
  '3-5-2',
  '3-4-3',
  '5-3-2',
  '4-5-1',
  '4-1-4-1',
];

interface FormationPickerProps {
  value: Formation;
  onChange: (next: Formation) => void;
}

export function FormationPicker({ value, onChange }: FormationPickerProps) {
  return (
    <select
      className="select mono"
      value={value}
      onChange={(e) => onChange(e.target.value as Formation)}
    >
      {FORMATIONS.map((f) => (
        <option key={f} value={f}>
          {f}
        </option>
      ))}
    </select>
  );
}
