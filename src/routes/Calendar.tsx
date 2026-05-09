import { PlaceholderRoute } from './PlaceholderRoute';
import { t } from '../lang';

export function CalendarRoute() {
  return (
    <PlaceholderRoute
      title={t('nav.calendar')}
      glyph="◰"
      body="Season overview. Advance time, view scheduled matchdays."
    />
  );
}
