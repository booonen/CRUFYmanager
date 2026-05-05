/* ===========================================================================
 * CRUFYmanager — views2.js
 *   Remaining page renderers: fixtures, results, national team,
 *   external matches, history book, settings, import/export.
 * ========================================================================= */

/* ===========================================================================
 * FIXTURES — generation control: per-match, matchday, end-of-season
 * ========================================================================= */
function renderFixtures() {
  const root = document.getElementById('fixtures-content');
  if (!root) return;
  if (!state.leagues.length) { root.innerHTML = emptyState({ icon: '◷', title: 'No leagues', body: 'Create a league to start scheduling matches.' }); return; }

  let html = '';
  for (const lg of state.leagues) {
    if (!lg.schedule || !lg.schedule.length) continue;
    const next = nextMatchdayForLeague(lg.id);
    if (!next) {
      html += `<div class="card mb-16"><h3>${esc(lg.name)} — Season complete</h3><p class="text-muted">All matchdays played. Click "Roll season over" below to start the next season.</p></div>`;
      continue;
    }
    const drafts = (state.draftMatches || []).filter(d => d.leagueId === lg.id && d.matchday === next.matchday);
    html += `<div class="gen-bar">
      <div class="gen-info"><strong>${esc(lg.name)}</strong> — next: Matchday ${next.matchday} (${next.fixtures.length} matches, ${drafts.length ? `<span class="text-warn">${drafts.length} drafts pending</span>` : 'no drafts yet'})</div>
      <div class="gen-actions">
        ${drafts.length === 0 ? `<button class="btn btn-primary" onclick="generateMatchdayDrafts('${lg.id}'); refreshAll(); showToast('Drafted matchday ${next.matchday}','success')">⚡ Draft matchday</button>` : `
          <button class="btn btn-warn" onclick="rerollMatchday('${lg.id}', ${next.matchday})">↻ Re-roll all</button>
          <button class="btn btn-danger" onclick="discardMatchday('${lg.id}', ${next.matchday})">✕ Discard all</button>
          <button class="btn btn-primary" onclick="commitAllDraftsForMatchday('${lg.id}', ${next.matchday}); refreshAll(); showToast('Matchday committed','success')">✓ Commit matchday</button>
        `}
        <button class="btn btn-warn" onclick="if(confirm('Generate AND commit every remaining match this season? This will end the season.')) { generateAndCommitToEndOfSeason('${lg.id}'); refreshAll(); showToast('Season fast-forwarded','success'); }">⏭ End season</button>
      </div>
    </div>`;

    html += `<div class="card mb-24"><h3>Matchday ${next.matchday}</h3>`;
    for (const fx of next.fixtures) {
      const home = getClub(fx.homeId);
      const away = getClub(fx.awayId);
      if (!home || !away) continue;
      const draft = drafts.find(d => d.homeId === fx.homeId && d.awayId === fx.awayId);
      if (draft) {
        html += `<div class="scoreline scoreline-draft" onclick="viewMatchModal('${draft.id}')" style="cursor:pointer">
          <div class="home-team">${esc(home.name)}</div>
          <div class="score">${draft.hScore}–${draft.aScore}<span class="pen-detail">draft · click to review</span></div>
          <div class="away-team">${esc(away.name)}</div>
        </div>`;
      } else {
        html += `<div class="scoreline">
          <div class="home-team">${esc(home.name)}</div>
          <div class="score" style="cursor:pointer" onclick="generateSingleMatchAndView('${lg.id}', '${fx.matchId}')">vs<br><span class="pen-detail">click to draft</span></div>
          <div class="away-team">${esc(away.name)}</div>
        </div>`;
      }
    }
    html += `</div>`;
  }

  // Cup matchdays
  for (const cp of state.cups) {
    const fixtures = nextCupFixtures(cp.id);
    if (!fixtures.length) continue;
    const drafts = (state.draftMatches || []).filter(d => d.cupId === cp.id);
    html += `<div class="gen-bar"><div class="gen-info"><strong>${esc(cp.name)}</strong> — next: ${fixtures.length} cup match(es) · ${drafts.length} drafts</div><div class="gen-actions">
      <button class="btn btn-primary" onclick="generateCupRoundDrafts('${cp.id}'); refreshAll()">⚡ Draft round</button>
      ${drafts.length ? `<button class="btn btn-primary" onclick="commitCupDrafts('${cp.id}'); refreshAll()">✓ Commit + advance</button>` : ''}
    </div></div>`;
    html += `<div class="card mb-16"><h3>${esc(cp.name)} — ${cp._currentRound === 'groups' ? 'Group stage' : (cp.rounds[cp.rounds.length - 1]?.name || 'next round')}</h3>`;
    for (const fx of fixtures) {
      const home = getClub(fx.homeId);
      const away = getClub(fx.awayId);
      if (!home || !away) continue;
      const draft = drafts.find(d => d.homeId === fx.homeId && d.awayId === fx.awayId);
      if (draft) {
        html += `<div class="scoreline scoreline-draft" onclick="viewMatchModal('${draft.id}')" style="cursor:pointer">
          <div class="home-team">${esc(home.name)}</div>
          <div class="score">${draft.hScore}–${draft.aScore}<span class="pen-detail">draft</span></div>
          <div class="away-team">${esc(away.name)}</div>
        </div>`;
      } else {
        html += `<div class="scoreline">
          <div class="home-team">${esc(home.name)}</div>
          <div class="score">vs</div>
          <div class="away-team">${esc(away.name)}</div>
        </div>`;
      }
    }
    html += `</div>`;
  }

  // End-of-season convenience
  const allDone = state.leagues.length && state.leagues.every(l => l.schedule && l.schedule.length && l.schedule.every(rd => rd.fixtures.every(f => f.played)));
  if (allDone) {
    html += `<div class="card"><h3>Season ${state.settings.season} complete</h3>
      <p>All league matchdays have been played and committed. Roll the season over to:</p>
      <ul style="font-size:13px;padding-left:18px;color:var(--text-dim)">
        <li>Crown champions, apply promotions / relegations</li>
        <li>Age every player by 1 year, retire eligible players, generate youth intakes</li>
        <li>Process manager hire/sack cycle for AI clubs</li>
        <li>Generate the next season's schedules</li>
      </ul>
      <button class="btn btn-primary" onclick="if(confirm('Roll the season over now?')) { endOfSeasonProcessing(); showToast('New season begun','success'); refreshAll(); }">↻ Roll season over</button>
    </div>`;
  }

  if (!html) html = emptyState({ icon: '◷', title: 'No active fixtures', body: 'Generate a league schedule from the Leagues tab first.' });
  root.innerHTML = html;
}

