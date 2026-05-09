# CRUFYmanager — Project Plan

**Companion to APPYmanager and BRIXYmanager.** Generates fictional football competitions, players, seasons, and match reports for use on the NationStates forum.

---

## ⚠️ Status: Best-guess starting point, NOT a final spec

This document was drafted from a single planning conversation between the user and a planning agent. It captures the user's stated intent on big-ticket questions (persistence model, sim style, UI structure, player tiering, calendar abstraction, etc.) but **the planning agent made many smaller decisions on the user's behalf** to keep the document coherent — choices about TypeScript strictness, specific entity fields, exact phase boundaries, acceptance gates, the existence and shape of fields like `currentForm` / `momentum` / `narrative flags`, the specific 10 game-stats chosen, the personality tag list, the tactical profile shape, the manager stat list, the position taxonomy, lineup auto-selection logic, and many others.

**Treat every concrete detail in this document as a starting proposal, not a settled requirement.** When in doubt, ask the user.

### Required workflow for every phase

Before writing any code in a given phase, the responsible sub-agent **must**:

1. **Re-read this document end-to-end** — later phases depend on schema and decisions established in earlier phases, and the document may have been updated since the last phase.
2. **Produce a phase-specific design proposal** — a short doc that:
   - Restates the goals and acceptance gate for the phase in the sub-agent's own words.
   - Lists every concrete decision the sub-agent intends to make (file layout, component breakdown, library choices, schema extensions, algorithm sketches, edge cases).
   - **Explicitly flags every place the sub-agent is overriding, refining, or extending what this document says** — including silent extensions where this document is vague.
   - Lists open questions for the user.
3. **Run a question round with the user.** Get explicit go-ahead on the design proposal. Iterate until the user signs off. The user has said they want this to happen *every phase*, no exceptions.
4. **Only then begin implementation.** If new questions arise mid-phase, pause and ask — don't guess.
5. **Update this document** when the phase ends to reflect any changes to the schema, principles, or future-phase plans that the phase produced.

The user's working style is "Lazy God": they want autopilot for things they don't care about, full control over things they do. The sub-agent's job is to figure out which is which *by asking*, not by guessing.

### Specifically suspect parts of this document

These are the areas where the planning agent's guesses are most likely to be wrong and most deserve scrutiny in the relevant phase's question round:

- **§3.2 Player stats** — the choice of 10 game stats, the specific hidden stats, the personality tag list, the OVR computation. Reasonable defaults but not user-confirmed.
- **§3.4 Competition templates** — the exact list of 6 templates. User said "templates only" but did not enumerate.
- **§3.5–3.7** — many fields (finances shape, manager stat list, club founding semantics, national team structure) are placeholder reasonable choices.
- **§4 Match engine** — the entire tick model, narrative flag system, lineup selection logic, and test coverage are the planning agent's invention. The user only specified "minute-by-minute, believable narratives, explainable outcomes." Phase 4 needs a deep design round.
- **§5 Match reports** — three templates proposed but not confirmed; BBCode is confirmed but exact format isn't.
- **§6 Phase boundaries and acceptance gates** — the cut points between phases are pragmatic guesses. The user may want different breakpoints once they see early output.
- **§7 Sub-agent guidance** — reflects the planning agent's preferences. User may have stronger opinions on PR workflow, conventions, and house style.

When in doubt: **ask, don't assume.**

---

This document is the canonical plan for sub-agent execution. Phases are ordered by dependency. Each phase has explicit inputs, outputs, and acceptance criteria. **Do not skip phases or build features cross-phase without updating this document, and do not begin a phase's implementation without completing the question round described above.**

---

## 0. Design philosophy

Three principles that govern every decision below. When in doubt, return to these.

