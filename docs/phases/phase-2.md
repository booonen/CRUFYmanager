# Phase 2 Design Proposal — The Spine, Manual-First

> **Status:** ratified 2026-06-10 — question round complete (see §9); implementation in progress.

Companion to `CRUFY_PLAN_2.md` (canonical). Per the plan workflow, this restates the Phase 2 goal and gate, lists every concrete decision I intend to make, flags every override/extension of the plan, and ends with the question round.

---

## 1. Goal & acceptance gate (restated)

**Goal:** the sport-agnostic competition core — Competition → SportEvent → Stage → Round → Fixture → Result — exists, with hand-typed results as the only input method. Standings, brackets, and qualification are pure derivations that reflow on any change. Publish-locking works at the data layer. No engine, no Bonus math, no calendar wiring: a host can already run a real tournament thread out of CRUFY, typing scores in by hand.

**Acceptance gate (from plan §10):** build a 32-entry World Cup from ad-hoc names + ranks only — groups → knockout, hand-typed results, standings/brackets always correct and auto-reflowing, rounds published (edits refused without unlock; unlocks logged; integrity warning fires on upstream edits), group tables exported as BBCode. A classic double-round-robin league works the same way.

**Out of scope:** sim/Bonus/SimParams (Phase 3), real publish pipeline & prose reports (Phase 4 — Phase 2 ships only minimal table/results BBCode), calendar placement & seasons (Phase 5), non-football sports (Phase 8 — but their payload types are defined now per plan §1.4).

---

## 2. Domain model (concrete TypeScript)

New folder `src/domain/spine/` (a cohesive subsystem; flat-file convention continues elsewhere), re-exported through `src/domain/index.ts`. The old `src/domain/competition.ts` is **deleted** — it was Phase-0 scaffolding with no real consumers (`routes/Competitions.tsx` is a placeholder; `stores/competitions.ts` is a one-line selector; `domain/history.ts` only imports the `Competition` type, which the new module re-provides).

