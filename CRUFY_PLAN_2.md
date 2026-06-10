# CRUFYmanager — Project Plan, Second Generation

**Companion to APPYmanager and BRIXYmanager.** CRUFY is a competition manager and **scorinator** for NationStates sports roleplay: it manages the teams, players, and competitions of the savefile's country, simulates (or accepts) results, and produces paste-ready BBCode for the NS forum.

**This document supersedes [`CRUFY_PLAN_1.md`](CRUFY_PLAN_1.md)** as the canonical plan. Plan 1 remains in the repo for archaeology; its Phase 0–1 outcomes are carried into §11 here so this document is self-contained. Where the two documents disagree, this one wins.

---

## ⚠️ Status: ratified reframe, proposal-grade details

Plan 1 imagined CRUFY primarily as a self-playing football-manager-style sim. The user's second brief reframed it around how NationStates sports RP actually gets hosted:

- The host ("scorinator") runs competitions round by round and **posts results to the NS forum**. The post is the product.
- Results are not always simulated: sometimes the host **dictates a scoreline** and wants the app to elaborate it (events, scorers, stats); sometimes results are typed in entirely by hand.
- Hosts **re-run rounds** in real life (a forgotten RP bonus is the classic case), so "results are sacred" is wrong; what is sacred is what has already been *posted*.
- Roleplay quality feeds results: RPs are graded and the grade ("**Bonus**") adjusts a team's effective rank for upcoming rounds.
- Football is only the first sport. The long-term shape is multi-sport (up to Olympics-style multi-event Games), so the competition core — **the spine** — must be sport-agnostic from the start.

A replanning question round was held with the user on 2026-06-10. Its outcomes (§1) are **user-ratified and binding**. Most other concrete details in this document are the planning agent's proposals built on top of them — same status as plan 1's details: starting points, to be confirmed in each phase's question round.

### Required workflow for every phase (unchanged from plan 1 — it works)

Before writing any code in a given phase, the responsible sub-agent **must**:

1. **Re-read this document end-to-end.** Later phases depend on schema and decisions established in earlier phases, and the document may have been updated since the last phase.
2. **Produce a phase-specific design proposal** in `docs/phases/phase-N.md`: restate goals and the acceptance gate in your own words; list every concrete decision you intend to make; **explicitly flag every place you override, refine, or extend this document**; list open questions.
3. **Run a question round with the user.** Get explicit go-ahead. Iterate until sign-off. Every phase, no exceptions.
4. **Only then implement.** New questions mid-phase → pause and ask.
5. **Update this document** when the phase ends (outcomes log, §11; plus any schema/principle changes).

The user's working style is "Lazy God": autopilot for what they don't care about, full control over what they do. Figure out which is which *by asking*.

---

## 1. The replanning question round — ratified decisions (2026-06-10)

These four decisions came from an explicit question round and are **not** up for silent revision. Changing them requires a new question round.

### 1.1 Result mutability: **lock on publish**

Any result can be re-rolled, dictated, edited, or Bonus-adjusted **until the host marks it published** (= posted to NS). Published results are locked; touching one requires an explicit unlock action. Tables, brackets, and qualification **recompute automatically on any change** — standings are always derived from results, never independently authoritative.

This replaces plan 1's principle 2 ("competition results are sacred — never edited"). The sacred thing is the *published post*, not the sim output.

### 1.2 Bonus: graded RPs, additive on rank, **grading-scale-agnostic**

The user's wording, verbatim, because it is a requirement statement:

> "RPs are graded and then a value is assigned that is additively applied to rank. However, any grading system should work equally; we'll need to allow for variables to be set, so that a host using any grading system can effectively use CRUFY. If there is a host using a system which ranks RPs from 0–10, then the results should be the same if the RP grades are instead from 0–1000 across the board. (Provided there is internal consistency)"

Consequences: grades are normalized against per-savefile grading-scale variables before use; only the *normalized* value ever reaches the engine; and scale invariance is a **mandatory automated test** (§5.3).

### 1.3 Randomness: **per-savefile parameters**, fresh seeds, stored seeds

