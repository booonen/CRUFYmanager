/* ===========================================================================
 * CRUFYmanager — state.js
 *   Global state object, default schema, localStorage persistence,
 *   JSON export / import, and the append-only history book.
 *
 *   Every save flows through saveState(). Commit-style operations append
 *   to state.history, which is the source of truth for derived views
 *   (career stats, club honours, season-by-season tables, news feed).
 * ========================================================================= */

const STATE_KEY = 'crufy_save_v1';
const SCHEMA_VERSION = 1;

let state = null;
let _saveDebounce = null;

/* ===========================================================================
 * Default state
 * ========================================================================= */
function defaultState() {
  return {
    version: SCHEMA_VERSION,
    createdAt: Date.now(),
    settings: {
      nation: {
        name: '',
        demonym: '',
        flagUrl: '',
        faName: ''
      },
      season: 1,
      matchdayPointer: { leagueId: null, matchday: 0 },
      defaultNameBank: 'Generic English',
      yellowsForBan: 5,
      redCardBanRange: [1, 3],
      injuryRange: [1, 20],
      retirementGK:    { early: 28, normalLow: 36, normalHigh: 41, late: 44 },
      retirementOutfield: { early: 26, normalLow: 33, normalHigh: 38, late: 41 },
    },
    nameBanks: deepClone(DEFAULT_NAME_BANKS),
    clubs: [],
    players: [],
    managers: [],
    leagues: [],
    cups: [],
    externalMatches: [],
    history: [],
    ui: {
      lastTab: 'dashboard',
      detail: { type: null, id: null },
    },
    /* Draft matches: results that have been generated but not yet committed to
     * the history book. Each entry is a full match record (incl. commentary).
     * Keys: same as a match in history. They live here until commit/discard. */
    draftMatches: [],
  };
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/* ===========================================================================
 * Load / save
 * ========================================================================= */
async function loadState() {
  let raw = null;
  try { raw = localStorage.getItem(STATE_KEY); } catch (e) { /* private mode etc. */ }
  if (!raw) {
    state = defaultState();
    return state;
  }
  try {
    const parsed = JSON.parse(raw);
    state = migrateState(parsed);
  } catch (e) {
    console.warn('Failed to parse save, starting fresh', e);
    state = defaultState();
  }
  return state;
}

function migrateState(parsed) {
  if (!parsed || typeof parsed !== 'object') return defaultState();
  const fresh = defaultState();
  // Shallow-merge top-level keys, preferring saved data; fall back to defaults
  // for missing branches so older saves still load.
  for (const k of Object.keys(fresh)) {
    if (parsed[k] === undefined) continue;
    if (k === 'settings' || k === 'ui') {
      fresh[k] = Object.assign({}, fresh[k], parsed[k] || {});
      if (parsed[k] && parsed[k].nation) fresh[k].nation = Object.assign({}, fresh[k].nation, parsed[k].nation);
    } else {
      fresh[k] = parsed[k];
    }
  }
  fresh.version = SCHEMA_VERSION;
  return fresh;
}

function saveState() {
  if (_saveDebounce) clearTimeout(_saveDebounce);
  _saveDebounce = setTimeout(() => {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); }
    catch (e) { showToast('Save failed: ' + e.message, 'error'); }
  }, 80);
}

function saveStateNow() {
  if (_saveDebounce) { clearTimeout(_saveDebounce); _saveDebounce = null; }
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); }
  catch (e) { showToast('Save failed: ' + e.message, 'error'); }
}

