import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { PageHeading } from '../components/PageHeading';
import { t } from '../lang';
import { useSavefileStore } from '../stores/savefile';

interface PlaceholderRouteProps {
  title: string;
  glyph: string;
  body: string;
}

export function PlaceholderRoute({ title, glyph, body }: PlaceholderRouteProps) {
  const status = useSavefileStore((s) => s.status);

  if (status !== 'ready') {
    return (
      <EmptyState
        glyph="◉"
        title={t('saves.empty.title')}
        body={t('saves.empty.body')}
        action={
          <Link to="/saves">
            <Button variant="primary">{t('saves.new')}</Button>
          </Link>
        }
      />
    );
  }

  return (
    <>
      <PageHeading title={title} sub={body} />
      <EmptyState
        glyph={glyph}
        title={t('routes.placeholder.title')}
        body={t('routes.placeholder.body')}
      />
    </>
  );
}