How strongly rank decides outcomes vs. chaos is controlled by **per-savefile sim parameters** (not per-event knobs, not hardcoded). Every sim rolls a **fresh seed** (non-deterministic by default), but the seed is **stored on the result**, so any result can be replayed/exported identically until it is re-rolled.

The user pointed at a commonly used community scorinator spreadsheet to mine for algorithmic tips — **learn from it, do not copy it**:
`https://docs.google.com/spreadsheets/d/1mR3goTl-4MKSz5Iw9jmD_LK5iZQMsiJXiGw7S6DyN5M/edit?gid=986165932#gid=986165932`
(Note: the cloud dev environment's network allowlist blocks `docs.google.com`, so it has not been studied yet. Phase 3's design round must do so — either from a session with access, or by asking the user to paste the relevant formulas/parameters into the round.)

### 1.4 Sport families: **all of them, eventually** — bake the taxonomy in now

Football first. After that, in some order: more head-to-head match sports (hockey, basketball, rugby, handball), races & marks (athletics, swimming, cycling), set sports (tennis, volleyball, badminton), judged sports (gymnastics, diving, figure skating). The spine's result-model taxonomy (§4.5) must accommodate all four families from Phase 2, even though only football's is implemented at first.

---

## 2. Design philosophy

1. **God-mode by default, autopilot by request.** The user can override anything; the sim runs autonomously when asked. Nobody is ever forced to wait for the sim or forced to set something manually. (Unchanged.)
2. **Published is sacred, everything else is fluid.** Results are freely re-rollable, dictatable, and editable until published; publishing locks them; unlocking is explicit and logged. Enforced at the data layer, not just UI. (Replaces "competitions are sacred".)
3. **The post is the product.** CRUFY's real output is BBCode pasted into the NS forum. Every result-producing flow ends in "copy/publish", and the publish pipeline is core, not polish.
4. **Manual entry is a first-class input, forever.** The sim is *one way* to fill in a result — never the only way. Hand-typed scores, dictated scorelines elaborated by the sim, and fully simmed results are equal citizens and can mix freely within a round.
5. **Stub-first.** Every competition flow must work with nothing but entry names and ranks (a 32-nation World Cup should need zero player records). Squads, players, and managers are optional depth that adds flavor (named scorers, richer reports) — they are never a prerequisite.
6. **Believable narrative over statistical purity.** Reports should read like real sport. Upsets happen; red cards swing matches; a siege reads like a siege. (Unchanged.)
7. **The spine consumes projections; sport modules own shapes.** Standings, brackets, and qualification logic never inspect sport-specific result payloads — they consume a normalized projection (§4.6). This is what makes sport #2 cheap and sport #7 possible.

---

## 3. Tech stack & conventions (carried from plan 1 / phases 0–1, all shipped)

- Vite + React 18 + TypeScript **strict** (`noUncheckedIndexedAccess` on, no `any`) + Zustand + Dexie 4 + React Router v6 + Vitest + nanoid. ESLint + Prettier.
- Visual language lifted from BRIXY/APPY: gold accent `#d4a73c`, tokens in `src/styles/tokens.css`, DM Sans / Fraunces / JetBrains Mono, dark theme only, 56 px header over a 220 px sidebar.
- **No native dialogs** — modal components only. Number inputs commit on blur/Enter.
- Single source-of-truth `useSavefileStore` holding the whole `Savefile`; per-domain selector hooks in `src/stores/*`. Debounced full-blob flush to Dexie.
- i18n: every visible string flows through `t()` / `src/lang/en.ts`.
- Hosting: GitHub Pages via Actions; deep links work via the `404.html` trick.
- **Schema versioning policy (in-development):** in-flight saves are disposable; schema changes mutate the v1 baseline without migrations. The migration system stays in place for the first post-release breaking change.
- Tests required for the engine and the spine's derivation logic (standings, qualification, projections); optional for plain UI.

---

## 4. The spine (sport-agnostic competition core)

The spine replaces plan 1's §3.4 competition model. The current `src/domain/competition.ts` and the unused parts of `src/domain/match.ts` are Phase-0 scaffolding with no real consumers (the Competitions route is a placeholder) — Phase 2 replaces them wholesale.

