import { POSITION_GROUPS, type Position } from '../domain/player';

interface PositionPickerProps {
  value: Position;
  onChange: (next: Position) => void;
}

const GROUP_ORDER: (keyof typeof POSITION_GROUPS)[] = ['GK', 'DEF', 'MID', 'FWD'];

export function PositionPicker({ value, onChange }: PositionPickerProps) {
  return (
    <div className="position-picker">
      {GROUP_ORDER.map((group) => (
        <div key={group} className="position-picker__group">
          <div className="position-picker__group-label">{group}</div>
          <div className="position-picker__row">
            {POSITION_GROUPS[group].map((pos) => (
              <button
                key={pos}
                type="button"
                className={
                  pos === value
                    ? 'position-picker__btn position-picker__btn--active'
                    : 'position-picker__btn'
                }
                onClick={() => onChange(pos)}
              >
                {labelFor(pos)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function labelFor(pos: Position): string {
  if (pos === 'GK') return 'GK';
  return pos.split('-')[1] ?? pos;
}