```ts
// participant.ts
export type ParticipantRef =
  | { kind: 'club'; id: string }
  | { kind: 'foreign-club'; id: string }
  | { kind: 'national-team' }
  | { kind: 'foreign-nt'; id: string }
  | { kind: 'ad-hoc'; name: string; shortCode: string };

// entry.ts
export interface RpGrade {                 // schema ships now, UI in Phase 3
  id: string; roundId: string | null; label: string; grade: number;
}
export interface Entry {
  id: string;
  participant: ParticipantRef;
  seeding: { mode: 'rating' | 'rank'; value: number };
  bonus: RpGrade[];                        // always [] until Phase 3
}

// competition.ts
export interface Competition {
  id: string; name: string; shortName: string;     // free-running by nature (Q2): the
  sportEvents: SportEvent[];               // named to avoid DOM `Event` collision
}                                          // schedule is the stages/rounds themselves

// event.ts
export type SportId = 'football';          // union grows in Phase 8
export interface SportEvent {
  id: string; name: string; sport: SportId;
  entries: Entry[];
  stages: Stage[];                         // ordered; qualification feeds N → N+1
}

// stage.ts
export type StageFormat =
  | { kind: 'league';   legs: 1 | 2 }
  | { kind: 'groups';   legs: 1 | 2 }                       // group count = groups.length
  | { kind: 'knockout'; legs: 1 | 2; thirdPlace: boolean }  // final is always single-leg
  | { kind: 'single-match' };

export interface Group { id: string; name: string; entryIds: string[] }

export type QualRule =
  | { kind: 'top-n-overall'; n: number }                    // league/table stages
  | { kind: 'top-n-per-group'; n: number }
  | { kind: 'best-of-place'; place: number; count: number } // e.g. 4 best third-placed

export type PairingPattern = 'standard-cross' | 'ranked' | 'manual';
  // standard-cross: FIFA-style A1–B2 templates (shipped for 2/4/8-group cases)
  // ranked: 1 v N, 2 v N−1, …
  // manual: host drags entries into bracket slots (always available as override)

export interface TiebreakerConfig {
  order: ('gd' | 'gf' | 'h2h')[];          // after points, always. 'h2h' = composite
}                                          // mini-table (points → GD). Default ['gd','h2h'];
                                           // 'gf' is opt-in only (Q3 — NS convention)

export interface Stage {
  id: string; name: string;
  format: StageFormat;
  entryIds: string[];                      // first stage: all; later stages: fed or manual
  groups: Group[];                         // empty unless kind 'groups'
  rounds: Round[];
  qualification: QualRule[];               // how this stage feeds the NEXT one
  pairing: PairingPattern;                 // how qualifiers are seeded into the next stage
  points: { win: number; draw: number; loss: number };      // default 3/1/0
  tiebreakers: TiebreakerConfig;
  manualTieOrder: string[][];              // host-resolved ties: each inner array is a
}                                          // tied set in chosen order; final tiebreaker

// round.ts
export interface Round {
  id: string; index: number; name: string; // auto-named ("Matchday 4", "Semifinals"), renamable
  fixtures: Fixture[];
}
export interface Fixture {
  id: string;
  homeEntryId: string | null;              // null = TBD bracket slot (or bye)
  awayEntryId: string | null;
  groupId: string | null;
  tieId: string | null; leg: 1 | 2 | null; // two-leg knockout linkage
  result: ResultEnvelope | null;           // results live inline on the fixture
}

// result.ts — all four payload families typed now; only 'score' is producible in P2
export type ResultPayload =
  | { family: 'score'; score: [number, number];
      decidedBy: 'regulation' | 'extra-time' | 'shootout';
      shootout: [number, number] | null;
      detail: null }                       // MatchDetail arrives with the Phase 3 engine
  | { family: 'sets';   sets: [number, number][] }
  | { family: 'marks';  marks: { entryId: string; mark: number | null;
                                 status: 'ok' | 'dnf' | 'dsq' | 'dns' }[] }
  | { family: 'judged'; scores: { entryId: string; total: number }[] };

export interface ResultEnvelope {
  id: string;
  competitors: string[];                   // entry ids, home first
  payload: ResultPayload;
  provenance: { method: 'manual' | 'sim' | 'dictated-sim';
                seed: string | null; engineVersion: string | null;
                inputsDigest: string | null };   // 'manual' in all of Phase 2
  lifecycle: { status: 'draft' | 'published'; publishedAt: string | null;
               unlocks: { at: string; note: string }[] };
  modifiedAt: string;                      // drives integrity checks
}
```

`Savefile.competitions` switches to the new `Competition`. No migration: per the in-development policy the v1 baseline mutates, and every existing save has an empty `competitions` array anyway. `domain/history.ts` keeps compiling (its `dissolvedCompetitions: Competition[]` follows the new type).

---

## 3. Engines (pure, tested) — new top-level `src/engine/`

| File | Responsibility |
|---|---|
| `projection.ts` | `ResultPayload → OutcomeRow[]` per plan §4.6. Only `score` implemented; other families `throw` with a Phase-8 marker. **Shootout goals do not count toward GF/GA** (football convention); the shootout decides `outcome` only. |
| `roundrobin.ts` | Circle-method scheduler, 1–2 legs, odd counts get byes; every pair meets exactly `legs` times, nobody plays twice in a round. |
| `table.ts` | Points + configurable tiebreakers, including head-to-head mini-tables and `manualTieOrder` as the final step; rows still tied after everything are flagged `unresolved` for the UI. |
| `bracket.ts` | Tie resolution: single-leg (KO draws must carry `decidedBy` ET/shootout — entry UI enforces), two-leg aggregate with an away-goals toggle (**default off**), winner/loser propagation into TBD slots, third-place feed. |
| `qualification.ts` | Evaluates `QualRule[]` over final standings; pairing patterns into the next stage. Next stage auto-fills **only when the source stage is complete** (every fixture has a result); a "Seed next stage now" button lets the host force it early (God mode). |
| `integrity.ts` | Warnings (→ Issues route): **stale-upstream** — a round containing published results while an earlier round in the same or a feeding stage has a result with `modifiedAt > publishedAt`; **bracket contradiction** — recomputed qualification disagrees with the occupants of an already-published bracket fixture. Warnings inform, never block. |
| `mutate.ts` | The only write-path for spine data (called by store actions): set/clear result, publish round / publish result, unlock (note required, appended to `unlocks`), edit entries/stages. **Refuses any mutation of a published result** — the plan's data-layer guard. |

