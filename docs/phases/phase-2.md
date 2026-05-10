# Phase 2 Design Proposal — Procedural Generation

> **Status:** awaiting user sign-off. No code yet.

Companion to `CRUFY_PLAN_1.md`. Per the workflow, this restates Phase 2 goals, lists every concrete decision I plan to make, flags overrides/extensions of the plan, and ends with a question round.

---

## 1. Goal & acceptance gate (restated)

**Goal:** Lazy God mode for entity creation.

**Acceptance gate (verbatim from plan):** user clicks "Generate full domestic league for [country], 4 tiers, 16 clubs each" and gets a complete world in under 30 seconds.

**Out of scope for Phase 2:** calendar (Phase 3), match engine (Phase 4), competitions (Phase 3+), national teams (Phase 6), transfers (Phase 7).

---

## 2. Phase 2 ships

- **Player generator** — given `(position, age, targetOvr, nationality, personalityCount)`, produce a Player whose stats roll up to roughly the target OVR.
- **Squad generator** — given `(clubId, targetClubOvr, squadSize?)`, produce a positionally-balanced squad and link them to the club.
- **Manager generator** — given `(nationality, targetOvr?)`, produce a Manager.
- **League generator** — given `(countryName, tierCount, clubsPerTier, ovrCurve)`, generate N tiers × M clubs per tier; each club gets a name, kit colors, stadium, founding year, manager, and a full squad.
- **Name generator** — per-nationality first/last name pools, plus a generic-fictional fallback. Configurable via JSON files in `src/data/names/`.
- **City + club name pools** — small per-nationality pools so generated clubs feel local rather than nameless.
- **"Randomize stats" button** — on the existing player form, fills the stat block with values that roll up to a chosen target OVR. Does not auto-save; you can still tweak before submitting.
- **"Generate squad" button** — on the club detail page, opens a modal to fill an empty (or partial) squad to a target OVR.
- **"Generate manager" button** — on the managers view, adds N unemployed managers in one click.

---

## 3. Generation algorithms

### 3.1 Player stat sampling for a target OVR

Given a position and a target OVR `T`:
1. Get the position's weight vector `w` (12 weights summing to 1).
2. Sample raw stat block `s` where each stat is drawn from a bias-shifted truncated normal: high-weight stats lean toward `T + Δ`, low-weight stats lean toward `T − Δ` for some spread `Δ`. Personality stats (consistency / workRate / injuryProneness / potential) get their own simple distributions.
3. Compute resulting OVR via the existing `computeOvr(position, s)`. If it's more than ±2 off from `T`, do up to 5 calibration passes that nudge top-weighted stats up/down by 1 each.

This produces stat blocks that look like a real player at that level (high-weight stats are higher than low-weight ones), without forcing every striker to be a clone.

### 3.2 Personality sampling

Pick 1–3 tags. Distribution: 70% chance of 1 tag, 25% chance of 2, 5% chance of 3. Each tag uniformly picked, no duplicates.

### 3.3 Hidden stats

- `potential`: bias toward `targetOvr + ageBonus`, where younger players (age < 23) get a +5 to +20 boost. Older players (age > 30) get a slight downshift.
- `injuryProneness`: bias toward 30 ± 20.
- `consistency`, `workRate`: bias toward 60 ± 15.

### 3.4 Age distribution within a squad

Realistic age curve for a 25-man squad:
- 1 senior keeper (28–34) and 1 backup (18–24)
- ~6 senior outfield (28–32)
- ~12 prime outfield (23–27)
- ~5 youth outfield (17–22)
- 1 veteran (33–37)

Tunable. Lives in `src/utils/squadShape.ts`.

### 3.5 Positional distribution within a 25-man squad

```
GK: 3
DEF-CB: 4   DEF-LB: 2   DEF-RB: 2     (= 8 defenders)
MID-CDM: 2  MID-CM: 3   MID-CAM: 2
MID-LM: 1   MID-RM: 1                  (= 9 midfielders)
FWD-LW: 1   FWD-RW: 1   FWD-ST: 3      (= 5 forwards)
```

