# Phase 0 Design Proposal — Scaffold & Schema

> **Status:** shipped. Phase 0 acceptance gate met on 2026-05-09. Merged to `main` via PR #4.
> Post-ship polish (header layout, dashboard route, modal rename/delete, BrowserRouter) included in the same PR.

Companion to `CRUFY_PLAN_1.md`. This is the per-phase design proposal the plan requires before any implementation. It restates Phase 0 goals, lists the concrete decisions I plan to make, flags every place I'm overriding/extending the plan, and ends with an open-question round for sign-off.

---

## 1. Goal & acceptance gate (restated)

**Goal:** project boots, schema is locked, persistence works.

**Acceptance gate (verbatim from plan):** can create a new savefile, name it, save, close the tab, reopen, and see it. Can export to JSON and re-import as a second savefile.

**Out of scope for Phase 0:** any feature UI (clubs, players, calendar, sim). Routes exist but are placeholder shells. No procedural generation. No match engine. No reports.

---

## 2. Tech & tooling

Per the plan, accepted as-is:
- **Vite** + **React 18** + **TypeScript** (strict mode, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`).
- **Zustand** for state, **one store per major domain** (see §5).
- **Dexie 4** for IndexedDB; migration system from day one.
- **React Router v6** (data router APIs OK; sidebar nav drives `<NavLink>` routes).
- **Vitest** for tests (Phase 0: just smoke tests for persistence + schema round-trip).
- **`nanoid`** for ids.
- **ESLint + Prettier**, default TS configs, no Tailwind (BRIXY/APPY use vanilla CSS custom properties — we'll match).

---

## 3. Visual language (lifted from BRIXY/APPY)

CSS custom properties exposed in `src/styles/tokens.css`:

```css
:root {
  --bg: #0f1117;
  --bg-raised: #181a23;
  --bg-input: #1e2130;
  --bg-hover: #242738;
  --border: #2a2d3e;
  --text: #e2e4ed;
  --text-dim: #8b8fa4;
  --text-muted: #5c5f73;
  --danger: #e05555;
  --warn: #e0a855;
  --success: #55c07a;
  --radius-sm: 5px;
  --radius: 8px;
  --radius-lg: 12px;
  --font-body: 'DM Sans', sans-serif;
  --font-display: 'Fraunces', serif;
  --font-mono: 'JetBrains Mono', monospace;
  --shadow: 0 2px 12px rgba(0,0,0,0.3);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.4);
  --transition: 150ms ease;
  --accent: <USER DECISION — see Q1>;
  --accent-glow: <derived from --accent>;
}
```

Layout: 56px header, 220px fixed sidebar (`--bg-raised`), main scroll content with 28–32px padding. Dark theme only (matches both reference repos). Singleton-modal pattern, but implemented in React via a `<ModalProvider>` + portal rather than a single global div.

**Override flagged:** the plan says "match BRIXY/APPY conventions" — BRIXY/APPY are vanilla HTML/JS with no build step. CRUFY's React/TS stack is a deliberate uplift; I'm inheriting visuals (colors, fonts, spacing, layout, modal pattern) but not architecture (no global mutable `data` object; no inline `onclick` handlers; React function components; Zustand for state; React Router for nav).

---

## 4. File layout

```
CRUFYmanager/
├── CRUFY_PLAN_1.md
├── CRUFY_PHASE_0_PROPOSAL.md          # this doc
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── public/
└── src/
    ├── main.tsx                        # React root + Router + DB hydrate
    ├── App.tsx                         # Layout shell (header + sidebar + Outlet)
    ├── styles/
    │   ├── tokens.css
    │   ├── globals.css
    │   └── components.css
    ├── components/
    │   ├── Layout.tsx
    │   ├── Sidebar.tsx
    │   ├── Header.tsx
    │   ├── Modal.tsx                   # portal + ModalProvider context
    │   ├── Button.tsx
    │   └── EmptyState.tsx
    ├── routes/                         # one per top-level view (placeholder bodies)
    │   ├── Calendar.tsx
    │   ├── Competitions.tsx
    │   ├── Clubs.tsx
    │   ├── Players.tsx
    │   ├── NationalTeam.tsx
    │   ├── OtherMatches.tsx
    │   ├── History.tsx
    │   ├── World.tsx
    │   └── NewSavefile.tsx             # initial create flow
    ├── domain/                         # pure type defs, no logic
    │   ├── index.ts
    │   ├── savefile.ts
    │   ├── calendar.ts
    │   ├── competition.ts
    │   ├── club.ts
    │   ├── player.ts                   # discriminated union
    │   ├── manager.ts
    │   ├── nationalTeam.ts
    │   ├── foreignWorld.ts
    │   ├── otherMatches.ts
    │   └── history.ts
    ├── stores/                         # Zustand — one per domain
    │   ├── savefile.ts
    │   ├── calendar.ts
    │   ├── competitions.ts
    │   ├── clubs.ts
    │   ├── players.ts
    │   ├── managers.ts
    │   ├── nationalTeam.ts
    │   ├── foreignWorld.ts
    │   ├── otherMatches.ts
    │   ├── history.ts
    │   └── settings.ts
    ├── db/
    │   ├── schema.ts                   # Dexie schema + version()
    │   ├── migrations.ts
    │   └── persistence.ts              # debounced save → flush
    └── utils/
        ├── ids.ts                      # nanoid wrapper
        └── jsonIO.ts                   # export/import with id re-key
