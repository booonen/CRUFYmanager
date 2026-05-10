import { useEffect, useState, type InputHTMLAttributes } from 'react';

interface NumberInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  allowFloat?: boolean;
  onCommit: (next: number) => void;
}

export function NumberInput({
  value,
  min,
  max,
  step = 1,
  allowFloat = false,
  onCommit,
  className,
  onBlur,
  onKeyDown,
  ...rest
}: NumberInputProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    if (draft === '' || draft === '-' || draft === '.') {
      setDraft(String(value));
      return;
    }
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    let next = parsed;
    if (typeof min === 'number' && next < min) next = min;
    if (typeof max === 'number' && next > max) next = max;
    if (!allowFloat) next = Math.round(next);
    if (next !== value) onCommit(next);
    setDraft(String(next));
  };

  return (
    <input
      type="number"
      step={step}
      className={className}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        commit();
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit();
          (e.currentTarget as HTMLInputElement).blur();
        }
        onKeyDown?.(e);
      }}
      {...rest}
    />
  );
}