Total 25. Configurable. **See Q3.**

### 3.6 OVR curve within a squad (around club target OVR `C`)

For a 25-man squad targeting club OVR `C`:
- 2 first-team stars: `C + 6 to C + 10`
- 9 first-team regulars: `C + 0 to C + 5`
- 9 squad players: `C − 3 to C + 2`
- 5 reserves / youth: `C − 8 to C − 1`

Average roughly comes out to `C` (+ a small star premium). Club OVR (computed as the mean of the top 18 by `computeOvr`) lands close to `C`. Tunable.

### 3.7 League OVR curve across tiers

For an N-tier domestic league:
- Tier 1 (top flight): club OVRs ≈ `78 ± 6` (champions ≈ 84, relegation candidates ≈ 72)
- Tier 2: `68 ± 6`
- Tier 3: `58 ± 6`
- Tier 4: `48 ± 6`

Tunable. **See Q4.**

### 3.8 Manager generator

Stats biased around 60–70 with one or two strengths peaking 75–85. Random formation + style. Age 35–65. Initial pool size: tier-count × 2 unemployed managers, on top of the one-per-club assigned at league creation.

### 3.9 Determinism

The generator accepts an optional `seed` string. The user-facing flow generates a seed from `Date.now()` by default; advanced users can paste a specific seed to reproduce a world. Seed is persisted into the savefile's `meta` so re-running on the same save does not change the world.

---

## 4. Name pools

Per-nationality lists of first names + last names + city names + club-name templates. JSON files at `src/data/names/<code>.json`:

```json
{
  "code": "ENG",
  "displayName": "England",
  "firstNamesMale": [...],
  "lastNames": [...],
  "cities": [...],
  "clubTemplates": ["{city} FC", "{city} United", "{city} City", "AFC {city}", "{city} Town"]
}
```

`{city}` is the only template variable today (others may follow). The generic-fictional pool uses CV-syllable assembly so it produces names like "Lavren Drekov" / "Korus FC".

