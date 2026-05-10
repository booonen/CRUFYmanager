import { PERSONALITY_TAGS, type PersonalityTag } from '../domain/player';

interface PersonalityPickerProps {
  values: PersonalityTag[];
  min?: number;
  max?: number;
  onChange: (next: PersonalityTag[]) => void;
}

export function PersonalityPicker({
  values,
  min = 1,
  max = 3,
  onChange,
}: PersonalityPickerProps) {
  const set = new Set(values);

  const toggle = (tag: PersonalityTag) => {
    if (set.has(tag)) {
      if (values.length <= min) return;
      onChange(values.filter((v) => v !== tag));
    } else {
      if (values.length >= max) return;
      onChange([...values, tag]);
    }
  };

  return (
    <div>
      <div className="chip-row">
        {PERSONALITY_TAGS.map((tag) => {
          const active = set.has(tag);
          const wouldExceed = !active && values.length >= max;
          return (
            <button
              key={tag}
              type="button"
              className={active ? 'chip chip--active' : 'chip'}
              onClick={() => toggle(tag)}
              disabled={wouldExceed}
              style={wouldExceed ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
            >
              {tag}
            </button>
          );
        })}
      </div>
      <div className="text-muted" style={{ fontSize: 11, marginTop: 6 }}>
        Pick {min === max ? min : `${min}–${max}`} ({values.length}/{max} selected)
      </div>
    </div>
  );
}
