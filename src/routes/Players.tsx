import { PlaceholderRoute } from './PlaceholderRoute';
import { t } from '../lang';

export function PlayersRoute() {
  return (
    <PlaceholderRoute
      title={t('nav.players')}
      glyph="◐"
      body="All players, filterable by tier, club, position."
    />
  );
}
