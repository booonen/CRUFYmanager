interface ColorSwatchPickerProps {
  primary: string;
  secondary: string;
  onChange: (next: { primary: string; secondary: string }) => void;
  onRandomize?: () => void;
}

export function ColorSwatchPicker({
  primary,
  secondary,
  onChange,
  onRandomize,
}: ColorSwatchPickerProps) {
  return (
    <div className="color-stack">
      <ColorField
        label="Primary"
        value={primary}
        onChange={(v) => onChange({ primary: v, secondary })}
      />
      <ColorField
        label="Secondary"
        value={secondary}
        onChange={(v) => onChange({ primary, secondary: v })}
      />
      <div className="color-stack__preview-row">
        <div className="color-stack__preview">
          <span className="color-stack__chip" style={{ background: primary }} />
          <span className="color-stack__chip" style={{ background: secondary }} />
        </div>
        {onRandomize ? (
          <button
            type="button"
            className="btn btn--sm"
            onClick={onRandomize}
            style={{ marginLeft: 'auto' }}
          >
            Randomize
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="color-field">
      <span className="color-field__label mono">{label}</span>
      <span className="color-field__row">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="color-field__swatch"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input mono color-field__hex"
        />
      </span>
    </label>
  );
}