**Pools shipping by default — Q1.** Plan §8 asks; my proposal: **English, Spanish, German, Italian, French, Generic-fictional**. (6 pools cover most of Europe + a fallback.) Source: open-data lists (e.g. names from Wikipedia's most-common-names tables, openly-licensed; cited in the file headers).

---

## 5. UI surfaces

### 5.1 Player form — "Randomize stats" button

A small button next to the OVR badge. Clicking opens a tiny popover: target OVR slider (40–95, default = current OVR or 70). Confirm fills the 12 game stats and the 4 hidden stats. Personality and identity left untouched. Doesn't save until the user submits.

### 5.2 Club detail — "Generate squad" button

Beside the existing "Add player". Opens a modal:
- Target club OVR (default = current `club.ovr` or 70)
- Squad size (default 25)
- Replace existing squad? (checkbox; default off — i.e. *fill to size*, not overwrite)
- Nationality (default = savefile country)
- Confirm → spawns the players and links them.

### 5.3 Managers view — "Generate N managers"

Button next to "New manager". Modal: count (1–20), nationality. Adds them all to the unemployed pool.

### 5.4 World view — "Generate foreign league"

In the foreign-leagues tab. Modal: country name, tier (default 1), club count, club OVR target. Adds a stub league with N foreign clubs.

### 5.5 New: "Generator" sidebar route

Top-level entry under "System" (next to Issues / Saves). The acceptance-gate flow lives here:
- **Generate domestic league**: country, tier count (1–6), clubs per tier, top-tier OVR target, OVR step per tier.
- **Generate manager pool**: count.
- **Generate foreign world**: countries (multi-select), tiers per country.

Each generation runs synchronously (fast enough — see Q5) with a progress bar. Results land in the savefile and persist as usual.

---

## 6. New files / structure

```
src/
├── data/
│   └── names/
│       ├── eng.json       # English
│       ├── esp.json       # Spanish
│       ├── deu.json       # German
│       ├── ita.json       # Italian
│       ├── fra.json       # French
│       └── generic.json   # Fictional
├── routes/
│   └── Generator.tsx                     # the sidebar destination
├── components/
│   ├── GenerateSquadModal.tsx
│   ├── GenerateManagersModal.tsx
│   ├── GenerateLeagueModal.tsx
│   └── RandomizeStatsPopover.tsx
└── generation/                           # all the pure logic
    ├── prng.ts                            # seeded RNG
    ├── statSampler.ts                     # stat block targeting an OVR
    ├── playerGen.ts                       # generatePlayer()
    ├── squadGen.ts                        # generateSquad()
    ├── managerGen.ts                      # generateManager()
    ├── leagueGen.ts                       # generateLeague()
    ├── nameGen.ts                         # name pool driver
    ├── clubGen.ts                         # club identity (name, city, kit, stadium)
    └── shapes.ts                          # shared shape constants (squad sizes, OVR curves)
```

---

## 7. Tests

- `prng.ts`: seeded determinism (same seed → same sequence).
- `statSampler.ts`: target-OVR convergence — for 1000 random calls at every position × every target OVR in {50, 60, 70, 80, 85}, the resulting OVR is within ±3 of target ≥ 95% of the time.
- `playerGen.ts`: smoke — generated players validate against the schema.
- `squadGen.ts`: positional distribution sums to the requested squad size; ages match the curve.
- `leagueGen.ts`: tier-count × clubs-per-tier results in the right number of clubs and players; club OVRs are roughly on the curve.
- `nameGen.ts`: known seed produces a deterministic name; pool loading works for every shipped code.
- Acceptance benchmark: `leagueGen({ countryName: 'Testland', tierCount: 4, clubsPerTier: 16, ... })` completes in < 30 s in CI (warning, not hard fail, on slow CI).

---

## 8. Plan deviations / overrides

- **"Generator" sidebar route** is a Phase 2 invention not in the plan — the plan describes the generators as functions but doesn't propose a unified UI. I think one home is friendlier than per-view buttons alone.
- **Per-view inline buttons** (Randomize stats on player form; Generate squad on club page; Generate managers on managers page; Generate foreign league on world page) are also Phase 2 inventions — the plan only requires the generators to exist.
- **Squad shape (positional distribution)**, **age curve**, **OVR curve within a squad**, **OVR curve across tiers** are all my proposals. Tunable later.
- **Name pools shipping by default** (English / Spanish / German / Italian / French / Generic) is my proposal — plan §8 explicitly leaves this open. **Q1.**
- **No bulk *editing*** — generators only *create*. Replacing an existing entity goes through the existing edit form.
- **No procedural generation for foreign-resident players or NT-stub players** — those are Phase 6 territory.

---

## 9. Open questions for the user (the question round)

**Q1. Name pools shipping by default.** I propose English, Spanish, German, Italian, French, and a Generic-fictional fallback. Add Portuguese, Dutch, Brazilian, etc., or fewer? Or should I lean entirely on Generic and let you add real country pools later?

**Q2. Determinism / seeds visible to the user.** Should the Generator UI expose a "Seed" field (advanced — paste a string to reproduce a world), or hide seeds entirely (always random per click)?

**Q3. Squad positional distribution.** Accept the 3 GK / 8 DEF / 9 MID / 5 FWD shape from §3.5, or different? Plan didn't specify; this is one of those "looks reasonable" picks.

**Q4. OVR curves.** Accept the proposed top-tier OVR ≈ 78 (champions ≈ 84, bottom ≈ 72), step −10 per tier (so 4-tier league spans ~78 / 68 / 58 / 48)? Or different starting point / step?

**Q5. Performance budget.** Plan says "under 30 seconds" for 4 tiers × 16 clubs × 25 players ≈ 1600 players. My target: under 5 s on a modern laptop. Is the user willing to accept up to ~10 s if it gets us better-quality output (more calibration passes)?

Smaller defaults I'm taking unless you push back: 25-man default squad size (changeable in modal), age curve as in §3.4, generic-fictional always available regardless of country, all generated worlds are mutually independent (no cross-savefile sharing), no procedural progression of stats across seasons (Phase 4/5).
