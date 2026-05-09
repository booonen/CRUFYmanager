import type { ReactNode } from 'react';

interface EmptyStateProps {
  glyph?: string;
  title: string;
  body?: string;
  action?: ReactNode;
}

export function EmptyState({ glyph = '○', title, body, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state__glyph">{glyph}</div>
      <div className="empty-state__title">{title}</div>
      {body ? <div className="empty-state__body">{body}</div> : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}