function rerollMatchday(leagueId, matchday) {
  if (!confirm(`Re-roll all draft matches for matchday ${matchday}?`)) return;
  state.draftMatches = (state.draftMatches || []).filter(d => !(d.leagueId === leagueId && d.matchday === matchday));
  generateMatchdayDrafts(leagueId);
  refreshAll();
}
function discardMatchday(leagueId, matchday) {
  if (!confirm('Discard all drafts (without committing)?')) return;
  state.draftMatches = (state.draftMatches || []).filter(d => !(d.leagueId === leagueId && d.matchday === matchday));
  saveState(); refreshAll();
}
function generateSingleMatchAndView(leagueId, matchId) {
  const lg = getLeague(leagueId);
  if (!lg) return;
  let fx = null, matchday = null;
  for (const rd of lg.schedule) {
    const f = rd.fixtures.find(x => x.matchId === matchId);
    if (f) { fx = f; matchday = rd.matchday; break; }
  }
  if (!fx) return;
  const draft = generateSingleFixtureDraft({ homeId: fx.homeId, awayId: fx.awayId, leagueId, matchday });
  if (!draft) return;
  refreshAll();
  setTimeout(() => viewMatchModal(draft, { draft: true }), 50);
}

function generateCupRoundDrafts(cupId) {
  const cp = getCup(cupId);
  if (!cp) return;
  const fixtures = nextCupFixtures(cupId);
  state.draftMatches = (state.draftMatches || []).filter(d => d.cupId !== cupId);
  for (const f of fixtures) {
    const isKO = cp._currentRound !== 'groups';
    const draft = simulateMatch({ homeId: f.homeId, awayId: f.awayId, cupId: cp.id, neutral: false, isKnockout: isKO, requiresWinner: isKO });
    if (draft) state.draftMatches.push(draft);
  }
  saveState();
  showToast(`Drafted ${fixtures.length} cup match(es)`, 'success');
}

function commitCupDrafts(cupId) {
  const drafts = (state.draftMatches || []).filter(d => d.cupId === cupId);
  for (const d of drafts) commitMatch(d);
  advanceCup(cupId);
  saveState();
}

/* ===========================================================================
 * RESULTS — committed history of matches, paginated by season
 * ========================================================================= */
function renderResults() {
  const root = document.getElementById('results-content');
  if (!root) return;
  const matches = state.history.filter(e => e.type === 'match_committed' && !e.struck).slice().sort((a, b) => b.ts - a.ts);
  if (!matches.length) { root.innerHTML = emptyState({ icon: '✓', title: 'No results yet', body: 'Generate and commit some matchdays first.' }); return; }
  // Group by season then matchday
  const bySeason = {};
  for (const m of matches) {
    bySeason[m.season] = bySeason[m.season] || {};
    const key = m.leagueId ? `L:${m.leagueId}:${m.matchday}` : `C:${m.cupId}`;
    bySeason[m.season][key] = bySeason[m.season][key] || { matches: [], leagueId: m.leagueId, cupId: m.cupId, matchday: m.matchday };
    bySeason[m.season][key].matches.push(m);
  }
  let html = '';
  const seasons = Object.keys(bySeason).map(Number).sort((a, b) => b - a);
  for (const sn of seasons) {
    html += `<h2 style="font-family:var(--font-display);font-size:18px;margin:18px 0 8px">Season ${sn}</h2>`;
    const groups = bySeason[sn];
    const groupKeys = Object.keys(groups).sort();
    for (const k of groupKeys) {
      const grp = groups[k];
      let label = '';
      if (grp.leagueId) label = `${getLeague(grp.leagueId)?.name || '?'} — Matchday ${grp.matchday}`;
      else label = `${getCup(grp.cupId)?.name || '?'}`;
      const exp = grp.leagueId ? `bbcodeMatchdayResults('${grp.leagueId}', ${grp.matchday})` : `'(see cup detail page)'`;
      html += `<div class="card mb-16"><h3>${esc(label)} <button class="btn btn-sm" onclick="copyToClipboard(${exp})">📋 BBCode</button></h3>`;
      for (const m of grp.matches) {
        const home = getClub(m.homeId), away = getClub(m.awayId);
        if (!home || !away) continue;
        html += `<div class="scoreline scoreline-committed" onclick="viewMatchModal('${m.id}')" style="cursor:pointer">
          <div class="home-team">${esc(home.name)}</div>
          <div class="score">${m.hScore}–${m.aScore}${m.penalties ? `<span class="pen-detail">${m.penalties.homeKicks}–${m.penalties.awayKicks} pens</span>` : ''}</div>
          <div class="away-team">${esc(away.name)}</div>
        </div>`;
      }
      html += `</div>`;
    }
  }
  root.innerHTML = html;
}

