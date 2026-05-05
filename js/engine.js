/* ===========================================================================
 * CRUFYmanager — engine.js
 *   Match simulation (minute-by-minute commentary), schedule generation
 *   (round-robin, knockout, group→knockout), AI squad selection, AI
 *   tactics, retirement, youth intake, manager hire/sack.
 *
 *   Determinism model: every match generates a draft, which the user can
 *   commit to history or reroll. Side effects (cards, injuries, suspensions,
 *   season counters) only apply on commit.
 * ========================================================================= */

/* ===========================================================================
 * Player / club / manager generation
 * ========================================================================= */
function generatePlayer({ nationality, nameBank, position, role, ageBand, qualityBand = 50, clubId = null } = {}) {
  // nameBank is the source of names (e.g. 'Generic English').
  // nationality is the displayed nationality (e.g. 'Demolandia') — independent.
  nameBank = nameBank || (clubId ? (getClub(clubId)?.nameBankPref) : null) || state.settings.defaultNameBank || 'Generic English';
  if (!nationality) {
    const club = clubId ? getClub(clubId) : null;
    nationality = club?.nationality
      || state.settings.nation?.name
      || bankToCountryLabel(nameBank);
  }
  if (!position) position = pickPositionForSquad();
  if (!role) role = pick(POSITION_ROLES[position]);

  const ageMin = ageBand === 'youth' ? 16 : ageBand === 'veteran' ? 30 : 17;
  const ageMax = ageBand === 'youth' ? 19 : ageBand === 'veteran' ? 38 : 32;
  const age = pickInt(ageMin, ageMax);
  const dob = { year: state.settings.season - age };

  // Attribute generation: each attr ~ N(qualityBand, 12) with role weighting
  const base = qualityBand;
  const sd = 10;
  const attr = (mean, weight = 1) => Math.round(clamp(randNorm(mean * weight, sd), 1, 99));
  let pace, strength, technique, passing, defending, shooting, mental, goalkeeping;
  switch (position) {
    case 'GK':
      pace = attr(base, 0.6);
      strength = attr(base, 0.85);
      technique = attr(base, 0.55);
      passing = attr(base, 0.65);
      defending = attr(base, 0.5);
      shooting = attr(base, 0.2);
      mental = attr(base, 0.95);
      goalkeeping = attr(base, 1.15);
      break;
    case 'DF':
      pace = attr(base, role === 'CB' ? 0.85 : 1.05);
      strength = attr(base, role === 'CB' ? 1.1 : 0.9);
      technique = attr(base, 0.75);
      passing = attr(base, 0.85);
      defending = attr(base, 1.15);
      shooting = attr(base, 0.4);
      mental = attr(base, 0.9);
      goalkeeping = pickInt(1, 12);
      break;
    case 'MF':
      pace = attr(base, role === 'CDM' ? 0.85 : 1.0);
      strength = attr(base, 0.85);
      technique = attr(base, 1.05);
      passing = attr(base, 1.1);
      defending = attr(base, role === 'CDM' ? 1.0 : 0.7);
      shooting = attr(base, role === 'CAM' ? 0.95 : 0.75);
      mental = attr(base, 0.95);
      goalkeeping = pickInt(1, 12);
      break;
    case 'FW':
      pace = attr(base, 1.1);
      strength = attr(base, role === 'ST' ? 1.0 : 0.85);
      technique = attr(base, 1.05);
      passing = attr(base, 0.85);
      defending = attr(base, 0.45);
      shooting = attr(base, 1.15);
      mental = attr(base, 0.9);
      goalkeeping = pickInt(1, 12);
      break;
  }
  // Hidden attrs
  const peak = Math.max(pace, strength, technique, passing, defending, shooting, mental, goalkeeping);
  const potential = clamp(Math.round(peak + randNorm(8, 6)), peak, 99);
  const injuryProneness = clamp(Math.round(randNorm(20, 15)), 1, 95);
  return {
    id: uid('p_'),
    firstName: '', lastName: '',
    name: '',
    nationality,
    nameBankUsed: nameBank,
    age, dob,
    position, role,
    attrs: { pace, strength, technique, passing, defending, shooting, mental, goalkeeping },
    potential,
    injuryProneness,
    clubId,
    shirtNumber: null,
    contract: { wage: pickInt(50, 500) * 10, years: pickInt(1, 5) },
    status: { injuredUntil: 0, suspendedFor: 0, yellowsThisSeason: 0, fatigue: 0 },
    seasonStats: { apps: 0, goals: 0, assists: 0, yellows: 0, reds: 0 },
    skillHistory: [],
    isRetired: false,
  };
}

function fillPlayerName(player, bankName) {
  bankName = bankName || player.nameBankUsed || 'Generic English';
  const bank = state.nameBanks[bankName] || DEFAULT_NAME_BANKS[bankName] || DEFAULT_NAME_BANKS['Generic English'];
  player.firstName = pick(bank.firstNames);
  player.lastName  = pick(bank.lastNames);
  player.name = `${player.firstName} ${player.lastName}`;
  player.nameBankUsed = bankName;
  return player;
}

function pickPositionForSquad() {
  // Realistic distribution roughly: 1 GK, 4-5 DF, 4-5 MF, 2-3 FW per 11
  const r = rand();
  if (r < 0.10) return 'GK';
  if (r < 0.45) return 'DF';
  if (r < 0.80) return 'MF';
  return 'FW';
}

function generateSquad(clubId, opts = {}) {
  const club = getClub(clubId);
  if (!club) return [];
  const size = opts.size || 22;
  const quality = opts.quality || 55;
  const bank = opts.nameBank || club.nameBankPref || state.settings.defaultNameBank;
  const nationality = opts.nationality || club.nationality || state.settings.nation?.name || bankToCountryLabel(bank);

  const composition = [
    { position: 'GK', count: 3 },
    { position: 'DF', count: 7 },
    { position: 'MF', count: 7 },
    { position: 'FW', count: 5 },
  ];
  let usedNumbers = new Set();
  const usedPlayers = [];
  let shirtCounter = 1;
  for (const slot of composition) {
    for (let i = 0; i < slot.count; i++) {
      const p = generatePlayer({
        nationality,
        nameBank: bank,
        position: slot.position,
        qualityBand: quality + pickInt(-15, 15),
        clubId
      });
      fillPlayerName(p, bank);
      // Assign shirt
      while (usedNumbers.has(shirtCounter)) shirtCounter++;
      p.shirtNumber = shirtCounter;
      usedNumbers.add(shirtCounter);
      shirtCounter++;
      state.players.push(p);
      usedPlayers.push(p);
    }
  }
  // Ensure size
  while (usedPlayers.length < size) {
    const p = generatePlayer({ nationality, nameBank: bank, qualityBand: quality - 8, clubId });
    fillPlayerName(p, bank);
    p.shirtNumber = shirtCounter++;
    state.players.push(p);
    usedPlayers.push(p);
  }
  // Auto pick captain + vice-captain (oldest two outfielders)
  const candidates = usedPlayers
    .filter(p => p.position !== 'GK')
    .sort((a, b) => b.age - a.age);
  if (candidates[0]) club.captainId = candidates[0].id;
  if (candidates[1]) club.viceCaptainId = candidates[1].id;
  return usedPlayers;
}

function generateClub({ name, shortName, leagueId, kitPrimary, kitSecondary, stadiumName, stadiumCapacity, nameBankPref, nationality, quality } = {}) {
  const bank = nameBankPref || state.settings.defaultNameBank;
  const c = {
    id: uid('c_'),
    name: name || generateClubName(bank),
    shortName: shortName || (name ? name.split(' ')[0].slice(0, 3).toUpperCase() : 'CLB'),
    kitPrimary: kitPrimary || randomKitColour(),
    kitSecondary: kitSecondary || '#ffffff',
    stadiumName: stadiumName || generateStadiumName(name || 'Club'),
    stadiumCapacity: stadiumCapacity || pickInt(8, 80) * 1000,
    captainId: null,
    viceCaptainId: null,
    formation: DEFAULT_FORMATION,
    tactics: { mentality: 50, tempo: 50, pressing: 50 },
    nameBankPref: bank,
    nationality: nationality || state.settings.nation?.name || bankToCountryLabel(bank),
    managerId: null,
    leagueId: leagueId || null,
    reputation: quality || pickInt(40, 70),
    foundedSeason: state.settings.season,
  };
  state.clubs.push(c);
  return c;
}

function generateManager({ nationality, nameBank, attrs, formerPlayerId } = {}) {
  nameBank = nameBank || state.settings.defaultNameBank || 'Generic English';
  nationality = nationality || state.settings.nation?.name || bankToCountryLabel(nameBank);
  const bank = state.nameBanks[nameBank] || DEFAULT_NAME_BANKS[nameBank] || DEFAULT_NAME_BANKS['Generic English'];
  const m = {
    id: uid('m_'),
    firstName: pick(bank.firstNames),
    lastName: pick(bank.lastNames),
    nationality,
    nameBankUsed: nameBank,
    attrs: attrs || {
      tactical: pickInt(35, 85),
      manManagement: pickInt(35, 85),
      youthDev: pickInt(35, 85),
      reputation: pickInt(30, 80),
    },
    formerPlayerId: formerPlayerId || null,
    clubId: null,
    isUnemployed: true,
    seasonsAtClub: 0,
  };
  state.managers.push(m);
  return m;
}

/* ===========================================================================
 * Schedule generation: double round-robin (each pair plays home + away)
 * ========================================================================= */
function generateLeagueSchedule(leagueId) {
  const lg = getLeague(leagueId);
  if (!lg) return;
  const ids = lg.clubIds.slice();
  if (ids.length < 2) { lg.schedule = []; return; }
  if (ids.length % 2 === 1) ids.push(null); // bye marker
  const n = ids.length;
  const rounds = n - 1;
  const half = n / 2;

  const firstHalf = [];
  const teams = ids.slice();
  for (let r = 0; r < rounds; r++) {
    const fixtures = [];
    for (let i = 0; i < half; i++) {
      const home = teams[i];
      const away = teams[n - 1 - i];
      if (home === null || away === null) continue;
      // Alternate H/A by round + slot for variety
      if ((r + i) % 2 === 0) fixtures.push({ matchId: uid('mt_'), homeId: home, awayId: away, played: false });
      else                   fixtures.push({ matchId: uid('mt_'), homeId: away, awayId: home, played: false });
    }
    firstHalf.push({ matchday: r + 1, fixtures });
    // Rotate (keep first fixed)
    teams.splice(1, 0, teams.pop());
  }
  // Mirror: second half is first half reversed (swap home/away)
  const secondHalf = firstHalf.map((rd, i) => ({
    matchday: rounds + i + 1,
    fixtures: rd.fixtures.map(f => ({ matchId: uid('mt_'), homeId: f.awayId, awayId: f.homeId, played: false }))
  }));
  lg.schedule = firstHalf.concat(secondHalf);
  lg.season = state.settings.season;
  lg.status = 'active';

  // Slot each matchday onto the shared calendar, expanding totalDays if
  // this league has more matchdays than currently planned for the season.
  if (!state.calendar) state.calendar = { season: state.settings.season, day: 1, totalDays: lg.schedule.length };
  if (state.calendar.totalDays < lg.schedule.length) state.calendar.totalDays = lg.schedule.length;
  assignDaysToSchedule(lg);
  recomputeCalendarTotalDays();
}

/* For each round in `lg.schedule`, set `round.day` so the matchdays are
 * spread evenly across the season's totalDays. Round 1 always lands on
 * day 1; the final round always lands on day = totalDays. */
