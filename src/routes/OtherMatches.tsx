import { PlaceholderRoute } from './PlaceholderRoute';
import { t } from '../lang';

export function OtherMatchesRoute() {
  return (
    <PlaceholderRoute
      title={t('nav.otherMatches')}
      glyph="◆"
      body="Friendlies, one-offs, manual-score matches."
    />
  );
}