### 4.1 Concept hierarchy

```
Competition            a hosted property: "Cherry League", "World Cup 88", "Olympiad XII"
 └─ SportEvent[]       one per discipline; leagues/cups have exactly 1, a Games has many
     ├─ Entry[]        the participants of that event, with seeding + Bonus state
     └─ Stage[]        ordered phases: "Group Stage" → "Knockout"; "Heats" → "Final"
         └─ Round[]    the scorination unit: "Matchday 4", "Quarterfinals", "Heat 2"
             └─ Fixture[] / Unit[]   head-to-head pairings, or one N-entrant unit (races, judged)
                 └─ ResultEnvelope   the atomic result, with lifecycle + provenance
```

- **Competition** is what the host runs and what the forum thread is about. It owns presentation settings (name, BBCode flavor) and, for multi-event competitions, the medal table.
- **SportEvent** binds one sport module + one entry list + one stage chain. The UI collapses this layer when a competition has a single event (a league never shows "events").
- **Stage** has a format (§4.3) and produces **standings**; qualification rules map standings → next stage's entries (or final placements).
- **Round** is the unit hosts scorinate and publish: sim a round, post a round, Bonus applies between rounds.
- **Entry** is a team/athlete *in this event* — seeding, Bonus ledger, and eligibility live here, not on the club/NT record (the same club can have different ranks in different events).

### 4.2 Entries and participants

```ts
type ParticipantRef =
  | { kind: 'club'; id: string }            // domestic club (full data available)
  | { kind: 'foreign-club'; id: string }
  | { kind: 'national-team' }               // the savefile country's NT
  | { kind: 'foreign-nt'; id: string }
  | { kind: 'ad-hoc'; name: string; shortCode: string };  // stub-first: a bare named team
// future, Phase 8+: { kind: 'athlete'; ... } for individual sports

interface Entry {
  id: string;
  participant: ParticipantRef;
  seeding: { mode: 'rating'; value: number }      // 0–100 strength scale (club OVR compatible)
         | { mode: 'rank'; value: number };       // 1 = best; classic scorinator input
  bonus: RpGrade[];                               // §5.2 — the Bonus ledger for this event
}
```

`ad-hoc` participants are the stub-first principle made concrete: a host can paste 32 nation names, assign ranks, and scorinate a World Cup with zero world-building. Where a participant *does* resolve to rich data (domestic club with a squad), the football module uses it for scorers/ratings/reports; the spine itself never requires it. Default `rating` seeding for clubs is derived from squad OVR but always overridable.

### 4.3 Stages and formats

Stage formats absorb plan 1's six competition templates and add the shapes other families need:

| Format | Notes |
|---|---|
| `league` | single or double round-robin (plan 1's two league templates merged, `legs: 1 \| 2`) |
| `groups` | N groups of M, each a mini round-robin; qualification slots per group |
| `knockout` | single- or two-leg ties, optional third-place match, bracket seeding rules |
| `single-match` | super cup / final as its own stage |
| `heats-progression` | races & marks: rounds of N-entrant units, top-K (+ lucky losers) advance — Phase 8 |
| `ranking` | one pool, placements by aggregate mark/score (judged finals, time trials) — Phase 8 |

Formats are **presets with parameters**, not free-form; extending the format list requires a question round (carried rule from plan 1). Qualification rules (`top K of each group`, `best N thirds`, `winner advances`, `top 8 to final`) are declarative data on the stage, evaluated automatically — which is what makes brackets fill themselves in when group results change (§1.1's auto-recompute).

### 4.4 Rounds, fixtures, units

Head-to-head families produce **fixtures** (two entries per result). Races/marks and judged families produce **units** (one result covering N entries — a heat, a final apparatus rotation). Both are `competitors: EntryId[]` under the hood; fixtures are the 2-entry case with home/away semantics where the sport wants them.

### 4.5 Results: envelope + family-shaped payloads

One envelope for lifecycle/provenance, a discriminated payload per family. All four payload kinds are **defined in Phase 2** (the taxonomy is baked in per §1.4); only `score` gets an engine before Phase 8.

```ts
interface ResultEnvelope {
  id: string;
  roundId: string;
  competitors: string[];                    // entry ids, ordered (home first for fixtures)
  payload: ResultPayload;
  provenance: Provenance;                   // §5.4
  lifecycle: {
    status: 'draft' | 'published';
    publishedAt: string | null;
    unlocks: { at: string; note: string }[]; // every unlock is logged
  };
}

type ResultPayload =
  | { family: 'score';  score: [number, number];
      decidedBy: 'regulation' | 'extra-time' | 'shootout';
      shootout?: [number, number];
      detail?: MatchDetail }                // football elaboration: timeline, scorers, stats box
  | { family: 'sets';   sets: [number, number][] }                     // Phase 8+
  | { family: 'marks';  marks: { entryId: string; mark: number | null; // null = DNF/DSQ
                                 status: 'ok' | 'dnf' | 'dsq' | 'dns' }[] }  // Phase 8+
  | { family: 'judged'; scores: { entryId: string; total: number;
                                 breakdown?: Record<string, number> }[] };   // Phase 8+
```

`MatchDetail` is the football module's minute-by-minute elaboration (events timeline, player ratings, narrative flags, stats box — plan 1 §4's output, kept). It is optional: a hand-typed `3–1` is a complete, publishable result without it.

### 4.6 Projections and standings (the load-bearing abstraction)

Every payload projects to normalized rows; standings engines consume **only** projections:

```ts
interface OutcomeRow {
  entryId: string;
  outcome: 'W' | 'D' | 'L' | null;   // null for field events
  scoreFor: number | null;            // goals, sets won, etc.
  scoreAgainst: number | null;
  placing: number | null;             // 1..N within a unit (races, judged)
  mark: number | null;                // raw time/distance/points where meaningful
}
```

Standings engines (all pure functions over projections, all heavily tested):
- **Table** — configurable points (3/1/0 default), tiebreakers as an ordered rule list. House default (ratified): **points → GD → head-to-head (composite mini-table: points, then GD)**. Goals-for is *explicitly not used* in NS RP competitions and never appears in a default — it exists only as a per-stage opt-in.
- **Bracket** — tie resolution incl. two-leg aggregate/away-goals-toggle/shootouts; auto-fills from qualification.
- **Ranking** — placement by best/aggregate mark, for heats and judged stages (Phase 8).
- **Medal table** — per-competition rollup of event podiums (Phase 8, Games shells).

Standings are recomputed from results on every change and cached, never hand-edited. Editing or unlocking-and-editing any result anywhere reflows everything downstream automatically (§1.1).

### 4.7 Publish lifecycle & integrity

- Per-result `draft → published`; a round offers "publish all" as a convenience. Publishing stamps `publishedAt`.
- **Data-layer guard:** mutation helpers refuse to modify a published result's payload/provenance. The UI's unlock action is the only door, and it appends to `unlocks`.
- **Integrity warnings** go to the existing Issues system (Phase 1 shipped it), e.g.: a draft edit changed standings that a *published* later round was built on; a bracket slot's published tie contradicts re-derived qualification; Bonus changed after a round that consumed it was published. Warnings never block (God mode) — they inform.

### 4.8 Scheduling: every competition is free-running *(ratified in Phase 2's question round)*

There is no mapping of rounds onto external calendar slots and no real-world-date concept. A competition's schedule **is** its stages and rounds; the host advances through it at their own pace. (User, 2026-06-10: *"Each tournament will need a schedule, however, it is up to the user to progress through that schedule at their own pace."*)

What remains of plan 1's season calendar (seasons as labels, promotion/relegation cadence, the Calendar route) is an explicit **Phase 5 question-round item** — until then the calendar domain/route stay untouched.

---

## 5. The performance model (strength, Bonus, randomness, seeds)

How an entry's rank becomes a result. Shapes are binding; exact formulas and constants are Phase 3 design-round material (informed by the spreadsheet in §1.3).

### 5.1 Effective strength

1. **Base** from `Entry.seeding`: `rating` used directly (0–100); `rank` mapped through a per-savefile rank→rating curve (parameterized so hosts can tune how steep the top is).
2. **Bonus applied additively on the seeding scale** (per §1.2 "additively applied to rank"): rank-seeded → `effectiveRank = rank − bonusValue` (fractional ranks fine, lower = better) before the curve; rating-seeded → `effectiveRating = rating + bonusValue`.
3. The engine consumes the resulting effective rating; rich-data participants (domestic clubs) may *derive* their default rating from squad OVR, but at sim time there is only one number per entry plus sport-module context.

### 5.2 Bonus (scale-agnostic, per §1.2)

```ts
// per savefile
interface RpGradingConfig {
  scaleMin: number;     // e.g. 0
  scaleMax: number;     // e.g. 10, or 1000 — host's choice, results identical
  weight: number;       // what a maximum-grade RP is worth, in seeding-scale units
}
// per entry, per event
interface RpGrade { id: string; roundId: string | null; label: string; grade: number; }
```

`normalized = (grade − scaleMin) / (scaleMax − scaleMin)` (clamped to [0,1]); only normalized values reach the engine. How grades aggregate into the round's `bonusValue` (sum vs. mean vs. latest; whether old rounds' grades decay) is a **Phase 3 question-round item** — the user's systems-vary point suggests the aggregation itself may need to be a per-save setting.