Standings/brackets/qualification are **never persisted** — they are memoized selectors over results ("recomputed and cached" from plan §4.6 = selector memoization, not stored caches).

`computeIssues(clubs)` becomes `computeIssues(savefile)` and gains the integrity warnings alongside the Phase 1 squad-coverage checks.

---

## 4. UI

- **`/competitions`** — card list + **New Competition wizard** (modal, multi-step): basics (name, short name) → format preset → entries → review & generate. Presets map to stage chains: *League* (single/double RR), *Groups + Knockout* (group count, legs, qualifiers per group, optional best-of-place, KO legs, third place), *Knockout* (size, legs, third place), *Single match*. Free-form stage editing is **not** in Phase 2 — presets only, per the plan's formats-are-presets rule.
- **Entry input is host-shaped:** a bulk paste box — one entry per line, `Name, CODE, rank` (rank optional) — plus pickers for existing clubs/NTs/foreign teams. Ad-hoc entries are the expected default for international tournaments.
- **`/competitions/:id`** — the scorinator cockpit. Stage tabs across the top; inside a stage: standings panel (group tables / league table / bracket view) beside the rounds column. Per round: fixture rows with **fast score entry** (two number cells; Enter commits and jumps to the next fixture; standings reflow instantly), an ET/shootout popover on knockout fixtures, a publish bar ("Publish round" locks all completed results; lock icons per fixture; unlock via modal requiring a note), and a "Copy BBCode" button (round results / stage tables — minimal `[table]` markup, Phase 4 owns the real pipeline). Entries tab for the entry list, seeding edits, and late additions (blocked once the entry appears in any published result).
- The SportEvent layer is **collapsed in the UI** whenever a competition has exactly one event (every Phase 2 competition does — the wizard creates one football event implicitly).
- Reuses Phase 0/1 furniture: `Modal`, `ConfirmModal`, `NumberInput`, `Button`, `EmptyState`, `PageHeading`; all strings through `t()`; no native dialogs.

---

## 5. Tests

- `roundrobin`: pair coverage, no double-bookings, byes, 2-leg mirroring.
- `table`: points/GD/GF; H2H mini-table resolution incl. 3-way; `manualTieOrder`; `unresolved` flagging; double-RR home/away accumulation.
- `bracket`: single-leg shootout; two-leg aggregate ± away-goals toggle; propagation into TBDs; third-place; bye handling.
- `qualification`: top-n-per-group; best-of-place across groups; standard-cross pattern for the 8×4 → R16 case; ranked pairing; stage-complete gating + forced seeding.
- `projection`: score → rows; shootout exclusion from GF/GA.
- `mutate`: published-result mutations refused; unlock (with note) → edit allowed → re-publish; unlock log grows.
- `integrity`: stale-upstream and bracket-contradiction fixtures fire; clean savefile is silent.
- Persistence round-trip of a populated competition (Dexie blob in/out).

---

## 6. Gate verification (manual, on the deployed Pages site)

