import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { PageHeading } from '../components/PageHeading';
import { t } from '../lang';
import { downloadSavefile } from '../utils/jsonIO';
import { useSavefileStore } from '../stores/savefile';
import { loadSaveSlot } from '../db/persistence';
import type { SaveSlotSummary } from '../domain/savefile';

export function SavesRoute() {
  const slots = useSavefileStore((s) => s.slots);
  const activeSaveId = useSavefileStore((s) => s.activeSaveId);
  const refreshSlots = useSavefileStore((s) => s.refreshSlots);
  const switchTo = useSavefileStore((s) => s.switchTo);
  const deleteSlot = useSavefileStore((s) => s.deleteSlot);
  const renameSlot = useSavefileStore((s) => s.renameSlot);
  const createSavefile = useSavefileStore((s) => s.createSavefile);
  const importFromJson = useSavefileStore((s) => s.importFromJson);

  const [creating, setCreating] = useState(false);
  const [renamingSlot, setRenamingSlot] = useState<SaveSlotSummary | null>(null);
  const [deletingSlot, setDeletingSlot] = useState<SaveSlotSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void refreshSlots();
  }, [refreshSlots]);

  const handleExport = async (id: string) => {
    const slot = await loadSaveSlot(id);
    if (!slot) return;
    downloadSavefile(slot.savefile);
  };

  const handleImportClick = () => {
    setImportError(null);
    fileInputRef.current?.click();
  };

  const handleImportFile = async (file: File) => {
    setImportError(null);
    try {
      const text = await file.text();
      await importFromJson(text);
    } catch (err) {
      setImportError((err as Error).message);
    }
  };

  return (
    <>
      <PageHeading
        title={t('nav.saves')}
        sub={t('app.tagline')}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void handleImportFile(file);
                }
                e.target.value = '';
              }}
            />
            <Button onClick={handleImportClick}>{t('saves.import')}</Button>
            <Button variant="primary" onClick={() => setCreating(true)}>
              {t('saves.new')}
            </Button>
          </div>
        }
      />

      {importError ? (
        <div className="panel" style={{ marginBottom: 16, borderColor: 'var(--danger)' }}>
          <strong style={{ color: 'var(--danger)' }}>{t('errors.importFailed')}:</strong>{' '}
          <span className="text-dim">{importError}</span>
        </div>
      ) : null}

      {slots.length === 0 ? (
        <EmptyState
          glyph="◉"
          title={t('saves.empty.title')}
          body={t('saves.empty.body')}
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              {t('saves.new')}
            </Button>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {slots.map((slot) => {
            const isActive = slot.id === activeSaveId;
            return (
              <div
                key={slot.id}
                className="panel"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  borderColor: isActive ? 'var(--accent)' : 'var(--border)',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <strong style={{ fontSize: 15 }}>{slot.name}</strong>
                    <span
                      className="mono"
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: 'var(--bg-input)',
                        color: 'var(--text-dim)',
                      }}
                    >
                      {slot.countryShortCode}
                    </span>
                    {isActive ? (
                      <span
                        className="mono"
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: 'var(--accent-glow)',
                          color: 'var(--accent)',
                        }}
                      >
                        {t('saves.activeBadge')}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-muted mono" style={{ fontSize: 12, marginTop: 4 }}>
                    {new Date(slot.lastSavedAt).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {!isActive ? (
                    <Button size="sm" onClick={() => void switchTo(slot.id)}>
                      {t('saves.switch')}
                    </Button>
                  ) : null}
                  <Button size="sm" onClick={() => setRenamingSlot(slot)}>
                    {t('saves.rename')}
                  </Button>
                  <Button size="sm" onClick={() => void handleExport(slot.id)}>
                    {t('saves.export')}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setDeletingSlot(slot)}
                  >
                    {t('saves.delete')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NewSavefileModal
        open={creating}
        onCancel={() => setCreating(false)}
        onCreate={async (input) => {
          await createSavefile(input);
          setCreating(false);
        }}
      />

      <RenameSavefileModal
        slot={renamingSlot}
        onCancel={() => setRenamingSlot(null)}
        onRename={async (id, name) => {
          await renameSlot(id, name);
          setRenamingSlot(null);
        }}
      />

      <DeleteSavefileModal
        slot={deletingSlot}
        onCancel={() => setDeletingSlot(null)}
        onConfirm={async (id) => {
          await deleteSlot(id);
          setDeletingSlot(null);
        }}
      />
    </>
  );
}

interface RenameSavefileModalProps {
  slot: SaveSlotSummary | null;
  onCancel: () => void;
  onRename: (id: string, name: string) => Promise<void>;
}

function RenameSavefileModal({ slot, onCancel, onRename }: RenameSavefileModalProps) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (slot) {
      setName(slot.name);
      setSubmitting(false);
    }
  }, [slot]);

  if (!slot) return null;

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && trimmed !== slot.name && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onRename(slot.id, trimmed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={true}
      title={t('saves.renameTitle')}
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!canSubmit} onClick={() => void submit()}>
            {t('saves.rename')}
          </Button>
        </>
      }
    >
      <div className="field">
        <label className="field__label" htmlFor="rename-input">
          {t('saves.renameLabel')}
        </label>
        <input
          id="rename-input"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
          autoFocus
        />
      </div>
    </Modal>
  );
}

