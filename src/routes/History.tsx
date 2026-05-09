import { PlaceholderRoute } from './PlaceholderRoute';
import { t } from '../lang';

export function HistoryRoute() {
  return (
    <PlaceholderRoute
      title={t('nav.history')}
      glyph="◍"
      body="Past seasons, dissolved competitions, all-time records."
    />
  );
}
