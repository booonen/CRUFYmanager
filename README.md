# CRUFYmanager

A solo NationStates football-roleplay manager. Sister tool to [BRIXYmanager](https://github.com/booonen/BRIXYmanager) — same dark-pitch UI, same single-page-app philosophy, this time for clubs and pitches instead of nodes and trains.

CRUFY runs entirely in the browser. No server, no account, no telemetry. Your save lives in `localStorage` and can be exported as JSON whenever you want a backup.

## What it does

- **Nation-shaped league pyramid.** Configurable per league: number of teams, promotion / relegation slots, points system, tiebreakers.
- **Domestic cups.** Single-leg knockout or group → knockout, with configurable group size and advancement count.
- **Match engine.** Minute-by-minute commentary, goals/cards/injuries/subs, ET + penalty shootouts in cup ties, ~3–6 minutes of stoppage every match.
- **Generate-then-commit workflow.** Drafts can be re-rolled freely. Once committed, the match enters the **history book** (an append-only event ledger). Striking a record from the ledger is intentionally high-friction.
- **8-attribute player model.** Pace, Strength, Technique, Passing, Defending, Shooting, Mental, Goalkeeping, plus hidden Potential and Injury-proneness.
- **Manager system.** Tactical / Man-management / Youth-dev / Reputation. Retired players sometimes return as managers. AI clubs sack underperformers and hire from the unemployed pool.
- **Auto squad selection.** AI picks an XI per club from a chosen formation, with form-aware substitutions during the match.
- **Three advancement modes.** Click through match-by-match, draft a whole matchday at once, or fast-forward to end of season.
- **National team.** Auto-suggested 23 from eligible players; manual call-ups; off-engine NT and continental match logging.
- **phpBB BBCode export.** League tables, top-scorer charts, cup brackets, match reports, news digests, NT squads — one-click copy, ready to paste into NationStates forums.

## File layout

```
leaguemanager.html      — single-page app shell + tab routing
styles.css              — pitch-green dark theme (BRIXY-derived)
index.html              — redirect to leaguemanager.html
js/
  data.js               — formations, name banks, commentary phrase banks
  state.js              — schema, save/load, history book, derived views
  engine.js             — match sim, scheduling, AI, retirement, youth
  export.js             — phpBB BBCode generators
  ui.js                 — tabs, modal helpers, shared HTML helpers
  views.js              — page renderers (dashboard, leagues, cups, etc.)
  views2.js             — page renderers (fixtures, settings, IE, etc.)
  forms.js              — modal CRUD forms
```

## Getting started

1. Clone or download.
2. Open `leaguemanager.html` (or `index.html`) in any modern browser. No build step.
3. **Settings** → set your nation name, demonym, and FA name. Pick a default name bank.
4. **Leagues** → add a top-tier league.
5. **Clubs** → use **Bulk-create** to seed it with auto-generated clubs and squads.
6. **Fixtures** → draft and commit your first matchday.

## History book

Every committed match, retirement, hiring, sacking, and season transition is appended to a single event ledger. All derived views — career stats, club honours, all-time tables, news feed — read from it. If you ever need to undo a result, the ledger supports striking individual records (with double-confirmation), but they remain in the audit trail.

## Save format

`localStorage` key `crufy_save_v1`, single JSON document. Export and import via the **Saves** dropdown in the header or the **Import / Export** tab.

## License

MIT — see [LICENSE](./LICENSE).

## Version

v0.1.0 — initial release.
