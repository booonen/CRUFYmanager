import type { Savefile } from '../domain/savefile';
import type { ParticipantRef, SportEvent } from '../domain/spine';

export interface ParticipantDisplay {
  name: string;
  code: string;
}

const codeOf = (name: string) => name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || '???';

export function participantDisplay(sf: Savefile, ref: ParticipantRef): ParticipantDisplay {
  switch (ref.kind) {
    case 'club': {
      const club = sf.clubs.find((c) => c.id === ref.id);
      return club
        ? { name: club.name, code: club.shortName.toUpperCase() || codeOf(club.name) }
        : { name: '?', code: '???' };
    }
    case 'foreign-club': {
      const club = sf.foreignWorld.clubs.find((c) => c.id === ref.id);
      return club ? { name: club.name, code: codeOf(club.name) } : { name: '?', code: '???' };
    }
    case 'national-team':
      return { name: sf.meta.countryName, code: sf.meta.countryShortCode };
    case 'foreign-nt': {
      const nt = sf.foreignWorld.nationalTeams.find((n) => n.id === ref.id);
      return nt ? { name: nt.countryName, code: codeOf(nt.countryName) } : { name: '?', code: '???' };
    }
    case 'ad-hoc':
      return { name: ref.name, code: ref.shortCode.toUpperCase() || codeOf(ref.name) };
  }
}

export function entryDisplay(sf: Savefile, event: SportEvent, entryId: string | null): ParticipantDisplay {
  if (!entryId) return { name: '—', code: '—' };
  const entry = event.entries.find((e) => e.id === entryId);
  if (!entry) return { name: '?', code: '???' };
  return participantDisplay(sf, entry.participant);
}