/* ===========================================================================
 * NATIONAL TEAM — squad picker for the user's nation
 * ========================================================================= */
function renderNationalTeam() {
  const root = document.getElementById('nt-content');
  if (!root) return;
  const nat = state.settings.nation.name;
  if (!nat) { root.innerHTML = emptyState({ icon: '★', title: 'No nation set', body: 'Set your nation name in Settings to manage a national team.', cta: `<button class="btn btn-primary" onclick="switchTab('settings')">Open Settings</button>` }); return; }

  state.settings.ntSquad = state.settings.ntSquad || [];
  const eligible = state.players.filter(p => !p.isRetired && p.nationality === nat);
  const currentSquad = state.settings.ntSquad.map(getPlayer).filter(Boolean);

  let html = `<div class="page-header">
    <div><h2 style="font-family:var(--font-display)">${esc(nat)} senior squad</h2><div class="subtitle">${currentSquad.length} called up · ${eligible.length} eligible</div></div>
    <div class="flex gap-8">
      <button class="btn" onclick="copyToClipboard(bbcodeNTSquad())">📋 BBCode squad</button>
      <button class="btn btn-warn" onclick="autoPickNTSquad()">⚡ Auto-pick best 23</button>
      <button class="btn btn-danger" onclick="state.settings.ntSquad=[]; saveState(); refreshAll(); showToast('Squad cleared','warning')">Clear</button>
    </div>
  </div>`;

  // Eligible pool table with toggle
  html += `<div class="two-col">
    <div>
      <div class="card"><h3>Eligible players (${eligible.length})</h3>
        <p class="text-muted">Eligibility = nationality matches "${esc(nat)}". Click ✓/✗ to toggle.</p>
        <table class="data-table"><thead><tr><th>Player</th><th>Pos</th><th>Club</th><th class="num-c">Age</th><th class="num-c">Rating</th><th></th></tr></thead><tbody>
          ${eligible.sort((a,b) => approxRating(b) - approxRating(a)).map(p => {
            const inSquad = state.settings.ntSquad.includes(p.id);
            return `<tr>
              <td>${playerLink(p.id)}</td>
              <td>${positionBadge(p.position)}</td>
              <td>${clubLink(p.clubId)}</td>
              <td class="num-c">${p.age}</td>
              <td class="num-c">${approxRating(p)}</td>
              <td><button class="btn btn-sm ${inSquad ? 'btn-danger' : 'btn-primary'}" onclick="toggleNTSquad('${p.id}')">${inSquad ? '✗ remove' : '✓ call up'}</button></td>
            </tr>`;
          }).join('')}
        </tbody></table>
      </div>
    </div>
    <div>
      <div class="card mb-16"><h3>Current squad</h3>
        ${!currentSquad.length ? '<p class="text-muted" style="font-size:12px">Empty.</p>' : ''}
        ${['GK','DF','MF','FW'].map(grp => {
          const grpPlayers = currentSquad.filter(p => p.position === grp);
          if (!grpPlayers.length) return '';
          return `<h4>${grp} (${grpPlayers.length})</h4>` + grpPlayers.map(p => `<div class="squad-row" style="grid-template-columns: 60px 1fr 50px 60px auto"><div class="sr-pos">${positionBadge(p.position)}</div><div class="sr-name">${esc(p.name)}</div><div>${ovrPill(playerOverall(p))}</div><div class="sr-age">${p.age}</div><button class="btn btn-sm btn-danger" onclick="toggleNTSquad('${p.id}')">✗</button></div>`).join('');
        }).join('')}
      </div>
      <div class="card"><h3>Historic squads</h3>${renderNTSquadHistoryHTML()}</div>
    </div>
  </div>`;
  root.innerHTML = html;
}

function approxRating(p) {
  return playerOverall(p);
}

function renderNTSquadHistoryHTML() {
  const history = (state.ntSquadHistory || []).slice().sort((a, b) => b.season - a.season);
  if (!history.length) return '<p class="text-muted" style="font-size:12px">No snapshots yet — your NT squad is saved at the end of each season.</p>';
  let html = '';
  for (const snap of history) {
    const players = (snap.playerIds || []).map(getPlayer).filter(Boolean);
    html += `<details style="margin-bottom:6px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px">
      <summary style="cursor:pointer;font-weight:400">
        <strong>Season ${snap.season}</strong> · <span class="text-muted">${players.length} players</span>
      </summary>
      <div style="margin-top:8px">
        ${['GK','DF','MF','FW'].map(grp => {
          const ps = players.filter(p => p.position === grp);
          if (!ps.length) return '';
          return `<h4 style="margin-top:6px">${grp} (${ps.length})</h4>` + ps.map(p => {
            const histAtSeason = (p.skillHistory || []).find(h => h.season === snap.season);
            const ovr = histAtSeason ? histAtSeason.overall : playerOverall(p);
            return `<div style="display:flex;gap:8px;align-items:center;font-size:12px;padding:2px 0"><div>${ovrPill(ovr)}</div><div style="flex:1">${playerLink(p.id)}</div><div class="text-muted" style="font-size:11px">${histAtSeason ? `age ${histAtSeason.age}` : `age ${p.age}`}</div></div>`;
          }).join('');
        }).join('')}
      </div>
    </details>`;
  }
  return html;
}

