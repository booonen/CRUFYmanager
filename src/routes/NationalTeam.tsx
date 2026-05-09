import { PlaceholderRoute } from './PlaceholderRoute';
import { t } from '../lang';

export function NationalTeamRoute() {
  return (
    <PlaceholderRoute
      title={t('nav.nationalTeam')}
      glyph="✦"
      body="Squad selection, fixtures, history."
    />
  );
}
