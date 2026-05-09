import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'default' | 'primary' | 'danger';
type Size = 'md' | 'sm';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export function Button({
  variant = 'default',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = ['btn'];
  if (variant === 'primary') classes.push('btn--primary');
  if (variant === 'danger') classes.push('btn--danger');
  if (size === 'sm') classes.push('btn--sm');
  if (className) classes.push(className);

  return (
    <button type="button" className={classes.join(' ')} {...rest}>
      {children}
    </button>
  );
}