1. **God-mode by default, autopilot by request.** The user can override anything that isn't a competition match result. The sim runs autonomously when asked. There is no scenario where the user is *forced* to wait for the sim or *forced* to set something manually.
2. **Competitions are sacred, sandboxes are free.** Match results inside a competition are sim-only — never edited. Anything in the "Other Matches" sandbox is fully manual. This separation is enforced at the data layer, not just UI.
3. **Believable narrative over statistical purity.** The sim's job is to produce match reports that read like real football, not to be a perfect statistical model. A red card *should* swing things. Form *should* matter. Underdogs *should* occasionally win.

---

## 1. Tech stack

- **Frontend**: React 18 + TypeScript (strict mode) + Vite
- **State**: Zustand (one store per major domain — calendar, competitions, players, etc.)
- **Persistence**: IndexedDB via Dexie 4
- **Styling**: same approach as BRIXY/APPY (sub-agents should inspect those repos to match conventions)
- **Routing**: React Router (sidebar nav drives routes)
- **IDs**: local-only (`nanoid` or similar). Cross-savefile import re-keys.
- **Testing**: Vitest for sim engine and reducers. UI tests not required initially.
- **No backend.** Everything lives in the browser. Savefiles export/import as JSON blobs.

**TypeScript strictness is non-negotiable.** The entity graph is too deep to debug at runtime. Discriminated unions for player tiers (see §3.2). No `any`.

---

## 2. UI structure

Sidebar nav, fixed left, with these top-level views:

| View | Purpose |
|---|---|
| **Calendar** | Season overview. Shows all scheduled matchdays across all competitions. Where the user advances time. |
| **Competitions** | List + detail. Create, configure, schedule, view tables and brackets. |
| **Clubs** | All domestic clubs. Squad management, finances (light), history. |
| **Players** | All players in the system (domestic, foreign-resident, foreign-NT stubs). Filter by tier. |
| **National Team** | The savefile country's national team. Squad selection, fixtures, history. |
| **Other Matches** | Sandbox. Friendlies, one-offs, manual-score matches. |
| **History** | Past seasons, dissolved competitions, all-time records. |
| **World** | Foreign leagues, foreign clubs, foreign national teams. Manager pool. Country-level settings. |

Match the visual language of BRIXY/APPY. Sub-agents should pull components and styling tokens from those repos rather than reinventing.

---

## 3. Data model (Phase 0 deliverable)

This is the schema. Everything else is built against it. Sub-agents extending it must update this document.

### 3.1 Top-level savefile structure

```ts
interface Savefile {
  meta: {
    schemaVersion: number;        // bump on breaking changes
    createdAt: string;
    lastSavedAt: string;
    countryName: string;          // the savefile's country
    countryShortCode: string;     // 3-letter code, used in BBCode output
  };
  calendar: Calendar;             // §3.3
  competitions: Competition[];    // §3.4
  clubs: Club[];                  // §3.5
  players: Player[];              // §3.2 — all tiers in one array, discriminated by `tier`
  managers: Manager[];            // §3.6
  nationalTeam: NationalTeam;     // §3.7
  foreignWorld: ForeignWorld;     // §3.8 — stub-leagues, stub-clubs, foreign NTs
  otherMatches: OtherMatch[];     // §3.9
  history: HistoryArchive;        // §3.10
  settings: UserSettings;
}
```

### 3.2 Player (discriminated union)

