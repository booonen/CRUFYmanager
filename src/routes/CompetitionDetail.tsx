import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { BonusImportModal } from '../components/BonusImportModal';
import { BonusLedgerModal } from '../components/BonusLedgerModal';
import { Button } from '../components/Button';
import { CompetitionStageView } from '../components/CompetitionStageView';
import { EmptyState } from '../components/EmptyState';
import { NumberInput } from '../components/NumberInput';
import { PageHeading } from '../components/PageHeading';
import type { Savefile } from '../domain/savefile';
import type { Competition, SportEvent } from '../domain/spine';
import { bonusAt, eventRatingMax } from '../engine/simulate';
import { t } from '../lang';
import { setEntrySeeding, setEntryStyleAction, setRatingMaxAction, useCompetition } from '../stores/competitions';
import { useSavefileStore } from '../stores/savefile';
import { entryDisplay } from '../utils/participants';

export function CompetitionDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const stageParam = searchParams.get('stage');
  const roundParam = searchParams.get('round');
  const savefile = useSavefileStore((s) => s.savefile);
  const competition = useCompetition(id);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  // Deep links from the calendar pick the stage tab (and the focused round below).
  useEffect(() => {
    if (stageParam) setActiveTab(stageParam);
  }, [stageParam, roundParam]);

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

  const tab = activeTab ?? stageParam ?? event.stages[0]?.id ?? 'entries';

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
              initialFocusRoundId={stage.id === stageParam ? roundParam : null}
            />
          );
        })()
      )}
    </>
  );
}

function EntriesPanel({ sf, competition, event }: { sf: Savefile; competition: Competition; event: SportEvent }) {
  const eventRef = { competitionId: competition.id, eventId: event.id };
  const [importOpen, setImportOpen] = useState(false);
  const [ledgerEntryId, setLedgerEntryId] = useState<string | null>(null);
  const currentMd = sf.calendar.currentMatchday;
  const autoMax = Math.max(0, ...event.entries.map((e) => e.seeding));
  const ledgerEntry = event.entries.find((e) => e.id === ledgerEntryId) ?? null;

  return (
    <div className="panel" style={{ padding: 12, maxWidth: 760 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 10, flexWrap: 'wrap' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field__label">{t('competitions.cockpit.ratingMaxLabel')}</label>
          <NumberInput
            className="input"
            style={{ width: 90 }}
            value={event.ratingMax ?? 0}
            min={0}
            max={99999}
            step={0.01}
            allowFloat
            onCommit={(v) => setRatingMaxAction(eventRef, v === 0 ? null : v)}
          />
          <div className="field__hint">{t('competitions.cockpit.ratingMaxHint', { auto: autoMax })}</div>
        </div>
        <Button size="sm" onClick={() => setImportOpen(true)}>
          {t('competitions.cockpit.importBonus')}
        </Button>
      </div>

      <table className="data-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>{t('competitions.cockpit.entryCode')}</th>
            <th>{t('competitions.cockpit.entryName')}</th>
            <th>{t('competitions.cockpit.entrySeed')}</th>
            <th title={t('competitions.cockpit.styleHint')}>{t('competitions.cockpit.styleCol')}</th>
            <th>{t('competitions.cockpit.bonusCol')}</th>
            <th>{t('competitions.cockpit.effCol')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {event.entries.map((entry) => {
            const d = entryDisplay(sf, event, entry.id);
            const bonus = bonusAt(entry, currentMd);
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
                    onCommit={(value) => setEntrySeeding(eventRef, entry.id, value)}
                  />
                </td>
                <td style={{ width: 90 }}>
                  <NumberInput
                    className="input"
                    style={{ width: 68, padding: '2px 6px', fontSize: 12 }}
                    value={entry.styleMod}
                    min={-5}
                    max={5}
                    step={0.01}
                    allowFloat
                    title={t('competitions.cockpit.styleHint')}
                    onCommit={(value) => setEntryStyleAction(eventRef, entry.id, value)}
                  />
                </td>
                <td className="mono" style={{ color: bonus !== 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {bonus > 0 ? `+${bonus}` : bonus}
                </td>
                <td className="mono" style={{ fontWeight: 700 }}>
                  {Number((entry.seeding + bonus).toFixed(2))}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <Button size="sm" onClick={() => setLedgerEntryId(entry.id)}>
                    ✎
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="field__hint" style={{ marginTop: 8 }}>
        {t('competitions.cockpit.entrySeedHint')} · {t('competitions.cockpit.effCol')} ={' '}
        {t('competitions.cockpit.entrySeed')} + {t('competitions.cockpit.bonusCol')} @ MD{currentMd} /max{' '}
        {eventRatingMax(event)}
      </div>

      <BonusImportModal
        open={importOpen}
        sf={sf}
        event={event}
        eventRef={eventRef}
        onClose={() => setImportOpen(false)}
      />
      <BonusLedgerModal
        open={ledgerEntry !== null}
        entry={ledgerEntry}
        entryName={ledgerEntry ? entryDisplay(sf, event, ledgerEntry.id).name : ''}
        eventRef={eventRef}
        matchdaysPerSeason={sf.calendar.matchdaysPerSeason}
        onClose={() => setLedgerEntryId(null)}
      />
    </div>
  );
}