function toggleNTSquad(playerId) {
  state.settings.ntSquad = state.settings.ntSquad || [];
  const i = state.settings.ntSquad.indexOf(playerId);
  if (i >= 0) state.settings.ntSquad.splice(i, 1);
  else {
    state.settings.ntSquad.push(playerId);
    historyAppend('nt_callup', { playerId, nation: state.settings.nation.name });
  }
  saveState(); refreshAll();
}

function autoPickNTSquad() {
  const nat = state.settings.nation.name;
  const eligible = state.players.filter(p => !p.isRetired && p.nationality === nat);
  const byPos = { GK: [], DF: [], MF: [], FW: [] };
  for (const p of eligible) byPos[p.position].push(p);
  for (const k of Object.keys(byPos)) byPos[k].sort((a, b) => approxRating(b) - approxRating(a));
  const squad = [
    ...byPos.GK.slice(0, 3),
    ...byPos.DF.slice(0, 8),
    ...byPos.MF.slice(0, 7),
    ...byPos.FW.slice(0, 5)
  ];
  const newCallups = squad.map(p => p.id).filter(id => !state.settings.ntSquad.includes(id));
  state.settings.ntSquad = squad.map(p => p.id);
  for (const id of newCallups) historyAppend('nt_callup', { playerId: id, nation: state.settings.nation.name });
  saveState(); refreshAll();
  showToast(`23-man squad picked. ${newCallups.length} new call-ups.`, 'success');
}

function bbcodeNTSquad() {
  const squad = (state.settings.ntSquad || []).map(getPlayer).filter(Boolean);
  if (!squad.length) return '(empty squad)';
  let s = bbcodeNationHeader();
  s += bbCentre(bbSize(140, bbBold(`${state.settings.nation.name} — Squad`))) + '\n[hr]\n';
  for (const grp of ['GK','DF','MF','FW']) {
    const ps = squad.filter(p => p.position === grp);
    if (!ps.length) continue;
    s += bbBold(grp) + '\n[list]';
    for (const p of ps) s += `[*]${p.name} — ${clubName(p.clubId)} (age ${p.age})`;
    s += '[/list]\n';
  }
  return s;
}

/* ===========================================================================
 * EXTERNAL MATCHES — user-input NT, continental club, friendly results
 * ========================================================================= */
function renderExternal() {
  const root = document.getElementById('external-content');
  if (!root) return;
  const list = state.externalMatches || [];
  if (!list.length) {
    root.innerHTML = emptyState({
      icon: '⟶',
      title: 'No external matches',
      body: 'Generate scripted matches for NT friendlies, qualifiers, continental club ties, or any one-off you need a match report for. You provide the final score; the engine fills in the narrative.',
      cta: `<button class="btn btn-primary" onclick="openExternalModal()">⚡ Generate match</button>`
    });
    return;
  }
  // Group by season
  const bySeason = {};
  for (const m of list) (bySeason[m.season] = bySeason[m.season] || []).push(m);
  let html = '';
  const seasons = Object.keys(bySeason).map(Number).sort((a, b) => b - a);
  for (const sn of seasons) {
    html += `<h3 style="font-family:var(--font-display);margin:18px 0 8px">Season ${sn}</h3>`;
    const matches = bySeason[sn].slice().reverse();
    for (const m of matches) {
      const subtitle = [m.type, m.competition].filter(Boolean).join(' · ');
      let pen = '';
      if (m.penalties) pen = `<span class="pen-detail">${m.penalties.homeKicks}–${m.penalties.awayKicks} pens</span>`;
      else if (m.extraTime) pen = `<span class="pen-detail">a.e.t.</span>`;
      html += `<div class="scoreline scoreline-committed" onclick="viewMatchModal('${m.id}')" style="cursor:pointer">
        <div class="home-team">${esc(m.homeName)}<div class="text-muted" style="font-size:11px">${esc(subtitle)}</div></div>
        <div class="score">${m.hScore}–${m.aScore}${pen}</div>
        <div class="away-team">${esc(m.awayName)}</div>
      </div>`;
    }
  }
  root.innerHTML = html;
}

function deleteExternal(id) {
  state.externalMatches = (state.externalMatches || []).filter(m => m.id !== id);
  saveState(); refreshAll();
}

/* ===========================================================================
 * HISTORY BOOK — three sub-tabs: ledger, past seasons (per league),
 *   and all-time records.
 * ========================================================================= */