```ts
type Player =
  | DomesticPlayer        // full record, plays for a domestic club
  | ForeignResidentPlayer // was domestic, transferred to a foreign stub-club, still tracked
  | ForeignNTStubPlayer;  // exists only because user added them to a foreign NT roster

interface PlayerCommon {
  id: string;
  tier: 'domestic' | 'foreign-resident' | 'foreign-nt-stub';
  name: string;
  nationality: string;          // free-text country name
  position: Position;           // GK | DEF-CB | DEF-FB | MID-DM | MID-CM | MID-AM | FWD-W | FWD-ST
  preferredFoot: 'L' | 'R' | 'Both';
  dateOfBirth: { season: number; matchday: number }; // calendar-relative, see §3.3
}

interface FullPlayerStats {
  // Game stats (10) — drive minute-by-minute sim
  pace: number;                 // 0-100
  finishing: number;
  passing: number;
  dribbling: number;
  defending: number;
  heading: number;
  goalkeeping: number;          // mostly relevant for GKs
  vision: number;
  physicality: number;
  technique: number;

  // Hidden / character stats
  injuryProneness: number;      // 0-100, higher = more injury-prone
  potential: number;            // 0-100, ceiling for OVR growth
  personality: PersonalityTag;  // see below
  consistency: number;          // 0-100, low = volatile match-to-match form
  workRate: number;             // 0-100, affects stamina drain & pressing

  // Derived
  ovr: number;                  // 0-100, computed from above weighted by position
}

type PersonalityTag =
  | 'Professional' | 'Mercurial' | 'Loyal' | 'Ambitious'
  | 'Hothead' | 'Leader' | 'Quiet' | 'Showboat';

interface DomesticPlayer extends PlayerCommon {
  tier: 'domestic';
  stats: FullPlayerStats;
  clubId: string;
  contractUntilSeason: number;
  squadNumber: number | null;
  currentForm: number;          // 0-100, drifts after matches
  currentMorale: number;        // 0-100
  currentFitness: number;       // 0-100, depleted by matches, recovered between
  injury: Injury | null;
  careerHistory: CareerEntry[]; // appearances, goals, assists per season per club
}

interface ForeignResidentPlayer extends PlayerCommon {
  tier: 'foreign-resident';
  stats: FullPlayerStats;       // still tracked
  foreignClubId: string;        // points into foreignWorld.clubs
  contractUntilSeason: number;
  careerHistory: CareerEntry[];
}

interface ForeignNTStubPlayer extends PlayerCommon {
  tier: 'foreign-nt-stub';
  foreignNTId: string;
  // Stub players have NO stats. Sim derives implicit stats from foreign NT's OVR at match time.
  // If user wants to give them a stat hint, they "promote" the stub by linking it
  // to a domestic or foreign-resident player (changes tier).
  linkedPlayerId: string | null; // when non-null, this stub is actually a full player who plays for the foreign NT
}
```

**Linked-stub rule.** When `linkedPlayerId` is set, the sim ignores the stub's own data and uses the linked player's stats. The stub becomes a roster pointer.

### 3.3 Calendar

```ts
interface Calendar {
  currentSeason: number;        // 1, 2, 3, ...
  currentMatchday: number;      // 1..matchdaysPerSeason
  matchdaysPerSeason: number;   // user-configurable, e.g. 52
  schedule: ScheduleSlot[];     // length = matchdaysPerSeason
}

interface ScheduleSlot {
  matchday: number;
  fixtures: ScheduledFixture[]; // multiple fixtures per matchday allowed (different competitions)
}

interface ScheduledFixture {
  fixtureId: string;
  competitionId: string;
  competitionMatchday: number;  // which matchday-within-the-competition this represents
}
```

**Calendar model.** A season is `matchdaysPerSeason` abstract slots (no real dates). Each competition generates *its own* sequence of internal matchdays based on its template. The user places those internal matchdays onto the season's slots — possibly stacking multiple competitions on the same slot. Two competitions on the same slot = midweek/weekend doubleheader, sim runs both.

Generation flow:
1. User configures all competitions for the upcoming season.
2. Engine computes how many internal matchdays each competition has.
3. User drags/places competition matchdays onto calendar slots (with a "default spread" auto-fill option).
4. Locked once the season starts — only "Other Matches" can be added/removed mid-season.

### 3.4 Competition

```ts
interface Competition {
  id: string;
  name: string;
  shortName: string;            // for tables
  template: CompetitionTemplate;
  config: CompetitionConfig;
  state: CompetitionState;      // current season's state
  history: CompetitionHistory;  // past seasons
}

type CompetitionTemplate =
  | 'league-double-rr'    // home & away round robin
  | 'league-single-rr'    // single round robin
  | 'knockout-single'     // single-leg knockout
  | 'knockout-two-leg'    // two-leg knockout
  | 'group-then-knockout' // group stage → knockout
  | 'super-cup';          // single match between two qualifiers

interface CompetitionConfig {
  participantClubIds: string[];
  promotionRelegation?: { promoteCount: number; relegateCount: number; linkedCompetitionId: string };
  // Template-specific config: groupCount, groupSize, knockoutSeed, etc.
  templateParams: Record<string, unknown>;
}
```

