import { PlaceholderRoute } from './PlaceholderRoute';
import { t } from '../lang';

export function CompetitionsRoute() {
  return (
    <PlaceholderRoute
      title={t('nav.competitions')}
      glyph="◇"
      body="Create, configure, and view competitions and brackets."
    />
  );
}