function renderHistoryBook() {
  const root = document.getElementById('history-content');
  if (!root) return;
  if (!state.history.length) { root.innerHTML = emptyState({ icon: '❒', title: 'Empty', body: 'No committed events yet. Play and commit some matches.' }); return; }
  state._historyTab = state._historyTab || 'ledger';
  let html = `<div class="htabs">
    <div class="htab ${state._historyTab === 'ledger' ? 'active' : ''}" onclick="setHistoryTab('ledger')">Ledger</div>
    <div class="htab ${state._historyTab === 'seasons' ? 'active' : ''}" onclick="setHistoryTab('seasons')">Past seasons</div>
    <div class="htab ${state._historyTab === 'records' ? 'active' : ''}" onclick="setHistoryTab('records')">All-time records</div>
    <div class="htab ${state._historyTab === 'transfers' ? 'active' : ''}" onclick="setHistoryTab('transfers')">Transfers</div>
  </div>`;
  if (state._historyTab === 'ledger') html += renderHistoryLedgerHTML();
  else if (state._historyTab === 'seasons') html += renderHistorySeasonsHTML();
  else if (state._historyTab === 'records') html += renderHistoryRecordsHTML();
  else if (state._historyTab === 'transfers') html += renderHistoryTransfersHTML();
  root.innerHTML = html;
}

function setHistoryTab(tab) { state._historyTab = tab; renderHistoryBook(); }

function renderHistoryLedgerHTML() {
  state._historyFilter = state._historyFilter || { type: 'all', season: 'all', includeStruck: false };
  const f = state._historyFilter;
  const types = Array.from(new Set(state.history.map(e => e.type)));
  const seasons = Array.from(new Set(state.history.map(e => e.season))).sort((a, b) => b - a);

  let html = `<div class="card mb-16">
    <div class="form-row-3">
      ${formGroup('Type', formSelect('hist-type', f.type, ['all', ...types]))}
      ${formGroup('Season', formSelect('hist-season', f.season, ['all', ...seasons.map(String)]))}
      <div class="form-group" style="display:flex;align-items:end"><label style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" id="hist-struck" ${f.includeStruck ? 'checked' : ''}> show struck records</label></div>
    </div>
    <button class="btn" onclick="applyHistoryFilter()">Apply</button>
  </div>`;

  let filtered = state.history.slice().reverse();
  if (f.type !== 'all') filtered = filtered.filter(e => e.type === f.type);
  if (f.season !== 'all') filtered = filtered.filter(e => String(e.season) === f.season);
  if (!f.includeStruck) filtered = filtered.filter(e => !e.struck);

  html += `<p class="text-muted" style="font-size:12px">${filtered.length} entr${filtered.length === 1 ? 'y' : 'ies'} after filter.</p>`;

  for (const e of filtered.slice(0, 200)) {
    const struckCls = e.struck ? 'opacity:0.5;text-decoration:line-through' : '';
    let body = describeHistoryEntry(e);
    html += `<div class="history-entry" style="${struckCls}">
      <div class="he-tag">${esc(e.type)}<br>S${e.season}</div>
      <div>${body}${e.struck ? `<div class="text-muted" style="font-size:11px;margin-top:4px">struck: ${esc(e.strikeReason || '')}</div>` : ''}
        <div style="margin-top:4px">${e.type === 'match_committed' ? `<button class="btn btn-sm" onclick="viewMatchModal('${e.id}')">View</button>` : ''}${e.type === 'external_match' ? `<button class="btn btn-sm" onclick="viewMatchModal('${e.matchId}')">View</button>` : ''}
        ${e.struck
          ? `<button class="btn btn-sm" onclick="if(confirm('Restore struck record?')) { unstrikeRecord('${e.id}'); refreshAll(); }">↺ Restore</button>`
          : `<button class="btn btn-sm btn-danger" onclick="askStrikeRecord('${e.id}')">Strike…</button>`}
        </div>
      </div>
    </div>`;
  }
  if (filtered.length > 200) html += `<p class="text-muted" style="margin-top:8px">Showing first 200. Filter further to see older entries.</p>`;
  return html;
}

function renderHistorySeasonsHTML() {
  const leagues = state.leagues.slice().sort((a, b) => (a.tier || 99) - (b.tier || 99));
  if (!leagues.length) return `<div class="empty-state"><p>No leagues yet.</p></div>`;
  let html = '';
  for (const lg of leagues) {
    const titles = leagueSeasonHistory(lg.id);
    if (!titles.length) continue;
    html += `<h3 style="margin-top:18px;font-family:var(--font-display)">${esc(lg.name)}</h3>`;
    html += renderLeagueHistoryHTML(lg.id);
  }
  // Cup history
  for (const cp of state.cups) {
    const wins = cupHistory(cp.id);
    if (!wins.length) continue;
    html += `<h3 style="margin-top:18px;font-family:var(--font-display)">${esc(cp.name)}</h3>`;
    html += `<table class="data-table"><thead><tr><th class="num-c">Season</th><th>Winner</th><th>Runner-up</th></tr></thead><tbody>`;
    for (const w of wins) html += `<tr><td class="num-c">${w.season}</td><td><strong>${clubLink(w.winnerId)}</strong> 🏆</td><td>${clubLink(w.runnerUpId)}</td></tr>`;
    html += `</tbody></table>`;
  }
  if (!html) return `<div class="empty-state"><p>No completed seasons yet.</p></div>`;
  return html;
}