function exportSave() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const tag = state.settings.nation.name
    ? state.settings.nation.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase()
    : 'crufy';
  a.href = url;
  a.download = `${tag}_save_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
}

function handleImport(ev) {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed || !parsed.version) throw new Error('Not a CRUFY save');
      if (!confirm('Importing will replace your current save. Continue?')) return;
      state = migrateState(parsed);
      saveStateNow();
      showToast('Save imported', 'success');
      refreshAll();
      switchTab('dashboard');
    } catch (err) {
      showToast('Import failed: ' + err.message, 'error');
    }
    ev.target.value = '';
  };
  reader.readAsText(file);
}

function resetSave() {
  if (!confirm('This wipes all data including history. Type-confirm in next prompt to be sure.')) return;
  const confirmation = prompt('Type RESET to wipe everything:');
  if (confirmation !== 'RESET') { showToast('Reset cancelled', 'warning'); return; }
  state = defaultState();
  saveStateNow();
  refreshAll();
  switchTab('settings');
  showToast('Save wiped', 'success');
}

/* ===========================================================================
 * Entity lookups
 * ========================================================================= */
function getClub(id) { return state.clubs.find(c => c.id === id) || null; }
function getPlayer(id) { return state.players.find(p => p.id === id) || null; }
function getManager(id) { return state.managers.find(m => m.id === id) || null; }
function getLeague(id) { return state.leagues.find(l => l.id === id) || null; }
function getCup(id) { return state.cups.find(c => c.id === id) || null; }

function clubName(id) { const c = getClub(id); return c ? c.name : '?'; }
function clubShort(id) { const c = getClub(id); return c ? (c.shortName || c.name.slice(0, 3).toUpperCase()) : '???'; }
function playerName(id) { const p = getPlayer(id); return p ? `${p.firstName} ${p.lastName}` : '?'; }
function managerName(id) { const m = getManager(id); return m ? `${m.firstName} ${m.lastName}` : '?'; }

function clubsByLeague(leagueId) {
  return state.clubs.filter(c => c.leagueId === leagueId);
}

function playersByClub(clubId) {
  return state.players.filter(p => p.clubId === clubId);
}

/* ===========================================================================
 * History book (append-only ledger)
 *
 *   Each entry: { id, ts, season, type, ...payload, struck: false, strikeReason? }
 *   Types:
 *     'match_committed'  — full match record. Most read-heavy.
 *     'player_retired'   — { playerId, age, careerSummary }
 *     'player_to_manager'— { playerId, managerId }
 *     'manager_hired'    — { managerId, clubId }
 *     'manager_sacked'   — { managerId, clubId, reason }
 *     'season_ended'     — { season, leagueId, finalTable, championId, topScorer, promoted, relegated }
 *     'cup_won'          — { cupId, winnerId, runnerUpId }
 *     'youth_intake'     — { clubId, playerIds }
 *     'player_signed'    — { playerId, fromClubId, toClubId, fee }
 *     'player_injured'   — { playerId, matches, season, matchId }
 *     'player_suspended' — { playerId, games, reason, matchId }
 *     'nt_callup'        — { playerId, nation }
 *     'note'             — free-form { text }
 *
 *   Strikes are intentionally hard to discover — see strikeRecord().
 * ========================================================================= */
function historyAppend(type, payload) {
  const entry = Object.assign({
    id: uid('h_'),
    ts: Date.now(),
    season: state.settings.season,
    type,
    struck: false,
  }, payload);
  state.history.push(entry);
  saveState();
  return entry;
}

function historyByType(type, includeStruck = false) {
  return state.history.filter(e => e.type === type && (includeStruck || !e.struck));
}

function historyForClub(clubId) {
  return state.history.filter(e => {
    if (e.struck) return false;
    if (e.type === 'match_committed' && (e.homeId === clubId || e.awayId === clubId)) return true;
    if (e.type === 'manager_hired' && e.clubId === clubId) return true;
    if (e.type === 'manager_sacked' && e.clubId === clubId) return true;
    if (e.type === 'season_ended' && (e.championId === clubId || (e.promoted && e.promoted.includes(clubId)) || (e.relegated && e.relegated.includes(clubId)) || (e.finalTable && e.finalTable.some(r => r.clubId === clubId)))) return true;
    if (e.type === 'cup_won' && (e.winnerId === clubId || e.runnerUpId === clubId)) return true;
    if (e.type === 'youth_intake' && e.clubId === clubId) return true;
    return false;
  });
}

function historyForPlayer(playerId) {
  return state.history.filter(e => {
    if (e.struck) return false;
    if (e.type === 'match_committed' && (
        (e.appearances || []).some(a => a.playerId === playerId) ||
        (e.scorers || []).some(s => s.playerId === playerId))) return true;
    if (e.type === 'player_retired' && e.playerId === playerId) return true;
    if (e.type === 'player_to_manager' && e.playerId === playerId) return true;
    if (e.type === 'player_signed' && e.playerId === playerId) return true;
    if (e.type === 'player_injured' && e.playerId === playerId) return true;
    if (e.type === 'player_suspended' && e.playerId === playerId) return true;
    if (e.type === 'nt_callup' && e.playerId === playerId) return true;
    if (e.type === 'season_ended' && e.topScorer && e.topScorer.playerId === playerId) return true;
    return false;
  });
}

function historyForManager(managerId) {
  return state.history.filter(e => {
    if (e.struck) return false;
    if ((e.type === 'manager_hired' || e.type === 'manager_sacked') && e.managerId === managerId) return true;
    if (e.type === 'player_to_manager' && e.managerId === managerId) return true;
    return false;
  });
}

function strikeRecord(eventId, reason) {
  const ent = state.history.find(e => e.id === eventId);
  if (!ent) return false;
  if (ent.struck) return false;
  ent.struck = true;
  ent.strikeReason = reason || '(no reason given)';
  ent.struckAt = Date.now();
  saveState();
  return true;
}

function unstrikeRecord(eventId) {
  const ent = state.history.find(e => e.id === eventId);
  if (!ent || !ent.struck) return false;
  ent.struck = false;
  delete ent.strikeReason;
  delete ent.struckAt;
  saveState();
  return true;
}

/* ===========================================================================
 * Career stat aggregation (derived from history book)
 *
 *   Returns { apps, goals, assists, yellows, reds, motm, byClub: { clubId: {...} }, bySeason: { season: {...} } }
 * ========================================================================= */
function playerCareerStats(playerId) {
  const out = { apps: 0, mins: 0, goals: 0, assists: 0, yellows: 0, reds: 0, byClub: {}, bySeason: {} };
  const matches = state.history.filter(e => e.type === 'match_committed' && !e.struck);
  for (const m of matches) {
    const apps = (m.appearances || []).filter(a => a.playerId === playerId);
    if (!apps.length) continue;
    const ourSide = apps[0].side;
    const ourClubId = ourSide === 'home' ? m.homeId : m.awayId;
    const ourGoals = (m.scorers || []).filter(s => s.playerId === playerId && !s.ownGoal).length;
    const ourAssists = (m.scorers || []).filter(s => s.assistId === playerId).length;
    const ourYellows = (m.cards || []).filter(c => c.playerId === playerId && c.type === 'yellow').length;
    const ourReds = (m.cards || []).filter(c => c.playerId === playerId && c.type === 'red').length;
    const ourMins = apps.reduce((acc, a) => acc + (a.minutesPlayed || 0), 0);
    out.apps += 1;
    out.mins += ourMins;
    out.goals += ourGoals;
    out.assists += ourAssists;
    out.yellows += ourYellows;
    out.reds += ourReds;
    if (!out.byClub[ourClubId]) out.byClub[ourClubId] = { apps: 0, mins: 0, goals: 0, assists: 0, yellows: 0, reds: 0 };
    out.byClub[ourClubId].apps += 1;
    out.byClub[ourClubId].mins += ourMins;
    out.byClub[ourClubId].goals += ourGoals;
    out.byClub[ourClubId].assists += ourAssists;
    out.byClub[ourClubId].yellows += ourYellows;
    out.byClub[ourClubId].reds += ourReds;
    if (!out.bySeason[m.season]) out.bySeason[m.season] = { apps: 0, mins: 0, goals: 0, assists: 0, yellows: 0, reds: 0, clubId: ourClubId };
    out.bySeason[m.season].apps += 1;
    out.bySeason[m.season].mins += ourMins;
    out.bySeason[m.season].goals += ourGoals;
    out.bySeason[m.season].assists += ourAssists;
    out.bySeason[m.season].yellows += ourYellows;
    out.bySeason[m.season].reds += ourReds;
  }
  return out;
}

/* Per-season stat snapshot for a single competition (used for top-scorer rankings) */
function topScorers(leagueId, season, limit = 20) {
  const matches = state.history.filter(e =>
    e.type === 'match_committed' && !e.struck &&
    e.leagueId === leagueId && e.season === season
  );
  const counts = {};
  for (const m of matches) {
    for (const sc of (m.scorers || [])) {
      if (sc.ownGoal) continue;
      counts[sc.playerId] = (counts[sc.playerId] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([playerId, goals]) => ({ playerId, goals }))
    .sort((a, b) => b.goals - a.goals)
    .slice(0, limit);
}

function topAssists(leagueId, season, limit = 20) {
  const matches = state.history.filter(e =>
    e.type === 'match_committed' && !e.struck &&
    e.leagueId === leagueId && e.season === season
  );
  const counts = {};
  for (const m of matches) {
    for (const sc of (m.scorers || [])) {
      if (!sc.assistId) continue;
      counts[sc.assistId] = (counts[sc.assistId] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([playerId, assists]) => ({ playerId, assists }))
    .sort((a, b) => b.assists - a.assists)
    .slice(0, limit);
}

/* ===========================================================================
 * Live league table (derived from history book — current season only)
 * ========================================================================= */
function leagueTable(leagueId, season) {
  const lg = getLeague(leagueId);
  if (!lg) return [];
  season = season ?? state.settings.season;
  const ps = lg.pointsSystem || DEFAULT_POINTS_SYSTEM;
  const rows = {};
  for (const cid of lg.clubIds) {
    rows[cid] = { clubId: cid, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [], h2h: {} };
  }
  const matches = state.history.filter(e =>
    e.type === 'match_committed' && !e.struck &&
    e.leagueId === leagueId && e.season === season
  );
  matches.sort((a, b) => (a.matchday || 0) - (b.matchday || 0));
  for (const m of matches) {
    const home = rows[m.homeId];
    const away = rows[m.awayId];
    if (!home || !away) continue;
    home.p++; away.p++;
    home.gf += m.hScore; home.ga += m.aScore;
    away.gf += m.aScore; away.ga += m.hScore;
    let res;
    if (m.hScore > m.aScore)      { home.w++; away.l++; home.pts += ps.win; away.pts += ps.loss; res = 'h'; }
    else if (m.hScore < m.aScore) { away.w++; home.l++; away.pts += ps.win; home.pts += ps.loss; res = 'a'; }
    else                          { home.d++; away.d++; home.pts += ps.draw; away.pts += ps.draw; res = 'd'; }
    home.form.push(res === 'h' ? 'W' : res === 'd' ? 'D' : 'L');
    away.form.push(res === 'a' ? 'W' : res === 'd' ? 'D' : 'L');
    home.h2h[away.clubId] = (home.h2h[away.clubId] || 0) + (res === 'h' ? ps.win : res === 'd' ? ps.draw : ps.loss);
    away.h2h[home.clubId] = (away.h2h[home.clubId] || 0) + (res === 'a' ? ps.win : res === 'd' ? ps.draw : ps.loss);
  }
  const arr = Object.values(rows);
  arr.forEach(r => { r.gd = r.gf - r.ga; r.form = r.form.slice(-5); });
  arr.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    for (const tb of (lg.tiebreakers || TIEBREAKERS)) {
      if (tb === 'gd' && b.gd !== a.gd) return b.gd - a.gd;
      if (tb === 'gf' && b.gf !== a.gf) return b.gf - a.gf;
      if (tb === 'wins' && b.w !== a.w) return b.w - a.w;
      if (tb === 'h2h') {
        const ah = a.h2h[b.clubId] || 0;
        const bh = b.h2h[a.clubId] || 0;
        if (ah !== bh) return bh - ah;
      }
    }
    return clubName(a.clubId).localeCompare(clubName(b.clubId));
  });
  return arr;
}

/* All-time aggregate honours (per club / per player) */
function clubHonours(clubId) {
  const titles = state.history.filter(e => e.type === 'season_ended' && !e.struck && e.championId === clubId);
  const cups = state.history.filter(e => e.type === 'cup_won' && !e.struck && e.winnerId === clubId);
  const promotions = state.history.filter(e => e.type === 'season_ended' && !e.struck && (e.promoted || []).includes(clubId));
  const relegations = state.history.filter(e => e.type === 'season_ended' && !e.struck && (e.relegated || []).includes(clubId));
  return {
    leagueTitles: titles.map(t => ({ season: t.season, leagueId: t.leagueId })),
    cups: cups.map(c => ({ season: c.season, cupId: c.cupId })),
    promotions: promotions.map(p => ({ season: p.season, leagueId: p.leagueId })),
    relegations: relegations.map(r => ({ season: r.season, leagueId: r.leagueId })),
  };
}

function playerHonours(playerId) {
  const titles = state.history.filter(e => e.type === 'season_ended' && !e.struck);
  const won = [];
  for (const t of titles) {
    const apps = state.history.filter(e =>
      e.type === 'match_committed' && !e.struck &&
      e.season === t.season && e.leagueId === t.leagueId &&
      (e.appearances || []).some(a => a.playerId === playerId &&
        ((a.side === 'home' && e.homeId === t.championId) ||
         (a.side === 'away' && e.awayId === t.championId)))
    );
    if (apps.length) won.push({ season: t.season, leagueId: t.leagueId, championId: t.championId, apps: apps.length });
  }
  const cupsWon = [];
  for (const c of state.history.filter(e => e.type === 'cup_won' && !e.struck)) {
    const apps = state.history.filter(e =>
      e.type === 'match_committed' && !e.struck &&
      e.season === c.season && e.cupId === c.cupId &&
      (e.appearances || []).some(a => a.playerId === playerId &&
        ((a.side === 'home' && e.homeId === c.winnerId) ||
         (a.side === 'away' && e.awayId === c.winnerId)))
    );
    if (apps.length) cupsWon.push({ season: c.season, cupId: c.cupId, apps: apps.length });
  }
  const topScorerAwards = state.history.filter(e =>
    e.type === 'season_ended' && !e.struck &&
    e.topScorer && e.topScorer.playerId === playerId
  ).map(e => ({ season: e.season, leagueId: e.leagueId, goals: e.topScorer.goals }));
  return { leagueTitles: won, cups: cupsWon, topScorer: topScorerAwards };
}

/* ===========================================================================
 * Toast helper (used by save/load and many other places)
 * ========================================================================= */
function showToast(msg, type = 'success') {
  const cont = document.getElementById('toast-container');
  if (!cont) { console.log(`[${type}]`, msg); return; }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  cont.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 200ms ease, transform 200ms ease';
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    setTimeout(() => el.remove(), 220);
  }, 3200);
}
