export type ParticipantRef =
  | { kind: 'club'; id: string }
  | { kind: 'foreign-club'; id: string }
  | { kind: 'national-team' }
  | { kind: 'foreign-nt'; id: string }
  | { kind: 'ad-hoc'; name: string; shortCode: string };