function renderHistoryRecordsHTML() {
  let html = '<div class="two-col">';
  // All-time top scorers
  html += `<div><div class="card mb-16"><h3>All-time top scorers</h3>`;
  const ts = allTimeTopScorers(25);
  if (!ts.length) html += '<p class="text-muted">No goals committed yet.</p>';
  else {
    html += `<table class="data-table"><thead><tr><th class="num-c">#</th><th>Player</th><th>Club</th><th class="num-c">Goals</th></tr></thead><tbody>`;
    ts.forEach((r, i) => {
      const p = getPlayer(r.playerId);
      html += `<tr><td class="num-c">${i + 1}</td><td>${p ? playerLink(p.id) : '?'}</td><td>${p ? clubLink(p.clubId) : '?'}</td><td class="num-c"><strong>${r.goals}</strong></td></tr>`;
    });
    html += `</tbody></table>`;
  }
  html += `</div>`;

  // All-time apps
  html += `<div class="card"><h3>Most appearances</h3>`;
  const apps = allTimeAppearances(25);
  if (!apps.length) html += '<p class="text-muted">No appearances yet.</p>';
  else {
    html += `<table class="data-table"><thead><tr><th class="num-c">#</th><th>Player</th><th>Club</th><th class="num-c">Apps</th></tr></thead><tbody>`;
    apps.forEach((r, i) => {
      const p = getPlayer(r.playerId);
      html += `<tr><td class="num-c">${i + 1}</td><td>${p ? playerLink(p.id) : '?'}</td><td>${p ? clubLink(p.clubId) : '?'}</td><td class="num-c"><strong>${r.apps}</strong></td></tr>`;
    });
    html += `</tbody></table>`;
  }
  html += `</div></div>`;

  // Most-titled clubs
  html += `<div><div class="card mb-16"><h3>Most-titled clubs</h3>`;
  const titles = allTimeTitleHolders(15);
  if (!titles.length) html += '<p class="text-muted">No titles yet.</p>';
  else {
    html += `<table class="data-table"><thead><tr><th class="num-c">#</th><th>Club</th><th class="num-c">Titles</th></tr></thead><tbody>`;
    titles.forEach((r, i) => html += `<tr><td class="num-c">${i + 1}</td><td>${clubLink(r.clubId)}</td><td class="num-c"><strong>${r.titles}</strong></td></tr>`);
    html += `</tbody></table>`;
  }
  html += `</div></div></div>`;
  return html;
}

function renderHistoryTransfersHTML() {
  const transfers = state.history.filter(e => e.type === 'player_signed' && !e.struck).sort((a, b) => b.ts - a.ts);
  if (!transfers.length) return `<div class="empty-state"><p>No transfers logged yet. Use the Transfer button on a player's page.</p></div>`;
  let html = `<table class="data-table"><thead><tr><th class="num-c">Season</th><th>Player</th><th>From</th><th>To</th><th class="num-c">Fee</th></tr></thead><tbody>`;
  for (const t of transfers.slice(0, 200)) {
    const fee = t.freeTransfer ? '<span class="text-muted">free</span>' : (t.fee ? t.fee.toLocaleString() : '—');
    html += `<tr><td class="num-c">${t.season}</td><td>${playerLink(t.playerId)}</td><td>${t.fromClubId ? clubLink(t.fromClubId) : '<span class="text-muted">debut</span>'}</td><td>${t.toClubId ? clubLink(t.toClubId) : '<span class="text-muted">released</span>'}</td><td class="num-c">${fee}</td></tr>`;
  }
  html += `</tbody></table>`;
  if (transfers.length > 200) html += `<p class="text-muted" style="margin-top:6px;font-size:11px">Showing first 200 of ${transfers.length}.</p>`;
  return html;
}

function applyHistoryFilter() {
  state._historyFilter = {
    type: document.getElementById('hist-type').value,
    season: document.getElementById('hist-season').value,
    includeStruck: document.getElementById('hist-struck').checked,
  };
  renderHistoryBook();
}

function describeHistoryEntry(e) {
  switch (e.type) {
    case 'match_committed': {
      const home = clubName(e.homeId), away = clubName(e.awayId);
      const meta = e.leagueId ? `${getLeague(e.leagueId)?.name || '?'} MD${e.matchday}` : (e.cupId ? getCup(e.cupId)?.name || '?' : '');
      return `<strong>${esc(home)} ${e.hScore}–${e.aScore} ${esc(away)}</strong> <span class="text-muted" style="font-size:11px">${esc(meta)}</span>`;
    }
    case 'external_match': {
      return `<strong>${esc(e.homeName || '?')} ${e.hScore}–${e.aScore} ${esc(e.awayName || '?')}</strong> <span class="text-muted" style="font-size:11px">${esc(e.type || 'External')}${e.competition ? ' · ' + esc(e.competition) : ''}</span>`;
    }
    case 'season_ended': return `<strong>${getLeague(e.leagueId)?.name || '?'}</strong> — Champion: ${clubLink(e.championId)} · Promoted: ${(e.promoted||[]).map(clubLink).join(', ')||'—'} · Relegated: ${(e.relegated||[]).map(clubLink).join(', ')||'—'}`;
    case 'cup_won': return `<strong>${getCup(e.cupId)?.name || '?'}</strong> — Winner: ${clubLink(e.winnerId)} · Runner-up: ${clubLink(e.runnerUpId)}`;
    case 'manager_hired': return `${managerLink(e.managerId)} appointed by ${clubLink(e.clubId)}`;
    case 'manager_sacked': return `${managerLink(e.managerId)} dismissed by ${clubLink(e.clubId)}${e.reason ? ` <span class="text-muted">(${esc(e.reason)})</span>` : ''}`;
    case 'player_retired': return `${playerLink(e.playerId)} retires at age ${e.age}`;
    case 'player_to_manager': return `${playerLink(e.playerId)} → ${managerLink(e.managerId)} (entered management)`;
    case 'player_injured': return `${playerLink(e.playerId)} — injured for ${e.matches} match(es)`;
    case 'player_suspended': return `${playerLink(e.playerId)} — suspended for ${e.games} game(s)${e.reason ? ` (${esc(e.reason)})` : ''}`;
    case 'youth_intake': return `${clubLink(e.clubId)} youth intake (${(e.playerIds || []).length} players)`;
    case 'player_signed': {
      const fee = e.freeTransfer ? 'free' : (e.fee ? e.fee.toLocaleString() : '?');
      return `${playerLink(e.playerId)}: ${e.fromClubId ? clubLink(e.fromClubId) : 'free agent'} → ${e.toClubId ? clubLink(e.toClubId) : 'released'} <span class="text-muted">(${fee})</span>`;
    }
    case 'nt_callup': return `${playerLink(e.playerId)} called up to ${esc(e.nation || '?')}`;
    case 'note': return esc(e.text || '');
    default: return esc(e.type);
  }
}

