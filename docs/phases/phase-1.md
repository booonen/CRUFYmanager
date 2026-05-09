# Phase 1 Design Proposal — Static Entity Management

> **Status:** awaiting user sign-off. No code yet.

Companion to `CRUFY_PLAN_1.md`. Per the plan workflow, this restates Phase 1 goals, lists every concrete decision I plan to make, flags overrides/extensions of the plan, and ends with a question round.

---

## 1. Goal & acceptance gate (restated)

**Goal:** user can populate a world manually before any simulation exists.

**Acceptance gate (verbatim from plan):** user can build out an entire domestic league (12 clubs, 25 players each, 12 managers) entirely by hand. No simulation yet, no calendar yet. Just data entry.

**Out of scope for Phase 1:** procedural generation (Phase 2), calendar (Phase 3), match engine (Phase 4), competitions (Phase 3+), national team and foreign-resident/foreign-NT-stub players (Phase 6), transfers (Phase 7).

---

## 2. Phase 1 ships

- **Clubs view**: list + detail. Create, edit, delete clubs. Squad list with inline add/remove player. Manager assignment slot.
- **Players view (domestic only)**: list + detail. CRUD. Filters: club, position, foot, personality. Sort: OVR, name, age, club. OVR is computed and displayed.
- **Managers view**: list + detail. CRUD. Pool of unemployed shows separately. Hire-to-club / sack actions.
- **World view (foreign world basics)**: foreign leagues CRUD + foreign clubs CRUD. *Foreign players deferred to Phase 6* (they're tied to the foreign-NT-stub flow).
- **Dashboard updates**: stat cards now reflect real counts, plus a "Squad coverage" warning panel when any club is below 11 players.
- **Validation**: min/max constraints, helpful errors, no native dialogs.

---

## 3. Schema decisions to ratify (the §3.2/§3.5/§3.6 placeholder list)

The plan flagged these as "specifically suspect." Phase 1 is when they bite, so this proposal locks them down. Defaults below are the plan's values; question round captures any overrides.

### 3.1 Game stats — propose the plan's 10 verbatim

```
pace · finishing · passing · dribbling · defending
heading · goalkeeping · vision · physicality · technique
```

All `0–100`. `goalkeeping` only meaningfully matters for GKs; we keep it as a regular stat (rather than splitting into a GK-only sub-block) for engine simplicity. This is the plan's call; happy to revisit. **See Q1.**

### 3.2 Hidden / character stats — propose the plan's 5 verbatim

`injuryProneness`, `potential`, `consistency`, `workRate` (all 0–100) + `personality` (one of 8 tags).

### 3.3 Personality tags — propose the plan's 8 verbatim

```
Professional · Mercurial · Loyal · Ambitious
Hothead · Leader · Quiet · Showboat
```

These are flavour tags, not an opposed-pair system. Each player has exactly one. **See Q2.**

### 3.4 Position taxonomy — propose the plan's 8 verbatim

```
GK · DEF-CB · DEF-FB · MID-DM · MID-CM · MID-AM · FWD-W · FWD-ST
```

`DEF-FB` covers both LB/RB; `FWD-W` covers both wings. Could split into LB/RB/LW/RW for tactical asymmetry, but the formation picker (Phase 4) will select sides separately. **See Q3.**

### 3.5 Manager stats — propose the plan's 5 verbatim

`tactical`, `motivation`, `development`, `discipline`, `adaptability` (all 0–100).

### 3.6 OVR formula — concrete proposal

A per-position weight matrix. OVR is the dot product of weights and stats, rounded to int. Example weights (`0–1`, sum to 1.0 per row):

| pos | pace | fin | pass | drib | def | head | gk | vis | phys | tech |
|---|---|---|---|---|---|---|---|---|---|---|
| GK     | 0.05 | 0   | 0.05 | 0   | 0.05 | 0.05 | 0.55 | 0.05 | 0.10 | 0.10 |
| DEF-CB | 0.05 | 0   | 0.10 | 0.05 | 0.30 | 0.20 | 0    | 0.05 | 0.15 | 0.10 |
| DEF-FB | 0.20 | 0.05| 0.15 | 0.10 | 0.20 | 0.05 | 0    | 0.05 | 0.10 | 0.10 |
| MID-DM | 0.05 | 0.05| 0.20 | 0.10 | 0.20 | 0.05 | 0    | 0.15 | 0.10 | 0.10 |
| MID-CM | 0.05 | 0.10| 0.25 | 0.10 | 0.10 | 0.05 | 0    | 0.20 | 0.05 | 0.10 |
| MID-AM | 0.10 | 0.15| 0.20 | 0.15 | 0.05 | 0.05 | 0    | 0.20 | 0.05 | 0.05 |
| FWD-W  | 0.25 | 0.15| 0.10 | 0.20 | 0.05 | 0.05 | 0    | 0.10 | 0.05 | 0.05 |
| FWD-ST | 0.15 | 0.30| 0.05 | 0.15 | 0.05 | 0.10 | 0    | 0.05 | 0.10 | 0.05 |

Tunable later; Phase 1 only *displays* OVR, the match engine uses raw stats. Lives in `src/utils/ovr.ts`. **See Q4.**

### 3.7 Other small lockdowns

- **Validation ranges**: stats 0–100; player age 14–50; squad size soft-warns < 11 and > 30 (no hard cap, just a warning panel — "lazy god" lets users break their own rules).
- **DOB is calendar-relative** per plan §3.2. The form takes "age N" as input and writes `{ season: currentSeason - N, matchday: currentMatchday }`; display computes age from the current calendar position.
- **Squad numbers**: `1–99`, optional, auto-suggest the lowest unused number when adding a player to a squad.
- **Founding year**: numeric, can be negative or 0 (clubs older than the savefile's season 1).
- **Club colors**: two hex inputs (primary/secondary). No image uploads.
- **Finances**: `balance: number` exists in schema, but the Phase 1 UI shows it read-only (just a row in the club detail panel). No transactions until Phase 7.

---

## 4. UI patterns

### 4.1 List + detail

Each entity gets a two-pane layout: list on the left (with filter controls in a top bar), detail on the right (when something is selected). Click adds; Edit pre-fills modal; Delete shows confirm modal (modal pattern from Phase 0). On narrow widths the detail collapses to a stacked card under the list.

### 4.2 Squad list inside Club detail

A table with columns: number · name · pos · age · OVR · form · fitness · contract. Add Player button opens a multi-step modal (identity → stats → contract). Remove Player from squad sets `clubId` to `null` and removes from `squadPlayerIds`; the player still exists, just unassigned. Delete from the player's own page actually deletes.

### 4.3 Hire/fire flow

On a club's detail panel, the Manager slot shows current manager card OR an "Assign manager" button. Click opens a manager picker modal (filtered to unemployed by default, with a "show all" toggle that warns when reassigning a manager already under contract). Sack button on the manager card prompts a confirm modal and sets `contractClubId` to `null`.

### 4.4 Player form (the big one)

A single modal with three labeled sections: **Identity** (name / nationality / position / foot / age / squad number / club), **Stats** (10 game + 5 hidden, sliders 0–100 with numeric input + computed OVR badge that updates live), **Contract** (until-season picker, opening morale/form/fitness defaulting to 70/75/100). Submit creates the player with the right discriminated `tier: 'domestic'`.

### 4.5 Filters + sort

URL-driven via search params (`?club=…&pos=…&sort=ovr-desc`) so users can bookmark filtered views. Page count + simple "load more" if list exceeds 200 rows. No virtualisation in Phase 1 — premature; will add when sim history starts producing thousands of records.

### 4.6 Cascade behaviour

- Delete a club → its players become unassigned (`clubId: null` is **not** valid since `tier: 'domestic'` requires a `clubId`; instead we offer two choices in the confirm dialog: *delete club and its players* OR *delete club, demote players to free agents (move to a "Free Agents" pseudo-club)*). I'll create a synthetic `FREE_AGENTS` reserved club id that exists per savefile and is non-deletable. **See Q5.**
- Delete a manager → set `club.managerId = null` for any club they were assigned to.
- Delete a player → remove from `club.squadPlayerIds` and any national team roster lists.

---

## 5. Schema additions / extensions

Mostly the plan as-written; small additions needed:

- **Reserved free-agents club**: synthetic club with id `__free_agents__`, name "Free Agents", flagged `kind: 'free-agents' | 'club'` (new optional field on `Club`). Hidden from competition participant pickers. Stored alongside other clubs in `savefile.clubs`. Initialized lazily on first use.
- **`Club.kind`** discriminator (above) — additive, optional; existing clubs default to `'club'` in a v1→v2 migration. Bumps `SCHEMA_VERSION` to 2.
- **`Player` form-input shape ≠ stored shape**: the modal form takes friendly inputs (age, year-strings, percentage sliders) and converts to the stored discriminated player. A small `playerFormToDomain` util.
- No new top-level entities.

**Migration**: `migrations[1] = (sf) => { /* add kind to existing clubs, bump version */ }`. Tested.

---

## 6. New files / structure

```
src/
├── routes/
│   ├── Clubs.tsx                  # was placeholder
│   ├── ClubDetail.tsx             # nested route
│   ├── Players.tsx                # was placeholder
│   ├── PlayerDetail.tsx
│   ├── Managers.tsx               # NEW (no placeholder existed)
│   ├── ManagerDetail.tsx
│   └── World.tsx                  # was placeholder
├── components/
│   ├── ListPane.tsx               # generic filterable list
│   ├── DetailPane.tsx             # generic right-panel shell
│   ├── StatSlider.tsx
│   ├── PositionPicker.tsx
│   ├── PersonalityPicker.tsx
│   ├── FormationPicker.tsx
│   ├── ColorSwatchPicker.tsx
│   ├── PlayerCard.tsx
│   ├── ClubCard.tsx
│   ├── ManagerCard.tsx
│   └── ConfirmModal.tsx           # extracted from Phase 0 inline use
├── utils/
│   ├── ovr.ts
│   ├── age.ts
│   ├── playerForm.ts              # form ↔ domain
│   └── freeAgents.ts              # reserved-club helpers
└── stores/
    ├── clubs.ts                   # add CRUD actions
    ├── players.ts                 # add CRUD actions
    ├── managers.ts                # add CRUD actions
    └── foreignWorld.ts            # add CRUD actions
```

Routes nest under `/clubs/:id`, `/players/:id`, `/managers/:id`. The list pane stays mounted; only the detail pane re-renders on selection.

---

## 7. Tests

- `utils/ovr.ts`: known-stat-block produces expected OVR per position.
- `utils/age.ts`: DOB↔age round-trip across season boundaries.
- `stores/clubs.ts` actions: add club / update / delete with cascade options; manager assignment.
- `stores/players.ts` actions: add player / move between clubs / delete with squad cleanup.
- `stores/managers.ts` actions: hire / fire; reassignment warning surface.
- `db/migrations.ts`: v1 → v2 migration produces clubs with `kind: 'club'` and free-agents stub when needed.
- No UI tests yet (per plan).

---

## 8. Acceptance gate verification plan

Manual, on the deployed Pages site:
1. Create a fresh savefile.
2. Create 12 clubs (form takes <30 s each).
3. Create 12 managers.
4. Hire each manager to a club.
5. Create 12 × 25 = 300 players, each assigned to a club. (This will take a while — fine. Phase 2 ships generators.)
6. Refresh the tab; everything persists.
7. Export to JSON; structure looks right.
8. Re-import; second savefile mirrors the first.
9. Open the dashboard; counts are 12 / 12 / 300; squad-coverage panel is silent (all squads ≥ 11).
10. Delete one club via the "demote to free agents" path; its 25 players appear in the Free Agents pseudo-club.

---

## 9. Plan deviations / overrides

Flagged inline above; consolidated:

- **Free Agents pseudo-club** is a Phase 1 invention. The plan doesn't address what happens to a player when their club is deleted. Alternative: forbid club deletion when squad is non-empty (forces user to manually unassign first). I think the pseudo-club is friendlier. **See Q5.**
- **`Club.kind` discriminator + SCHEMA_VERSION bump to 2.** Non-breaking; migration writes `kind: 'club'` to existing clubs.
- **OVR formula concretized** to the matrix in §3.6. Plan only said "weighted by position."
- **Validation ranges** are mine; plan didn't specify.
- **Foreign world scope reduced**: leagues + clubs only; foreign-resident and foreign-NT-stub players deferred to Phase 6 because their semantics tie to the NT registration flow.

---

## 10. Open questions for the user (the question round)

The four below get put through `AskUserQuestion`. Smaller items above default to my proposal unless you push back in the question's "Other" field.

**Q1. Game stats list (the 10).** Accept the plan's list verbatim, or prefer one of the alternatives below?

**Q2. Personality tags.** Accept the plan's 8 verbatim, or expand for more flavour?

**Q3. Position taxonomy.** Accept the plan's 8, or split DEF-FB into LB/RB and FWD-W into LW/RW (16 total) for tactical asymmetry?

**Q4. OVR formula.** Accept the proposed weight matrix in §3.6 (tunable later), or take a different approach?

**Q5. Club deletion behaviour.** Demote players to a synthetic Free Agents club (lazy-god friendly), or forbid deletion when squad is non-empty (strict)?

Smaller defaults I'm taking unless you say otherwise: 14–50 age range, 11/30 squad soft-warn, finances read-only in Phase 1, foreign world = leagues+clubs only (foreign players deferred to Phase 6), URL-driven filter state, no virtualisation yet.
