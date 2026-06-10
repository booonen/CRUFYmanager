import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { CompetitionStageView } from '../components/CompetitionStageView';
import { EmptyState } from '../components/EmptyState';
import { NumberInput } from '../components/NumberInput';
import { PageHeading } from '../components/PageHeading';
import type { Savefile } from '../domain/savefile';
import type { Competition, SportEvent } from '../domain/spine';
import { t } from '../lang';
import { setEntrySeeding, useCompetition } from '../stores/competitions';
import { useSavefileStore } from '../stores/savefile';
import { entryDisplay } from '../utils/participants';

export function CompetitionDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const savefile = useSavefileStore((s) => s.savefile);
  const competition = useCompetition(id);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  if (!savefile || !competition) {
    return (
      <EmptyState
        glyph="◇"
        title={t('competitions.notFound')}
        action={
          <Link to="/competitions">
            <Button>{t('common.back')}</Button>
          </Link>
        }
      />
    );
  }

  const event = competition.sportEvents[0];
  if (!event) return null;

  const tab = activeTab ?? event.stages[0]?.id ?? 'entries';

  return (
    <>
      <PageHeading
        title={competition.name}
        sub={competition.shortName}
        actions={
          <Link to="/competitions">
            <Button size="sm">{t('common.back')}</Button>
          </Link>
        }
      />

      <div className="chip-row" style={{ marginBottom: 16 }}>
        {event.stages.map((stage) => (
          <button
            key={stage.id}
            type="button"
            className={`chip ${tab === stage.id ? 'chip--active' : ''}`}
            style={{ cursor: 'pointer' }}
            onClick={() => setActiveTab(stage.id)}
          >
            {stage.name}
          </button>
        ))}
        <button
          type="button"
          className={`chip ${tab === 'entries' ? 'chip--active' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveTab('entries')}
        >
          {t('competitions.cockpit.entriesTab')}
        </button>
      </div>

      {tab === 'entries' ? (
        <EntriesPanel sf={savefile} competition={competition} event={event} />
      ) : (
        (() => {
          const stageIndex = event.stages.findIndex((s) => s.id === tab);
          const stage = event.stages[stageIndex];
          if (!stage) return null;
          return (
            <CompetitionStageView
              sf={savefile}
              competition={competition}
              event={event}
              stage={stage}
              stageIndex={stageIndex}
            />
          );
        })()
      )}
    </>
  );
}

function EntriesPanel({ sf, competition, event }: { sf: Savefile; competition: Competition; event: SportEvent }) {
  return (
    <div className="panel" style={{ padding: 12, maxWidth: 640 }}>
      <table className="data-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>{t('competitions.cockpit.entryCode')}</th>
            <th>{t('competitions.cockpit.entryName')}</th>
            <th>{t('competitions.cockpit.entrySeed')}</th>
          </tr>
        </thead>
        <tbody>
          {event.entries.map((entry) => {
            const d = entryDisplay(sf, event, entry.id);
            return (
              <tr key={entry.id}>
                <td className="mono">{d.code}</td>
                <td>{d.name}</td>
                <td style={{ width: 110 }}>
                  <NumberInput
                    className="input"
                    style={{ width: 88, padding: '2px 6px', fontSize: 12 }}
                    value={entry.seeding}
                    min={0}
                    max={9999}
                    step={0.01}
                    allowFloat
                    onCommit={(value) =>
                      setEntrySeeding({ competitionId: competition.id, eventId: event.id }, entry.id, value)
                    }
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="field__hint" style={{ marginTop: 8 }}>
        {t('competitions.cockpit.entrySeedHint')}
      </div>
    </div>
  );
}