/* ===========================================================================
 * SETTINGS — nation identity + name banks
 * ========================================================================= */
function renderSettings() {
  const root = document.getElementById('settings-content');
  if (!root) return;
  const n = state.settings.nation;
  let html = `<div class="card mb-16"><h3>Nation identity</h3>
    <div class="form-row">
      ${formGroup('Nation name', `<input type="text" id="set-nation-name" value="${esc(n.name)}" placeholder="e.g. Demolandia">`)}
      ${formGroup('Demonym', `<input type="text" id="set-demonym" value="${esc(n.demonym)}" placeholder="e.g. Demolandian">`)}
    </div>
    <div class="form-row">
      ${formGroup('Football association name', `<input type="text" id="set-fa" value="${esc(n.faName)}" placeholder="e.g. Demolandian FA">`)}
      ${formGroup('Flag URL (optional)', `<input type="url" id="set-flag" value="${esc(n.flagUrl)}" placeholder="https://...">`)}
    </div>
    ${formGroup('Default name bank for new players/managers', formSelect('set-default-bank', state.settings.defaultNameBank, Object.keys(state.nameBanks)), 'A name bank only supplies first/last names. Player nationality is a separate field, defaulting to your nation name above.')}
    <div class="flex gap-8 mt-8">
      <button class="btn btn-primary" onclick="saveNationSettings()">Save identity</button>
      <button class="btn" onclick="retagAllPlayersToNation()" title="Set every domestic-club player's nationality to the nation name above. Useful if your existing roster has banks-as-nationality from older saves.">⟲ Re-tag domestic players</button>
    </div>
  </div>`;

  // Storage / compaction
  html += `<div class="card mb-16"><h3>Storage</h3>
    <p class="text-muted">Older saves can store verbose match-by-match commentary. Compacting strips that and keeps only the slim record (scorers, cards, stats). Match reports stay viewable — commentary is regenerated on the fly.</p>
    <div class="flex gap-8 flex-wrap">
      <button class="btn" onclick="(async()=>{ const n = await compactSaveNow(); refreshAll(); showToast('Compacted ' + n + ' historic match records', n ? 'success' : 'warning'); })()">⚙ Compact save now</button>
      <button class="btn" onclick="alert('Approximate save size: ' + Math.round((JSON.stringify(state).length || 0) / 1024) + ' KB. CRUFY now uses IndexedDB which typically allows hundreds of MB.')">📊 Save size</button>
    </div>
  </div>`;

  // Engine settings
  html += `<div class="card mb-16"><h3>Engine settings</h3>
    <div class="form-row-3">
      ${formGroup('Yellows for ban', `<input type="number" id="set-yellows" value="${state.settings.yellowsForBan}" min="3" max="20">`)}
      ${formGroup('Red-card ban (low)', `<input type="number" id="set-red-low" value="${state.settings.redCardBanRange[0]}" min="1" max="10">`)}
      ${formGroup('Red-card ban (high)', `<input type="number" id="set-red-high" value="${state.settings.redCardBanRange[1]}" min="1" max="20">`)}
    </div>
    <div class="form-row">
      ${formGroup('Min injury length (matches)', `<input type="number" id="set-inj-low" value="${state.settings.injuryRange[0]}" min="1" max="10">`)}
      ${formGroup('Max injury length (matches)', `<input type="number" id="set-inj-high" value="${state.settings.injuryRange[1]}" min="2" max="60">`)}
    </div>
    <button class="btn btn-primary" onclick="saveEngineSettings()">Save engine settings</button>
  </div>`;

  // Name banks
  html += `<div class="card"><h3>Name banks <button class="btn btn-sm" onclick="openNameBankModal()">+ Add bank</button></h3>
    <p class="text-muted">Each bank has first-name and last-name lists. Add new banks to support more nationalities, or edit existing ones.</p>
    <table class="data-table"><thead><tr><th>Bank</th><th class="num-c">First names</th><th class="num-c">Last names</th><th class="actions-cell"></th></tr></thead><tbody>`;
  for (const k of Object.keys(state.nameBanks)) {
    const b = state.nameBanks[k];
    html += `<tr><td><strong>${esc(k)}</strong></td><td class="num-c">${b.firstNames.length}</td><td class="num-c">${b.lastNames.length}</td><td class="actions-cell"><button class="btn btn-sm" onclick="openNameBankModal('${esc(k)}')">Edit</button>${k !== state.settings.defaultNameBank ? `<button class="btn btn-sm btn-danger" onclick="deleteNameBank('${esc(k)}')">✕</button>` : ''}</td></tr>`;
  }
  html += `</tbody></table></div>`;

  root.innerHTML = html;
}