**Mandatory test (CI, forever):** two savefiles identical except all grades and `scaleMin/scaleMax` multiplied by a constant produce **identical results** for identical seeds.

### 5.3 Randomness: per-savefile sim parameters

```ts
interface SimParams {
  upsetFactor: number;          // global: how much noise vs. strength gap
  rankCurve: { /* shape params for rank→rating */ };
  football: { goalEnvironment: number; drawBand: number; homeAdvantage: number; /* … */ };
  // future sports contribute their own parameter blocks
}
```

Engine shape (Phase 3 refines): per-competitor performance roll = effective rating + noise scaled by `upsetFactor`; the sport module maps the performance gap to a result (football: scoring-rate split → goal counts with a draw band; later sports: marks/sets from per-entry rolls). Calibration is owned by **distribution tests**, with defaults targeting believable football: roughly 25% draws between equals, and a ~20-point rating gap giving the favorite on the order of 70–75% wins — exact bands set in Phase 3, all reachable knobs being per-save params.

### 5.4 Seeds, replay, re-roll, dictation

```ts
interface Provenance {
  method: 'manual' | 'sim' | 'dictated-sim';
  seed: string | null;            // present for sim & dictated-sim; fresh-rolled per run
  engineVersion: string | null;   // module version that produced it
  dictation?: { score?: [number, number]; placings?: string[] };  // what the host fixed
  inputsDigest: string | null;    // hash of effective inputs (strengths, bonus, params)
}
```

- **Sim**: rolls a fresh seed, stores it. **Replay** re-runs deterministically from the stored seed (for re-export, regenerating reports, debugging); if `inputsDigest` no longer matches, the UI warns that inputs drifted since the roll. **Re-roll** (drafts only) replaces the seed.
- **Dictated-sim**: host fixes the scoreline (later: finishing order); the engine generates an elaboration *consistent with it* — timeline, scorers, stats that plausibly produce exactly that score. Same seed semantics.
- **Manual**: no seed; optionally annotated (scorers, notes). Equal citizen per philosophy #4.

---

## 6. The football module (Phase 3; carries plan 1 §4 with amendments)

Plan 1's minute-by-minute engine survives as the football module's elaboration layer — it is what makes reports worth posting, and dictation needs exactly that machinery. Carried: tick model with pressure/possession states; event resolvers (shot, foul, card, injury, sub) as tested pure functions; narrative flags (`momentum`, `siegeMode`, `gameOpen`, `tilt`) feeding reports; every event carrying its *reason*; lineup auto-selection (when squads exist) with the alt-position matrix still deferred; player ratings & stats box.

