/* ===========================================================================
 * CRUFYmanager — state.js
 *   Global state object, default schema, localStorage persistence,
 *   JSON export / import, and the append-only history book.
 *
 *   Every save flows through saveState(). Commit-style operations append
 *   to state.history, which is the source of truth for derived views
 *   (career stats, club honours, season-by-season tables, news feed).
 * ========================================================================= */

const STATE_KEY = 'crufy_save_v1';   // legacy localStorage key (migrated on load)
const DB_NAME = 'crufy';
const DB_VERSION = 1;
const STORE = 'saves';
const NAMEBANK_KEY = 'nameBanks';      // separate IDB key, preserved across resets
const SCHEMA_VERSION = 1;

let state = null;
let _saveDebounce = null;
let _dbPromise = null;
let _saveInFlight = false;
let _saveQueued = false;

/* ===========================================================================
 * IndexedDB wrapper — small promise-y shim around a single object store.
 * ========================================================================= */
function _openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB not available')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
  return _dbPromise;
}

function _idbGet(key) {
  return _openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

function _idbPut(key, value) {
  return _openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.onabort = () => reject(tx.error || new Error('IDB tx aborted'));
  }));
}

function _idbDel(key) {
  return _openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  }));
}

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
    /* Shared season calendar. All leagues' matchdays are distributed across
     * `totalDays` so a single "Advance day" tick plays the matches happening
     * that day across the whole nation. Roll-over happens once when day
     * exceeds totalDays — irrespective of how many leagues there are. */
    calendar: { season: 1, day: 1, totalDays: 38 },
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
 *
 *   Primary store is IndexedDB (much larger quota than localStorage). On
 *   first load we also check for a legacy localStorage save and migrate
 *   it across, then delete the localStorage copy to free that quota.
 * ========================================================================= */