function saveNationSettings() {
  state.settings.nation.name = document.getElementById('set-nation-name').value.trim();
  state.settings.nation.demonym = document.getElementById('set-demonym').value.trim();
  state.settings.nation.faName = document.getElementById('set-fa').value.trim();
  state.settings.nation.flagUrl = document.getElementById('set-flag').value.trim();
  state.settings.defaultNameBank = document.getElementById('set-default-bank').value;
  saveState(); refreshAll();
  showToast('Nation identity saved', 'success');
}

function retagAllPlayersToNation() {
  const nat = state.settings.nation.name;
  if (!nat) { showToast('Set your nation name first', 'warning'); return; }
  const domesticLeagueIds = new Set(state.leagues.map(l => l.id));
  let retaggedPlayers = 0, retaggedClubs = 0;
  for (const c of state.clubs) {
    if (domesticLeagueIds.has(c.leagueId) && c.nationality !== nat) {
      c.nationality = nat;
      retaggedClubs++;
    }
  }
  for (const p of state.players) {
    if (p.isRetired) continue;
    const c = p.clubId ? getClub(p.clubId) : null;
    if (c && domesticLeagueIds.has(c.leagueId) && p.nationality !== nat) {
      p.nationality = nat;
      retaggedPlayers++;
    }
  }
  saveState(); refreshAll();
  showToast(`Re-tagged ${retaggedPlayers} players + ${retaggedClubs} clubs to "${nat}"`, 'success');
}
function saveEngineSettings() {
  state.settings.yellowsForBan = clamp(parseInt(document.getElementById('set-yellows').value) || 5, 1, 30);
  state.settings.redCardBanRange = [
    clamp(parseInt(document.getElementById('set-red-low').value) || 1, 1, 30),
    clamp(parseInt(document.getElementById('set-red-high').value) || 3, 1, 30),
  ];
  state.settings.injuryRange = [
    clamp(parseInt(document.getElementById('set-inj-low').value) || 1, 1, 60),
    clamp(parseInt(document.getElementById('set-inj-high').value) || 20, 1, 80),
  ];
  saveState();
  showToast('Engine settings saved', 'success');
}

function deleteNameBank(name) {
  if (!confirm(`Delete the "${name}" name bank? Players/clubs already using it stay tagged but may break on regeneration.`)) return;
  delete state.nameBanks[name];
  saveState(); refreshAll();
}

/* ===========================================================================
 * IMPORT / EXPORT
 * ========================================================================= */
function renderImportExport() {
  const root = document.getElementById('ie-content');
  if (!root) return;
  let html = `<div class="ie-card"><h3>Save backups</h3><p>Your save lives in the browser's localStorage. Export a JSON copy as a backup, or import to restore.</p>
    <div class="flex gap-8">
      <button class="btn btn-primary" onclick="exportSave()">⤓ Export save</button>
      <button class="btn" onclick="document.getElementById('file-input').click()">⤒ Import save</button>
      <button class="btn btn-danger" onclick="resetSave()">⌫ Wipe save</button>
    </div>
  </div>`;

  html += `<div class="ie-card"><h3>BBCode generators</h3><p>One-click copy of forum-ready BBCode for tables and reports.</p>
    <div class="flex gap-8 flex-wrap mb-16">
      ${state.leagues.map(l => `<button class="btn btn-sm" onclick="copyToClipboard(bbcodeLeagueTable('${l.id}'))">📋 ${esc(l.name)} table</button>`).join('')}
      ${state.leagues.map(l => `<button class="btn btn-sm" onclick="copyToClipboard(bbcodeTopScorers('${l.id}'))">📋 ${esc(l.name)} scorers</button>`).join('')}
      ${state.cups.map(c => `<button class="btn btn-sm" onclick="copyToClipboard(bbcodeCupBracket('${c.id}'))">📋 ${esc(c.name)} bracket</button>`).join('')}
      <button class="btn btn-sm" onclick="copyToClipboard(bbcodeNewsFeed())">📋 News digest</button>
      ${state.settings.nation.name ? `<button class="btn btn-sm" onclick="copyToClipboard(bbcodeNTSquad())">📋 NT squad</button>` : ''}
    </div>
    <h4>Preview</h4>
    <textarea id="bbcode-preview" class="bbcode-out" placeholder="Click any button above and the BBCode appears in your clipboard. Use the preview below to inspect it." readonly></textarea>
    <div class="flex gap-8 mt-8">
      ${state.leagues.length ? `<button class="btn btn-sm" onclick="document.getElementById('bbcode-preview').value = bbcodeLeagueTable('${state.leagues[0].id}')">Preview ${esc(state.leagues[0].name)} table</button>` : ''}
    </div>
  </div>`;
  root.innerHTML = html;
}
