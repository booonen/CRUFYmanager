import { clampStat } from '../utils/ovr';

interface StatSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  hint?: string;
}

export function StatSlider({ label, value, onChange, disabled, hint }: StatSliderProps) {
  return (
    <div className="stat-slider" style={{ opacity: disabled ? 0.45 : 1 }}>
      <div className="stat-slider__head">
        <span className="stat-slider__label">{label}</span>
        <span className="stat-slider__value mono">{value}</span>
      </div>
      <div className="stat-slider__row">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(clampStat(Number(e.target.value)))}
          className="stat-slider__range"
        />
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(clampStat(Number(e.target.value)))}
          className="input mono stat-slider__num"
        />
      </div>
      {hint ? <div className="stat-slider__hint">{hint}</div> : null}
    </div>
  );
}