**Templates only — no free-form.** Sub-agents must not extend `CompetitionTemplate` without updating this doc and confirming with the user.

### 3.5 Club

```ts
interface Club {
  id: string;
  name: string;
  shortName: string;
  city: string;
  founded: number;              // season number, can be 0 or negative for pre-savefile
  colors: { primary: string; secondary: string };
  stadium: { name: string; capacity: number };
  managerId: string | null;
  squadPlayerIds: string[];     // refs into players[] where tier='domestic' and clubId matches
  ovr: number;                  // 0-100, computed from squad
  finances: { balance: number }; // light — just enough for transfers
  history: ClubSeasonRecord[];
}
```

### 3.6 Manager

```ts
interface Manager {
  id: string;
  name: string;
  nationality: string;
  age: number;
  stats: {
    tactical: number;       // 0-100, how well their tactics translate
    motivation: number;     // boosts morale
    development: number;    // youth growth bonus
    discipline: number;     // affects card rates
    adaptability: number;   // performance swing in away/big games
  };
  preferredFormation: Formation;
  preferredStyle: TacticalProfile;
  contractClubId: string | null; // null = unemployed, in manager pool
  contractUntilSeason: number | null;
  history: ManagerStint[];
}
```

### 3.7 National team

```ts
interface NationalTeam {
  // Same country as the savefile.
  managerId: string | null;
  squadPlayerIds: string[];     // references domestic OR foreign-resident players whose nationality matches savefile country
  formation: Formation;
  tactics: TacticalProfile;
  fixtures: NationalFixture[];  // upcoming + past, lives outside competition system
  history: NationalSeasonRecord[];
}
```

National team matches don't live in a competition. They're scheduled directly onto the calendar (same slot system, different fixture type). Opponents are foreign NTs from `foreignWorld`.

### 3.8 Foreign world

```ts
interface ForeignWorld {
  leagues: ForeignLeague[];     // stub: name + tier
  clubs: ForeignClub[];         // stub: name + leagueId + ovr
  nationalTeams: ForeignNT[];   // user-created, ad hoc
}

interface ForeignNT {
  id: string;
  countryName: string;
  rosterPlayerIds: string[];    // references ForeignNTStubPlayer entries (some may be linked)
  ovr: number;                  // user-set when registering
  formation: Formation;
  tactics: TacticalProfile;
}
```

### 3.9 Other matches (sandbox)

```ts
interface OtherMatch {
  id: string;
  name: string;                 // user-labelled
  homeTeamRef: TeamRef;         // can be domestic club, foreign club, national team, foreign NT
  awayTeamRef: TeamRef;
  scheduledMatchday: number | null;
  result: ManualResult | SimResult | null;
  mode: 'manual' | 'sim';
}
```

Manual mode = user types in the score and event list. Sim mode = runs through the engine but stays segregated from competition stats.

### 3.10 History archive

```ts
interface HistoryArchive {
  pastSeasons: PastSeason[];
  dissolvedCompetitions: Competition[]; // full snapshot at dissolution
  allTimeRecords: { topScorers; mostAppearances; biggestWins; ... };
}
```

Every match ever played is queryable. Storage is JSON in IndexedDB; if size becomes a problem, sub-agents should add a compaction step that summarizes very old seasons (>20 seasons back). Not Phase 1 work.

---

## 4. Match simulation engine

**The engine is the heart of CRUFY.** Build it carefully, test it heavily.

### 4.1 Inputs

