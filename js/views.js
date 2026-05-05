/* ===========================================================================
 * CRUFYmanager — views.js
 *   Page renderers. Each render*(...) function writes into its tab panel.
 *   Modal CRUD forms live in forms.js.
 * ========================================================================= */

/* ===========================================================================
 * DASHBOARD
 * ========================================================================= */
function renderDashboard() {
  const stats = document.getElementById('dashboard-stats');
  const body = document.getElementById('dashboard-content');
  if (!stats || !body) return;

  const activePlayers = state.players.filter(p => !p.isRetired).length;
  const activeManagers = state.managers.filter(m => !m.isUnemployed).length;
  const draftCount = (state.draftMatches || []).length;
  const matchesPlayed = state.history.filter(e => e.type === 'match_committed' && !e.struck).length;

  stats.innerHTML = `
    <div class="stat-card"><div class="stat-value">${state.settings.season}</div><div class="stat-label">Season</div></div>
    <div class="stat-card"><div class="stat-value">${state.clubs.length}</div><div class="stat-label">Clubs</div></div>
    <div class="stat-card"><div class="stat-value">${activePlayers}</div><div class="stat-label">Active players</div><div class="stat-sub">${state.players.length - activePlayers} retired</div></div>
    <div class="stat-card"><div class="stat-value">${activeManagers}</div><div class="stat-label">Employed managers</div><div class="stat-sub">${state.managers.length - activeManagers} unemployed</div></div>
    <div class="stat-card"><div class="stat-value">${matchesPlayed}</div><div class="stat-label">Matches played</div></div>
    <div class="stat-card"><div class="stat-value ${draftCount ? 'text-warn' : ''}">${draftCount}</div><div class="stat-label">Draft matches</div><div class="stat-sub">awaiting commit</div></div>
  `;

  if (!state.clubs.length) {
    body.innerHTML = emptyState({
      icon: '⬡',
      title: 'Welcome to CRUFYmanager',
      body: 'You have no nation set up yet. Head to Settings to name your nation, then create some leagues, cups, clubs and players.',
      cta: `<button class="btn btn-primary" onclick="switchTab('settings')">Open Settings</button>`
    });
    return;
  }

  let html = '';
  // League tables
  for (const lg of state.leagues) {
    if (!lg.clubIds.length) continue;
    html += `<h2 style="font-family:var(--font-display);font-size:18px;margin:18px 0 8px">${esc(lg.name)} <span class="text-muted" style="font-size:13px;font-family:var(--font-body);font-weight:400">Tier ${lg.tier} · ${lg.clubIds.length} clubs</span></h2>`;
    html += renderLeagueTableHTML(lg.id);
  }

  // Top scorers across all leagues this season
  const allScorers = [];
  for (const lg of state.leagues) {
    const ts = topScorers(lg.id, state.settings.season, 5);
    ts.forEach(s => allScorers.push({ ...s, leagueId: lg.id }));
  }
  allScorers.sort((a, b) => b.goals - a.goals);
  if (allScorers.length) {
    html += `<h2 style="font-family:var(--font-display);font-size:18px;margin:24px 0 8px">Top scorers this season</h2>`;
    html += `<table class="data-table"><thead><tr><th>#</th><th>Player</th><th>Club</th><th>League</th><th class="num">Goals</th></tr></thead><tbody>`;
    allScorers.slice(0, 10).forEach((row, i) => {
      const p = getPlayer(row.playerId);
      html += `<tr><td class="num">${i + 1}</td><td>${p ? playerLink(p.id) : '?'}</td><td>${p ? clubLink(p.clubId) : '?'}</td><td>${leagueLink(row.leagueId)}</td><td class="num">${row.goals}</td></tr>`;
    });
    html += `</tbody></table>`;
  }

  // News feed
  const news = compileNewsItems(20);
  if (news.length) {
    html += `<h2 style="font-family:var(--font-display);font-size:18px;margin:24px 0 8px">News</h2>`;
    html += `<div class="news-list">`;
    for (const n of news) {
      const cls = n.severity === 'major' ? 'ni-major' : n.severity === 'warn' ? 'ni-warn' : '';
      html += `<div class="news-item ${cls}"><div class="ni-icon">▸</div><div class="ni-text">${esc(n.text)}</div><div class="ni-time">S${n.season}</div></div>`;
    }
    html += `</div>`;
  }

  body.innerHTML = html;
}

function renderLeagueTableHTML(leagueId) {
  const lg = getLeague(leagueId);
  if (!lg) return '';
  const table = leagueTable(leagueId);
  const promoted = lg.rules?.promoted ?? 0;
  const playoffUp = lg.rules?.playoffPromoted ?? 0;
  const relegated = lg.rules?.relegated ?? 0;
  const playoffDown = lg.rules?.playoffRelegated ?? 0;
  const n = table.length;
  let html = `<table class="league-table">
    <thead><tr><th class="pos">#</th><th>Club</th><th class="num-c">P</th><th class="num-c">W</th><th class="num-c">D</th><th class="num-c">L</th><th class="num-c">GF</th><th class="num-c">GA</th><th class="num-c">GD</th><th class="num-c">Pts</th><th>Form</th></tr></thead><tbody>`;
  table.forEach((r, i) => {
    let posCls = '';
    if (i < promoted) posCls = 'pos-promo';
    else if (i < promoted + playoffUp) posCls = 'pos-playoff';
    else if (i >= n - relegated) posCls = 'pos-relegate';
    else if (i >= n - relegated - playoffDown) posCls = 'pos-playoff';
    const form = r.form.map(f => `<span class="f-${f.toLowerCase()}">${f}</span>`).join('');
    html += `<tr><td class="pos ${posCls}">${i + 1}</td><td>${clubLink(r.clubId)}</td><td class="num-c">${r.p}</td><td class="num-c">${r.w}</td><td class="num-c">${r.d}</td><td class="num-c">${r.l}</td><td class="num-c">${r.gf}</td><td class="num-c">${r.ga}</td><td class="num-c">${r.gd > 0 ? '+' : ''}${r.gd}</td><td class="num-c"><strong>${r.pts}</strong></td><td class="form-cell">${form}</td></tr>`;
  });
  html += `</tbody></table>`;
  if (promoted || relegated || playoffUp || playoffDown) {
    html += `<div class="legend-row">
      ${promoted ? `<span class="legend-item"><span class="legend-marker" style="background:var(--success)"></span>Auto-promotion (top ${promoted})</span>` : ''}
      ${playoffUp ? `<span class="legend-item"><span class="legend-marker" style="background:var(--info)"></span>Promotion playoff (next ${playoffUp})</span>` : ''}
      ${playoffDown ? `<span class="legend-item"><span class="legend-marker" style="background:var(--info)"></span>Relegation playoff (${playoffDown} above drop)</span>` : ''}
      ${relegated ? `<span class="legend-item"><span class="legend-marker" style="background:var(--danger)"></span>Auto-relegation (bottom ${relegated})</span>` : ''}
    </div>`;
  }
  return html;
}