Amendments:
1. **Seeding per §5.4** — fresh-rolled stored seeds replace plan 1's derived-deterministic seeds (`savefile.id + fixtureId`). Replay uses the stored seed.
2. **Outcome vs. elaboration split.** The *outcome* layer (scoreline from effective strengths + SimParams) is the scorinator core and must run on stub entries alone. The *elaboration* layer (minute-by-minute detail) runs when asked, and degrades gracefully: full squads → named scorers and ratings; bare entries → anonymous-but-flavorful timelines ("the №9", or generated stand-in names — Phase 3 question).
3. **Dictation mode**: given a fixed final score, generate a consistent timeline (constraint-driven event placement rather than free simulation).
4. Plan 1's distribution/snapshot test suite carries over, recalibrated to §5.3's targets, plus dictation-respects-score and replay-identical tests.

---

## 7. Future sport families (Phase 8+; taxonomy fixed now per §1.4)

| Family | Payload | Stage formats exercised | Examples |
|---|---|---|---|
| Match sports | `score` | league, groups, knockout | football (now), hockey, basketball, rugby, handball |
| Races & marks | `marks` | heats-progression, ranking | athletics, swimming, cycling |
| Set sports | `sets` | knockout, league | tennis, volleyball, badminton |
| Judged | `judged` | ranking | gymnastics, diving, figure skating |

A sport module contributes: payload semantics + projection; an outcome engine over effective strengths + its SimParams block; optional elaboration + dictation support; result-entry UI fragment; BBCode renderers; format presets. The Phase 8 acceptance test of the spine is that athletics lands **without schema surgery** — only a module and presets. Races & marks goes first (the Olympics workhorse and the strongest stress test); set sports and judged follow; further match sports are cheap variants of football's shapes. Multi-event Games shells (one Competition, many SportEvents, medal table) land alongside.

---

## 8. Publish pipeline (Phase 4)