For each fixture:
- Both teams' squads (selected lineups, see §4.4)
- Both teams' tactical setups
- Both teams' managers
- Both teams' aggregate stats (form, momentum, home advantage)
- Match context (matchday, importance flag, weather roll, neutral venue?)

### 4.2 Tick model

90 minutes + injury time, simulated one minute at a time. Each tick:

1. Compute current pressure/possession state (Markov-ish, with state transitions weighted by team midfield + tactics).
2. Determine if a *significant event* occurs this minute (chance, foul, card, injury, sub trigger).
3. If an event: resolve it using the relevant individuals' stats — finishing vs goalkeeping for shots, defending vs dribbling for tackles, etc. Manager stats modulate the rolls (good tactical manager = more chances created from possession, etc.).
4. Update state: score, cards, fitness, momentum, narrative flags.
5. Append a `MatchEvent` to the timeline.

Every event must include a *reason* — which players were involved, what stats determined the outcome. This produces explainability and makes report generation easy.

### 4.3 Narrative flags

The engine tracks soft state that affects subsequent ticks:
- `momentum` (-100 to +100, drifts toward 0, swings on goals/cards)
- `gameOpen` (boolean, true if both teams chasing)
- `siegeMode` (boolean, true when a team is parked deep)
- `tilt` (which team is currently dominating)

These exist *for the report*. A 1-0 game with 80 minutes of `siegeMode` reads very differently from a 1-0 with 80 minutes of even possession. The match-report generator (§5) reads these flags.

### 4.4 Lineup selection

Per your spec: "starting XI shifts between games." Auto-selection logic:
- Pick the best XI by OVR for the formation.
- Apply a fitness cutoff: anyone below 70% fitness is downgraded.
- Apply rotation: if a player started the previous match and squad has depth, 25% chance of rotation for non-key players.
- Form: high-form players get a small boost in selection priority.
- User can override before any matchday — overrides are sticky for that match only.

### 4.5 Output

```ts
interface MatchResult {
  fixtureId: string;
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];           // full minute-by-minute log
  playerRatings: Record<string, number>; // 0-10 per player, computed from contributions
  narrative: NarrativeSummary;    // distilled flags for report generation
  statsBox: { possession; shots; shotsOnTarget; corners; fouls; offsides; ... };
}
```

### 4.6 Determinism & seeds

Every match has a seed (derived from `savefile.id + fixtureId`). Re-simulating must produce identical results. This is critical for debugging and for letting users re-watch a match.

### 4.7 Testing

Sub-agents must include:
- Unit tests for individual event resolvers (shot, tackle, card, sub).
- Integration test: simulate 1000 matches between equally-rated teams, expect roughly even win distribution (45-55% range).
- Integration test: simulate 1000 matches between OVR-90 vs OVR-60 teams, expect strong but not absolute favorite bias (~75-85% win rate for stronger).
- Snapshot test: a fixed-seed match always produces the same event log.

---

## 5. Match report generator

Reads `MatchResult` and produces output in user-selected format. Initial formats:

- **BBCode** (NS forum primary): formatted with `[b]`, `[table]`, `[color]` tags.
- **Plain text / markdown**: for casual sharing.
- **Image export** (post-Phase 1): canvas-rendered match summary card.

Templates are user-editable (Phase 2+). Initially ship 3-4 hardcoded BBCode templates: brief, standard, deep-narrative.

The generator is *separate from the sim*. It's a pure function: `MatchResult → string`. This lets users regenerate reports in different formats without re-simulating.

---

## 6. Build phases

Each phase has explicit inputs, outputs, and acceptance gates. **Sub-agents should not start phase N+1 work until phase N's gate is met.**

### Phase 0 — Scaffold & schema

**Goal:** project boots, schema is locked, persistence works.

**Tasks:**
1. Vite + React + TypeScript scaffold matching BRIXY/APPY conventions.
2. Sidebar layout with placeholder routes for all 8 main views.
3. Dexie schema implementing §3 in full. Migration system from day one (every schema change bumps `schemaVersion`).
4. Zustand stores: one per major domain. Hydrate from Dexie on mount.
5. Savefile create/load/save/export-JSON/import-JSON.
6. "New savefile" flow: country name + short code + matchdays per season.