function assignDaysToSchedule(lg) {
  const n = lg.schedule.length;
  const D = state.calendar.totalDays;
  if (n <= 1 || D <= 1) {
    lg.schedule.forEach((rd, i) => rd.day = i + 1);
    return;
  }
  for (let i = 0; i < n; i++) {
    lg.schedule[i].day = Math.round(i * (D - 1) / (n - 1)) + 1;
  }
}

function recomputeCalendarTotalDays() {
  let max = 0;
  for (const lg of state.leagues) {
    if (lg.schedule && lg.schedule.length) max = Math.max(max, lg.schedule.length);
  }
  if (max === 0) max = 38;
  if (!state.calendar) state.calendar = { season: state.settings.season, day: 1, totalDays: max };
  // If totalDays grew because a bigger league joined, redistribute the
  // smaller leagues' days across the new totalDays. Played fixtures keep
  // their slot — only future matchdays shift.
  const oldTotal = state.calendar.totalDays;
  state.calendar.totalDays = max;
  if (max !== oldTotal) {
    for (const lg of state.leagues) {
      if (!lg.schedule || !lg.schedule.length) continue;
      const allPlayed = lg.schedule.every(rd => rd.fixtures.every(f => f.played));
      const anyPlayed = lg.schedule.some(rd => rd.fixtures.some(f => f.played));
      // If nothing played in this league this season, just rebuild day mapping.
      if (!anyPlayed) assignDaysToSchedule(lg);
      // Otherwise leave existing day numbers alone so progress isn't disturbed.
    }
  }
}

/* Find the next day (>= calendar.day, <= totalDays) that has at least one
 * unplayed fixture across any league. Returns null if the season is over. */
function nextCalendarDay() {
  if (!state.calendar) return null;
  const total = state.calendar.totalDays;
  for (let d = state.calendar.day; d <= total; d++) {
    if (fixturesOnCalendarDay(d).some(f => !f.fixture.played)) return d;
  }
  return null;
}

/* Flat list of fixtures across all leagues scheduled for `day`. */
function fixturesOnCalendarDay(day) {
  const out = [];
  for (const lg of state.leagues) {
    if (!lg.schedule) continue;
    const rd = lg.schedule.find(r => r.day === day);
    if (!rd) continue;
    for (const fx of rd.fixtures) out.push({ leagueId: lg.id, matchday: rd.matchday, day: rd.day, fixture: fx });
  }
  return out;
}

/* Generate drafts for every unplayed fixture on `day` across all leagues. */
function generateCalendarDayDrafts(day) {
  state.draftMatches = (state.draftMatches || []).filter(d => d.calendarDay !== day);
  const fixtures = fixturesOnCalendarDay(day).filter(f => !f.fixture.played);
  const drafts = [];
  for (const f of fixtures) {
    const draft = simulateMatch({ homeId: f.fixture.homeId, awayId: f.fixture.awayId, leagueId: f.leagueId, matchday: f.matchday });
    if (draft) { draft.calendarDay = day; drafts.push(draft); }
  }
  state.draftMatches.push(...drafts);
  saveState();
  return drafts;
}

function commitCalendarDay(day) {
  const drafts = (state.draftMatches || []).filter(d => d.calendarDay === day);
  for (const d of drafts) commitMatch(d);
  if (day >= state.calendar.day) state.calendar.day = day + 1;
  saveState();
  return drafts.length;
}

function discardCalendarDay(day) {
  state.draftMatches = (state.draftMatches || []).filter(d => d.calendarDay !== day);
  saveState();
}

function rerollCalendarDay(day) {
  state.draftMatches = (state.draftMatches || []).filter(d => d.calendarDay !== day);
  return generateCalendarDayDrafts(day);
}

/* Generate AND commit through every remaining day of this season, then run
 * the season rollover. */
function advanceCalendarToEndOfSeason() {
  let safety = (state.calendar?.totalDays || 38) * 2;
  while (--safety > 0) {
    const day = nextCalendarDay();
    if (day == null) break;
    generateCalendarDayDrafts(day);
    commitCalendarDay(day);
  }
  // Cup tidy-up: play out any remaining cup ties this season
  for (const cp of state.cups) {
    let cupSafety = 50;
    while (--cupSafety > 0) {
      const fx = nextCupFixtures(cp.id);
      if (!fx.length) break;
      for (const f of fx) {
        const draft = simulateMatch({ homeId: f.homeId, awayId: f.awayId, cupId: cp.id, neutral: f.neutral, isKnockout: cp._currentRound !== 'groups', requiresWinner: cp._currentRound !== 'groups' });
        if (draft) commitMatch(draft);
      }
      advanceCup(cp.id);
    }
  }
  if (calendarSeasonComplete()) rollSeasonOver();
}

function calendarSeasonComplete() {
  if (!state.calendar) return false;
  if (state.calendar.day <= state.calendar.totalDays) {
    // also check no day has unplayed fixtures
    if (nextCalendarDay() != null) return false;
  }
  return true;
}

/* Run the end-of-season pipeline, then reset the calendar for next season.
 * No-op (with a warning toast inside endOfSeasonProcessing) if no leagues
 * have actually completed their schedules. */
function rollSeasonOver() {
  const seasonBefore = state.settings.season;
  endOfSeasonProcessing();
  if (state.settings.season === seasonBefore) return;   // EoS bailed; don't reset calendar
  state.calendar = state.calendar || { season: state.settings.season, day: 1, totalDays: 38 };
  state.calendar.season = state.settings.season;
  state.calendar.day = 1;
  recomputeCalendarTotalDays();
  saveState();
}

/* Cup bracket generation. Knockout: power-of-2 padded with byes.
 * Group→knockout: divide into groups of `groupSize`, top `groupAdvance` advance to bracket. */
function generateCupBracket(cupId) {
  const cup = getCup(cupId);
  if (!cup) return;
  const eligibleClubs = (cup.eligibleLeagueIds || [])
    .flatMap(lid => state.leagues.find(l => l.id === lid)?.clubIds || []);
  const ids = (cup.entrantIds && cup.entrantIds.length ? cup.entrantIds : eligibleClubs).slice();
  if (ids.length < 2) { showToast('Not enough entrants for cup', 'warning'); return; }

  // Shuffle entrants for random seeding
  shuffle(ids);

  cup.season = state.settings.season;
  cup.rounds = [];
  cup.groups = [];
  cup.status = 'active';

  if (cup.format === 'group_knockout') {
    const gs = cup.groupSize || 4;
    const adv = cup.groupAdvance || 2;
    // Pad with nulls to multiple of groupSize
    while (ids.length % gs !== 0) ids.push(null);
    const numGroups = ids.length / gs;
    for (let g = 0; g < numGroups; g++) {
      const groupIds = ids.slice(g * gs, (g + 1) * gs).filter(Boolean);
      const fixtures = [];
      // Double round-robin within group
      for (let i = 0; i < groupIds.length; i++) {
        for (let j = i + 1; j < groupIds.length; j++) {
          fixtures.push({ matchId: uid('mt_'), homeId: groupIds[i], awayId: groupIds[j], played: false, leg: 1 });
          fixtures.push({ matchId: uid('mt_'), homeId: groupIds[j], awayId: groupIds[i], played: false, leg: 2 });
        }
      }
      cup.groups.push({
        name: `Group ${String.fromCharCode(65 + g)}`,
        clubIds: groupIds,
        fixtures
      });
    }
    cup._groupAdvance = adv;
    cup._currentRound = 'groups';
    return;
  }

  // Pure knockout
  buildKnockoutRound(cup, ids);
}

function buildKnockoutRound(cup, entrantIds) {
  // Pad to power of 2 with byes
  let n = 2;
  while (n < entrantIds.length) n *= 2;
  while (entrantIds.length < n) entrantIds.push(null);

  const ties = [];
  for (let i = 0; i < entrantIds.length; i += 2) {
    const a = entrantIds[i];
    const b = entrantIds[i + 1];
    ties.push({
      tieId: uid('t_'),
      homeId: a,
      awayId: b,
      matchId: a && b ? uid('mt_') : null,
      played: false,
      winnerId: a && !b ? a : (!a && b ? b : null), // bye
    });
  }
  const roundName = roundNameForSize(entrantIds.length);
  cup.rounds.push({ name: roundName, ties });
}