/* ===========================================================================
 * LEAGUES
 * ========================================================================= */
function renderLeagues() {
  const list = document.getElementById('leagues-list');
  const detail = document.getElementById('league-detail');
  if (!list || !detail) return;
  detail.innerHTML = '';
  if (state.ui.detail.type === 'leagues' && state.ui.detail.id) {
    list.innerHTML = '';
    detail.innerHTML = renderLeagueDetailHTML(state.ui.detail.id);
    return;
  }
  if (!state.leagues.length) {
    list.innerHTML = emptyState({ icon: '⊞', title: 'No leagues', body: 'Create one to start a season.', cta: `<button class="btn btn-primary" onclick="openLeagueModal()">+ Add League</button>` });
    return;
  }
  list.innerHTML = `<table class="data-table"><thead><tr><th>League</th><th class="num-c">Tier</th><th class="num-c">Clubs</th><th>Status</th><th class="num-c">Promoted</th><th class="num-c">Relegated</th><th class="actions-cell">Actions</th></tr></thead><tbody>` +
    state.leagues.slice().sort((a, b) => (a.tier || 99) - (b.tier || 99)).map(l =>
      `<tr><td>${leagueLink(l.id)}</td><td class="num-c">${l.tier}</td><td class="num-c">${l.clubIds.length}</td><td>${l.status || 'pending'}</td><td class="num-c">${l.rules?.promoted ?? 0}</td><td class="num-c">${l.rules?.relegated ?? 0}</td><td class="actions-cell"><button class="btn btn-sm" onclick="openLeagueDetail('${l.id}')">View</button><button class="btn btn-sm" onclick="openLeagueModal('${l.id}')">Edit</button><button class="btn btn-sm btn-danger" onclick="deleteLeague('${l.id}')">✕</button></td></tr>`
    ).join('') + `</tbody></table>`;
}

function renderLeagueDetailHTML(id) {
  const lg = getLeague(id);
  if (!lg) return '';
  let html = `<div class="back-link clickable" onclick="clearDetail()">‹ All leagues</div>`;
  html += `<div class="page-header">
    <div><h1>${esc(lg.name)}</h1><div class="subtitle">Tier ${lg.tier} · Season ${lg.season || state.settings.season} · ${lg.status || 'pending'}</div></div>
    <div class="flex gap-8 flex-wrap">
      <button class="btn" onclick="generateLeagueSchedule('${lg.id}'); refreshAll(); showToast('Schedule generated','success')">↻ Regen schedule</button>
      <button class="btn" onclick="copyToClipboard(bbcodeLeagueTable('${lg.id}'))">📋 Copy table BBCode</button>
      <button class="btn" onclick="copyToClipboard(bbcodeTopScorers('${lg.id}'))">📋 Top scorers BBCode</button>
      <button class="btn btn-primary" onclick="openLeagueModal('${lg.id}')">Edit</button>
    </div>
  </div>`;
  html += `<div class="htabs">
    <div class="htab active" data-htab="lg-table">Table</div>
    <div class="htab" data-htab="lg-fixtures">Fixtures</div>
    <div class="htab" data-htab="lg-scorers">Scorers</div>
    <div class="htab" data-htab="lg-history">History</div>
  </div>`;
  html += `<div id="lg-tab-table">${renderLeagueTableHTML(lg.id)}</div>`;
  html += `<div id="lg-tab-fixtures" class="hidden">${renderLeagueFixturesHTML(lg.id)}</div>`;
  html += `<div id="lg-tab-scorers" class="hidden">${renderLeagueScorersHTML(lg.id)}</div>`;
  html += `<div id="lg-tab-history" class="hidden">${renderLeagueHistoryHTML(lg.id)}</div>`;
  // Defer wiring htabs to a microtask so DOM is in place
  queueMicrotask(() => wireHtabs('lg-', ['lg-tab-table','lg-tab-fixtures','lg-tab-scorers','lg-tab-history']));
  return html;
}

function wireHtabs(prefix, panels) {
  document.querySelectorAll(`.htab[data-htab^="${prefix}"]`).forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll(`.htab[data-htab^="${prefix}"]`).forEach(t => t.classList.remove('active'));
      el.classList.add('active');
      const target = el.dataset.htab.replace(prefix, '');
      panels.forEach(p => {
        const node = document.getElementById(p);
        if (node) node.classList.toggle('hidden', !p.endsWith(target) && p !== `${prefix}tab-${target}`);
      });
    });
  });
}

function renderLeagueFixturesHTML(leagueId) {
  const lg = getLeague(leagueId);
  if (!lg) return '';
  if (!lg.schedule || !lg.schedule.length) return `<div class="empty-state"><p>No schedule. Click "Regen schedule" to generate one.</p></div>`;
  let html = '';
  for (const rd of lg.schedule) {
    const allPlayed = rd.fixtures.every(f => f.played);
    html += `<div class="card mb-16"><h3>Matchday ${rd.matchday} ${allPlayed ? '<span class="chip chip-accent">complete</span>' : ''}</h3>`;
    for (const fx of rd.fixtures) {
      const home = getClub(fx.homeId);
      const away = getClub(fx.awayId);
      if (!home || !away) continue;
      // Find committed match for this fixture
      const m = state.history.find(e => e.type === 'match_committed' && e.matchId === fx.matchId);
      const score = m ? `${m.hScore}–${m.aScore}` : 'vs';
      html += `<div class="scoreline ${m ? 'scoreline-committed' : ''}" ${m ? `onclick="viewMatchModal('${m.id}')" style="cursor:pointer"` : ''}>
        <div class="home-team">${esc(home.name)}</div>
        <div class="score">${score}</div>
        <div class="away-team">${esc(away.name)}</div>
      </div>`;
    }
    html += `</div>`;
  }
  return html;
}