async function loadState() {
  // 1) Prefer IndexedDB
  let raw = null;
  try {
    raw = await _idbGet('main');
  } catch (e) {
    console.warn('IndexedDB read failed, falling back to localStorage', e);
  }
  // 2) Migrate from localStorage if present
  if (!raw) {
    try {
      const legacy = localStorage.getItem(STATE_KEY);
      if (legacy) {
        raw = JSON.parse(legacy);
        try { await _idbPut('main', raw); localStorage.removeItem(STATE_KEY); console.log('Migrated save from localStorage to IndexedDB'); }
        catch (e) { console.warn('Could not migrate to IDB:', e); }
      }
    } catch (e) { /* ignore */ }
  }
  if (!raw) state = defaultState();
  else { try { state = migrateState(raw); }
         catch (e) { console.warn('Failed to migrate save, starting fresh', e); state = defaultState(); } }

  // 3) Load name-banks library (kept separate from main save). If the user
  // has an established library, it overrides whatever was in the save; if
  // not, persist the save's banks (which start as defaults) into the library.
  let lib = null;
  try { lib = await _idbGet(NAMEBANK_KEY); } catch (e) { /* ignore */ }
  if (lib && Object.keys(lib).length) {
    state.nameBanks = lib;
  } else if (state.nameBanks && Object.keys(state.nameBanks).length) {
    try { await _idbPut(NAMEBANK_KEY, state.nameBanks); } catch (e) { /* ignore */ }
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
  // Compact any bloated old match records — strip events / XI in place
  if (Array.isArray(fresh.history)) {
    let slimmed = 0;
    for (const e of fresh.history) {
      if (e.type !== 'match_committed') continue;
      if (e.events) { delete e.events; slimmed++; }
      if (e.homeXI) { e.homeFormation = e.homeFormation || (e.homeXI.formation || null); delete e.homeXI; }
      if (e.awayXI) { e.awayFormation = e.awayFormation || (e.awayXI.formation || null); delete e.awayXI; }
    }
    if (slimmed) console.log(`Compacted ${slimmed} historic match records on load.`);
  }
  // Calendar migration: backfill day numbers on old league schedules and
  // derive a sensible calendar.day / totalDays.
  if (Array.isArray(fresh.leagues) && fresh.leagues.length) {
    let maxMatchdays = 0;
    let maxPlayedMatchday = 0;
    for (const lg of fresh.leagues) {
      if (!lg.schedule || !lg.schedule.length) continue;
      maxMatchdays = Math.max(maxMatchdays, lg.schedule.length);
      for (const rd of lg.schedule) {
        if (rd.day == null) rd.day = rd.matchday;   // legacy: matchday == day
        const allPlayed = rd.fixtures.every(f => f.played);
        if (allPlayed) maxPlayedMatchday = Math.max(maxPlayedMatchday, rd.day);
      }
    }
    if (!fresh.calendar) fresh.calendar = { season: fresh.settings?.season || 1, day: 1, totalDays: 38 };
    fresh.calendar.totalDays = Math.max(fresh.calendar.totalDays || 0, maxMatchdays || 38);
    if (!fresh.calendar.day || fresh.calendar.day < 1) {
      fresh.calendar.day = Math.min(maxPlayedMatchday + 1, fresh.calendar.totalDays);
    }
    if (!fresh.calendar.season) fresh.calendar.season = fresh.settings?.season || 1;
  } else if (!fresh.calendar) {
    fresh.calendar = { season: fresh.settings?.season || 1, day: 1, totalDays: 38 };
  }
  // One-time backfill: apply seasonStats deltas to any external matches that
  // pre-date the apps/goals/assists logging. Idempotent via statsApplied flag.
  if (Array.isArray(fresh.externalMatches) && Array.isArray(fresh.players)) {
    const byId = new Map(fresh.players.map(p => [p.id, p]));
    const currentSeason = fresh.settings?.season;
    let backfilled = 0;
    const ensureStats = p => p.seasonStats = p.seasonStats || { apps: 0, goals: 0, assists: 0, yellows: 0, reds: 0 };
    for (const m of fresh.externalMatches) {
      if (m.statsApplied) continue;
      // Past-season matches: counters were wiped at rollover. Mark as
      // applied so future strikes won't try to roll them back from this
      // season's tallies.
      if (m.season !== currentSeason) { m.statsApplied = true; backfilled++; continue; }
      for (const ap of m.appearances || []) {
        if (!ap.playerId) continue;
        const p = byId.get(ap.playerId);
        if (!p) continue;
        ensureStats(p);
        p.seasonStats.apps = (p.seasonStats.apps || 0) + 1;
      }
      for (const sc of m.scorers || []) {
        if (sc.playerId && !sc.ownGoal) {
          const p = byId.get(sc.playerId);
          if (p) { ensureStats(p); p.seasonStats.goals = (p.seasonStats.goals || 0) + 1; }
        }
        if (sc.assistId) {
          const a = byId.get(sc.assistId);
          if (a) { ensureStats(a); a.seasonStats.assists = (a.seasonStats.assists || 0) + 1; }
        }
      }
      m.statsApplied = true;
      backfilled++;
    }
    if (backfilled) console.log(`Backfilled seasonStats for ${backfilled} external match(es).`);
  }
  return fresh;
}

/* User-triggered compactor — same logic, callable from Settings. */
async function compactSaveNow() {
  let slimmed = 0;
  for (const e of state.history) {
    if (e.type !== 'match_committed') continue;
    if (e.events) { delete e.events; slimmed++; }
    if (e.homeXI) { e.homeFormation = e.homeFormation || (e.homeXI.formation || null); delete e.homeXI; }
    if (e.awayXI) { e.awayFormation = e.awayFormation || (e.awayXI.formation || null); delete e.awayXI; }
  }
  await saveStateNow();
  return slimmed;
}

function saveState() {
  if (_saveDebounce) clearTimeout(_saveDebounce);
  _saveDebounce = setTimeout(() => { _saveDebounce = null; saveStateNow(); }, 120);
}

/* Coalesce concurrent save attempts: if a save is already running, mark a
 * follow-up save needed when it finishes. Returns the in-flight promise. */
function saveStateNow() {
  if (_saveDebounce) { clearTimeout(_saveDebounce); _saveDebounce = null; }
  if (_saveInFlight) { _saveQueued = true; return Promise.resolve(); }
  _saveInFlight = true;
  const snapshot = state;
  // Mirror name banks to their separate IDB key so they survive save resets.
  const banksSnapshot = snapshot.nameBanks;
  return Promise.all([
    _idbPut('main', snapshot),
    banksSnapshot ? _idbPut(NAMEBANK_KEY, banksSnapshot) : Promise.resolve(),
  ]).catch(err => {
    showToast('Save failed: ' + (err.message || err), 'error');
    console.error('IDB save failed', err);
  }).finally(() => {
    _saveInFlight = false;
    if (_saveQueued) { _saveQueued = false; saveStateNow(); }
  });
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
  reader.onload = async e => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed || !parsed.version) throw new Error('Not a CRUFY save');
      if (!confirm('Importing will replace your current save. Continue?')) return;
      state = migrateState(parsed);
      await saveStateNow();
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

function handleRosterImport(ev) {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const roster = JSON.parse(e.target.result);
      if (!roster || !Array.isArray(roster.players)) {
        throw new Error('Not a roster JSON (expected { players: [...] })');
      }
      const teamLabel = roster.team || roster.country || 'roster';
      const msg = `Add ${roster.players.length} player(s) from "${teamLabel}" to your save as free agents? Existing data is kept; ids are regenerated to avoid collisions.`;
      if (!confirm(msg)) { ev.target.value = ''; return; }

      const defaultBank = state.settings.defaultNameBank || 'Generic English';
      const knownBank = name => name && (state.nameBanks[name] || DEFAULT_NAME_BANKS[name]);

      let addedPlayers = 0;
      const newIds = [];
      for (const raw of roster.players) {
        const p = deepClone(raw);
        p.id = uid('p_');
        p.clubId = null;
        if (!knownBank(p.nameBankUsed)) p.nameBankUsed = defaultBank;
        p.contract = p.contract || { wage: 0, years: 0 };
        p.status = p.status || { injuredUntil: 0, suspendedFor: 0, yellowsThisSeason: 0, fatigue: 0 };
        p.seasonStats = p.seasonStats || { apps: 0, goals: 0, assists: 0, yellows: 0, reds: 0 };
        p.skillHistory = p.skillHistory || [];
        p.isRetired = !!p.isRetired;
        p.shirtNumber = null; // free agents don't carry a club shirt
        if (!p.name && (p.firstName || p.lastName)) p.name = `${p.firstName || ''} ${p.lastName || ''}`.trim();
        state.players.push(p);
        newIds.push(p.id);
        addedPlayers++;
      }
      // If the roster's country matches the user's nation, auto-add the
      // imported players to the NT squad so external NT matches can pick
      // from them (and have a bench for substitutions).
      const rosterCountry = (roster.country || roster.team || '').trim();
      const myNation = (state.settings.nation?.name || '').trim();
      if (rosterCountry && myNation && rosterCountry.toLowerCase() === myNation.toLowerCase()) {
        state.settings.ntSquad = state.settings.ntSquad || [];
        const existing = new Set(state.settings.ntSquad);
        for (const id of newIds) if (!existing.has(id)) state.settings.ntSquad.push(id);
      }

      const stockManagerAttrs = () => ({
        tactical: 60, manManagement: 60, youthDev: 50, reputation: 55,
      });
      let addedManagers = 0;
      for (const key of ['manager', 'assistantManager']) {
        const raw = roster[key];
        if (!raw) continue;
        const m = deepClone(raw);
        m.id = uid('m_');
        m.firstName = m.firstName || (m.name || '').split(' ')[0] || '?';
        m.lastName = m.lastName || (m.name || '').split(' ').slice(1).join(' ') || '?';
        m.nationality = m.nationality || roster.country || state.settings.nation?.name || '';
        if (!knownBank(m.nameBankUsed)) m.nameBankUsed = defaultBank;
        m.attrs = m.attrs || stockManagerAttrs();
        m.formerPlayerId = m.formerPlayerId || null;
        m.clubId = null;
        m.isUnemployed = true;
        m.seasonsAtClub = 0;
        state.managers.push(m);
        addedManagers++;
      }

      // After a re-import, history records still reference the OLD player
      // ids. Relink any orphan ids to the freshly-imported players by name
      // and rebuild seasonStats so career / squad views populate.
      const relinked = relinkOrphanPlayerIds();
      await saveStateNow();
      const linkMsg = relinked ? `, re-linked ${relinked} historic record(s)` : '';
      showToast(`Imported ${addedPlayers} players, ${addedManagers} staff${linkMsg}`, 'success');
      refreshAll();
    } catch (err) {
      showToast('Roster import failed: ' + err.message, 'error');
    }
    ev.target.value = '';
  };
  reader.readAsText(file);
}