**Acceptance gate:** can create a new savefile, name it, save, close the tab, reopen, and see it. Can export to JSON and re-import as a second savefile.

### Phase 1 — Static entity management

**Goal:** user can populate a world manually before any simulation exists.

**Tasks:**
1. Clubs view: CRUD for clubs, squad list display.
2. Players view: CRUD for domestic players, computed OVR from stats. Filter by tier/club/position.
3. Managers view: CRUD for managers. Pool of unemployed managers.
4. Hire/fire flow: assign manager to club, sack manager.
5. Foreign world basics: CRUD for foreign leagues and foreign clubs.

**Acceptance gate:** user can build out an entire domestic league (12 clubs, 25 players each, 12 managers) entirely by hand. No simulation yet, no calendar yet. Just data entry.

### Phase 2 — Procedural generation

**Goal:** Lazy God mode for entity creation.

**Tasks:**
1. Player generator: given (position, age, target OVR, nationality), produce a believable Player with stats that roll up to the target OVR.
2. Squad generator: given a club and target OVR, generate a full 25-man squad with correct positional distribution.
3. Manager generator.
4. League generator: given a country and tier count, create N divisions with M clubs each, each fully populated.
5. Name generators: per-nationality first/last name pools (sub-agent can use existing open data; should be configurable).

**Acceptance gate:** user clicks "Generate full domestic league for [country], 4 tiers, 16 clubs each" and gets a complete world in under 30 seconds.

### Phase 3 — Calendar & competitions

**Goal:** seasons exist, matchdays exist, but matches don't sim yet.

**Tasks:**
1. Calendar view: grid of matchday slots for the current season.
2. Competition CRUD: create competitions from templates, configure participants, generate internal matchdays.
3. Schedule placement: drag/place competition matchdays onto calendar slots, with "auto-spread evenly" default.
4. Multi-competition stacking on a single slot.
5. Season advance: button to move from MD N to MD N+1, but it does nothing yet (no sim).

**Acceptance gate:** user creates 2 competitions (a league and a cup), schedules them across a season, can navigate the calendar and see what's scheduled where. No simulation runs.

### Phase 4 — The match engine

**Goal:** the sim works. This is the make-or-break phase.

**Tasks:**
1. Event resolvers (shot, tackle, foul, card, sub, injury) as pure functions.
2. Tick loop, narrative flag tracking.
3. Lineup auto-selection.
4. Tactical profile application.
5. Manager stat application.
6. Determinism & seeding.
7. Test suite per §4.7.

**Acceptance gate:** all tests pass. Standalone "Sim Test" debug page where user picks two teams and watches a match unfold tick-by-tick. Engine is *not yet wired into competitions* — that's Phase 5.

### Phase 5 — Competitions live

**Goal:** end-to-end loop. Schedule a season, advance through it, results matter.

**Tasks:**
1. "Advance to next matchday" runs the sim for every fixture on that slot.
2. League tables compute correctly from results.
3. Knockout brackets advance.
4. Group → knockout transitions.
5. Promotion/relegation at season end.
6. Player stats accumulate (goals, assists, appearances, ratings).
7. End-of-season flow: archive season, generate next season's fixtures, advance year.

**Acceptance gate:** user simulates an entire season of a league and a cup. Tables and brackets are correct. Top scorer stats are correct. Season archive contains the full result history.

### Phase 6 — National team & foreign world

**Goal:** internationals work.

**Tasks:**
1. National team squad selection (auto-pick from eligible domestic + foreign-resident players).
2. Foreign NT registration flow: user creates a foreign NT, adds stub players to roster, optionally links stubs to existing players.
3. National fixtures scheduled directly onto calendar.
4. Sim handles foreign-NT-stub players via OVR-derived implicit stats.
5. National team history & records.

