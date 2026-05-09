import { PlaceholderRoute } from './PlaceholderRoute';
import { t } from '../lang';

export function WorldRoute() {
  return (
    <PlaceholderRoute
      title={t('nav.world')}
      glyph="◌"
      body="Foreign leagues, foreign clubs, foreign national teams."
    />
  );
}