function renderLeagueScorersHTML(leagueId) {
  const ts = topScorers(leagueId, state.settings.season, 25);
  if (!ts.length) return `<div class="empty-state"><p>No goals yet this season.</p></div>`;
  let html = `<table class="data-table"><thead><tr><th>#</th><th>Player</th><th>Club</th><th class="num">Goals</th></tr></thead><tbody>`;
  ts.forEach((row, i) => {
    const p = getPlayer(row.playerId);
    html += `<tr><td class="num">${i + 1}</td><td>${p ? playerLink(p.id) : '?'}</td><td>${p ? clubLink(p.clubId) : '?'}</td><td class="num">${row.goals}</td></tr>`;
  });
  html += `</tbody></table>`;
  return html;
}

function renderLeagueHistoryHTML(leagueId) {
  const titles = leagueSeasonHistory(leagueId);
  if (!titles.length) return `<div class="empty-state"><p>No completed seasons yet.</p></div>`;
  let html = `<p class="text-muted" style="font-size:12px">Click a season to expand the final table.</p>`;
  for (const t of titles) {
    const ts = t.topScorer ? `${playerLink(t.topScorer.playerId)} (${t.topScorer.goals})` : '—';
    html += `<details style="margin-bottom:8px;background:var(--bg-raised);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 12px">
      <summary style="cursor:pointer;font-weight:500;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:baseline">
        <span><strong>Season ${t.season}</strong> · 🏆 ${clubLink(t.championId)}</span>
        <span class="text-muted" style="font-size:12px">Top scorer: ${ts}${(t.promoted || []).length ? ` · ↑ ${(t.promoted || []).length}` : ''}${(t.relegated || []).length ? ` · ↓ ${(t.relegated || []).length}` : ''}</span>
      </summary>
      <div style="margin-top:10px">
        ${renderArchivedSeasonTableHTML(t)}
      </div>
    </details>`;
  }
  return html;
}

function renderArchivedSeasonTableHTML(season) {
  if (!season.finalTable || !season.finalTable.length) return '<p class="text-muted">No table snapshot stored.</p>';
  const promoted = season.promoted || [];
  const playoffUp = season.playoffPromoted || [];
  const relegated = season.relegated || [];
  const playoffDown = season.playoffRelegated || [];
  let html = `<table class="league-table"><thead><tr><th class="pos">#</th><th>Club</th><th class="num-c">P</th><th class="num-c">W</th><th class="num-c">D</th><th class="num-c">L</th><th class="num-c">GF</th><th class="num-c">GA</th><th class="num-c">GD</th><th class="num-c">Pts</th></tr></thead><tbody>`;
  season.finalTable.forEach((r, i) => {
    let posCls = '';
    if (promoted.includes(r.clubId) || r.clubId === season.championId) posCls = 'pos-promo';
    else if (playoffUp.includes(r.clubId)) posCls = 'pos-playoff';
    else if (relegated.includes(r.clubId)) posCls = 'pos-relegate';
    else if (playoffDown.includes(r.clubId)) posCls = 'pos-playoff';
    html += `<tr><td class="pos ${posCls}">${i + 1}</td><td>${clubLink(r.clubId)}${r.clubId === season.championId ? ' 🏆' : ''}</td><td class="num-c">${r.p}</td><td class="num-c">${r.w}</td><td class="num-c">${r.d}</td><td class="num-c">${r.l}</td><td class="num-c">${r.gf}</td><td class="num-c">${r.ga}</td><td class="num-c">${(r.gd ?? r.gf - r.ga) > 0 ? '+' : ''}${r.gd ?? r.gf - r.ga}</td><td class="num-c"><strong>${r.pts}</strong></td></tr>`;
  });
  html += `</tbody></table>`;
  return html;
}

function deleteLeague(id) {
  if (!confirm('Delete this league? Clubs will be unassigned but kept.')) return;
  state.leagues = state.leagues.filter(l => l.id !== id);
  state.clubs.forEach(c => { if (c.leagueId === id) c.leagueId = null; });
  saveState(); refreshAll();
}

/* ===========================================================================
 * CUPS
 * ========================================================================= */
function renderCups() {
  const list = document.getElementById('cups-list');
  const detail = document.getElementById('cup-detail');
  if (!list || !detail) return;
  detail.innerHTML = '';
  if (state.ui.detail.type === 'cups' && state.ui.detail.id) {
    list.innerHTML = '';
    detail.innerHTML = renderCupDetailHTML(state.ui.detail.id);
    return;
  }
  if (!state.cups.length) {
    list.innerHTML = emptyState({ icon: '⌖', title: 'No cups', body: 'Create a knockout or group→knockout cup.', cta: `<button class="btn btn-primary" onclick="openCupModal()">+ Add Cup</button>` });
    return;
  }
  list.innerHTML = `<table class="data-table"><thead><tr><th>Cup</th><th>Format</th><th>Status</th><th class="num-c">Entrants</th><th class="actions-cell">Actions</th></tr></thead><tbody>` +
    state.cups.map(c => `<tr><td>${cupLink(c.id)}</td><td>${esc(c.format)}</td><td>${esc(c.status || 'pending')}</td><td class="num-c">${(c.entrantIds || []).length || (c.eligibleLeagueIds || []).flatMap(id => getLeague(id)?.clubIds || []).length}</td><td class="actions-cell"><button class="btn btn-sm" onclick="openCupDetail('${c.id}')">View</button><button class="btn btn-sm" onclick="openCupModal('${c.id}')">Edit</button><button class="btn btn-sm btn-danger" onclick="deleteCup('${c.id}')">✕</button></td></tr>`).join('') + `</tbody></table>`;
}