async function resetSave() {
  if (!confirm('This wipes all data including history. Name banks (your custom name lists) will be preserved. Type-confirm in next prompt to be sure.')) return;
  const confirmation = prompt('Type RESET to wipe everything:');
  if (confirmation !== 'RESET') { showToast('Reset cancelled', 'warning'); return; }
  // Preserve the name-bank library across the reset.
  let preservedBanks = null;
  try { preservedBanks = await _idbGet(NAMEBANK_KEY); } catch (e) { /* ignore */ }
  if (!preservedBanks) preservedBanks = state.nameBanks;
  state = defaultState();
  state.nameBanks = preservedBanks || deepClone(DEFAULT_NAME_BANKS);
  try { await _idbDel('main'); } catch (e) { /* ignore */ }
  await saveStateNow();
  try { localStorage.removeItem(STATE_KEY); } catch (e) {}
  refreshAll();
  switchTab('settings');
  showToast('Save wiped — name banks preserved', 'success');
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
  const { matchAppearance, matchScorer } = playerMatchHelpers(playerId);
  return state.history.filter(e => {
    if (e.struck) return false;
    if ((e.type === 'match_committed' || e.type === 'external_match') && (
        (e.appearances || []).some(matchAppearance) ||
        (e.scorers || []).some(matchScorer))) return true;
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

/* Walk history and rewrite any orphan playerId on appearances / scorers /
 * assists / cards to the current player whose name matches uniquely. After
 * the remap, rebuild every active player's seasonStats counters from the
 * current season's matches so squad lists and season cards reflect the
 * relinked records too. Returns { relinked, statsRebuilt }.
 *
 * Call this after a roster re-import that gave players fresh ids. The
 * playerCareerStats orphan-fallback already covers display-time matching;
 * this is the one-shot data fix that also restores seasonStats. */
function relinkOrphanPlayerIds() {
  const byName = new Map();
  for (const p of state.players) {
    const k = (p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim()).trim();
    if (!k) continue;
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(p);
  }
  const knownIds = new Set(state.players.map(p => p.id));
  let relinked = 0;
  const remap = (rec, idField, nameField) => {
    if (rec[idField] && knownIds.has(rec[idField])) return;
    const name = (rec[nameField] || '').trim();
    if (!name) return;
    const cands = byName.get(name) || [];
    if (cands.length !== 1) return; // skip ambiguous and not-found
    rec[idField] = cands[0].id;
    relinked++;
  };
  for (const e of state.history) {
    if (e.type !== 'match_committed' && e.type !== 'external_match') continue;
    for (const ap of e.appearances || []) remap(ap, 'playerId', 'playerName');
    for (const sc of e.scorers || []) {
      remap(sc, 'playerId', 'playerName');
      if (sc.assistName) remap(sc, 'assistId', 'assistName');
    }
    for (const c of e.cards || []) remap(c, 'playerId', 'playerName');
  }

  // Rebuild current-season seasonStats from the (now-relinked) history.
  for (const p of state.players) {
    p.seasonStats = { apps: 0, goals: 0, assists: 0, yellows: 0, reds: 0 };
  }
  const currentSeason = state.settings.season;
  for (const e of state.history) {
    if (e.struck || e.season !== currentSeason) continue;
    if (e.type !== 'match_committed' && e.type !== 'external_match') continue;
    for (const ap of e.appearances || []) {
      if (!ap.playerId) continue;
      const p = getPlayer(ap.playerId);
      if (p) p.seasonStats.apps = (p.seasonStats.apps || 0) + 1;
    }
    for (const sc of e.scorers || []) {
      if (sc.playerId && !sc.ownGoal) {
        const p = getPlayer(sc.playerId);
        if (p) p.seasonStats.goals = (p.seasonStats.goals || 0) + 1;
      }
      if (sc.assistId) {
        const a = getPlayer(sc.assistId);
        if (a) a.seasonStats.assists = (a.seasonStats.assists || 0) + 1;
      }
    }
    for (const c of e.cards || []) {
      if (!c.playerId) continue;
      const p = getPlayer(c.playerId);
      if (!p) continue;
      if (c.type === 'yellow') p.seasonStats.yellows = (p.seasonStats.yellows || 0) + 1;
      else if (c.type === 'red') p.seasonStats.reds = (p.seasonStats.reds || 0) + 1;
    }
  }
  // Mark current-season external matches as having had stats applied so a
  // future strike can roll back correctly.
  for (const m of (state.externalMatches || [])) {
    if (m.season === currentSeason) m.statsApplied = true;
  }
  saveState();
  return relinked;
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
/* Predicates that match a player against the appearance / scorer / card
 * records in a match. Re-imported rosters get fresh ids while old external
 * matches still reference the old ones; we treat any record whose id isn't
 * in state.players as "orphan" and fall back to a name match for it. This
 * credits the re-imported player without double-crediting any active
 * player who happens to share the name. */
function playerMatchHelpers(playerId) {
  const me = getPlayer(playerId);
  const myName = me?.name || (me ? `${me.firstName || ''} ${me.lastName || ''}`.trim() : '');
  const knownIds = new Set(state.players.map(p => p.id));
  const isOrphan = id => !id || !knownIds.has(id);
  return {
    matchAppearance: a => a.playerId === playerId || (myName && a.playerName === myName && isOrphan(a.playerId)),
    matchScorer:    s => s.playerId === playerId || (myName && s.playerName === myName && isOrphan(s.playerId)),
    matchAssister:  s => s.assistId === playerId || (myName && s.assistName === myName && isOrphan(s.assistId)),
    matchCard:      c => c.playerId === playerId || (myName && c.playerName === myName && isOrphan(c.playerId)),
  };
}

function playerCareerStats(playerId) {
  const out = {
    apps: 0, mins: 0, goals: 0, assists: 0, yellows: 0, reds: 0,
    byClub: {}, bySeason: {},
    international: { apps: 0, mins: 0, goals: 0, assists: 0, yellows: 0, reds: 0 },
  };
  const { matchAppearance, matchScorer, matchAssister, matchCard } = playerMatchHelpers(playerId);

  const matches = state.history.filter(e =>
    !e.struck && (e.type === 'match_committed' || e.type === 'external_match')
  );
  for (const m of matches) {
    const apps = (m.appearances || []).filter(matchAppearance);
    if (!apps.length) continue;
    const ourGoals = (m.scorers || []).filter(s => matchScorer(s) && !s.ownGoal).length;
    const ourAssists = (m.scorers || []).filter(matchAssister).length;
    const ourYellows = (m.cards || []).filter(c => matchCard(c) && c.type === 'yellow').length;
    const ourReds = (m.cards || []).filter(c => matchCard(c) && c.type === 'red').length;
    const ourMins = apps.reduce((acc, a) => acc + (a.minutesPlayed || 0), 0);

    if (m.type === 'external_match') {
      out.international.apps += 1;
      out.international.mins += ourMins;
      out.international.goals += ourGoals;
      out.international.assists += ourAssists;
      out.international.yellows += ourYellows;
      out.international.reds += ourReds;
      continue;
    }

    const ourSide = apps[0].side;
    const ourClubId = ourSide === 'home' ? m.homeId : m.awayId;
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

/* ===========================================================================
 * Encyclopedic-view helpers
 * ========================================================================= */

/* Head-to-head record between two clubs across all committed history.
 * Returns { p, w, d, l, gf, ga, matches: [{...}] } from clubA's perspective. */
function clubHeadToHead(clubAId, clubBId) {
  const matches = state.history.filter(e =>
    e.type === 'match_committed' && !e.struck &&
    ((e.homeId === clubAId && e.awayId === clubBId) ||
     (e.homeId === clubBId && e.awayId === clubAId))
  ).sort((a, b) => a.season - b.season || (a.matchday || 0) - (b.matchday || 0));
  const out = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, matches };
  for (const m of matches) {
    out.p++;
    const aIsHome = m.homeId === clubAId;
    const aGoals = aIsHome ? m.hScore : m.aScore;
    const bGoals = aIsHome ? m.aScore : m.hScore;
    out.gf += aGoals; out.ga += bGoals;
    if (aGoals > bGoals) out.w++;
    else if (aGoals < bGoals) out.l++;
    else out.d++;
  }
  return out;
}

/* All committed matches a player appeared in. Each entry includes the
 * player's stat line for that match. */
function playerMatchLog(playerId) {
  const out = [];
  for (const m of state.history.filter(e => e.type === 'match_committed' && !e.struck)) {
    const apps = (m.appearances || []).filter(a => a.playerId === playerId);
    if (!apps.length) continue;
    const ourSide = apps[0].side;
    const goals = (m.scorers || []).filter(s => s.playerId === playerId && !s.ownGoal).length;
    const assists = (m.scorers || []).filter(s => s.assistId === playerId).length;
    const yellows = (m.cards || []).filter(c => c.playerId === playerId && c.type === 'yellow').length;
    const reds = (m.cards || []).filter(c => c.playerId === playerId && c.type === 'red').length;
    const mins = apps.reduce((acc, a) => acc + (a.minutesPlayed || 0), 0);
    const started = apps.some(a => a.started);
    out.push({
      matchId: m.id, season: m.season, matchday: m.matchday,
      leagueId: m.leagueId, cupId: m.cupId,
      homeId: m.homeId, awayId: m.awayId, hScore: m.hScore, aScore: m.aScore,
      ourSide, ourClubId: ourSide === 'home' ? m.homeId : m.awayId,
      mins, started, goals, assists, yellows, reds
    });
  }
  out.sort((a, b) => b.season - a.season || (b.matchday || 0) - (a.matchday || 0));
  return out;
}

/* All season_ended events for a league, newest first. Each contains the full
 * final table snapshot. */
function leagueSeasonHistory(leagueId) {
  return state.history
    .filter(e => e.type === 'season_ended' && !e.struck && e.leagueId === leagueId)
    .sort((a, b) => b.season - a.season);
}

/* Cup history — list of all winners and runners-up. */
function cupHistory(cupId) {
  return state.history
    .filter(e => e.type === 'cup_won' && !e.struck && e.cupId === cupId)
    .sort((a, b) => b.season - a.season);
}

/* All-time top scorers across all leagues. Returns flat list. */
function allTimeTopScorers(limit = 25) {
  const counts = {};
  for (const e of state.history) {
    if (e.type !== 'match_committed' || e.struck) continue;
    for (const sc of (e.scorers || [])) {
      if (sc.ownGoal) continue;
      counts[sc.playerId] = (counts[sc.playerId] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([playerId, goals]) => ({ playerId, goals }))
    .sort((a, b) => b.goals - a.goals)
    .slice(0, limit);
}

/* All-time appearance leaders */
function allTimeAppearances(limit = 25) {
  const counts = {};
  for (const e of state.history) {
    if (e.type !== 'match_committed' || e.struck) continue;
    for (const ap of (e.appearances || [])) {
      counts[ap.playerId] = (counts[ap.playerId] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([playerId, apps]) => ({ playerId, apps }))
    .sort((a, b) => b.apps - a.apps)
    .slice(0, limit);
}

/* Most-titled clubs (by league wins) */
function allTimeTitleHolders(limit = 25) {
  const counts = {};
  for (const e of state.history) {
    if (e.type !== 'season_ended' || e.struck || !e.championId) continue;
    counts[e.championId] = (counts[e.championId] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([clubId, titles]) => ({ clubId, titles }))
    .sort((a, b) => b.titles - a.titles)
    .slice(0, limit);
}

/* ===========================================================================
 * Skill / overall rating helpers
 *
 *   playerOverall(p): 1-99 weighted aggregate of attrs, position-aware.
 *   clubOverall(c):   avg of top-11 player overalls in the squad.
 * ========================================================================= */
function playerOverall(p) {
  if (!p) return 0;
  const a = p.attrs || {};
  const safe = (k) => a[k] || 1;
  if (p.position === 'GK') {
    return Math.round((safe('goalkeeping') * 1.6 + safe('mental') * 0.6 + safe('strength') * 0.4 + safe('passing') * 0.2) / 2.8);
  }
  if (p.position === 'DF') {
    return Math.round((safe('defending') * 1.4 + safe('strength') * 0.7 + safe('pace') * 0.6 + safe('mental') * 0.5 + safe('passing') * 0.3 + safe('technique') * 0.3) / 3.8);
  }
  if (p.position === 'MF') {
    return Math.round((safe('passing') * 1.0 + safe('technique') * 0.9 + safe('mental') * 0.7 + safe('defending') * 0.4 + safe('shooting') * 0.4 + safe('pace') * 0.4) / 3.8);
  }
  if (p.position === 'FW') {
    return Math.round((safe('shooting') * 1.4 + safe('pace') * 0.9 + safe('technique') * 0.8 + safe('mental') * 0.4 + safe('passing') * 0.3) / 3.8);
  }
  return 50;
}

function clubOverall(clubId) {
  const c = typeof clubId === 'string' ? getClub(clubId) : clubId;
  if (!c) return 0;
  const squad = playersByClub(c.id).filter(p => !p.isRetired);
  if (!squad.length) return 0;
  const top11 = squad.map(playerOverall).sort((a, b) => b - a).slice(0, Math.min(11, squad.length));
  return Math.round(top11.reduce((a, b) => a + b, 0) / top11.length);
}

/* Colour-class helper for ratings (used in tables/pills) */
function ratingClass(r) {
  if (r >= 80) return 'rating-elite';
  if (r >= 70) return 'rating-strong';
  if (r >= 55) return 'rating-mid';
  if (r >= 40) return 'rating-weak';
  return 'rating-poor';
}
