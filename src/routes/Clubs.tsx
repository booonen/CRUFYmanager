import { PlaceholderRoute } from './PlaceholderRoute';
import { t } from '../lang';

export function ClubsRoute() {
  return (
    <PlaceholderRoute
      title={t('nav.clubs')}
      glyph="◎"
      body="Domestic clubs, squads, finances, history."
    />
  );
}