- Pure functions `ResultEnvelope[] + standings → string` (BBCode primary; markdown/plain secondary). Regenerable at any time; replay (§5.4) guarantees regenerated output matches what was locked.
- **Round post** is the flagship artifact: results list + updated table/bracket + scorers, paste-ready for NS with zero manual cleanup (plan 1's Phase 8 gate, pulled forward).
- Per-match prose reports (brief / standard / deep-narrative templates) for fixtures the host wants to feature, driven by `MatchDetail` narrative flags.
- Publishing and copying are one gesture: "publish round & copy BBCode". Optionally store the NS post URL on the round.

---

## 9. UI structure

Sidebar unchanged from Phase 1 (Overview / World / Country / Records / Beyond / System). The **Competitions** route becomes real in Phase 2: list → competition detail with stage tabs, round grid, inline fast score entry (type `3-1`, tab, next), per-round sim/publish/copy actions, standings always live alongside. Entries panel manages participants, seeding, and (Phase 3) the Bonus ledger with effective-strength preview. The Sim Test debug page (plan 1 Phase 4) survives in Phase 3 as the engine calibration harness. Calendar view stays as-is until Phase 5 re-integration.

---

## 10. Build phases

Phases 0–1 shipped under plan 1 (§11). Numbering continues; contents reordered around the scorinator core. **This reordering is a planning-agent proposal — ratify in Phase 2's question round** (§12).

### Phase 2 — The spine, manual-first
Domain: Competition/SportEvent/Stage/Round/Entry/ResultEnvelope with all four payload families typed; projections; table + bracket engines with declarative qualification; lifecycle with data-layer publish guard + logged unlocks; integrity warnings in Issues; ad-hoc participants; manual + potted-draw group assignment; Competitions UI with fast manual entry; BBCode table/results export (minimal, ahead of Phase 4 polish). Replaces `domain/competition.ts` scaffolding. **No engine yet — manual results prove the spine.** Design proposal: [`docs/phases/phase-2.md`](docs/phases/phase-2.md) (ratified 2026-06-10).
**Gate:** host builds a 32-entry World Cup (ad-hoc names + ranks only): groups → knockout, hand-typed results, standings/brackets always correct and auto-reflowing, rounds published (edits refused without unlock; unlock logged; integrity warning fires on upstream edits), group tables exported as BBCode. A classic double-RR league works the same way.

### Phase 3 — The football engine
§5 performance model end-to-end: per-save SimParams + RpGradingConfig editors, Bonus ledger UI, rank→rating curve; outcome engine; sim / re-roll / replay / dictated-sim on every draft fixture; elaboration layer (plan 1 tick engine) incl. graceful stub degradation; calibration + scale-invariance + replay + dictation test suite; Sim Test harness page. Design round studies the §1.3 spreadsheet.
**Gate:** all tests green; the Phase 2 World Cup re-run with mixed inputs — some rounds simmed, some dictated, some manual — plus Bonus grades entered between rounds, visibly shifting outcomes; any sim replayed identically; scale-invariance demonstrated.

### Phase 4 — Publish pipeline
§8 in full: round posts, prose match reports (3 templates), copy-all, publish-and-copy gesture, post-URL tracking.
**Gate:** a full tournament thread's worth of posts produced from CRUFY and pasted onto NS with no manual cleanup.

### Phase 5 — Seasons & the calendar question
Seasons as a concept (labels/cadence), promotion/relegation between linked competitions, end-of-season archive & rollover, player season stats accumulation (when squads exist). **Opens with a question round on what remains of plan 1's season calendar** — competitions are free-running by ratified decision (§4.8), so the Calendar route either becomes a cross-competition overview/dashboard or is retired.
**Gate:** a domestic league + cup run across two seasons with promotion/relegation and a correct archive.

### Phase 6 — Procedural generation (plan 1's Phase 2, deferred until depth is needed)
Player/squad/manager/league generators, name pools, stat fuzzification, bulk-create.
**Gate:** plan 1's — full 4-tier domestic pyramid generated in under 30 seconds.

### Phase 7 — National teams & internationals
NT squad auto-pick + eligibility, foreign-NT rosters with linked stubs, stub-player semantics in the elaboration layer, NT history.
**Gate:** an international tournament where some entries resolve to real NT squads (named scorers) and others stay stubs, in one event.

### Phase 8 — Second sport family: races & marks (then sets, judged)
`marks` engine + elaboration-lite, heats-progression + ranking formats, medal table, Games shells (multi-event competitions), athletics presets; afterwards sets and judged as separate sub-phases.
**Gate:** an athletics meet (heats → final) runs manual *and* simmed, medal table correct — with **no spine schema surgery**.

### Phase 9 — Football-world depth (optional; plan 1's Phase 7 demoted)
Transfers, windows, AI market, finances. Only if the user still wants it once the scorinator core is alive.

### Phase 10 — History, records & polish
Deep queryability (plan 1 Phase 9), all-time records, image-export match cards, user-editable templates, cross-savefile import re-keying.

---

## 11. Phase outcomes log (append-only; carried from plan 1 and continued here)

### Phase 0 — shipped 2026-05-09 (PR #4) · proposal: [`docs/phases/phase-0.md`](docs/phases/phase-0.md)
Locked: stack per §3 (Vite/React 18/TS strict/Zustand/Dexie 4/Router v6/Vitest/nanoid; ESLint+Prettier; `noUncheckedIndexedAccess`); BRIXY/APPY visual language (gold `#d4a73c`, tokens in `src/styles/tokens.css`, DM Sans/Fraunces/JetBrains Mono, dark only); full-width header over sidebar, Dashboard default route; **no native dialogs**; plan 1 §3 schema implemented as scaffolding (`SCHEMA_VERSION = 1`); Dexie multi-slot registry with 500 ms debounced blob flush; single `useSavefileStore` + per-domain selector hooks; `t()`/`en.ts` i18n from day one; BrowserRouter with `BASE_URL` basename + `404.html` fallback; GitHub Pages via Actions (`https://booonen.github.io/CRUFYmanager/`).

### Phase 1 — shipped 2026-05-10 (PR #5) · proposal: [`docs/phases/phase-1.md`](docs/phases/phase-1.md)
Locked (schema): 9 outfield + 3 GK-only game stats; 12 personality tags, 1–3 per player; 12 positions, single primary (alt-position matrix deferred); per-position OVR weight matrix (`src/utils/ovr.ts`); `firstName`/`lastName`; `preferredFoot` dropped; `Club.kind` + reserved `__free_agents__` club; `logoUrl`/`flagUrl` fields; manager stats = plan 1's five.
Locked (UX): modal confirms only; `<NumberInput>` commit-on-blur; list→profile routes for clubs/players; clickable squad rows; random kit palette; vertical color picker; 7-tier OVR color scale (inverted for injury proneness); sidebar sections Overview/World/Country/Records/Beyond/System; Issues as sidebar route with count badge; nationality defaults to savefile country.
Policy: in-development schema changes mutate the v1 baseline; no per-change migrations until first public release.

### Phase 2 — implemented 2026-06-10, gate verification pending · proposal: [`docs/phases/phase-2.md`](docs/phases/phase-2.md)
Question round resolved (proposal §9): scope & §10 reordering ratified; **scheduling concept dropped** — every competition is free-running, the season calendar's fate moved to Phase 5's round; **tiebreaker default points → GD → H2H, GF never in defaults** (NS convention; `'h2h'` = composite mini-table points→GD); **manual + potted draw** both shipped.
Implementation landed on `claude/affectionate-heisenberg-9bln2f` (commit `2e89e8b`): spine domain (`src/domain/spine/`), pure engines (`src/engine/` — projections, RR scheduler, tables, brackets with stable feeds, declarative qualification, publish guard, integrity warnings, generator + potted draw), cockpit UI (wizard with bulk paste, stage tabs, live standings, bracket view, fast score entry, AET/pens, publish/unlock, group draw, stage rules, manual lots, BBCode copy), Issues integration. 41 engine tests incl. an automated gate rehearsal; 72 total green. Implementation-level deviations logged in proposal §10 (notably: explicit `Stage.bracket` wiring with never-rewritten feeds; byes for non-power-of-two knockouts; entries fixed once generated in this phase).
**Outstanding before the phase closes:** the §6 manual gate checklist on the deployed Pages site, then merge + this log's final entry.

### Replan — 2026-06-10 (this document)
- User brief reframed CRUFY around the NS scorinator workflow; question round ratified the four decisions in §1 (lock-on-publish; scale-agnostic additive Bonus; per-savefile randomness with fresh stored seeds; all four sport families eventually, taxonomy baked in now).
- `CRUFY_PLAN_2.md` becomes canonical; plan 1 marked superseded.
- Phases renumbered/reordered per §10; Phase 2 = spine (manual-first), engine moved to Phase 3, publishing to Phase 4, generation deferred to Phase 6, transfers demoted to optional Phase 9.
- Scorinator reference spreadsheet recorded in §1.3; unfetchable from the cloud environment (network allowlist) — owed to Phase 3's design round.

---

## 12. Open questions ledger

~~For the next (Phase 2) question round~~ — **resolved 2026-06-10**, outcomes in [`docs/phases/phase-2.md`](docs/phases/phase-2.md) §9:
- §10 reordering **ratified**; Phase 2 scope ratified as proposed.
- Scheduling: the calendar-bound/free-running split is **gone** — every competition is free-running (§4.8); season-calendar's fate moved to Phase 5's round.
- Tiebreaker house default: **points → GD → H2H; goals-for never in defaults** (NS convention).
- Group assignment: **manual + potted draw**, both in Phase 2.
- Event layer + per-result publish with round-level "publish all": proceeding as proposed (covered by the scope ratification).

For Phase 3's round:
- Bonus aggregation (sum/mean/latest; decay; per-round vs cumulative) and whether aggregation itself is a per-save setting (§5.2).
- Bonus on rank-seeded entries: confirm rank-units-before-curve application (§5.1).
- Mine the §1.3 spreadsheet (needs network access or pasted formulas).
- Rank→rating curve shape; SimParams set and default calibration bands; draw/extra-time/shootout policy knobs per stage.
- Elaboration for stub entries: anonymous timeline vs generated stand-in names.

Carried from plan 1 (still open, now phase-shifted): name pools (Phase 6); relegation playoffs (Phase 5); transfer economy open/closed (Phase 9); report template trio (Phase 4).

---

*When in doubt: ask, don't assume. The user prefers five small questions over one big wrong assumption.*