1. New competition → Groups + Knockout preset: 8 groups × 4, single leg, top 2 advance, KO single leg with third place. Paste 32 ad-hoc entries with ranks.
2. Type all 48 group results; tables reflow live; resolve any tie flags; publish each matchday round; verify a published score refuses edits until unlocked (note logged).
3. Stage completes → R16 auto-fills via standard cross; play the bracket through (at least one ET and one shootout result); third place + final.
4. Unlock and change a group-stage result *after* R16 rounds are published → stale-upstream warning appears in Issues; bracket recompute disagreement surfaces the contradiction warning.
5. Copy group-table BBCode and round-results BBCode; eyeball NS-renderable markup.
6. Second competition → League preset, 12 entries, double RR; verify 22 matchdays, correct table, publish flow.
7. Refresh + export/import round-trips everything.

---

## 7. Plan deviations / extensions (consolidated)

1. **Results live inline on fixtures** (`Fixture.result`), not in a separate store; `ResultEnvelope` drops the plan's `roundId` (derivable) and gains `modifiedAt`. Envelope/payload shapes otherwise per plan §4.5.
2. **`Entry.bonus` ships now** (empty, no UI) so the schema doesn't churn again in Phase 3.
3. **Standings caching = memoized selectors**, never persisted (refines plan §4.6 "recomputed and cached").
4. **Knockout finals are always single-leg**; `legs: 2` applies to earlier KO rounds only.
5. **Shootout goals excluded from GF/GA** (decide outcome only).
6. **Next-stage auto-fill waits for stage completion**, with a God-mode "seed now" override.
7. **`manualTieOrder`** is the lots-drawing mechanism: hosts order tied sets by hand; no RNG in Phase 2.
8. ~~Wizard offers `free-running` only~~ — superseded by Q2: the `scheduling` field is gone; all competitions are free-running by nature.
9. **Layout**: spine types under `src/domain/spine/`, engines under new `src/engine/` (first non-domain/non-UI source folder).
10. `SportId` union starts at `'football'` even though all four payload families are typed (plan §1.4 taxonomy honored at the result level, not the module level).

---

## ~~8. Question round~~ — answered, see §9

- **Q1 — Ratify the plan-2 §10 reordering and this Phase 2 scope** (spine manual-first now; engine P3; publish pipeline P4; generation deferred to P6; transfers optional P9).
- **Q2 — Scheduling**: ship both `scheduling` values but wire only free-running in Phase 2 (calendar-bound lands with Phase 5)?
- **Q3 — House default tiebreaker order** (always configurable per stage): overall GD-first (FIFA) vs head-to-head-first (UEFA)?
- **Q4 — Group assignment**: manual only, or also a seeded-pot random draw in Phase 2?

---

## 9. Resolved decisions (question round outcome, 2026-06-10)

- **Q1 — Ratified.** Phase ordering and this scope proceed as proposed.
- **Q2 — The `scheduling` concept is dropped entirely.** User: real-world-date mapping isn't wanted; *"Each tournament will need a schedule, however, it is up to the user to progress through that schedule at their own pace."* Every competition is free-running by nature — its schedule is its own stages/rounds, advanced manually. The `Competition.scheduling` field is removed from §2. Whether the savefile-level season calendar still has a job (seasons, promotion/relegation cadence) is now an explicit **Phase 5 question-round item**; the Calendar route/domain stay untouched until then.
- **Q3 — Default tiebreakers: points → goal difference → head-to-head. Goals-for is explicitly NOT used in NS RP competitions** and must never sneak into a default. Implementation: `TiebreakerConfig.order` becomes `('gd' | 'gf' | 'h2h')[]` where `'h2h'` is a composite mini-table among the tied entries (points, then GD within the mini-table — no GF inside it either). House default `['gd', 'h2h']`; `'gf'` exists only as an explicit opt-in. After the list is exhausted: `manualTieOrder`, then `unresolved` flag.
- **Q4 — Manual + potted draw, both in Phase 2.** Rank entries into pots, "Draw" performs a seeded random draw, re-rollable until accepted; hand placement always available.
