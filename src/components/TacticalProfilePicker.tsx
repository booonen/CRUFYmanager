import type { TacticalProfile } from '../domain/manager';

const PROFILES: TacticalProfile[] = [
  'defensive',
  'counter-attack',
  'balanced',
  'possession',
  'pressing',
  'attacking',
];

interface TacticalProfilePickerProps {
  value: TacticalProfile;
  onChange: (next: TacticalProfile) => void;
}

export function TacticalProfilePicker({ value, onChange }: TacticalProfilePickerProps) {
  return (
    <select
      className="select"
      value={value}
      onChange={(e) => onChange(e.target.value as TacticalProfile)}
    >
      {PROFILES.map((p) => (
        <option key={p} value={p}>
          {labelize(p)}
        </option>
      ))}
    </select>
  );
}

function labelize(s: string): string {
  return s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