function roundNameForSize(n) {
  switch (n) {
    case 2:  return 'Final';
    case 4:  return 'Semi-finals';
    case 8:  return 'Quarter-finals';
    case 16: return 'Round of 16';
    case 32: return 'Round of 32';
    case 64: return 'Round of 64';
    default: return `Round (${n})`;
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ===========================================================================
 * Squad selection — AI picks XI for a given club
 * ========================================================================= */
function selectXI(clubId, formationName) {
  const club = getClub(clubId);
  if (!club) return null;
  formationName = formationName || club.formation || DEFAULT_FORMATION;
  const formation = FORMATIONS[formationName];
  if (!formation) return null;

  const squad = playersByClub(clubId).filter(p => !p.isRetired && !isUnavailable(p));
  const used = new Set();
  const slots = formation.map(f => ({ ...f, playerId: null }));

  const groupFor = role => ROLE_TO_GROUP[role];

  const rateForRole = (player, role, allowNoise = true) => {
    const a = player.attrs;
    const grp = groupFor(role);
    if (player.position === 'GK' && grp !== 'GK') return -1;
    if (player.position !== 'GK' && grp === 'GK') return -1;
    let r = 0;
    if (grp === 'GK') r = a.goalkeeping * 1.3 + a.mental * 0.4;
    else if (grp === 'DF') r = a.defending * 1.1 + a.strength * 0.7 + a.pace * 0.6 + a.mental * 0.5 + (player.role === role ? 6 : 0);
    else if (grp === 'MF') r = a.passing * 1.0 + a.technique * 0.9 + a.mental * 0.6 + a.defending * (role === 'CDM' ? 0.7 : 0.4) + a.shooting * (role === 'CAM' ? 0.6 : 0.3) + (player.role === role ? 6 : 0);
    else                  r = a.shooting * 1.1 + a.pace * 0.9 + a.technique * 0.8 + a.mental * 0.4 + (player.role === role ? 6 : 0);
    // Fatigue: subtract a chunk if recently played heavy minutes
    const fatigue = player.status.fatigue || 0;
    r -= fatigue * 0.15;
    // Rotation noise: ±18% so close calls get rotated, but clearly-better
    // players still keep their place
    if (allowNoise) r *= 0.82 + Math.random() * 0.36;
    return r - player.status.suspendedFor * 100;
  };

  // Pin the captain (and vice-captain when the captain is unfit) to their
  // best-fitting slot before the greedy fill. Captains play every match
  // they're available for.
  const pin = (player) => {
    if (!player || used.has(player.id) || isUnavailable(player) || player.isRetired) return false;
    let bestSlot = null, bestScore = -Infinity;
    for (const slot of slots) {
      if (slot.playerId) continue;
      const s = rateForRole(player, slot.role, false);
      if (s > bestScore) { bestScore = s; bestSlot = slot; }
    }
    if (!bestSlot || bestScore <= 0) return false;
    bestSlot.playerId = player.id;
    used.add(player.id);
    return true;
  };
  const cap = club.captainId ? getPlayer(club.captainId) : null;
  const vc  = club.viceCaptainId ? getPlayer(club.viceCaptainId) : null;
  pin(cap);
  pin(vc);

  // Greedy assignment for remaining slots: pick best available not-yet-used
  for (const slot of slots) {
    if (slot.playerId) continue;
    let best = null, bestScore = -Infinity;
    for (const p of squad) {
      if (used.has(p.id)) continue;
      const s = rateForRole(p, slot.role);
      if (s > bestScore) { bestScore = s; best = p; }
    }
    if (best) { slot.playerId = best.id; used.add(best.id); }
  }
  // Bench: best 7 remaining
  const bench = squad.filter(p => !used.has(p.id))
    .map(p => ({ p, rate: rateForRole(p, p.role) }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 7)
    .map(x => x.p.id);

  return { formation: formationName, slots, benchIds: bench };
}

function isUnavailable(p) {
  if (!p) return true;
  if (p.isRetired) return true;
  if ((p.status.suspendedFor || 0) > 0) return true;
  if ((p.status.injuredUntil || 0) > 0) return true;
  return false;
}

/* Team strength — sum of weighted attributes from XI for attack / defence / midfield */
function teamStrength(xi) {
  let attack = 0, defence = 0, midfield = 0, gk = 0, count = 0;
  for (const slot of xi.slots) {
    const p = getPlayer(slot.playerId);
    if (!p) continue;
    const a = p.attrs;
    const grp = ROLE_TO_GROUP[slot.role];
    if (grp === 'GK') gk = a.goalkeeping;
    else if (grp === 'DF') defence += a.defending * 1.0 + a.strength * 0.4 + a.mental * 0.3;
    else if (grp === 'MF') {
      midfield += a.passing * 0.8 + a.technique * 0.6 + a.mental * 0.4;
      attack += a.shooting * 0.4;
      defence += a.defending * 0.4;
    }
    else { attack += a.shooting * 0.9 + a.pace * 0.5 + a.technique * 0.5; }
    count++;
  }
  return { attack, defence, midfield, gk, overall: (attack + defence + midfield + gk * 1.2) / Math.max(count, 1) };
}

/* ===========================================================================
 * MATCH SIMULATION — minute-by-minute
 *
 *   Returns a draft match record (not committed). Caller decides whether
 *   to commit it (commitMatch) or discard.
 * ========================================================================= */
function simulateMatch({ homeId, awayId, leagueId = null, cupId = null, matchday = null, neutral = false, isKnockout = false, requiresWinner = false, leg = null, aggregateOpponentScoreH = 0, aggregateOpponentScoreA = 0 }) {
  const home = getClub(homeId);
  const away = getClub(awayId);
  if (!home || !away) return null;

  const homeXI = selectXI(homeId);
  const awayXI = selectXI(awayId);
  if (!homeXI || !awayXI) {
    showToast('Could not select XI — squad missing players', 'error');
    return null;
  }
  const homeS = teamStrength(homeXI);
  const awayS = teamStrength(awayXI);

  // Tactics influence
  const ht = home.tactics || { mentality: 50, tempo: 50, pressing: 50 };
  const at = away.tactics || { mentality: 50, tempo: 50, pressing: 50 };

  const homeAdv = neutral ? 0 : 8;
  const homeAttack = homeS.attack * (0.85 + ht.mentality / 200) + homeS.midfield * 0.3 + homeAdv;
  const homeDef    = homeS.defence + homeS.gk * 0.6 + (homeS.midfield * 0.2) + (100 - ht.mentality) * 0.05;
  const awayAttack = awayS.attack * (0.85 + at.mentality / 200) + awayS.midfield * 0.3;
  const awayDef    = awayS.defence + awayS.gk * 0.6 + (awayS.midfield * 0.2) + (100 - at.mentality) * 0.05;

  // Expected goals: ratio attack/(attack+defence) scaled to ~1.3 average per side
  const ratioH = homeAttack / Math.max(homeAttack + awayDef, 1);
  const ratioA = awayAttack / Math.max(awayAttack + homeDef, 1);
  let xgH = 0.5 + ratioH * 1.5;
  let xgA = 0.5 + ratioA * 1.3;
  // Tempo: higher tempo = slightly more shots both ways
  const avgTempo = (ht.tempo + at.tempo) / 2;
  const tempoMult = 0.95 + avgTempo / 400;
  xgH *= tempoMult; xgA *= tempoMult;
  // Tiny noise
  xgH *= 0.9 + rand() * 0.2;
  xgA *= 0.9 + rand() * 0.2;

  // ===== Tick loop =====
  const events = [];
  const stoppage = pickInt(2, 6);
  const totalMinutes = 90 + stoppage;
  let hScore = 0, aScore = 0;
  // Track on-pitch players (for goalscorers, cards, subs)
  const onPitch = { home: new Set(homeXI.slots.map(s => s.playerId).filter(Boolean)), away: new Set(awayXI.slots.map(s => s.playerId).filter(Boolean)) };
  const onBench = { home: homeXI.benchIds.slice(), away: awayXI.benchIds.slice() };
  const subsUsed = { home: 0, away: 0 };
  const yellows = { /* playerId: count */ };
  const sentOff = { home: new Set(), away: new Set() };
  const minutesPlayed = {};
  const teamGoalsRatio = { home: xgH, away: xgA };
  const cards = [];
  const scorers = [];
  const injuriesThisMatch = [];
  const subs = [];

  // Helpers
  const pickSide = () => {
    const totalShare = homeS.midfield + awayS.midfield + 1e-3;
    return rand() < (homeS.midfield + 5) / (homeS.midfield + awayS.midfield + 10) ? 'home' : 'away';
  };
  const homeTeamLabel = home.name;
  const awayTeamLabel = away.name;

  events.push({ minute: 0, type: 'kickoff', text: templ(pick(COMMENTARY.kickoff), { hometeam: homeTeamLabel, awayteam: awayTeamLabel, stadium: home.stadiumName, attendance: pickInt(Math.round(home.stadiumCapacity * 0.55), home.stadiumCapacity).toLocaleString() }) });

  // Pre-plan substitution minutes (3 per side, spread across the match).
  // Injuries may consume slots earlier; the schedule fills any unused slots.
  const planSubs = () => {
    const mins = new Set();
    while (mins.size < 3) mins.add(pickInt(55, 86));
    return Array.from(mins).sort((a, b) => a - b);
  };
  const subSchedule = { home: planSubs(), away: planSubs() };

  // Per-minute event probabilities
  const SHOT_RATE = 0.05 + avgTempo / 1300;     // ~6-8 shots per side
  const FOUL_RATE = 0.04 + (ht.pressing + at.pressing) / 2000; // ~4-8 fouls
  const INJURY_RATE = 0.0028;

  const initialPlayers = (side, xi) => xi.slots.map(s => s.playerId).filter(Boolean);
  const homePlayers = initialPlayers('home', homeXI);
  const awayPlayers = initialPlayers('away', awayXI);
  for (const pid of [...homePlayers, ...awayPlayers]) minutesPlayed[pid] = 0;

  // Roster maps for quick lookups
  const playerSide = {};
  for (const pid of homePlayers) playerSide[pid] = 'home';
  for (const pid of awayPlayers) playerSide[pid] = 'away';

  for (let min = 1; min <= totalMinutes; min++) {
    // Minute logging for everyone on pitch
    for (const pid of onPitch.home) minutesPlayed[pid] = (minutesPlayed[pid] || 0) + 1;
    for (const pid of onPitch.away) minutesPlayed[pid] = (minutesPlayed[pid] || 0) + 1;

    // Half-time
    if (min === 46) {
      events.push({ minute: 45, type: 'halftime', text: templ(pick(COMMENTARY.halftime), { hometeam: homeTeamLabel, awayteam: awayTeamLabel, hs: hScore, as: aScore }) });
    }

    // Shot events: each side may take a shot this minute
    for (const side of ['home', 'away']) {
      const opp = side === 'home' ? 'away' : 'home';
      const myXg = side === 'home' ? xgH : xgA;
      const sideShotRate = SHOT_RATE * (myXg / 1.4);
      if (rand() < sideShotRate) {
        rollShot(side, min);
      }
    }
    // Fouls
    if (rand() < FOUL_RATE) rollFoul(min);
    // Injuries
    if (rand() < INJURY_RATE) rollInjury(min);
    // Scheduled subs — force tactical subs at pre-planned minutes
    for (const side of ['home', 'away']) {
      if (subsUsed[side] >= 3) continue;
      if (subSchedule[side].includes(min)) forceAISub(side, min);
    }
  }

  // Full-time
  events.push({ minute: totalMinutes, type: 'fulltime', text: templ(pick(COMMENTARY.fulltime), { hometeam: homeTeamLabel, awayteam: awayTeamLabel, hs: hScore, as: aScore }) });

  // Extra time + penalties for knockout if drawn
  let extraTime = null;
  let penalties = null;
  if (requiresWinner && hScore === aScore) {
    extraTime = simulateExtraTime();
  }
  if (requiresWinner && hScore === aScore) {
    penalties = simulatePenalties();
  }

  const stats = computeMatchStats(events, hScore, aScore, homeS, awayS);

  // Build appearances list
  const appearances = [];
  for (const pid of homePlayers.concat([...onBench.home].slice(0, 7))) {
    if (minutesPlayed[pid] != null) appearances.push({ playerId: pid, side: 'home', minutesPlayed: minutesPlayed[pid] || 0, started: homePlayers.includes(pid) });
  }
  for (const pid of awayPlayers.concat([...onBench.away].slice(0, 7))) {
    if (minutesPlayed[pid] != null) appearances.push({ playerId: pid, side: 'away', minutesPlayed: minutesPlayed[pid] || 0, started: awayPlayers.includes(pid) });
  }

  return {
    id: uid('mt_'),
    season: state.settings.season,
    leagueId, cupId, matchday, neutral, isKnockout, leg,
    homeId, awayId,
    homeXI, awayXI,
    hScore, aScore,
    extraTime, penalties,
    events,
    scorers,
    cards,
    injuries: injuriesThisMatch,
    subs,
    appearances,
    stats,
    stoppage,
    generatedAt: Date.now(),
    committed: false,
  };

  // ----- inner helpers (closure over locals) -----
  function rollShot(side, min) {
    const xi = side === 'home' ? homeXI : awayXI;
    const onP = onPitch[side];
    if (!onP.size) return;
    // Pick a shooter weighted by shooting attribute
    let shooterCands = xi.slots
      .filter(s => onP.has(s.playerId))
      .map(s => getPlayer(s.playerId))
      .filter(Boolean);
    if (!shooterCands.length) return;
    const weights = shooterCands.map(p => Math.max(p.attrs.shooting + (p.position === 'FW' ? 30 : p.position === 'MF' ? 10 : 0), 1));
    const shooter = weightedPick(shooterCands, weights);
    if (!shooter) return;

    const oppSide = side === 'home' ? 'away' : 'home';
    const oppXI = oppSide === 'home' ? homeXI : awayXI;
    const oppGK = getPlayer(oppXI.slots[0].playerId);

    const shotQuality = (shooter.attrs.shooting + shooter.attrs.technique) / 2 + randNorm(0, 12);
    const gkQuality = oppGK ? oppGK.attrs.goalkeeping + randNorm(0, 8) : 50;

    // Penalty? small chance (~1 every 4 matches)
    const isPen = rand() < 0.012;
    if (isPen) {
      events.push({ minute: min, type: 'penalty', icon: '⚽', side, text: pick(COMMENTARY.penaltyAwarded) });
      const conv = (shotQuality - gkQuality * 0.6 + 30) / 100;
      if (rand() < clamp(conv, 0.65, 0.92)) {
        if (side === 'home') hScore++; else aScore++;
        scorers.push({ playerId: shooter.id, minute: min, ownGoal: false, penalty: true, side, assistId: null });
        events.push({ minute: min, type: 'goal', side, icon: '⚽', score: `${hScore}–${aScore}`, text: templ(pick(COMMENTARY.penaltyScored), { scorer: shooter.name }) });
      } else {
        events.push({ minute: min, type: 'pen_missed', side, icon: '✕', text: templ(pick(COMMENTARY.penaltyMissed), { scorer: shooter.name, keeper: oppGK ? oppGK.name : 'the keeper' }) });
      }
      return;
    }

    // Open play
    const goalP = clamp((shotQuality - gkQuality * 0.55 + 8) / 145, 0.035, 0.26);
    const blockP = 0.18;
    const saveP = 0.30;
    const r = rand();
    if (r < goalP) {
      // Pick assister (rand on midfielders/forwards)
      let assister = null;
      if (rand() < 0.7) {
        const possibles = xi.slots
          .filter(s => onP.has(s.playerId) && s.playerId !== shooter.id && (ROLE_TO_GROUP[s.role] === 'MF' || ROLE_TO_GROUP[s.role] === 'FW' || ROLE_TO_GROUP[s.role] === 'DF'))
          .map(s => getPlayer(s.playerId)).filter(Boolean);
        if (possibles.length) assister = weightedPick(possibles, possibles.map(p => Math.max(p.attrs.passing + p.attrs.technique, 1)));
      }
      if (side === 'home') hScore++; else aScore++;
      scorers.push({ playerId: shooter.id, minute: min, ownGoal: false, penalty: false, side, assistId: assister ? assister.id : null });
      const txt = assister
        ? templ(pick(COMMENTARY.goalAssist), { scorer: shooter.name, assister: assister.name })
        : templ(pick(COMMENTARY.goal), { scorer: shooter.name });
      events.push({ minute: min, type: 'goal', side, icon: '⚽', score: `${hScore}–${aScore}`, text: txt });
    } else if (r < goalP + saveP) {
      events.push({ minute: min, type: 'shot_saved', side, icon: '✋', text: templ(pick(COMMENTARY.shotSaved), { keeper: oppGK ? oppGK.name : 'the keeper', shooter: shooter.name }) });
    } else if (r < goalP + saveP + blockP) {
      events.push({ minute: min, type: 'blocked', side, icon: '◇', text: templ(pick(COMMENTARY.blocked), { shooter: shooter.name }) });
    } else {
      events.push({ minute: min, type: 'shot_missed', side, icon: '✕', text: templ(pick(COMMENTARY.shotMissed), { shooter: shooter.name }) });
    }
  }

  function rollFoul(min) {
    // Pick fouler from the side currently with fewer goals (mild bias)
    const side = rand() < 0.5 ? 'home' : 'away';
    const fouledSide = side === 'home' ? 'away' : 'home';
    const xi = side === 'home' ? homeXI : awayXI;
    const oxi = side === 'home' ? awayXI : homeXI;
    const onF = onPitch[side];
    const onTo = onPitch[fouledSide];
    if (!onF.size || !onTo.size) return;
    const fouler = pickFromOnPitch(xi, onF, p => p.position !== 'GK');
    const fouled = pickFromOnPitch(oxi, onTo, _ => true);
    if (!fouler || !fouled) return;
    // Card chance
    const r = rand();
    const cardThresh = 0.18 + (side === 'home' ? ht.pressing : at.pressing) / 600;
    if (r < cardThresh) {
      yellows[fouler.id] = (yellows[fouler.id] || 0) + 1;
      cards.push({ playerId: fouler.id, side, type: 'yellow', minute: min, reason: 'foul' });
      events.push({ minute: min, type: 'yellow', side, icon: '▪', text: templ(pick(COMMENTARY.yellow), { fouler: fouler.name, fouled: fouled.name }) });
      // Second yellow → red
      if (yellows[fouler.id] >= 2) {
        cards.push({ playerId: fouler.id, side, type: 'red', minute: min, reason: 'second_yellow' });
        sentOff[side].add(fouler.id);
        onPitch[side].delete(fouler.id);
        events.push({ minute: min, type: 'red', side, icon: '■', text: templ(pick(COMMENTARY.red), { fouler: fouler.name, fouled: fouled.name }) });
      }
    } else if (r < cardThresh + 0.005) {
      // Direct red
      cards.push({ playerId: fouler.id, side, type: 'red', minute: min, reason: 'direct_red' });
      sentOff[side].add(fouler.id);
      onPitch[side].delete(fouler.id);
      events.push({ minute: min, type: 'red', side, icon: '■', text: templ(pick(COMMENTARY.red), { fouler: fouler.name, fouled: fouled.name }) });
    }
    // Otherwise just an unbooked foul — ignore for commentary brevity
  }

  function rollInjury(min) {
    const side = rand() < 0.5 ? 'home' : 'away';
    const onF = onPitch[side];
    if (!onF.size) return;
    const xi = side === 'home' ? homeXI : awayXI;
    const cands = [...onF].map(getPlayer).filter(Boolean);
    if (!cands.length) return;
    // Weight by injuryProneness
    const weights = cands.map(p => 1 + (p.injuryProneness || 10) / 30);
    const victim = weightedPick(cands, weights);
    if (!victim) return;
    // Severity: weeks out
    const matches = pickInt(state.settings.injuryRange[0], state.settings.injuryRange[1]);
    injuriesThisMatch.push({ playerId: victim.id, side, minute: min, matches });
    events.push({ minute: min, type: 'injury', side, icon: '✚', text: templ(pick(COMMENTARY.injury), { player: victim.name }) });
    // Try to sub immediately if subs available
    const sub = pickSubFor(victim, side);
    if (sub) doSub(side, victim.id, sub.id, min, 'Injury');
    else { onPitch[side].delete(victim.id); /* play one short */ }
  }

  function forceAISub(side, min) {
    if (subsUsed[side] >= 3) return;
    // Sub the lowest-rated outfielder (NB: never the captain unless we have to)
    const xi = side === 'home' ? homeXI : awayXI;
    const onF = onPitch[side];
    const club = side === 'home' ? home : away;
    const onPlayers = xi.slots
      .filter(s => onF.has(s.playerId))
      .map(s => ({ slot: s, player: getPlayer(s.playerId) }))
      .filter(x => x.player && x.player.position !== 'GK' && x.player.id !== club.captainId);
    if (!onPlayers.length) return;
    // Pick the player whose role is filled best by a bench alternative
    const benchPids = onBench[side];
    const benchByGroup = {};
    for (const pid of benchPids) {
      const p = getPlayer(pid);
      if (!p) continue;
      const grp = ROLE_TO_GROUP[p.role];
      (benchByGroup[grp] = benchByGroup[grp] || []).push(p);
    }
    onPlayers.sort((a, b) => playerOverall(a.player) - playerOverall(b.player));
    for (const cand of onPlayers) {
      const targetGroup = ROLE_TO_GROUP[cand.slot.role];
      const benchPlayers = benchByGroup[targetGroup];
      if (!benchPlayers || !benchPlayers.length) continue;
      benchPlayers.sort((a, b) => playerOverall(b) - playerOverall(a));
      doSub(side, cand.player.id, benchPlayers[0].id, min, pick(SUBSTITUTION_REASONS));
      return;
    }
    // Fallback: any bench player for any outfielder
    if (onPlayers.length && benchPids.length) {
      const incoming = benchPids.map(getPlayer).filter(Boolean)[0];
      if (incoming) doSub(side, onPlayers[0].player.id, incoming.id, min, pick(SUBSTITUTION_REASONS));
    }
  }

  function pickSubFor(victim, side) {
    const benchPids = onBench[side];
    const cands = benchPids.map(getPlayer).filter(Boolean).filter(p => p.position === victim.position);
    if (cands.length) return cands[0];
    const any = benchPids.map(getPlayer).filter(Boolean);
    return any[0] || null;
  }

  function doSub(side, offId, onId, min, reason) {
    if (subsUsed[side] >= 3) return;
    onPitch[side].delete(offId);
    onPitch[side].add(onId);
    onBench[side] = onBench[side].filter(id => id !== onId);
    subsUsed[side]++;
    const off = getPlayer(offId);
    const onP = getPlayer(onId);
    subs.push({ side, offId, onId, minute: min, reason });
    events.push({
      minute: min, type: 'sub', side, icon: '⇄',
      text: templ(pick(COMMENTARY.sub), { team: side === 'home' ? home.name : away.name, playerOff: off?.name || '?', playerOn: onP?.name || '?' })
    });
    // Replace XI slot for stat purposes
    const xi = side === 'home' ? homeXI : awayXI;
    const slot = xi.slots.find(s => s.playerId === offId);
    if (slot) slot.playerId = onId;
  }

  function pickFromOnPitch(xi, onF, predicate) {
    const cands = xi.slots.filter(s => onF.has(s.playerId)).map(s => getPlayer(s.playerId)).filter(p => p && predicate(p));
    if (!cands.length) return null;
    return cands[Math.floor(rand() * cands.length)];
  }

  function simulateExtraTime() {
    const etEvents = [];
    const etMins = 30;
    const etShotRate = SHOT_RATE * 0.85;
    let etHomeGoals = 0, etAwayGoals = 0;
    for (let m = 1; m <= etMins; m++) {
      for (const side of ['home', 'away']) {
        if (rand() < etShotRate * (side === 'home' ? xgH : xgA) / 1.6) {
          rollShot(side, 90 + m);
        }
      }
    }
    return { homeGoals: hScore, awayGoals: aScore }; // hScore/aScore have been mutated by rollShot
  }

  function simulatePenalties() {
    const pens = [];
    let h = 0, a = 0;
    for (let i = 0; i < 5; i++) {
      const homeShooter = getRandomNonGK('home');
      const awayShooter = getRandomNonGK('away');
      const homeGK = getPlayer(awayXI.slots[0].playerId);
      const awayGK = getPlayer(homeXI.slots[0].playerId);
      const homeConv = clamp(((homeShooter?.attrs.shooting || 50) - (homeGK?.attrs.goalkeeping || 50) * 0.6 + 50) / 100, 0.55, 0.92);
      const awayConv = clamp(((awayShooter?.attrs.shooting || 50) - (awayGK?.attrs.goalkeeping || 50) * 0.6 + 50) / 100, 0.55, 0.92);
      const hMade = rand() < homeConv;
      const aMade = rand() < awayConv;
      if (hMade) h++;
      if (aMade) a++;
      pens.push({ round: i + 1, homeShooterId: homeShooter?.id, homeMade: hMade, awayShooterId: awayShooter?.id, awayMade: aMade });
      // Early-out check
      const remaining = 4 - i;
      if (Math.abs(h - a) > remaining) break;
    }
    // Sudden death
    while (h === a) {
      const homeShooter = getRandomNonGK('home');
      const awayShooter = getRandomNonGK('away');
      const hMade = rand() < 0.78;
      const aMade = rand() < 0.78;
      if (hMade) h++;
      if (aMade) a++;
      pens.push({ round: pens.length + 1, homeShooterId: homeShooter?.id, homeMade: hMade, awayShooterId: awayShooter?.id, awayMade: aMade, suddenDeath: true });
      if (h !== a) break;
      if (pens.length > 20) break; // safety
    }
    events.push({ minute: 121, type: 'penalties', text: `Penalty shootout: ${homeTeamLabel} ${h} – ${a} ${awayTeamLabel}` });
    return { homeKicks: h, awayKicks: a, kicks: pens };
  }

  function getRandomNonGK(side) {
    const xi = side === 'home' ? homeXI : awayXI;
    const onF = onPitch[side];
    const cands = xi.slots.filter(s => onF.has(s.playerId) && s.role !== 'GK').map(s => getPlayer(s.playerId)).filter(Boolean);
    if (!cands.length) return null;
    return cands[Math.floor(rand() * cands.length)];
  }
}

function weightedPick(items, weights) {
  if (!items.length) return null;
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function computeMatchStats(events, hScore, aScore, homeS, awayS) {
  const shots = { home: 0, away: 0, hOnT: 0, aOnT: 0 };
  const fouls = { home: 0, away: 0 };
  const corners = { home: 0, away: 0 };
  const yellows = { home: 0, away: 0 };
  const reds = { home: 0, away: 0 };
  for (const e of events) {
    if (!e.side) continue;
    const k = e.side;
    if (e.type === 'goal') { shots[k]++; if (k === 'home') shots.hOnT++; else shots.aOnT++; }
    if (e.type === 'shot_saved') { shots[k]++; if (k === 'home') shots.hOnT++; else shots.aOnT++; }
    if (e.type === 'shot_missed' || e.type === 'blocked') shots[k]++;
    if (e.type === 'yellow') yellows[k]++;
    if (e.type === 'red') reds[k]++;
  }
  // Possession derived from midfield strength ratio
  const totalMid = homeS.midfield + awayS.midfield + 1;
  const hPos = Math.round((homeS.midfield + 8) / totalMid * 100);
  const aPos = 100 - hPos;
  return {
    possessionH: hPos,
    possessionA: aPos,
    shotsH: shots.home,
    shotsA: shots.away,
    sotH: shots.hOnT,
    sotA: shots.aOnT,
    cornersH: pickInt(2, 8),
    cornersA: pickInt(2, 8),
    foulsH: pickInt(8, 16),
    foulsA: pickInt(8, 16),
    yellowsH: yellows.home,
    yellowsA: yellows.away,
    redsH: reds.home,
    redsA: reds.away,
  };
}

/* ===========================================================================
 * Commit a draft match — applies side-effects + appends to history book
 * ========================================================================= */
function commitMatch(draft) {
  if (!draft) return null;
  if (draft.committed) return draft;
  draft.committed = true;

  // Apply side effects: yellow accumulation, suspensions for reds, injuries
  const yellowsByPlayer = {};
  for (const c of draft.cards || []) {
    if (c.type === 'yellow') {
      yellowsByPlayer[c.playerId] = (yellowsByPlayer[c.playerId] || 0) + 1;
      const p = getPlayer(c.playerId);
      if (p) {
        p.status.yellowsThisSeason = (p.status.yellowsThisSeason || 0) + 1;
        if (p.status.yellowsThisSeason >= state.settings.yellowsForBan) {
          p.status.suspendedFor = (p.status.suspendedFor || 0) + 1;
          p.status.yellowsThisSeason = 0;
          historyAppend('player_suspended', { playerId: p.id, games: 1, reason: 'yellow_accumulation', matchId: draft.id });
        }
      }
    } else if (c.type === 'red') {
      const p = getPlayer(c.playerId);
      if (p) {
        const ban = pickInt(state.settings.redCardBanRange[0], state.settings.redCardBanRange[1]);
        p.status.suspendedFor = (p.status.suspendedFor || 0) + ban;
        historyAppend('player_suspended', { playerId: p.id, games: ban, reason: 'red_card', matchId: draft.id });
      }
    }
  }
  for (const inj of draft.injuries || []) {
    const p = getPlayer(inj.playerId);
    if (p) {
      p.status.injuredUntil = (p.status.injuredUntil || 0) + inj.matches;
      historyAppend('player_injured', { playerId: p.id, matches: inj.matches, matchId: draft.id });
    }
  }
  // Per-player season stats + fatigue
  const playedSet = new Set();
  for (const ap of draft.appearances || []) {
    const p = getPlayer(ap.playerId);
    if (p) {
      p.seasonStats.apps = (p.seasonStats.apps || 0) + 1;
      p.status.fatigue = clamp((p.status.fatigue || 0) + (ap.minutesPlayed || 0) / 8, 0, 100);
      playedSet.add(ap.playerId);
    }
  }
  // Bench non-appearance squad rest: decay fatigue for unused squad members
  for (const cid of [draft.homeId, draft.awayId]) {
    for (const p of playersByClub(cid)) {
      if (!p || playedSet.has(p.id) || p.isRetired) continue;
      p.status.fatigue = Math.max(0, (p.status.fatigue || 0) - 5);
    }
  }
  for (const sc of draft.scorers || []) {
    const p = getPlayer(sc.playerId);
    if (p && !sc.ownGoal) p.seasonStats.goals = (p.seasonStats.goals || 0) + 1;
    if (sc.assistId) {
      const a = getPlayer(sc.assistId);
      if (a) a.seasonStats.assists = (a.seasonStats.assists || 0) + 1;
    }
  }

  // Mark the league/cup fixture as played
  if (draft.leagueId) {
    const lg = getLeague(draft.leagueId);
    if (lg) {
      for (const rd of (lg.schedule || [])) {
        for (const fx of rd.fixtures) {
          if (fx.homeId === draft.homeId && fx.awayId === draft.awayId && !fx.played) {
            fx.played = true;
            fx.matchId = draft.id;
            break;
          }
        }
      }
    }
  }
  if (draft.cupId) {
    const cp = getCup(draft.cupId);
    if (cp) markCupFixturePlayed(cp, draft);
  }

  // History entry — slim form. Events / XI omitted to keep localStorage small;
  // they are reconstructed from scorers/cards/subs/injuries on view.
  historyAppend('match_committed', {
    matchId: draft.id,
    leagueId: draft.leagueId,
    cupId: draft.cupId,
    matchday: draft.matchday,
    homeId: draft.homeId,
    awayId: draft.awayId,
    homeFormation: (draft.homeXI && draft.homeXI.formation) || null,
    awayFormation: (draft.awayXI && draft.awayXI.formation) || null,
    hScore: draft.hScore,
    aScore: draft.aScore,
    extraTime: draft.extraTime,
    penalties: draft.penalties,
    scorers: draft.scorers,
    cards: draft.cards,
    injuries: draft.injuries,
    subs: draft.subs,
    appearances: draft.appearances,
    stats: draft.stats,
    stoppage: draft.stoppage,
  });

  // Remove from drafts
  state.draftMatches = (state.draftMatches || []).filter(d => d.id !== draft.id);
  // Keep calendar.day in sync: roll past any days that are now fully played
  syncCalendarDay();
  saveState();
  return draft;
}

/* Walk calendar.day forward through any days that have no unplayed fixtures
 * left, so the banner reflects what's actually next. */
function syncCalendarDay() {
  if (!state.calendar) return;
  const total = state.calendar.totalDays || 0;
  while (state.calendar.day <= total) {
    const day = state.calendar.day;
    const anyPending = fixturesOnCalendarDay(day).some(f => !f.fixture.played);
    if (anyPending) break;
    state.calendar.day++;
  }
}

function markCupFixturePlayed(cp, draft) {
  // Try groups first
  if (cp.groups) {
    for (const g of cp.groups) {
      for (const fx of g.fixtures) {
        if (!fx.played && fx.homeId === draft.homeId && fx.awayId === draft.awayId) {
          fx.played = true; fx.matchId = draft.id;
          fx.hScore = draft.hScore; fx.aScore = draft.aScore;
          return;
        }
      }
    }
  }
  // Knockout rounds
  for (const rd of cp.rounds) {
    for (const tie of rd.ties) {
      if (!tie.played && tie.homeId === draft.homeId && tie.awayId === draft.awayId) {
        tie.played = true;
        tie.matchId = draft.id;
        let winnerId;
        if (draft.penalties) {
          winnerId = draft.penalties.homeKicks > draft.penalties.awayKicks ? draft.homeId : draft.awayId;
        } else {
          winnerId = draft.hScore > draft.aScore ? draft.homeId : draft.awayId;
        }
        tie.winnerId = winnerId;
        return;
      }
    }
  }
}

function discardDraftMatch(draftId) {
  state.draftMatches = (state.draftMatches || []).filter(d => d.id !== draftId);
  saveState();
}

/* ===========================================================================
 * Cup helpers: advance round, group standings, group stage progression
 * ========================================================================= */
function advanceCup(cupId) {
  const cp = getCup(cupId);
  if (!cp) return;
  if (cp.format === 'group_knockout' && cp._currentRound === 'groups') {
    // If all group fixtures played, advance top N of each group to bracket
    const allDone = cp.groups.every(g => g.fixtures.every(f => f.played));
    if (!allDone) { showToast('Not all group fixtures played', 'warning'); return; }
    const advancing = [];
    for (const g of cp.groups) {
      const tbl = groupTable(g);
      for (let i = 0; i < (cp._groupAdvance || 2) && i < tbl.length; i++) advancing.push(tbl[i].clubId);
    }
    cp._currentRound = 'knockout';
    buildKnockoutRound(cp, shuffle(advancing));
    saveState();
    return;
  }
  // Knockout — advance winners of last round to next round
  const last = cp.rounds[cp.rounds.length - 1];
  if (!last) return;
  const allPlayed = last.ties.every(t => t.played || (t.homeId && !t.awayId) || (!t.homeId && t.awayId));
  if (!allPlayed) { showToast('Round still has unplayed ties', 'warning'); return; }
  const winners = last.ties.map(t => t.winnerId).filter(Boolean);
  if (winners.length <= 1) {
    // Cup over
    if (winners.length === 1) {
      const finalist = last.ties[0];
      historyAppend('cup_won', { cupId: cp.id, winnerId: winners[0], runnerUpId: finalist.homeId === winners[0] ? finalist.awayId : finalist.homeId });
      cp.status = 'completed';
      showToast(`${clubName(winners[0])} win the ${cp.name}!`, 'success');
    }
    return;
  }
  buildKnockoutRound(cp, shuffle(winners));
  saveState();
}

function groupTable(group) {
  const ps = DEFAULT_POINTS_SYSTEM;
  const rows = {};
  for (const cid of group.clubIds) rows[cid] = { clubId: cid, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  for (const f of group.fixtures) {
    if (!f.played) continue;
    const h = rows[f.homeId], a = rows[f.awayId];
    if (!h || !a) continue;
    h.p++; a.p++;
    h.gf += f.hScore; h.ga += f.aScore; a.gf += f.aScore; a.ga += f.hScore;
    if (f.hScore > f.aScore) { h.w++; a.l++; h.pts += ps.win; }
    else if (f.hScore < f.aScore) { a.w++; h.l++; a.pts += ps.win; }
    else { h.d++; a.d++; h.pts += ps.draw; a.pts += ps.draw; }
  }
  const arr = Object.values(rows);
  arr.forEach(r => r.gd = r.gf - r.ga);
  arr.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || clubName(a.clubId).localeCompare(clubName(b.clubId)));
  return arr;
}

/* ===========================================================================
 * Matchday batch: generate drafts for all unplayed fixtures of next matchday
 * ========================================================================= */
function nextMatchdayForLeague(leagueId) {
  const lg = getLeague(leagueId);
  if (!lg) return null;
  for (const rd of (lg.schedule || [])) {
    if (rd.fixtures.some(f => !f.played)) return rd;
  }
  return null;
}

function generateMatchdayDrafts(leagueId) {
  const rd = nextMatchdayForLeague(leagueId);
  if (!rd) { showToast('No more matchdays', 'warning'); return []; }
  const drafts = [];
  for (const fx of rd.fixtures) {
    if (fx.played) continue;
    const draft = simulateMatch({ homeId: fx.homeId, awayId: fx.awayId, leagueId, matchday: rd.matchday });
    if (draft) drafts.push(draft);
  }
  state.draftMatches = (state.draftMatches || []).filter(d => d.leagueId !== leagueId || d.matchday !== rd.matchday);
  state.draftMatches.push(...drafts);
  saveState();
  return drafts;
}

function generateSingleFixtureDraft(matchOpts) {
  const draft = simulateMatch(matchOpts);
  if (!draft) return null;
  state.draftMatches = state.draftMatches || [];
  state.draftMatches.push(draft);
  saveState();
  return draft;
}

function commitAllDraftsForMatchday(leagueId, matchday) {
  const drafts = (state.draftMatches || []).filter(d => d.leagueId === leagueId && d.matchday === matchday);
  for (const d of drafts) commitMatch(d);
}

function generateAndCommitToEndOfSeason(leagueId) {
  let safety = 100;
  while (--safety > 0) {
    const rd = nextMatchdayForLeague(leagueId);
    if (!rd) break;
    const drafts = generateMatchdayDrafts(leagueId);
    for (const d of drafts) commitMatch(d);
  }
  // Cup — generate + commit any remaining current-round ties
  for (const cp of state.cups) {
    let safety2 = 50;
    while (--safety2 > 0) {
      const fx = nextCupFixtures(cp.id);
      if (!fx.length) break;
      for (const f of fx) {
        const draft = simulateMatch({ homeId: f.homeId, awayId: f.awayId, cupId: cp.id, neutral: f.neutral, isKnockout: cp._currentRound !== 'groups', requiresWinner: cp._currentRound !== 'groups' });
        if (draft) commitMatch(draft);
      }
      advanceCup(cp.id);
    }
  }
  endOfSeasonProcessing();
}

function nextCupFixtures(cupId) {
  const cp = getCup(cupId);
  if (!cp || cp.status === 'completed') return [];
  if (cp.format === 'group_knockout' && cp._currentRound === 'groups') {
    return cp.groups.flatMap(g => g.fixtures.filter(f => !f.played));
  }
  const last = cp.rounds[cp.rounds.length - 1];
  if (!last) return [];
  return last.ties.filter(t => !t.played && t.homeId && t.awayId);
}

/* ===========================================================================
 * End of season: champion crowned, promotions, relegations, retirements,
 * youth intake, manager carousel, ageing, suspensions/yellow reset.
 * ========================================================================= */
function endOfSeasonProcessing() {
  const finishedLeagues = state.leagues.filter(l => {
    if (!l.schedule || !l.schedule.length) return false;
    return l.schedule.every(rd => rd.fixtures.every(f => f.played));
  });
  if (!finishedLeagues.length) {
    showToast('No leagues fully completed', 'warning');
    return;
  }

  const promotedClubsByLeague = {};
  const relegatedClubsByLeague = {};

  // Sort leagues by tier (lower tier number = higher tier)
  finishedLeagues.sort((a, b) => (a.tier || 99) - (b.tier || 99));

  for (const lg of finishedLeagues) {
    const table = leagueTable(lg.id);
    const champion = table[0]?.clubId;
    const ts = topScorersForLeague(lg.id);
    const top = ts[0] ? { playerId: ts[0].playerId, goals: ts[0].goals } : null;
    const numPromoted = lg.rules?.promoted ?? 0;
    const numPlayoffUp = lg.rules?.playoffPromoted ?? 0;
    const numRelegated = lg.rules?.relegated ?? 0;
    const numPlayoffDown = lg.rules?.playoffRelegated ?? 0;
    const promoted = table.slice(0, numPromoted).map(r => r.clubId);
    const playoffPromoted = numPlayoffUp ? table.slice(numPromoted, numPromoted + numPlayoffUp).map(r => r.clubId) : [];
    const relegated = numRelegated ? table.slice(-numRelegated).map(r => r.clubId) : [];
    const playoffRelegated = numPlayoffDown ? table.slice(-(numRelegated + numPlayoffDown), -numRelegated || undefined).map(r => r.clubId) : [];
    promotedClubsByLeague[lg.id] = promoted;
    relegatedClubsByLeague[lg.id] = relegated;
    historyAppend('season_ended', {
      leagueId: lg.id, championId: champion, finalTable: table.map(r => ({ clubId: r.clubId, p: r.p, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga, gd: r.gd, pts: r.pts })),
      topScorer: top, promoted, relegated, playoffPromoted, playoffRelegated
    });
    lg.status = 'completed';
  }

  // Apply promotions/relegations between adjacent tiers
  for (let i = 0; i < finishedLeagues.length - 1; i++) {
    const upper = finishedLeagues[i];
    const lower = finishedLeagues[i + 1];
    const promoted = promotedClubsByLeague[lower.id] || [];
    const relegated = relegatedClubsByLeague[upper.id] || [];
    // Remove relegated from upper, promoted from lower
    upper.clubIds = upper.clubIds.filter(id => !relegated.includes(id));
    lower.clubIds = lower.clubIds.filter(id => !promoted.includes(id));
    upper.clubIds.push(...promoted);
    lower.clubIds.push(...relegated);
    promoted.forEach(id => { const c = getClub(id); if (c) c.leagueId = upper.id; });
    relegated.forEach(id => { const c = getClub(id); if (c) c.leagueId = lower.id; });
  }

  // Retirements + ageing
  for (const p of state.players) {
    if (p.isRetired) continue;
    p.age = (p.age || 17) + 1;
    // Reset season stats
    p.seasonStats = { apps: 0, goals: 0, assists: 0, yellows: 0, reds: 0 };
    p.status.yellowsThisSeason = 0;
    p.status.suspendedFor = 0;
    p.status.fatigue = 0;
    if (p.status.injuredUntil > 0) p.status.injuredUntil = Math.max(0, p.status.injuredUntil - 38);
    // Decline phase: peak ~27-29, real drop-off from 30 (35 for GKs)
    const dec = p.position === 'GK' ? Math.max(0, p.age - 35) : Math.max(0, p.age - 29);
    if (dec > 0) {
      const drop = pickInt(1, 3) + (dec > 4 ? 1 : 0);
      for (const k of Object.keys(p.attrs)) {
        if (k === 'goalkeeping' && p.position !== 'GK') continue;
        if (k === 'mental') continue;
        p.attrs[k] = clamp(p.attrs[k] - drop, 1, 99);
      }
    } else if (p.age <= 26) {
      // Growth phase. Steeper for younger players with lots of headroom.
      // Use the *least-grown primary* as the headroom signal so a maxed-out
      // primary doesn't stall growth on the others.
      const primaryKeys = Object.keys(p.attrs).filter(k => isPrimaryAttr(p.position, k));
      const primaryMin = Math.min(...primaryKeys.map(k => p.attrs[k]));
      const headroom = Math.max(0, p.potential - primaryMin);
      if (headroom > 0) {
        let grow;
        if (p.age <= 22) grow = pickInt(2, 5) + Math.floor(headroom / 14);
        else             grow = pickInt(0, 3);
        grow = clamp(grow, 0, 8);
        for (const k of Object.keys(p.attrs)) {
          if (k === 'goalkeeping' && p.position !== 'GK') continue;
          const isPrimary = isPrimaryAttr(p.position, k);
          const inc = isPrimary ? grow : Math.max(0, Math.floor(grow / 2));
          p.attrs[k] = clamp(p.attrs[k] + inc, 1, p.potential);
        }
      }
    }
    // Retirement check
    const profile = p.position === 'GK' ? state.settings.retirementGK : state.settings.retirementOutfield;
    let retire = false;
    if (p.age >= profile.late) retire = true;
    else if (p.age >= profile.normalHigh) {
      retire = rand() < 0.6;
    } else if (p.age >= profile.normalLow) {
      retire = rand() < 0.18;
    } else if (p.age >= profile.early) {
      retire = rand() < 0.04;
    }
    if (retire) retirePlayer(p);
  }

  // Squad trim BEFORE youth intake. Most clubs target 22-24 senior players;
  // youth intake will then top them up to ~26-28. Released players are
  // immediately retired (they're the weakest end of the squad).
  const TARGET_SQUAD = 23;
  for (const club of state.clubs) {
    let squad = playersByClub(club.id).filter(p => !p.isRetired);
    if (squad.length <= TARGET_SQUAD) continue;
    // Sort by overall ascending, captains/vice protected, then drop weakest.
    const protectedIds = new Set([club.captainId, club.viceCaptainId].filter(Boolean));
    squad.sort((a, b) => {
      const ap = protectedIds.has(a.id) ? 1 : 0;
      const bp = protectedIds.has(b.id) ? 1 : 0;
      if (ap !== bp) return bp - ap;       // protected last
      return playerOverall(a) - playerOverall(b);
    });
    const releasedIds = [];
    while (squad.length > TARGET_SQUAD) {
      const p = squad.shift();
      if (!p) break;
      releasedIds.push(p.id);
      retirePlayer(p);
    }
  }

  // Youth intake — slightly smaller default so squads settle ~25-27 after.
  for (const club of state.clubs) {
    const cur = playersByClub(club.id).filter(p => !p.isRetired).length;
    const targetIntake = Math.max(2, TARGET_SQUAD + pickInt(2, 4) - cur);
    const intake = clamp(targetIntake, 1, 5);
    const newIds = [];
    for (let i = 0; i < intake; i++) {
      const np = generatePlayer({
        nationality: club.nationality || state.settings.nation?.name || bankToCountryLabel(club.nameBankPref),
        nameBank: club.nameBankPref,
        qualityBand: 35 + pickInt(0, 30),
        ageBand: 'youth',
        clubId: club.id
      });
      fillPlayerName(np, club.nameBankPref);
      np.shirtNumber = nextFreeShirtNumber(club.id);
      state.players.push(np);
      newIds.push(np.id);
    }
    if (newIds.length) historyAppend('youth_intake', { clubId: club.id, playerIds: newIds });
  }

  // Manager sackings: consider AI clubs whose final position fell well below
  // their reputation rank
  for (const lg of finishedLeagues) {
    const table = leagueTable(lg.id);
    const ranked = lg.clubIds.slice().map(id => ({ id, rep: getClub(id)?.reputation || 50 })).sort((a, b) => b.rep - a.rep);
    const expectedPos = {};
    ranked.forEach((x, idx) => expectedPos[x.id] = idx);
    table.forEach((row, pos) => {
      const club = getClub(row.clubId);
      if (!club || !club.managerId) return;
      const mgr = getManager(club.managerId);
      if (!mgr) return;
      const exp = expectedPos[row.clubId];
      const gap = pos - exp;
      if (gap >= Math.max(3, Math.round(table.length * 0.25))) {
        // sack
        sackManager(club.id, 'underperformance');
      }
    });
  }

  // Hire managers for vacant clubs
  for (const club of state.clubs) {
    if (!club.managerId) hireManagerForClub(club.id);
  }

  // AI transfer window
  runAITransferWindow();

  // Manager pool ageing: unemployed managers tick up their idle counter and
  // eventually retire from the profession. High-reputation ones stick around.
  for (const mgr of state.managers) {
    if (mgr.isUnemployed) {
      mgr.seasonsUnemployed = (mgr.seasonsUnemployed || 0) + 1;
    } else {
      mgr.seasonsUnemployed = 0;
      mgr.seasonsAtClub = (mgr.seasonsAtClub || 0) + 1;
    }
  }
  const beforeMgrs = state.managers.length;
  state.managers = state.managers.filter(m => {
    if (!m.isUnemployed) return true;
    const idle = m.seasonsUnemployed || 0;
    if (idle >= 4 && (m.attrs?.reputation || 50) < 70) return false;
    if (idle >= 6) return false; // even big-rep names eventually drop off
    return true;
  });
  const droppedMgrs = beforeMgrs - state.managers.length;
  if (droppedMgrs) console.log(`Phased ${droppedMgrs} long-unemployed manager(s) out of the pool.`);

  // Club squad snapshots — used by the historic-squads view.
  for (const club of state.clubs) {
    club.squadHistory = club.squadHistory || [];
    const squadIds = playersByClub(club.id).filter(p => !p.isRetired).map(p => p.id);
    club.squadHistory.push({
      season: state.settings.season,
      managerId: club.managerId,
      captainId: club.captainId,
      viceCaptainId: club.viceCaptainId,
      formation: club.formation,
      playerIds: squadIds,
    });
    if (club.squadHistory.length > 60) club.squadHistory = club.squadHistory.slice(-60);
  }
  // NT squad snapshot
  if (state.settings.ntSquad && state.settings.ntSquad.length) {
    state.ntSquadHistory = state.ntSquadHistory || [];
    state.ntSquadHistory.push({
      season: state.settings.season,
      playerIds: state.settings.ntSquad.slice(),
    });
    if (state.ntSquadHistory.length > 60) state.ntSquadHistory = state.ntSquadHistory.slice(-60);
  }

  // Snapshot player skill history (overall + raw attrs) for non-retired players
  for (const p of state.players) {
    if (p.isRetired) continue;
    if (!p.skillHistory) p.skillHistory = [];
    p.skillHistory.push({
      season: state.settings.season,
      age: p.age,
      overall: playerOverall(p),
      pace: p.attrs.pace,
      strength: p.attrs.strength,
      technique: p.attrs.technique,
      passing: p.attrs.passing,
      defending: p.attrs.defending,
      shooting: p.attrs.shooting,
      mental: p.attrs.mental,
      goalkeeping: p.attrs.goalkeeping,
    });
    // Cap at 30 entries
    if (p.skillHistory.length > 30) p.skillHistory = p.skillHistory.slice(-30);
  }

  // Bump season BEFORE rebuilding schedules so the new fixture lists carry
  // the new season number.
  state.settings.season += 1;

  // Reset cups; rebuild league schedules onto a fresh shared calendar.
  for (const lg of state.leagues) {
    if (lg.status === 'completed') {
      generateLeagueSchedule(lg.id);
    }
  }
  for (const cp of state.cups) {
    cp.status = 'pending';
    cp.rounds = [];
    cp.groups = [];
    cp._currentRound = null;
  }
  saveState();
}

function topScorersForLeague(leagueId) {
  return topScorers(leagueId, state.settings.season, 1);
}

function isPrimaryAttr(position, attr) {
  if (position === 'GK') return attr === 'goalkeeping' || attr === 'mental';
  if (position === 'DF') return ['defending', 'strength', 'pace', 'mental'].includes(attr);
  if (position === 'MF') return ['passing', 'technique', 'mental', 'pace'].includes(attr);
  if (position === 'FW') return ['shooting', 'pace', 'technique', 'mental'].includes(attr);
  return false;
}

function nextFreeShirtNumber(clubId) {
  const used = new Set(playersByClub(clubId).map(p => p.shirtNumber).filter(Boolean));
  for (let n = 1; n < 100; n++) if (!used.has(n)) return n;
  return null;
}

function retirePlayer(p) {
  p.isRetired = true;
  const oldClubId = p.clubId;
  p.clubId = null;
  // Maybe become a manager
  let willBeManager = false;
  if (rand() < 0.18) {
    willBeManager = true;
    const fmRep = clamp(Math.round(((p.attrs.mental || 50) + (p.attrs.passing || 50)) / 2 + randNorm(0, 8)), 25, 90);
    const mgr = generateManager({
      nationality: p.nationality,
      attrs: {
        tactical: clamp(Math.round(p.attrs.mental + randNorm(0, 10)), 25, 90),
        manManagement: clamp(Math.round(p.attrs.mental + randNorm(0, 10)), 25, 90),
        youthDev: pickInt(35, 75),
        reputation: fmRep,
      },
      formerPlayerId: p.id
    });
    mgr.firstName = p.firstName; mgr.lastName = p.lastName;
    // Track every club this player turned out for. Used by AI hiring to bias
    // ex-players toward returning to clubs they played for.
    mgr.formerClubs = playerClubsPlayedFor(p.id);
    historyAppend('player_to_manager', { playerId: p.id, managerId: mgr.id });
  }
  historyAppend('player_retired', { playerId: p.id, age: p.age, willBeManager, clubId: oldClubId });
}

function playerClubsPlayedFor(playerId) {
  const seen = new Set();
  for (const e of state.history) {
    if (e.type !== 'match_committed' || e.struck) continue;
    const apps = (e.appearances || []).filter(a => a.playerId === playerId);
    for (const ap of apps) {
      const cid = ap.side === 'home' ? e.homeId : e.awayId;
      if (cid) seen.add(cid);
    }
  }
  return Array.from(seen);
}

function sackManager(clubId, reason) {
  const club = getClub(clubId);
  if (!club || !club.managerId) return;
  const mgr = getManager(club.managerId);
  if (!mgr) return;
  historyAppend('manager_sacked', { managerId: mgr.id, clubId, reason });
  mgr.clubId = null;
  mgr.isUnemployed = true;
  mgr.seasonsAtClub = 0;
  club.managerId = null;
}

/* ===========================================================================
 * AI transfer window — runs once per off-season after youth intake.
 *
 *   For each club we identify the weakest XI position by overall, then
 *   look across all other clubs for an upgrade. Higher-tier and higher-
 *   reputation clubs poach more aggressively. Total transfers per window
 *   is bounded by `maxMoves` to keep things believable.
 * ========================================================================= */
function runAITransferWindow(maxMoves = null) {
  const totalCap = maxMoves != null ? maxMoves : Math.max(8, Math.floor(state.clubs.length * 1.2));
  let moves = 0;
  // Order clubs by reputation high→low so big clubs pick first
  const orderedClubs = state.clubs.slice().sort((a, b) => (b.reputation || 50) - (a.reputation || 50));
  for (const club of orderedClubs) {
    if (moves >= totalCap) break;
    if (Math.random() < 0.35) continue; // not every club moves every window
    const squad = playersByClub(club.id).filter(p => !p.isRetired);
    if (squad.length < 11) continue;
    const xi = selectXI(club.id);
    if (!xi || !xi.slots.length) continue;
    // Pick the lowest-rated starter as the upgrade target
    const xiPlayers = xi.slots
      .map(s => ({ slot: s, p: getPlayer(s.playerId) }))
      .filter(x => x.p);
    if (!xiPlayers.length) continue;
    xiPlayers.sort((a, b) => playerOverall(a.p) - playerOverall(b.p));
    const weakest = xiPlayers[0];
    if (!weakest || !weakest.p) continue;
    const targetGroup = ROLE_TO_GROUP[weakest.slot.role];
    const myThreshold = playerOverall(weakest.p) + 4;

    // Search candidates from other clubs at same position with better overall
    const candidates = state.players.filter(p =>
      !p.isRetired && p.clubId && p.clubId !== club.id && p.position === weakest.p.position &&
      playerOverall(p) >= myThreshold &&
      p.age <= 32
    );
    if (!candidates.length) continue;
    candidates.sort((a, b) => playerOverall(b) - playerOverall(a));

    // Pick a candidate. Higher-rep clubs poach from peers; smaller clubs
    // mostly fish in lower-rep waters.
    let chosen = null;
    for (const cand of candidates) {
      const candClub = getClub(cand.clubId);
      if (!candClub) continue;
      // Captains and vice-captains are unlikely to leave their current club
      if (candClub.captainId === cand.id) {
        if (Math.random() > 0.05) continue;
      } else if (candClub.viceCaptainId === cand.id) {
        if (Math.random() > 0.15) continue;
      }
      // Reputation gate: hiring club must be at least roughly on par with
      // selling club, otherwise selling club refuses
      const repGap = (candClub.reputation || 50) - (club.reputation || 50);
      if (repGap > 8 && Math.random() > 0.10) continue; // selling club refuses
      // Probabilistic acceptance: sometimes the move just doesn't happen
      if (Math.random() > 0.55) continue;
      chosen = cand;
      break;
    }
    if (!chosen) continue;

    const fee = Math.round((playerOverall(chosen) ** 1.6) * 1000 + pickInt(0, 500000));
    transferPlayer(chosen.id, club.id, fee, false);
    moves++;
  }
  // Free agent re-signings: any clubless retired-but-active (rare edge case)
  // — currently no such pool, so skip.
  return moves;
}

/* ===========================================================================
 * Scripted match — for the External Matches generator. Caller provides
 * both XIs plus a target final score; engine fills in plausible events,
 * scorers, cards, and stats that fit the scoreline.
 *
 *   homeXI / awayXI: { formation, slots: [{ role, x, y, player: { id?, name,
 *                       position, role, attrs:{...} } }] }
 *   scoring:         { hScore, aScore, hPenScore?, aPenScore? }
 *
 *   Returns a match-shaped object with isExternal: true.
 * ========================================================================= */
function scriptedMatch({
  homeName, awayName, homeXI, awayXI,
  hScore, aScore, hPenScore, aPenScore,
  type = 'NT friendly', competition = '', neutral = true,
  goesToET = false, goesToPens = false,
}) {
  const stoppage = pickInt(2, 6);
  const totalMin = 90 + stoppage;
  const events = [];
  events.push({ minute: 0, type: 'kickoff', icon: '', text: templ(pick(COMMENTARY.kickoff), { hometeam: homeName, awayteam: awayName, stadium: 'a neutral venue', attendance: pickInt(15000, 80000).toLocaleString() }) });

  // Pick goal-scorers and minutes
  const scorers = [];
  const hPlayers = (homeXI?.slots || []).map(s => s.player).filter(Boolean);
  const aPlayers = (awayXI?.slots || []).map(s => s.player).filter(Boolean);
  if (!hPlayers.length || !aPlayers.length) {
    showToast('Both XIs need at least one player', 'error');
    return null;
  }
  const goalEvents = [];
  for (let i = 0; i < hScore; i++) goalEvents.push({ side: 'home' });
  for (let i = 0; i < aScore; i++) goalEvents.push({ side: 'away' });
  shuffle(goalEvents);
  // Assign unique minutes biased toward second half a touch
  const usedMins = new Set();
  for (const g of goalEvents) {
    let m;
    let safety = 0;
    do { m = rand() < 0.55 ? pickInt(46, totalMin - 1) : pickInt(2, 45); safety++; }
    while (usedMins.has(m) && safety < 200);
    usedMins.add(m);
    g.minute = m;
  }
  goalEvents.sort((a, b) => a.minute - b.minute);

  let runH = 0, runA = 0;
  for (const g of goalEvents) {
    const xi = g.side === 'home' ? hPlayers : aPlayers;
    const weights = xi.map(p => Math.max((p.attrs?.shooting || 50) + (p.position === 'FW' ? 35 : p.position === 'MF' ? 12 : 0), 1));
    const scorer = weightedPick(xi, weights) || xi[0];
    const isPenalty = rand() < 0.10;
    const isOG = !isPenalty && rand() < 0.03;
    let assister = null;
    if (!isPenalty && !isOG && rand() < 0.7) {
      const others = xi.filter(p => p !== scorer);
      if (others.length) {
        const aw = others.map(p => Math.max((p.attrs?.passing || 50) + (p.attrs?.technique || 50), 1));
        assister = weightedPick(others, aw);
      }
    }
    if (g.side === 'home') runH++; else runA++;
    scorers.push({
      playerId: scorer.id || null,
      playerName: scorer.name,
      side: g.side,
      ownGoalSide: isOG ? (g.side === 'home' ? 'away' : 'home') : null,
      minute: g.minute,
      ownGoal: isOG,
      penalty: isPenalty,
      assistId: assister?.id || null,
      assistName: assister?.name || null,
    });
    let text;
    if (isPenalty) text = templ(pick(COMMENTARY.penaltyScored), { scorer: scorer.name });
    else if (isOG) text = `${scorer.name} turns the ball into his own net.`;
    else if (assister) text = templ(pick(COMMENTARY.goalAssist), { scorer: scorer.name, assister: assister.name });
    else text = templ(pick(COMMENTARY.goal), { scorer: scorer.name });
    events.push({ minute: g.minute, type: isPenalty ? 'penalty' : 'goal', side: g.side, icon: '⚽', score: `${runH}–${runA}`, text });
  }

  // Cards: 2-5 yellows + occasional red
  const cards = [];
  const numCards = pickInt(2, 5);
  const cardMins = new Set();
  for (let i = 0; i < numCards; i++) {
    const side = rand() < 0.5 ? 'home' : 'away';
    const xi = side === 'home' ? hPlayers : aPlayers;
    const cands = xi.filter(p => p.position !== 'GK');
    if (!cands.length) continue;
    const fouler = pick(cands);
    let m;
    let safety = 0;
    do { m = pickInt(8, totalMin - 4); safety++; } while (cardMins.has(m) && safety < 100);
    cardMins.add(m);
    cards.push({ playerId: fouler.id || null, playerName: fouler.name, side, type: 'yellow', minute: m, reason: 'foul' });
    events.push({ minute: m, type: 'yellow', side, icon: '▪', text: templ(pick(COMMENTARY.yellow), { fouler: fouler.name, fouled: 'an opponent' }) });
  }
  if (rand() < 0.10) {
    const side = rand() < 0.5 ? 'home' : 'away';
    const xi = side === 'home' ? hPlayers : aPlayers;
    const cands = xi.filter(p => p.position !== 'GK');
    if (cands.length) {
      const fouler = pick(cands);
      const m = pickInt(20, totalMin);
      cards.push({ playerId: fouler.id || null, playerName: fouler.name, side, type: 'red', minute: m, reason: 'direct_red' });
      events.push({ minute: m, type: 'red', side, icon: '■', text: templ(pick(COMMENTARY.red), { fouler: fouler.name, fouled: 'an opponent' }) });
    }
  }

  // Half-time + full-time markers
  let hAtHT = 0, aAtHT = 0;
  for (const sc of scorers) if (sc.minute <= 45) { if (sc.side === 'home') hAtHT++; else aAtHT++; }
  events.push({ minute: 45, type: 'halftime', icon: '', text: templ(pick(COMMENTARY.halftime), { hometeam: homeName, awayteam: awayName, hs: hAtHT, as: aAtHT }) });
  events.push({ minute: totalMin, type: 'fulltime', icon: '', text: templ(pick(COMMENTARY.fulltime), { hometeam: homeName, awayteam: awayName, hs: hScore, as: aScore }) });

  let extraTime = null;
  let penalties = null;
  if (goesToET) extraTime = { homeGoals: hScore, awayGoals: aScore };
  if (goesToPens && hPenScore != null && aPenScore != null) {
    penalties = { homeKicks: hPenScore, awayKicks: aPenScore, kicks: [] };
    events.push({ minute: 121, type: 'penalties', icon: '', text: `Penalty shootout: ${homeName} ${hPenScore} – ${aPenScore} ${awayName}` });
  }

  events.sort((a, b) => a.minute - b.minute);

  // Compose stats
  const avgRating = list => {
    if (!list || !list.length) return 50;
    return list.reduce((acc, p) => {
      const a = p.attrs || {};
      return acc + ((a.shooting||50) + (a.defending||50) + (a.passing||50) + (a.mental||50)) / 4;
    }, 0) / list.length;
  };
  const hStr = avgRating(hPlayers);
  const aStr = avgRating(aPlayers);
  const total = hStr + aStr;
  const possessionH = Math.round(hStr / total * 100);
  const possessionA = 100 - possessionH;
  const shotsH = Math.max(hScore + pickInt(0, 3), pickInt(8, 18));
  const shotsA = Math.max(aScore + pickInt(0, 3), pickInt(8, 18));
  const stats = {
    possessionH, possessionA,
    shotsH, shotsA,
    sotH: Math.max(hScore, Math.round(shotsH * 0.4)),
    sotA: Math.max(aScore, Math.round(shotsA * 0.4)),
    cornersH: pickInt(3, 9), cornersA: pickInt(3, 9),
    foulsH: pickInt(8, 16), foulsA: pickInt(8, 16),
    yellowsH: cards.filter(c => c.side === 'home' && c.type === 'yellow').length,
    yellowsA: cards.filter(c => c.side === 'away' && c.type === 'yellow').length,
    redsH: cards.filter(c => c.side === 'home' && c.type === 'red').length,
    redsA: cards.filter(c => c.side === 'away' && c.type === 'red').length,
  };

  return {
    id: uid('em_'),
    season: state.settings.season,
    type, competition,
    homeName, awayName,
    homeFormation: homeXI?.formation || null,
    awayFormation: awayXI?.formation || null,
    homeXI, awayXI,
    hScore, aScore,
    extraTime, penalties,
    events, scorers, cards,
    injuries: [], subs: [],
    appearances: [
      ...hPlayers.map(p => ({ playerId: p.id || null, playerName: p.name, side: 'home', minutesPlayed: totalMin, started: true })),
      ...aPlayers.map(p => ({ playerId: p.id || null, playerName: p.name, side: 'away', minutesPlayed: totalMin, started: true })),
    ],
    stats, stoppage,
    isExternal: true,
    ts: Date.now(),
  };
}

/* Build a synthetic 11-player XI from a strength target, formation, and
 * optional name bank. Used for "Custom" external opponents. */
function synthesizeXI({ formation = DEFAULT_FORMATION, strength = 60, nameBank = 'Generic English', nationality = '', teamName = 'Custom XI' }) {
  const formSlots = FORMATIONS[formation] || FORMATIONS[DEFAULT_FORMATION];
  const bank = (state && state.nameBanks && state.nameBanks[nameBank]) || DEFAULT_NAME_BANKS[nameBank] || DEFAULT_NAME_BANKS['Generic English'];
  const slots = formSlots.map((f, i) => {
    const grp = ROLE_TO_GROUP[f.role];
    const attr = (mean, w = 1) => clamp(Math.round(randNorm(mean * w, 8)), 1, 99);
    let attrs;
    if (grp === 'GK') attrs = { pace: attr(strength, 0.6), strength: attr(strength, 0.85), technique: attr(strength, 0.55), passing: attr(strength, 0.65), defending: attr(strength, 0.5), shooting: attr(strength, 0.2), mental: attr(strength, 0.95), goalkeeping: attr(strength, 1.15) };
    else if (grp === 'DF') attrs = { pace: attr(strength, 0.95), strength: attr(strength, 1.0), technique: attr(strength, 0.75), passing: attr(strength, 0.85), defending: attr(strength, 1.15), shooting: attr(strength, 0.4), mental: attr(strength, 0.9), goalkeeping: 5 };
    else if (grp === 'MF') attrs = { pace: attr(strength, 0.9), strength: attr(strength, 0.85), technique: attr(strength, 1.05), passing: attr(strength, 1.1), defending: attr(strength, 0.7), shooting: attr(strength, 0.85), mental: attr(strength, 0.95), goalkeeping: 5 };
    else attrs = { pace: attr(strength, 1.1), strength: attr(strength, 1.0), technique: attr(strength, 1.05), passing: attr(strength, 0.85), defending: attr(strength, 0.45), shooting: attr(strength, 1.15), mental: attr(strength, 0.9), goalkeeping: 5 };
    return {
      role: f.role, x: f.x, y: f.y,
      player: {
        id: null,
        name: `${pick(bank.firstNames)} ${pick(bank.lastNames)}`,
        position: grp,
        role: f.role,
        nationality,
        shirtNumber: i + 1,
        attrs,
      }
    };
  });
  return { formation, slots };
}

/* Auto-pick best XI from a candidate pool of player IDs, given a formation. */
function autoPickXIFromPool(playerIds, formation = DEFAULT_FORMATION) {
  const formSlots = FORMATIONS[formation] || FORMATIONS[DEFAULT_FORMATION];
  const pool = playerIds.map(getPlayer).filter(Boolean).filter(p => !p.isRetired);
  const used = new Set();
  const slots = formSlots.map(f => ({ ...f, player: null }));
  const rateForRole = (player, role) => {
    const a = player.attrs;
    const grp = ROLE_TO_GROUP[role];
    if (player.position === 'GK' && grp !== 'GK') return -1;
    if (player.position !== 'GK' && grp === 'GK') return -1;
    let r = 0;
    if (grp === 'GK') r = a.goalkeeping * 1.3 + a.mental * 0.4;
    else if (grp === 'DF') r = a.defending * 1.1 + a.strength * 0.7 + a.pace * 0.6 + a.mental * 0.5 + (player.role === role ? 6 : 0);
    else if (grp === 'MF') r = a.passing + a.technique * 0.9 + a.mental * 0.6 + (player.role === role ? 6 : 0);
    else r = a.shooting * 1.1 + a.pace * 0.9 + a.technique * 0.8 + (player.role === role ? 6 : 0);
    return r;
  };
  for (const slot of slots) {
    let best = null, bestScore = -Infinity;
    for (const p of pool) {
      if (used.has(p.id)) continue;
      const s = rateForRole(p, slot.role);
      if (s > bestScore) { bestScore = s; best = p; }
    }
    if (best) { slot.player = best; used.add(best.id); }
  }
  return { formation, slots };
}

/* ===========================================================================
 * Transfers — manual move of a player to a new club
 * ========================================================================= */
function transferPlayer(playerId, toClubId, fee = 0, freeTransfer = false) {
  const p = getPlayer(playerId);
  if (!p) return false;
  const fromClubId = p.clubId;
  // Free up captain/vice-captain references on the old club
  if (fromClubId) {
    const oldClub = getClub(fromClubId);
    if (oldClub) {
      if (oldClub.captainId === p.id) oldClub.captainId = null;
      if (oldClub.viceCaptainId === p.id) oldClub.viceCaptainId = null;
    }
  }
  p.clubId = toClubId || null;
  // Pick a free shirt number for the new club
  if (toClubId) {
    p.shirtNumber = nextFreeShirtNumber(toClubId);
  } else {
    p.shirtNumber = null;
  }
  historyAppend('player_signed', {
    playerId,
    fromClubId: fromClubId || null,
    toClubId: toClubId || null,
    fee: freeTransfer ? 0 : fee,
    freeTransfer: !!freeTransfer || !fromClubId,
    season: state.settings.season
  });
  saveState();
  return true;
}

function hireManagerForClub(clubId) {
  const club = getClub(clubId);
  if (!club) return;
  // Pool: unemployed managers, weighted by reputation
  let pool = state.managers.filter(m => m.isUnemployed);
  if (!pool.length) {
    // Generate one — match the club's nationality flavour
    const m = generateManager({ nameBank: club.nameBankPref, nationality: club.nationality || state.settings.nation?.name });
    pool = [m];
  }
  // Score by tactical + reputation, plus a hefty bonus if they're an ex-
  // player who turned out for this club, plus a small randomiser.
  const scored = pool.map(m => {
    const exBonus = (m.formerClubs && m.formerClubs.includes(clubId)) ? 22 : 0;
    return { m, s: m.attrs.tactical * 0.4 + m.attrs.reputation * 0.7 + exBonus + randNorm(0, 8) };
  });
  scored.sort((a, b) => b.s - a.s);
  const hired = scored[0].m;
  hired.clubId = clubId;
  hired.isUnemployed = false;
  hired.seasonsAtClub = 0;
  hired.seasonsUnemployed = 0;
  club.managerId = hired.id;
  historyAppend('manager_hired', { managerId: hired.id, clubId });
}
