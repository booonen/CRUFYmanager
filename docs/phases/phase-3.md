# Phase 3 Design Proposal — The Football Engine

> **Status:** proposal — question round pending.

Companion to `CRUFY_PLAN_2.md` (canonical, esp. §1.2–§1.3 ratified decisions and §5). Restates the goal and gate, lists every concrete decision, flags deviations, ends with the question round.

---

## 1. Goal & acceptance gate (restated)

**Goal:** results can now be *generated*, not just typed. The §5 performance model lands end-to-end: per-savefile sim parameters and RP-grading config, the Bonus ledger with live effective ratings, fresh-seed sims with stored seeds (replay-identical until re-rolled), re-roll on drafts, dictated-scoreline elaboration, and a calibration test suite. Manual entry remains a first-class equal (philosophy #4).

**Acceptance gate (from plan §10):** all tests green; the Phase 2 World Cup re-run with mixed inputs — some rounds simmed, some dictated, some manual — plus Bonus grades entered between rounds visibly shifting outcomes; any sim replayed identically; scale invariance demonstrated.

**Out of scope:** the deep minute-by-minute tick model with player stats (plan-1 §4 survives as the *deep elaboration* layer once squad-backed entries play — a later phase; Phase 3 elaboration is goals-timeline level), report templates & post formats (Phase 4), non-football sports (Phase 8).

---

## 2. The outcome engine (concrete)

For a fixture between entries A and B:

1. **Effective rating**: `eff = seeding + bonusValue` (§3). Ratings are scale-free decimals (higher = better) per the Phase 2 polish decision.
2. **Gap**: `g = (effA − effB) / classGap`, where `classGap` is "the rating difference that makes a clear favorite" (→ Q2: per-save default with per-event override vs. auto-normalization).
3. **Chaos**: `g' = g + ε`, `ε ~ Normal(0, chaos)` rolled per match from the seeded PRNG. `chaos` is the per-save upset knob (default 0.35 gap-units).
4. **Goal expectancies**: `share = 1 / (1 + exp(−favoritism · g'))`; `λA = goalsPerMatch · share`, `λB = goalsPerMatch · (1 − share)` (+ `homeEdge` rating points to the home side before the gap, default 0 — NS tournaments are mostly neutral-venue). Defaults: `goalsPerMatch 2.7`, `favoritism 0.9`.
5. **Score**: independent Poisson draws per side. With defaults this yields ≈26% draws between equals and a one-class favorite winning ≈65% — final bands locked by calibration tests, every knob a per-save `SimParams` field (per the ratified §1.3 decision).
6. **Knockout deciders**: a level score in a KO/single-match stage automatically sims extra time (λ·⅓ per side, goals in 91′–120′, `decidedBy: 'extra-time'` if broken) then a shootout (per-kick model with a small gap-based edge, capped ~60/40; `decidedBy: 'shootout'`). Sims never leave an unresolved tie.
7. **Seeds & provenance**: every sim rolls a fresh seed (nanoid), stored on the result with `engineVersion` and an `inputsDigest` (hash of effective ratings, params, and stage rules). PRNG: xmur3-seeded mulberry32 — same seed + same inputs ⇒ identical result and detail (replay); drifted inputs flag a UI warning. Re-roll (drafts only) replaces the seed. Sims **never auto-publish**.

**Elaboration (v1)**: `detail` on the score payload changes from `null` to `MatchDetail | null`:
```ts
interface GoalEvent { entryId: string; minute: number; scorerName: string | null }
interface MatchDetail { goals: GoalEvent[] }   // minutes weighted gently toward the late game
```
Scorer names per Q4 (anonymous vs. generated stand-ins; squad-backed entries use real players in the later deep-elaboration phase). **Dictated-sim**: type a score by hand, then hit *Elaborate* — the engine generates a detail consistent with exactly that score (provenance `dictated-sim`, seeded and replayable).

---

## 3. Bonus (per ratified §1.2)

Per-savefile `RpGradingConfig { scaleMin, scaleMax, weightInGaps, aggregation }`:
- `normalized = clamp((grade − scaleMin) / (scaleMax − scaleMin), 0, 1)` — only normalized values reach the engine (host scale is irrelevant given internal consistency).
- **`weightInGaps`**: what a maximum-grade RP is worth, expressed as a *fraction of `classGap`* (default 0.5). This keeps the Bonus scale-free even across events with different rating scales.
- `bonusValue = aggregate(normalized grades) × weightInGaps × classGap` — aggregation per Q3.
- **Ledger UI**: the Entries tab grows an expandable Bonus ledger per entry (add/edit/remove grades with label + optional round) and an *effective rating* column. The mandatory scale-invariance test (grades and scale ×k ⇒ identical results for identical seeds) ships in CI.

---

## 4. Schema, settings UI, sim UX

- `savefile.scorination = { rpGrading, sim: SimParams }`, factory defaults + load-time backfill for existing saves. `SimParams = { goalsPerMatch, chaos, favoritism, classGap, homeEdge }`.
- **Scorination settings**: gear button on the Competitions page → modal editing `SimParams` + `RpGradingConfig` (plain `NumberInput`s with hints; no sliders).
- **Sim UX**: a dice button on every empty draft fixture (sim) and on simmed drafts (re-roll); *Sim round* in the round-card header fills only empty fixtures (never touches manual/dictated drafts or published results); *Elaborate* on manually-scored drafts (dictated-sim); a provenance chip per fixture (M / S / D); an expandable detail row listing goal minutes/scorers.
- **Sim Lab** (the plan-1 debug harness, kept): a System-section route — pick two ratings (+ params override), run 1 000 seeded sims, see the W/D/L and scoreline distribution. Calibration you can eyeball.

---

## 5. Tests

Calibration (1 000 fixed-seed sims each): equals → draws 22–30%, wins symmetric ±4 pts; gap = 1·classGap → favorite 58–72%; gap = 2 → 75–88%. Invariance: affine rating transform with classGap scaled ⇒ identical scores, same seeds; Bonus grade-scale ×100 ⇒ identical. Replay: same seed twice ⇒ identical payload incl. detail; re-roll ⇒ new seed. Dictation: score preserved exactly, detail goal count matches. KO: sims always resolve, decidedBy/shootout shapes correct, no shootout goals in GF/GA (existing projection tests already pin this). Bulk: *Sim round* skips non-empty fixtures. Plus the standing gate rehearsal extended with mixed inputs.

---

## 6. Deviations / extensions flagged

1. `ResultPayload.score.detail` type changes (`null` → `MatchDetail | null`) — in-dev baseline mutation, no migration.
2. `weightInGaps` (Bonus expressed in class-gap fractions) is new — it is what keeps §1.2's scale-agnosticism compatible with mixed rating scales.
3. KO sims always resolve via ET+pens; the manual-entry path keeps allowing unresolved draws (engine refuses to).
4. The scorinator-reference spreadsheet (plan §1.3) **still cannot be fetched from this environment** (network allowlist) → Q1.
5. Deep tick-model elaboration (cards, possession, narrative flags, player ratings) explicitly deferred until entries resolve to squads.

---

## 7. Question round

- **Q1 — Spreadsheet**: proceed with the model above now, or wait for / paste the sheet's formulas?
- **Q2 — Rating scales**: how should the engine interpret gaps across events with different scales (football ~0–30 vs Olympic 0–100)?
- **Q3 — Bonus aggregation**: how do multiple graded RPs combine into one bonus?
- **Q4 — Stub scorers**: when entries have no players, do generated match details use anonymous minutes or invented stand-in names?

---

## 8. Resolved decisions (question round outcome, 2026-06-10)

- **Q1 — Build the model now.** Engine ships on the proposal's Poisson/logistic model; when the user pastes the reference sheet's formulas later, we compare and recalibrate in a follow-up round.
- **Q2 — Zero-anchored scale.** *"Zero is always the bottom anchor. Scale from zero to max, or from zero to an arbitrary number that the user has provided as max rank."* No class-gap parameter: ratings normalize as `rating / ratingMax`, where `ratingMax` is per-event — host-provided, defaulting to the highest entry seeding. The gap the curve sees is `(effA − effB) / ratingMax` ∈ [−1, 1].
- **Q3 — Bonus values are host-computed; grading is out of scope.** *"Hosts will input (or rather, import) bonus values at each matchday. The exact grading system … is out of scope — hosts will calculate boni themselves."* §3's `RpGradingConfig` (scaleMin/scaleMax/weightInGaps/aggregation) is **deleted**. The ledger becomes `BonusEntry { matchday, value, note }` in plain rating units; at sim time a team's bonus is the latest value with `matchday ≤` the round's matchday. Bulk import per matchday ("CODE, value" lines) is the primary input path. The §1.2 grade-scale invariance test morphs into rating-scale invariance: ratings+bonuses+ratingMax scaled together ⇒ identical results for identical seeds.
- **Q4 — No detail for rank-only entries (the U model).** *"No players = no player simming."* Match detail generation (scorers, minutes — even anonymous) is gated on player-backed entries and deferred with the deep-elaboration layer; Phase 3 sims produce scorelines (+ ET/pens) only. `detail` stays `null`; `dictated-sim` provenance stays in the type for that later phase. Phase 3 scope tightens to: params, bonus ledger + import, outcome engine, seeds/replay/re-roll, sim UX, Sim Lab, calibration suite.
