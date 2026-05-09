import { t } from '../lang';
import { useSavefileStore } from '../stores/savefile';

export function Header() {
  const savefile = useSavefileStore((s) => s.savefile);
  const status = useSavefileStore((s) => s.status);

  return (
    <header className="header">
      <div className="header__logo-mark">C</div>
      <div className="header__title">{t('app.name')}</div>
      <div className="header__active-save">
        {status === 'ready' && savefile ? (
          <>
            <span>Active:</span>
            <strong>{savefile.meta.countryName}</strong>
            <span>·</span>
            <span className="mono">S{savefile.calendar.currentSeason}</span>
            <span className="mono">MD{savefile.calendar.currentMatchday}</span>
          </>
        ) : (
          <span>{t('saves.activeNone')}</span>
        )}
      </div>
    </header>
  );
}
