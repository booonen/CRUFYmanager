import { PERSONALITY_TAGS, type PersonalityTag } from '../domain/player';

interface PersonalityPickerProps {
  value: PersonalityTag;
  onChange: (next: PersonalityTag) => void;
}

export function PersonalityPicker({ value, onChange }: PersonalityPickerProps) {
  return (
    <div className="chip-row">
      {PERSONALITY_TAGS.map((tag) => (
        <button
          key={tag}
          type="button"
          className={tag === value ? 'chip chip--active' : 'chip'}
          onClick={() => onChange(tag)}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}
