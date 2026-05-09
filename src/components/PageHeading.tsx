import type { ReactNode } from 'react';

interface PageHeadingProps {
  title: string;
  sub?: string;
  actions?: ReactNode;
}

export function PageHeading({ title, sub, actions }: PageHeadingProps) {
  return (
    <div className="page-heading">
      <div>
        <div className="page-heading__title">{title}</div>
        {sub ? <div className="page-heading__sub">{sub}</div> : null}
      </div>
      {actions ? <div>{actions}</div> : null}
    </div>
  );
}