function renderCupDetailHTML(id) {
  const cp = getCup(id);
  if (!cp) return '';
  let html = `<div class="back-link clickable" onclick="clearDetail()">‹ All cups</div>`;
  html += `<div class="page-header">
    <div><h1>${esc(cp.name)}</h1><div class="subtitle">${esc(cp.format)} · Season ${cp.season || state.settings.season} · ${cp.status || 'pending'}</div></div>
    <div class="flex gap-8 flex-wrap">
      <button class="btn" onclick="generateCupBracket('${cp.id}'); refreshAll(); showToast('Bracket generated','success')">↻ Regen bracket</button>
      <button class="btn" onclick="advanceCup('${cp.id}'); refreshAll()">→ Advance round</button>
      <button class="btn" onclick="copyToClipboard(bbcodeCupBracket('${cp.id}'))">📋 BBCode</button>
      <button class="btn btn-primary" onclick="openCupModal('${cp.id}')">Edit</button>
    </div>
  </div>`;

  if (cp.format === 'group_knockout' && cp.groups && cp.groups.length) {
    html += `<h3 style="margin-bottom:8px">Group stage</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px">`;
    for (const g of cp.groups) {
      const tbl = groupTable(g);
      html += `<div class="card"><h3>${esc(g.name)}</h3><table class="league-table"><thead><tr><th class="pos">#</th><th>Club</th><th class="num-c">P</th><th class="num-c">W</th><th class="num-c">D</th><th class="num-c">L</th><th class="num-c">GD</th><th class="num-c">Pts</th></tr></thead><tbody>`;
      tbl.forEach((r, i) => {
        html += `<tr><td class="pos">${i + 1}</td><td>${clubLink(r.clubId)}</td><td class="num-c">${r.p}</td><td class="num-c">${r.w}</td><td class="num-c">${r.d}</td><td class="num-c">${r.l}</td><td class="num-c">${r.gd}</td><td class="num-c"><strong>${r.pts}</strong></td></tr>`;
      });
      html += `</tbody></table></div>`;
    }
    html += `</div>`;
  }
  if (cp.rounds && cp.rounds.length) {
    html += `<h3 style="margin-top:24px;margin-bottom:8px">Knockout</h3><div class="bracket">`;
    for (const rd of cp.rounds) {
      html += `<div class="bracket-round"><h4>${esc(rd.name)}</h4>`;
      for (const t of rd.ties) {
        const home = clubName(t.homeId);
        const away = t.awayId ? clubName(t.awayId) : '(bye)';
        const m = t.matchId ? state.history.find(e => e.type === 'match_committed' && e.matchId === t.matchId) : null;
        const hScore = m ? m.hScore : (t.played ? '?' : '');
        const aScore = m ? m.aScore : (t.played ? '?' : '');
        const winner = t.winnerId;
        const onClick = m ? `onclick="viewMatchModal('${m.id}')"` : '';
        html += `<div class="bracket-tie" ${onClick}>
          <div class="bt-row ${winner === t.homeId ? 'bt-winner' : (t.played ? 'bt-loser' : '')}"><span>${esc(home)}</span><span class="bt-score">${hScore}</span></div>
          <div class="bt-row ${winner === t.awayId ? 'bt-winner' : (t.played ? 'bt-loser' : '')}"><span>${esc(away)}</span><span class="bt-score">${aScore}</span></div>
        </div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  }
  if (!cp.rounds.length && (!cp.groups || !cp.groups.length)) {
    html += `<div class="empty-state"><p>No bracket yet. Click "Regen bracket" to start.</p></div>`;
  }
  return html;
}

function deleteCup(id) {
  if (!confirm('Delete this cup?')) return;
  state.cups = state.cups.filter(c => c.id !== id);
  saveState(); refreshAll();
}

/* ===========================================================================
 * CLUBS
 * ========================================================================= */
function renderClubs() {
  const list = document.getElementById('clubs-list');
  const detail = document.getElementById('club-detail');
  if (!list || !detail) return;
  detail.innerHTML = '';
  if (state.ui.detail.type === 'clubs' && state.ui.detail.id) {
    list.innerHTML = '';
    detail.innerHTML = renderClubDetailHTML(state.ui.detail.id);
    return;
  }
  const q = (document.getElementById('clubs-search')?.value || '').toLowerCase().trim();
  let clubs = state.clubs.slice();
  if (q) clubs = clubs.filter(c => c.name.toLowerCase().includes(q) || (c.shortName || '').toLowerCase().includes(q));
  if (!clubs.length) {
    list.innerHTML = emptyState({ icon: '⚐', title: state.clubs.length ? 'No clubs match' : 'No clubs', body: state.clubs.length ? 'Adjust the search.' : 'Add one or use bulk-create.', cta: state.clubs.length ? '' : `<button class="btn btn-primary" onclick="openClubModal()">+ Add Club</button>` });
    return;
  }
  list.innerHTML = `<table class="data-table"><thead><tr><th>Club</th><th>League</th><th>Manager</th><th>Captain</th><th class="num-c">Squad</th><th class="num-c">Stadium cap.</th><th class="actions-cell">Actions</th></tr></thead><tbody>` +
    clubs.map(c => `<tr>
      <td><span class="dot" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${esc(c.kitPrimary || '#888')};margin-right:6px;vertical-align:middle"></span>${clubLink(c.id)}</td>
      <td>${leagueLink(c.leagueId) || '—'}</td>
      <td>${managerLink(c.managerId)}</td>
      <td>${playerLink(c.captainId)}</td>
      <td class="num-c">${playersByClub(c.id).filter(p => !p.isRetired).length}</td>
      <td class="num-c">${(c.stadiumCapacity || 0).toLocaleString()}</td>
      <td class="actions-cell"><button class="btn btn-sm" onclick="openClubDetail('${c.id}')">View</button><button class="btn btn-sm" onclick="openClubModal('${c.id}')">Edit</button><button class="btn btn-sm btn-danger" onclick="deleteClub('${c.id}')">✕</button></td>
    </tr>`).join('') + `</tbody></table>`;
}

function renderClubDetailHTML(id) {
  const c = getClub(id);
  if (!c) return '';
  const squad = playersByClub(id).filter(p => !p.isRetired).sort((a, b) => (a.shirtNumber || 99) - (b.shirtNumber || 99));
  const honours = clubHonours(id);
  let html = `<div class="back-link clickable" onclick="clearDetail()">‹ All clubs</div>`;
  html += `<div class="page-header">
    <div><h1><span style="display:inline-block;width:18px;height:18px;border-radius:4px;background:${esc(c.kitPrimary || '#888')};margin-right:8px;vertical-align:middle"></span>${esc(c.name)}</h1>
    <div class="subtitle">${leagueLink(c.leagueId) || 'Unattached'} · ${esc(c.stadiumName || '?')} (cap. ${(c.stadiumCapacity||0).toLocaleString()})</div></div>
    <div class="flex gap-8"><button class="btn btn-primary" onclick="openClubModal('${c.id}')">Edit</button></div>
  </div>`;
  html += `<div class="two-col">
    <div>
      <div class="card mb-16"><h3>Squad <span class="text-muted" style="font-size:13px;font-weight:400">${squad.length} players</span></h3>
        <div class="squad-row" style="border-bottom:2px solid var(--border);font-weight:600;color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:0.04em">
          <div class="sr-num">#</div><div class="sr-pos">Pos</div><div class="sr-name">Name</div><div class="sr-age">Age</div><div class="sr-nat">Nat.</div><div class="sr-status">Status</div><div class="sr-status">Apps · Goals</div>
        </div>
        ${squad.map(p => `<div class="squad-row">
          <div class="sr-num">${p.shirtNumber ?? '-'}</div>
          <div class="sr-pos">${positionBadge(p.position)}</div>
          <div class="sr-name" onclick="openPlayerDetail('${p.id}')">${esc(p.name)}${c.captainId === p.id ? ' <span class="chip chip-accent" style="font-size:10px">C</span>' : c.viceCaptainId === p.id ? ' <span class="chip" style="font-size:10px">VC</span>' : ''}</div>
          <div class="sr-age">${p.age}</div>
          <div class="sr-nat">${esc((p.nationality || '').replace('Generic ',''))}</div>
          <div class="sr-status">${statusBadge(p)}</div>
          <div class="sr-status">${p.seasonStats?.apps ?? 0} · ${p.seasonStats?.goals ?? 0}</div>
        </div>`).join('')}
        ${!squad.length ? '<div class="empty-state"><p>No players in this squad. Use the bulk-create option in Clubs view to populate.</p></div>' : ''}
      </div>
      <div class="card mb-16"><h3>Season-by-season</h3>${renderClubSeasonHistoryHTML(id)}</div>
      <div class="card"><h3>Head-to-head <span class="text-muted" style="font-size:12px;font-weight:400">all-time, sorted by wins</span></h3>${renderClubHeadToHeadHTML(id)}</div>
    </div>
    <div>
      <div class="card mb-16"><h3>Identity</h3>
        <div class="kv-row"><div class="kv-l">Manager</div><div class="kv-v">${managerLink(c.managerId)}</div></div>
        <div class="kv-row"><div class="kv-l">Captain</div><div class="kv-v">${playerLink(c.captainId)}</div></div>
        <div class="kv-row"><div class="kv-l">Vice-captain</div><div class="kv-v">${playerLink(c.viceCaptainId)}</div></div>
        <div class="kv-row"><div class="kv-l">Founded</div><div class="kv-v">Season ${c.foundedSeason ?? '?'}</div></div>
        <div class="kv-row"><div class="kv-l">Reputation</div><div class="kv-v">${c.reputation ?? '?'}</div></div>
        <div class="kv-row"><div class="kv-l">Kit</div><div class="kv-v"><span style="display:inline-block;width:18px;height:18px;border-radius:4px;background:${esc(c.kitPrimary)};vertical-align:middle"></span> <span style="display:inline-block;width:18px;height:18px;border-radius:4px;background:${esc(c.kitSecondary)};vertical-align:middle;margin-left:4px"></span></div></div>
      </div>
      <div class="card mb-16"><h3>Tactics</h3>
        <div class="kv-row"><div class="kv-l">Formation</div><div class="kv-v"><strong>${esc(c.formation)}</strong></div></div>
        <div class="kv-row"><div class="kv-l">Mentality</div><div class="kv-v">${c.tactics?.mentality ?? 50}</div></div>
        <div class="kv-row"><div class="kv-l">Tempo</div><div class="kv-v">${c.tactics?.tempo ?? 50}</div></div>
        <div class="kv-row"><div class="kv-l">Pressing</div><div class="kv-v">${c.tactics?.pressing ?? 50}</div></div>
      </div>
      <div class="card"><h3>Honours</h3>
        ${honours.leagueTitles.length ? `<h4>League titles (${honours.leagueTitles.length})</h4><ul style="font-size:13px;padding-left:18px;color:var(--text-dim)">${honours.leagueTitles.map(t => `<li>S${t.season} — ${esc(getLeague(t.leagueId)?.name || '?')}</li>`).join('')}</ul>` : ''}
        ${honours.cups.length ? `<h4>Cups (${honours.cups.length})</h4><ul style="font-size:13px;padding-left:18px;color:var(--text-dim)">${honours.cups.map(t => `<li>S${t.season} — ${esc(getCup(t.cupId)?.name || '?')}</li>`).join('')}</ul>` : ''}
        ${honours.promotions.length ? `<h4>Promotions</h4><ul style="font-size:13px;padding-left:18px;color:var(--text-dim)">${honours.promotions.map(t => `<li>S${t.season}</li>`).join('')}</ul>` : ''}
        ${honours.relegations.length ? `<h4>Relegations</h4><ul style="font-size:13px;padding-left:18px;color:var(--text-danger)">${honours.relegations.map(t => `<li>S${t.season}</li>`).join('')}</ul>` : ''}
        ${(!honours.leagueTitles.length && !honours.cups.length && !honours.promotions.length && !honours.relegations.length) ? '<p class="text-muted" style="font-size:12px">No honours recorded yet.</p>' : ''}
      </div>
    </div>
  </div>`;
  return html;
}

function renderClubHeadToHeadHTML(clubId) {
  const opponents = new Set();
  for (const e of state.history) {
    if (e.type !== 'match_committed' || e.struck) continue;
    if (e.homeId === clubId) opponents.add(e.awayId);
    else if (e.awayId === clubId) opponents.add(e.homeId);
  }
  if (!opponents.size) return '<p class="text-muted" style="font-size:12px">No matches played yet.</p>';
  const rows = Array.from(opponents).map(oid => {
    const h2h = clubHeadToHead(clubId, oid);
    return { oid, ...h2h };
  });
  rows.sort((a, b) => b.w - a.w || b.gf - b.ga - (a.gf - a.ga) || a.p - b.p);
  let html = `<table class="data-table"><thead><tr><th>Opponent</th><th class="num-c">P</th><th class="num-c">W</th><th class="num-c">D</th><th class="num-c">L</th><th class="num-c">GF</th><th class="num-c">GA</th><th class="num-c"></th></tr></thead><tbody>`;
  for (const r of rows) {
    const ratio = r.p ? Math.round(r.w / r.p * 100) : 0;
    html += `<tr><td>${clubLink(r.oid)}</td><td class="num-c">${r.p}</td><td class="num-c text-success">${r.w}</td><td class="num-c text-muted">${r.d}</td><td class="num-c text-danger">${r.l}</td><td class="num-c">${r.gf}</td><td class="num-c">${r.ga}</td><td class="num-c"><span class="text-muted" style="font-size:11px">${ratio}%</span></td></tr>`;
  }
  html += `</tbody></table>`;
  return html;
}

function renderClubSeasonHistoryHTML(clubId) {
  const seasons = {};
  for (const e of state.history.filter(x => x.type === 'season_ended' && !x.struck)) {
    const row = (e.finalTable || []).find(r => r.clubId === clubId);
    if (!row) continue;
    seasons[e.season] = { season: e.season, league: e.leagueId, position: (e.finalTable.findIndex(r => r.clubId === clubId) + 1), w: row.w, d: row.d, l: row.l, gf: row.gf, ga: row.ga, pts: row.pts, championId: e.championId };
  }
  const arr = Object.values(seasons).sort((a, b) => b.season - a.season);
  if (!arr.length) return '<p class="text-muted" style="font-size:12px">No completed seasons yet.</p>';
  let html = `<table class="data-table"><thead><tr><th class="num-c">Season</th><th>League</th><th class="num-c">Pos</th><th class="num-c">W-D-L</th><th class="num-c">GF/GA</th><th class="num-c">Pts</th></tr></thead><tbody>`;
  for (const s of arr) {
    html += `<tr><td class="num-c">${s.season}</td><td>${leagueLink(s.league)}</td><td class="num-c"><strong>${s.position}</strong>${s.championId === clubId ? ' 🏆' : ''}</td><td class="num-c">${s.w}-${s.d}-${s.l}</td><td class="num-c">${s.gf}/${s.ga}</td><td class="num-c">${s.pts}</td></tr>`;
  }
  html += `</tbody></table>`;
  return html;
}

function deleteClub(id) {
  if (!confirm('Delete this club? Players will be released.')) return;
  state.clubs = state.clubs.filter(c => c.id !== id);
  state.players.forEach(p => { if (p.clubId === id) p.clubId = null; });
  state.leagues.forEach(l => { l.clubIds = l.clubIds.filter(cid => cid !== id); });
  saveState(); refreshAll();
}

/* ===========================================================================
 * PLAYERS
 * ========================================================================= */
function renderPlayers() {
  const list = document.getElementById('players-list');
  const detail = document.getElementById('player-detail');
  if (!list || !detail) return;
  detail.innerHTML = '';
  if (state.ui.detail.type === 'players' && state.ui.detail.id) {
    list.innerHTML = '';
    detail.innerHTML = renderPlayerDetailHTML(state.ui.detail.id);
    return;
  }
  const q = (document.getElementById('players-search')?.value || '').toLowerCase().trim();
  let players = state.players.filter(p => !p.isRetired);
  if (q) players = players.filter(p => p.name.toLowerCase().includes(q) || clubName(p.clubId).toLowerCase().includes(q));
  if (!players.length) {
    list.innerHTML = emptyState({ icon: '☖', title: state.players.length ? 'No matches' : 'No players', body: state.players.length ? 'Adjust the search.' : 'Players are usually created via club bulk-create.' });
    return;
  }
  players.sort((a, b) => b.attrs.shooting + b.attrs.defending + b.attrs.passing - (a.attrs.shooting + a.attrs.defending + a.attrs.passing));
  list.innerHTML = `<table class="data-table"><thead><tr><th>#</th><th>Pos</th><th>Player</th><th>Club</th><th class="num-c">Age</th><th class="num-c">Apps</th><th class="num-c">G</th><th class="num-c">A</th><th>Status</th><th class="actions-cell"></th></tr></thead><tbody>` +
    players.slice(0, 500).map(p => `<tr>
      <td class="num">${p.shirtNumber ?? '-'}</td>
      <td>${positionBadge(p.position)}</td>
      <td>${playerLink(p.id)}</td>
      <td>${clubLink(p.clubId)}</td>
      <td class="num-c">${p.age}</td>
      <td class="num-c">${p.seasonStats?.apps ?? 0}</td>
      <td class="num-c">${p.seasonStats?.goals ?? 0}</td>
      <td class="num-c">${p.seasonStats?.assists ?? 0}</td>
      <td>${statusBadge(p)}</td>
      <td class="actions-cell"><button class="btn btn-sm" onclick="openPlayerModal('${p.id}')">Edit</button><button class="btn btn-sm btn-danger" onclick="deletePlayer('${p.id}')">✕</button></td>
    </tr>`).join('') + `</tbody></table>` +
    (players.length > 500 ? `<p class="text-muted" style="margin-top:8px">Showing first 500. Use search to filter.</p>` : '');
}

function renderPlayerDetailHTML(id) {
  const p = getPlayer(id);
  if (!p) return '';
  const career = playerCareerStats(id);
  const honours = playerHonours(id);
  const club = getClub(p.clubId);
  let html = `<div class="back-link clickable" onclick="clearDetail()">‹ All players</div>`;
  html += `<div class="page-header">
    <div><h1>${esc(p.name)} ${positionBadge(p.position)}</h1>
    <div class="subtitle">${esc(p.role)} · ${esc((p.nationality || '').replace('Generic ',''))} · age ${p.age}${p.isRetired ? ' · retired' : ''} · ${club ? clubLink(club.id) : 'free agent'}</div></div>
    <div class="flex gap-8">
      ${!p.isRetired ? `<button class="btn" onclick="openTransferModal('${p.id}')">⇄ Transfer</button>` : ''}
      <button class="btn btn-primary" onclick="openPlayerModal('${p.id}')">Edit</button>
    </div>
  </div>`;
  html += `<div class="two-col">
    <div>
      <div class="card mb-16"><h3>Attributes</h3>
        ${attrBar('Pace', p.attrs.pace)}
        ${attrBar('Strength', p.attrs.strength)}
        ${attrBar('Technique', p.attrs.technique)}
        ${attrBar('Passing', p.attrs.passing)}
        ${attrBar('Defending', p.attrs.defending)}
        ${attrBar('Shooting', p.attrs.shooting)}
        ${attrBar('Mental', p.attrs.mental)}
        ${attrBar('Goalkeeping', p.attrs.goalkeeping)}
        <h4 style="margin-top:14px">Hidden</h4>
        ${attrBar('Potential', p.potential)}
        ${attrBar('Injury proneness', p.injuryProneness)}
      </div>
      <div class="card mb-16"><h3>Career by season</h3>${renderPlayerCareerHTML(id, career)}</div>
      <div class="card mb-16"><h3>Match log <span class="text-muted" style="font-size:12px;font-weight:400">most recent first</span></h3>${renderPlayerMatchLogHTML(id)}</div>
      <div class="card"><h3>Transfers</h3>${renderPlayerTransfersHTML(id)}</div>
    </div>
    <div>
      <div class="card mb-16"><h3>Status</h3>
        <div class="kv-row"><div class="kv-l">Apps (S${state.settings.season})</div><div class="kv-v">${p.seasonStats?.apps ?? 0}</div></div>
        <div class="kv-row"><div class="kv-l">Goals (S${state.settings.season})</div><div class="kv-v">${p.seasonStats?.goals ?? 0}</div></div>
        <div class="kv-row"><div class="kv-l">Assists (S${state.settings.season})</div><div class="kv-v">${p.seasonStats?.assists ?? 0}</div></div>
        <div class="kv-row"><div class="kv-l">Yellows (S${state.settings.season})</div><div class="kv-v">${p.status?.yellowsThisSeason ?? 0}</div></div>
        <div class="kv-row"><div class="kv-l">Suspended for</div><div class="kv-v">${p.status?.suspendedFor || 0} match(es)</div></div>
        <div class="kv-row"><div class="kv-l">Injured for</div><div class="kv-v">${p.status?.injuredUntil || 0} match(es)</div></div>
      </div>
      <div class="card mb-16"><h3>Career totals</h3>
        <div class="kv-row"><div class="kv-l">Apps</div><div class="kv-v"><strong>${career.apps}</strong></div></div>
        <div class="kv-row"><div class="kv-l">Minutes</div><div class="kv-v">${career.mins}</div></div>
        <div class="kv-row"><div class="kv-l">Goals</div><div class="kv-v"><strong>${career.goals}</strong></div></div>
        <div class="kv-row"><div class="kv-l">Assists</div><div class="kv-v"><strong>${career.assists}</strong></div></div>
        <div class="kv-row"><div class="kv-l">Yellows</div><div class="kv-v">${career.yellows}</div></div>
        <div class="kv-row"><div class="kv-l">Reds</div><div class="kv-v">${career.reds}</div></div>
      </div>
      <div class="card"><h3>Honours</h3>
        ${honours.leagueTitles.length ? `<h4>League titles</h4><ul style="font-size:13px;padding-left:18px;color:var(--text-dim)">${honours.leagueTitles.map(t => `<li>S${t.season} — ${esc(getLeague(t.leagueId)?.name || '?')} (${t.apps} apps)</li>`).join('')}</ul>` : ''}
        ${honours.cups.length ? `<h4>Cups</h4><ul style="font-size:13px;padding-left:18px;color:var(--text-dim)">${honours.cups.map(t => `<li>S${t.season} — ${esc(getCup(t.cupId)?.name || '?')} (${t.apps} apps)</li>`).join('')}</ul>` : ''}
        ${honours.topScorer.length ? `<h4>Top scorer awards</h4><ul style="font-size:13px;padding-left:18px;color:var(--text-dim)">${honours.topScorer.map(t => `<li>S${t.season} — ${esc(getLeague(t.leagueId)?.name || '?')} (${t.goals} goals)</li>`).join('')}</ul>` : ''}
        ${(!honours.leagueTitles.length && !honours.cups.length && !honours.topScorer.length) ? '<p class="text-muted" style="font-size:12px">No honours yet.</p>' : ''}
      </div>
    </div>
  </div>`;
  return html;
}

function renderPlayerCareerHTML(playerId, career) {
  const seasons = Object.entries(career.bySeason || {}).sort((a, b) => Number(b[0]) - Number(a[0]));
  if (!seasons.length) return '<p class="text-muted" style="font-size:12px">No competitive history yet.</p>';
  let html = `<table class="data-table"><thead><tr><th class="num-c">Season</th><th>Club</th><th class="num-c">Apps</th><th class="num-c">Mins</th><th class="num-c">G</th><th class="num-c">A</th><th class="num-c">Y/R</th></tr></thead><tbody>`;
  for (const [season, s] of seasons) {
    html += `<tr><td class="num-c">${season}</td><td>${clubLink(s.clubId)}</td><td class="num-c">${s.apps}</td><td class="num-c">${s.mins}</td><td class="num-c">${s.goals}</td><td class="num-c">${s.assists}</td><td class="num-c">${s.yellows}/${s.reds}</td></tr>`;
  }
  html += `</tbody></table>`;
  return html;
}

function renderPlayerMatchLogHTML(playerId) {
  const log = playerMatchLog(playerId);
  if (!log.length) return '<p class="text-muted" style="font-size:12px">No appearances yet.</p>';
  let html = `<table class="data-table"><thead><tr><th class="num-c">S</th><th>Comp.</th><th>Match</th><th class="num-c">Mins</th><th class="num-c">G</th><th class="num-c">A</th><th class="num-c">Y/R</th></tr></thead><tbody>`;
  for (const r of log.slice(0, 200)) {
    const home = clubName(r.homeId);
    const away = clubName(r.awayId);
    const ourGoals = r.ourSide === 'home' ? r.hScore : r.aScore;
    const oppGoals = r.ourSide === 'home' ? r.aScore : r.hScore;
    const resCls = ourGoals > oppGoals ? 'text-success' : ourGoals < oppGoals ? 'text-danger' : 'text-muted';
    const comp = r.leagueId ? `${esc(getLeague(r.leagueId)?.name || '?').slice(0, 12)}${r.matchday ? ` MD${r.matchday}` : ''}` : (r.cupId ? esc(getCup(r.cupId)?.name || '?').slice(0, 16) : '—');
    html += `<tr onclick="viewMatchModal('${r.matchId}')" style="cursor:pointer"><td class="num-c">${r.season}</td><td>${comp}</td><td><span class="${resCls}">${esc(home)} ${r.hScore}–${r.aScore} ${esc(away)}</span></td><td class="num-c">${r.mins}</td><td class="num-c">${r.goals || '—'}</td><td class="num-c">${r.assists || '—'}</td><td class="num-c">${r.yellows || '—'}/${r.reds || '—'}</td></tr>`;
  }
  html += `</tbody></table>`;
  if (log.length > 200) html += `<p class="text-muted" style="margin-top:6px;font-size:11px">Showing 200 of ${log.length} matches.</p>`;
  return html;
}

function renderPlayerTransfersHTML(playerId) {
  const transfers = state.history.filter(e => e.type === 'player_signed' && !e.struck && e.playerId === playerId).sort((a, b) => b.ts - a.ts);
  if (!transfers.length) return '<p class="text-muted" style="font-size:12px">No transfers logged.</p>';
  let html = `<table class="data-table"><thead><tr><th class="num-c">Season</th><th>From</th><th>To</th><th class="num-c">Fee</th></tr></thead><tbody>`;
  for (const t of transfers) {
    const fee = t.freeTransfer ? '<span class="text-muted">free</span>' : (t.fee ? t.fee.toLocaleString() : '—');
    html += `<tr><td class="num-c">${t.season}</td><td>${t.fromClubId ? clubLink(t.fromClubId) : '<span class="text-muted">debut</span>'}</td><td>${t.toClubId ? clubLink(t.toClubId) : '<span class="text-muted">released</span>'}</td><td class="num-c">${fee}</td></tr>`;
  }
  html += `</tbody></table>`;
  return html;
}

function deletePlayer(id) {
  if (!confirm('Delete this player permanently?')) return;
  state.players = state.players.filter(p => p.id !== id);
  state.clubs.forEach(c => {
    if (c.captainId === id) c.captainId = null;
    if (c.viceCaptainId === id) c.viceCaptainId = null;
  });
  saveState(); refreshAll();
}

/* ===========================================================================
 * MANAGERS
 * ========================================================================= */
function renderManagers() {
  const list = document.getElementById('managers-list');
  const detail = document.getElementById('manager-detail');
  if (!list || !detail) return;
  detail.innerHTML = '';
  if (state.ui.detail.type === 'managers' && state.ui.detail.id) {
    list.innerHTML = '';
    detail.innerHTML = renderManagerDetailHTML(state.ui.detail.id);
    return;
  }
  const q = (document.getElementById('managers-search')?.value || '').toLowerCase().trim();
  let mgrs = state.managers.slice();
  if (q) mgrs = mgrs.filter(m => `${m.firstName} ${m.lastName}`.toLowerCase().includes(q));
  if (!mgrs.length) {
    list.innerHTML = emptyState({ icon: '▣', title: state.managers.length ? 'No matches' : 'No managers', body: 'Add one or wait for retired players to enter management.', cta: state.managers.length ? '' : `<button class="btn btn-primary" onclick="openManagerModal()">+ Add Manager</button>` });
    return;
  }
  list.innerHTML = `<table class="data-table"><thead><tr><th>Manager</th><th>Club</th><th class="num-c">Tac</th><th class="num-c">M-Mgmt</th><th class="num-c">Youth</th><th class="num-c">Rep</th><th>Status</th><th class="actions-cell"></th></tr></thead><tbody>` +
    mgrs.map(m => `<tr>
      <td>${managerLink(m.id)}</td>
      <td>${clubLink(m.clubId)}</td>
      <td class="num-c">${m.attrs.tactical}</td>
      <td class="num-c">${m.attrs.manManagement}</td>
      <td class="num-c">${m.attrs.youthDev}</td>
      <td class="num-c"><strong>${m.attrs.reputation}</strong></td>
      <td>${m.isUnemployed ? '<span class="chip">unemployed</span>' : '<span class="chip chip-accent">employed</span>'}${m.formerPlayerId ? ' <span class="chip" style="font-size:10px">ex-pro</span>' : ''}</td>
      <td class="actions-cell"><button class="btn btn-sm" onclick="openManagerModal('${m.id}')">Edit</button><button class="btn btn-sm btn-danger" onclick="deleteManager('${m.id}')">✕</button></td>
    </tr>`).join('') + `</tbody></table>`;
}

function renderManagerDetailHTML(id) {
  const m = getManager(id);
  if (!m) return '';
  const formerPlayer = m.formerPlayerId ? getPlayer(m.formerPlayerId) : null;
  let html = `<div class="back-link clickable" onclick="clearDetail()">‹ All managers</div>`;
  html += `<div class="page-header">
    <div><h1>${esc(m.firstName)} ${esc(m.lastName)}</h1>
    <div class="subtitle">${esc((m.nationality || '').replace('Generic ',''))} · ${m.isUnemployed ? 'unemployed' : `at ${clubName(m.clubId)}`}${formerPlayer ? ` · former player (${formerPlayer.position})` : ''}</div></div>
    <div class="flex gap-8"><button class="btn btn-primary" onclick="openManagerModal('${m.id}')">Edit</button></div>
  </div>`;
  html += `<div class="two-col">
    <div>
      <div class="card"><h3>Attributes</h3>
        ${attrBar('Tactical', m.attrs.tactical)}
        ${attrBar('Man-management', m.attrs.manManagement)}
        ${attrBar('Youth development', m.attrs.youthDev)}
        ${attrBar('Reputation', m.attrs.reputation)}
      </div>
    </div>
    <div>
      <div class="card"><h3>History</h3>${renderManagerHistoryHTML(id)}</div>
    </div>
  </div>`;
  return html;
}

function renderManagerHistoryHTML(managerId) {
  const ev = historyForManager(managerId).slice().sort((a, b) => b.ts - a.ts);
  if (!ev.length) return '<p class="text-muted" style="font-size:12px">No events recorded.</p>';
  return `<div class="news-list">${ev.map(e => {
    let txt;
    if (e.type === 'manager_hired') txt = `S${e.season}: appointed by ${clubName(e.clubId)}`;
    else if (e.type === 'manager_sacked') txt = `S${e.season}: dismissed by ${clubName(e.clubId)}${e.reason ? ` (${e.reason})` : ''}`;
    else if (e.type === 'player_to_manager') txt = `S${e.season}: entered management`;
    return `<div class="news-item"><div class="ni-icon">▸</div><div class="ni-text">${esc(txt)}</div><div class="ni-time">S${e.season}</div></div>`;
  }).join('')}</div>`;
}

function deleteManager(id) {
  if (!confirm('Delete this manager?')) return;
  state.managers = state.managers.filter(m => m.id !== id);
  state.clubs.forEach(c => { if (c.managerId === id) c.managerId = null; });
  saveState(); refreshAll();
}