**Acceptance gate:** user creates 4 foreign NTs, registers them, schedules a 4-team international tournament as Other Matches (or as a one-off competition; design call), sims it, sees results.

### Phase 7 — Transfers

**Goal:** players move.

**Tasks:**
1. Transfer windows (configurable per season — usually 2 windows of N matchdays).
2. Auto-market: clubs evaluate squad needs, make/accept offers based on club OVR + finances.
3. Manual transfers: user-brokered moves at any time during a window.
4. Outgoing-abroad: player moves to a stub-foreign-club, becomes `foreign-resident`, still tracked.
5. Incoming-from-abroad: user can hand-create a foreign-resident-becoming-domestic transfer.

**Acceptance gate:** AI-controlled clubs make sensible transfers without user input. User can override or block any transfer involving their attention.

### Phase 8 — Match reports

**Goal:** beautiful BBCode output for NS.

**Tasks:**
1. Report generator with 3 templates (brief / standard / deep).
2. BBCode and Markdown output.
3. Per-match "Copy Report" button.
4. Per-matchday "Copy All Reports" bundled output.
5. League table BBCode export.

**Acceptance gate:** user pastes a generated report into the NS forum and it renders cleanly with no manual cleanup.

### Phase 9 — History & stats

**Goal:** deep queryability.

**Tasks:**
1. History view with season-by-season navigation.
2. All-time records page.
3. Player career page: full career history across clubs, season-by-season stats.
4. Club page: all-time honours, biggest wins, most appearances.
5. Competition page: past winners, top scorers per season, etc.

**Acceptance gate:** after 10 simulated seasons, user can answer arbitrary questions like "who was top scorer in season 4?" or "what's the longest winning run for FC X?" via the UI.

### Phase 10 — Polish & extras

- Image-export match cards (canvas-rendered)
- Cross-savefile player export/import
- User-editable report templates
- "Other Matches" tournament shells (group your friendlies into a one-off cup)
- Future hooks for other sports (Phase 10+ — *out of initial scope*, but data model should not prevent it)

---

## 7. Sub-agent guidance

**Before anything else: re-read the "Required workflow for every phase" at the top of this document.** That workflow — re-read the doc, produce a design proposal, run a question round, get sign-off, then implement — is the binding rule. Everything below is supplementary.

- **Each phase assumes the previous phases' outputs are stable.** Don't reach back into prior-phase code to refactor without flagging it.
- **Don't extend or change the schema without proposing it in the design round.** If a phase needs new entities or fields, that's a design-round discussion.
- **The sim engine is the core IP.** Don't shortcut it. The user has explicitly said reports must be *believable narratives*, not just statistical resolutions. Phase 4 deserves an especially thorough design round.
- **Match BRIXY/APPY UI conventions.** Inspect those repos for component patterns, naming, and styling. If conventions conflict between BRIXY and APPY, ask.
- **Strict TypeScript by default.** No `any`, no implicit nullable. The planning agent picked this; if the user wants to relax it, that's a Phase 0 design-round discussion.
- **Tests are required for the sim engine** (Phase 4 onward). Optional for earlier UI work unless the user says otherwise.
- **The user is God, but lazy.** Every feature should support both manual override AND autopilot, except the sacred competition-results rule (§0 principle 2). If a feature can't easily support both, ask the user which mode matters more.
- **When in doubt, ask.** The user prefers being asked five small questions over receiving one big wrong assumption.

---

## 8. Open questions for the user

To revisit before or during the relevant phase:

- Phase 2: which name pools should ship by default? (English, Spanish, German, generic-fictional?)
- Phase 5: relegation playoffs — supported via template, or out of scope?
- Phase 7: transfer fees — economy is closed (money is real, finite) or open (clubs always have budget)?
- Phase 8: which 3 templates? Suggest "Compact (BBCode table only)", "Standard (table + key events + scorers)", "Narrative (full prose match report)".
- Phase 10: what other sports are likely? Affects how aggressive to be about abstracting the schema in earlier phases.
