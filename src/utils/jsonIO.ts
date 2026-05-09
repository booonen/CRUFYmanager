import type { Savefile } from '../domain/savefile';
import { SCHEMA_VERSION } from '../domain/savefile';
import { migrate } from '../db/migrations';

export interface SavefileEnvelope {
  schemaVersion: number;
  exportedAt: string;
  savefile: Savefile;
}

export function exportSavefile(savefile: Savefile): string {
  const envelope: SavefileEnvelope = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    savefile,
  };
  return JSON.stringify(envelope, null, 2);
}

export function downloadSavefile(savefile: Savefile, filenameSuffix?: string): void {
  const json = exportSavefile(savefile);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  const country = savefile.meta.countryShortCode || 'CRUFY';
  const suffix = filenameSuffix ? `-${filenameSuffix}` : '';
  a.href = url;
  a.download = `crufy-${country}-${stamp}${suffix}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseSavefile(jsonText: string): Savefile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`Not a valid JSON file: ${(err as Error).message}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Top-level JSON must be an object.');
  }

  const envelope = parsed as Partial<SavefileEnvelope>;
  if (
    typeof envelope.schemaVersion !== 'number' ||
    !envelope.savefile ||
    typeof envelope.savefile !== 'object'
  ) {
    throw new Error(
      'JSON does not look like a CRUFYmanager savefile (missing schemaVersion / savefile).',
    );
  }

  if (envelope.schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      `This savefile (v${envelope.schemaVersion}) was created by a newer CRUFYmanager. ` +
        `This build supports up to v${SCHEMA_VERSION}.`,
    );
  }

  const savefile = envelope.savefile as Savefile;
  if (!savefile.meta || typeof savefile.meta.countryName !== 'string') {
    throw new Error('Savefile is missing required meta.countryName.');
  }

  return migrate(savefile);
}