interface DeleteSavefileModalProps {
  slot: SaveSlotSummary | null;
  onCancel: () => void;
  onConfirm: (id: string) => Promise<void>;
}

function DeleteSavefileModal({ slot, onCancel, onConfirm }: DeleteSavefileModalProps) {
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (slot) setSubmitting(false);
  }, [slot]);

  if (!slot) return null;

  const submit = async () => {
    setSubmitting(true);
    try {
      await onConfirm(slot.id);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={true}
      title={t('saves.deleteTitle')}
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>{t('common.cancel')}</Button>
          <Button variant="danger" disabled={submitting} onClick={() => void submit()}>
            {t('saves.delete')}
          </Button>
        </>
      }
    >
      <p className="text-dim" style={{ fontSize: 13 }}>
        {t('saves.deleteWarning', { name: slot.name })}
      </p>
    </Modal>
  );
}

interface NewSavefileModalProps {
  open: boolean;
  onCancel: () => void;
  onCreate: (input: {
    countryName: string;
    countryShortCode: string;
    matchdaysPerSeason: number;
  }) => Promise<void>;
}

function NewSavefileModal({ open, onCancel, onCreate }: NewSavefileModalProps) {
  const [countryName, setCountryName] = useState('');
  const [countryShortCode, setCountryShortCode] = useState('');
  const [matchdaysPerSeason, setMatchdaysPerSeason] = useState(52);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setCountryName('');
      setCountryShortCode('');
      setMatchdaysPerSeason(52);
      setSubmitting(false);
    }
  }, [open]);

  const canSubmit =
    countryName.trim().length > 0 &&
    countryShortCode.trim().length >= 2 &&
    matchdaysPerSeason >= 4 &&
    matchdaysPerSeason <= 200 &&
    !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onCreate({
        countryName: countryName.trim(),
        countryShortCode: countryShortCode.trim().toUpperCase().slice(0, 3),
        matchdaysPerSeason,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('saves.create')}
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!canSubmit} onClick={() => void submit()}>
            {t('saves.create')}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="field">
          <label className="field__label" htmlFor="cn-country">
            {t('saves.fields.countryName')}
          </label>
          <input
            id="cn-country"
            className="input"
            value={countryName}
            onChange={(e) => setCountryName(e.target.value)}
            placeholder="Republic of Foo"
            autoFocus
          />
          <div className="field__hint">{t('saves.fields.countryNameHint')}</div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="cn-short">
            {t('saves.fields.countryShortCode')}
          </label>
          <input
            id="cn-short"
            className="input mono"
            value={countryShortCode}
            onChange={(e) => setCountryShortCode(e.target.value.toUpperCase().slice(0, 3))}
            placeholder="FOO"
            maxLength={3}
            style={{ width: 120, textTransform: 'uppercase' }}
          />
          <div className="field__hint">{t('saves.fields.countryShortCodeHint')}</div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="cn-mdps">
            {t('saves.fields.matchdaysPerSeason')}
          </label>
          <input
            id="cn-mdps"
            type="number"
            className="input mono"
            value={matchdaysPerSeason}
            min={4}
            max={200}
            onChange={(e) => setMatchdaysPerSeason(Number(e.target.value) || 52)}
            style={{ width: 120 }}
          />
          <div className="field__hint">{t('saves.fields.matchdaysPerSeasonHint')}</div>
        </div>
      </div>
    </Modal>
  );
}