```

---

## 5. Stores (Zustand)

Per the plan: one store per major domain. Each store exposes selectors + mutators; mutators call into a shared `persistence.scheduleSave()` that debounces a write of the *full* savefile to IndexedDB.

Stores: `savefile` (meta + active save id), `calendar`, `competitions`, `clubs`, `players`, `managers`, `nationalTeam`, `foreignWorld`, `otherMatches`, `history`, `settings`.

**Override flagged:** BRIXY/APPY use a single global `data` object. The plan says split per domain. I'm following the plan. Trade-off: cross-domain reads (e.g. "list players for club X") use a small `selectors.ts` helper rather than a single store hook. I think this is right but flagging it.

---

## 6. Persistence model

**IndexedDB schema (Dexie):**
- `meta`: `{ id: 'singleton', activeSaveId: string | null, schemaVersion: number }`
- `saves`: keyed by save id — `{ id, name, createdAt, lastSavedAt, savefile: Savefile }`

**Multi-slot savefile registry**, mirroring BRIXY/APPY. User can hold multiple savefiles in the same browser; one is "active" at a time. New / Switch / Delete / Duplicate / Export / Import operations.

**Debounced save:** any mutator calls `scheduleSave()`; a 500 ms debounce flushes the entire active savefile blob to the `saves` table. (Plenty fast for Phase 0 entity sizes; we'll revisit when sim history grows.)

**Export / import:** JSON blob = `{ schemaVersion, savefile }`. Import validates `schemaVersion`, re-keys all ids, writes as a new save, switches to it.

**Migration system from day one:** `db/migrations.ts` exposes `migrate(from, to, savefile)`. Phase 0 only has v1, but the scaffolding exists so later phases can add v2, v3 without ad-hoc fixes.

**Override flagged:** the plan in §3.1 doesn't explicitly require multi-slot saves — it just says JSON export/import. BRIXY/APPY both ship multi-slot. I think shipping multi-slot from day one is cheap and matches the family. **Q3.**

---

## 7. Schema (Phase 0)

Implementing §3 of the plan as TypeScript types in `src/domain/`. **No deviations from the plan's schema in Phase 0.** Every type from §3.1–§3.10 exists as a TS interface/discriminated union.

Phase 0 explicitly ships *types only* for entities the user can't yet create (clubs, players, etc.). The Dexie blob can hold them — they just start empty for new saves.

The "New savefile" flow asks for: country name, country short code (3 letters), matchdays per season (default 52). That's the full §3.1 `meta` + an empty `Calendar`. Everything else initializes empty.

**Schema-level questions deferred to later phases** (see §3 of plan and "specifically suspect parts" callout): exact game stats list, personality tags, manager stat list, competition templates beyond the 6 listed, narrative flag specifics. None of these need to resolve in Phase 0 — they're just type fields.

---

## 8. i18n

BRIXY/APPY ship `t('key')` lookups + `lang/en.js` from day one.

**Proposal:** ship a tiny `t()` helper + `src/lang/en.ts` in Phase 0 so every user-facing string flows through it. No second language yet, no language switcher UI. Cheap insurance, hard to retrofit later. **Q4.**

---

## 9. Tests (Phase 0)

- `db/persistence.test.ts`: round-trip a synthetic savefile through Dexie, assert it comes back equal.
- `utils/jsonIO.test.ts`: export → import → re-key; assert no id collisions and structural equality of non-id fields.
- `stores/*.test.ts`: smoke test that hydration + a single mutation persist correctly.

No UI tests yet (per plan §1).

---

## 10. Acceptance gate verification plan

Manual, demonstrated to user:
1. `npm run dev` boots the app at `localhost:5173`.
2. Sidebar shows 8 placeholder views; dark theme matches BRIXY/APPY visual feel.
3. "New savefile" flow accepts country name, short code, matchdays/season; creates a save and switches to it.
4. Refresh tab → savefile is still active.
5. Export to JSON → file downloads. Import in a second tab → second savefile registered.
6. Switch between saves; both persist.

---

## 11. Resolved decisions (question round outcome)

- **Q1 Accent.** Gold `#d4a73c`. `--accent-glow` derived as `rgba(212, 167, 60, 0.18)`.
- **Q2 App name in chrome.** `CRUFYmanager` (matches sibling naming).
- **Q3 Multi-slot savefile registry.** Ship from day one. Dexie `saves` table is keyed; `meta.activeSaveId` selects active save.
- **Q4 i18n.** Ship `t()` helper + `src/lang/en.ts` from day one. No language switcher, no second language.
- **Q5 Workflow.** Initial commit + draft PR opened up front; subsequent commits push incrementally to `claude/build-crufy-5s8vz`.
- **Q6 Proposal-doc lifecycle.** Default: at end of Phase 0, this file moves to `docs/phases/phase-0.md`. Same pattern for future phases.

Implementation begins per this proposal.
