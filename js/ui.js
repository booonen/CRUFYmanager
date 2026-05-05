/* ===========================================================================
 * CRUFYmanager — ui.js
 *   Core UI plumbing: tab routing, modal open/close, saves dropdown,
 *   refresh-all dispatcher, shared HTML helpers. Page-specific renderers
 *   live in views.js, modal forms in forms.js.
 * ========================================================================= */

let _modalMouseDownTarget = null;

function switchTab(tab) {
  const validTabs = ['dashboard','leagues','cups','clubs','players','managers','fixtures','results','nationalteam','external','history','settings','import-export'];
  if (!validTabs.includes(tab)) tab = 'dashboard';
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(el => el.classList.toggle('active', el.id === `panel-${tab}`));
  state.ui.lastTab = tab;
  saveState();
  // Reset detail context when switching away from owning tab
  if (state.ui.detail.type && !tab.startsWith(state.ui.detail.type)) {
    state.ui.detail = { type: null, id: null };
  }
  renderTab(tab);
}

function renderTab(tab) {
  switch (tab) {
    case 'dashboard':     return renderDashboard();
    case 'leagues':       return renderLeagues();
    case 'cups':          return renderCups();
    case 'clubs':         return renderClubs();
    case 'players':       return renderPlayers();
    case 'managers':      return renderManagers();
    case 'fixtures':      return renderFixtures();
    case 'results':       return renderResults();
    case 'nationalteam':  return renderNationalTeam();
    case 'external':      return renderExternal();
    case 'history':       return renderHistoryBook();
    case 'settings':      return renderSettings();
    case 'import-export': return renderImportExport();
  }
}

function refreshAll() {
  // Update sidebar badges + nation header
  const setBadge = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = n; };
  setBadge('badge-leagues', state.leagues.length);
  setBadge('badge-cups', state.cups.length);
  setBadge('badge-clubs', state.clubs.length);
  setBadge('badge-players', state.players.filter(p => !p.isRetired).length);
  setBadge('badge-managers', state.managers.length);

  const nh = document.getElementById('nation-header');
  if (nh) {
    const n = state.settings.nation.name;
    nh.textContent = n ? `· ${n} · S${state.settings.season}` : '';
  }

  // Re-render currently visible tab
  const cur = state.ui.lastTab || 'dashboard';
  renderTab(cur);
}

/* ===========================================================================
 * Modal helpers
 * ========================================================================= */
function openModal({ title, body, footer, wide }) {
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('modal');
  document.getElementById('modal-title').textContent = title || '';
  document.getElementById('modal-body').innerHTML = body || '';
  document.getElementById('modal-footer').innerHTML = footer || '';
  modal.classList.toggle('modal-wide', !!wide);
  overlay.classList.add('open');
  // Focus first input
  setTimeout(() => {
    const first = modal.querySelector('input, select, textarea');
    if (first) first.focus();
  }, 80);
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}
function closeModalOnOverlay(ev) {
  // Only close if mousedown started on overlay (not dragged from inside)
  if (ev.target.id === 'modal-overlay' && _modalMouseDownTarget && _modalMouseDownTarget.id === 'modal-overlay') {
    closeModal();
  }
}

/* ===========================================================================
 * Saves dropdown (header right)
 * ========================================================================= */
function toggleSavesDropdown(ev) {
  ev.stopPropagation();
  const m = document.getElementById('saves-dropdown-menu');
  m.innerHTML = `
    <div class="saves-dropdown-item" onclick="closeSavesDropdown(); exportSave()">⤓ Export save (.json)</div>
    <div class="saves-dropdown-item" onclick="closeSavesDropdown(); document.getElementById('file-input').click()">⤒ Import save…</div>
    <div class="saves-dropdown-divider"></div>
    <div class="saves-dropdown-item" onclick="closeSavesDropdown(); saveStateNow(); showToast('Save flushed','success')">💾 Save now</div>
    <div class="saves-dropdown-divider"></div>
    <div class="saves-dropdown-item" style="color:var(--danger)" onclick="closeSavesDropdown(); resetSave()">⌫ Wipe save…</div>
  `;
  m.classList.toggle('open');
}
function closeSavesDropdown() {
  document.getElementById('saves-dropdown-menu').classList.remove('open');
}
document.addEventListener('click', e => {
  const dd = document.getElementById('saves-dropdown');
  if (dd && !dd.contains(e.target)) closeSavesDropdown();
});

/* ===========================================================================
 * HTML / format helpers used by views & forms
 * ========================================================================= */
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}

function attrPill(label, value) {
  const v = value || 0;
  let cls = '';
  if (v >= 80) cls = 'ap-elite';
  else if (v < 40) cls = 'ap-poor';
  return `<span class="attr-pill ${cls}"><span class="ap-l">${label}</span><span class="ap-v">${v}</span></span>`;
}

function attrBar(label, value) {
  const v = value || 0;
  const pct = clamp(v, 0, 100);
  let cls = 'f-low';
  if (v >= 80) cls = 'f-elite';
  else if (v >= 65) cls = 'f-high';
  else if (v >= 45) cls = 'f-mid';
  return `<div class="attr-bar"><div class="ab-l">${label}</div><div class="ab-track"><div class="ab-fill ${cls}" style="width:${pct}%"></div></div><div class="ab-v">${v}</div></div>`;
}

function positionBadge(pos) {
  return `<span class="type-badge pos-${pos.toLowerCase()}">${pos}</span>`;
}

function positionLabel(p) {
  return p.role || p.position;
}

function ovrPill(rating, big) {
  const r = rating | 0;
  return `<span class="ovr ${ratingClass(r)} ${big ? 'ovr-lg' : ''}">${r}</span>`;
}

function statusBadge(player) {
  if (!player) return '';
  if (player.isRetired) return `<span class="chip">retired</span>`;
  if ((player.status.injuredUntil || 0) > 0) return `<span class="chip chip-danger">inj ${player.status.injuredUntil}</span>`;
  if ((player.status.suspendedFor || 0) > 0) return `<span class="chip chip-warn">susp ${player.status.suspendedFor}</span>`;
  return `<span class="chip"><span class="dot" style="background:var(--success)"></span>fit</span>`;
}

function clubLink(id) {
  if (!id) return '<span class="text-muted">—</span>';
  const c = getClub(id);
  if (!c) return '?';
  return `<a class="clickable" onclick="openClubDetail('${c.id}')">${esc(c.name)}</a>`;
}

function playerLink(id) {
  if (!id) return '<span class="text-muted">—</span>';
  const p = getPlayer(id);
  if (!p) return '?';
  return `<a class="clickable" onclick="openPlayerDetail('${p.id}')">${esc(p.name)}</a>`;
}

function managerLink(id) {
  if (!id) return '<span class="text-muted">—</span>';
  const m = getManager(id);
  if (!m) return '?';
  return `<a class="clickable" onclick="openManagerDetail('${m.id}')">${esc(m.firstName + ' ' + m.lastName)}</a>`;
}

function leagueLink(id) {
  if (!id) return '';
  const l = getLeague(id);
  if (!l) return '?';
  return `<a class="clickable" onclick="openLeagueDetail('${l.id}')">${esc(l.name)}</a>`;
}

function cupLink(id) {
  if (!id) return '';
  const c = getCup(id);
  if (!c) return '?';
  return `<a class="clickable" onclick="openCupDetail('${c.id}')">${esc(c.name)}</a>`;
}

function emptyState({ icon = '◯', title = 'Nothing here yet', body = '', cta = '' }) {
  return `<div class="empty-state">
    <div class="empty-icon">${icon}</div>
    <h3>${esc(title)}</h3>
    <p>${esc(body)}</p>
    ${cta || ''}
  </div>`;
}

function formatScoreline(m) {
  let str = `${m.hScore}–${m.aScore}`;
  if (m.extraTime) str += ' (a.e.t.)';
  if (m.penalties) str += ` (${m.penalties.homeKicks}–${m.penalties.awayKicks} pens)`;
  return str;
}

function formInput(name, value, opts = {}) {
  const t = opts.type || 'text';
  const ph = opts.placeholder || '';
  const min = opts.min != null ? `min="${opts.min}"` : '';
  const max = opts.max != null ? `max="${opts.max}"` : '';
  const step = opts.step != null ? `step="${opts.step}"` : '';
  return `<input type="${t}" id="${name}" placeholder="${esc(ph)}" ${min} ${max} ${step} value="${esc(value ?? '')}">`;
}

function formSelect(name, value, options) {
  const opts = options.map(o => {
    const ov = typeof o === 'string' ? o : o.value;
    const ol = typeof o === 'string' ? o : (o.label || o.value);
    return `<option value="${esc(ov)}" ${ov === value ? 'selected' : ''}>${esc(ol)}</option>`;
  }).join('');
  return `<select id="${name}">${opts}</select>`;
}

function formGroup(label, controlHTML, hint) {
  return `<div class="form-group"><label>${esc(label)}</label>${controlHTML}${hint ? `<div class="form-hint">${esc(hint)}</div>` : ''}</div>`;
}

/* ===========================================================================
 * Detail-panel openers (used by table-row click handlers)
 * ========================================================================= */
function openClubDetail(id)    { switchTab('clubs');    state.ui.detail = { type: 'clubs', id }; renderClubs(); }
function openPlayerDetail(id)  { switchTab('players');  state.ui.detail = { type: 'players', id }; renderPlayers(); }
function openManagerDetail(id) { switchTab('managers'); state.ui.detail = { type: 'managers', id }; renderManagers(); }
function openLeagueDetail(id)  { switchTab('leagues');  state.ui.detail = { type: 'leagues', id }; renderLeagues(); }
function openCupDetail(id)     { switchTab('cups');     state.ui.detail = { type: 'cups', id }; renderCups(); }

function clearDetail() {
  state.ui.detail = { type: null, id: null };
  refreshAll();
}

/* ===========================================================================
 * View-match modal — shown when user clicks a draft match or committed result
 * ========================================================================= */
function viewMatchModal(matchOrEventId, opts = {}) {
  let m = null;
  if (typeof matchOrEventId === 'string') {
    // Look up in history
    m = state.history.find(e => e.id === matchOrEventId || e.matchId === matchOrEventId);
    if (!m) {
      const draft = (state.draftMatches || []).find(d => d.id === matchOrEventId);
      if (draft) { m = draft; opts.draft = true; }
    }
    if (!m) {
      const ext = (state.externalMatches || []).find(e => e.id === matchOrEventId);
      if (ext) { m = ext; opts.external = true; }
    }
  } else m = matchOrEventId;
  if (!m) return;
  // External matches don't have club IDs — synthesize lightweight stand-ins
  const isExternalView = opts.external || m.isExternal;
  const home = isExternalView ? { name: m.homeName || '?', stadiumName: '', formation: m.homeFormation || '' } : getClub(m.homeId);
  const away = isExternalView ? { name: m.awayName || '?', stadiumName: '', formation: m.awayFormation || '' } : getClub(m.awayId);
  if (!home || !away) return;

  const leagueLine = m.leagueId
    ? `${getLeague(m.leagueId)?.name || '?'} · Matchday ${m.matchday}`
    : (m.cupId ? `${getCup(m.cupId)?.name || '?'}` : (isExternalView ? `${m.type || 'External'}${m.competition ? ' · ' + m.competition : ''}` : ''));

  let body = `<div class="match-report">
    <div class="match-report-header">
      <div class="team-block home">
        <div class="team-name">${esc(home.name)}</div>
        <div class="team-tactics">${esc((m.homeXI && m.homeXI.formation) || home.formation || '')}</div>
      </div>
      <div>
        <div class="score-big">${m.hScore} – ${m.aScore}</div>
        <div class="score-meta">${m.extraTime ? 'a.e.t. · ' : ''}${m.penalties ? `${m.penalties.homeKicks}–${m.penalties.awayKicks} pens · ` : ''}+${m.stoppage || 0}</div>
      </div>
      <div class="team-block away">
        <div class="team-name">${esc(away.name)}</div>
        <div class="team-tactics">${esc((m.awayXI && m.awayXI.formation) || away.formation || '')}</div>
      </div>
    </div>
    <div class="match-meta-row">
      ${leagueLine ? `<div>${esc(leagueLine)}</div>` : ''}
      <div>Season ${m.season}</div>
      <div>${esc(home.stadiumName || '')}</div>
    </div>`;

  // Stats row
  const st = m.stats || {};
  body += `<div class="match-stats-row"><div class="stat-h">${st.possessionH ?? '-'}%</div><div class="stat-l">Possession</div><div class="stat-a">${st.possessionA ?? '-'}%</div></div>`;
  body += `<div class="match-stats-row"><div class="stat-h">${st.shotsH ?? '-'} (${st.sotH ?? '-'})</div><div class="stat-l">Shots (on tgt)</div><div class="stat-a">${st.shotsA ?? '-'} (${st.sotA ?? '-'})</div></div>`;
  body += `<div class="match-stats-row"><div class="stat-h">${st.cornersH ?? '-'}</div><div class="stat-l">Corners</div><div class="stat-a">${st.cornersA ?? '-'}</div></div>`;
  body += `<div class="match-stats-row"><div class="stat-h">${st.foulsH ?? '-'}</div><div class="stat-l">Fouls</div><div class="stat-a">${st.foulsA ?? '-'}</div></div>`;
  body += `<div class="match-stats-row"><div class="stat-h">${st.yellowsH ?? 0} ▪ / ${st.redsH ?? 0} ■</div><div class="stat-l">Cards</div><div class="stat-a">${st.yellowsA ?? 0} ▪ / ${st.redsA ?? 0} ■</div></div>`;

  // Commentary log — reconstruct from slim data if `events` is missing
  const events = (m.events && m.events.length) ? m.events : reconstructMatchEvents(m);
  body += `<div class="commentary-log">`;
  for (const ev of events) {
    const cls = `ce-${ev.type}`;
    const minLabel = ev.minute > 90 ? `90+${ev.minute - 90}'` : `${ev.minute}'`;
    const score = ev.score ? `<span class="ce-running-score">${esc(ev.score)}</span>` : '';
    body += `<div class="commentary-event ${cls}"><div class="ce-min">${minLabel}</div><div class="ce-icon">${ev.icon || ''}</div><div class="ce-text">${esc(ev.text || '')}${score}</div></div>`;
  }
  body += `</div></div>`;

  // Footer actions
  let footer = '';
  if (opts.draft) {
    footer = `
      <button class="btn" onclick="(()=>{ discardDraftMatch('${m.id}'); closeModal(); refreshAll(); })()">Discard</button>
      <button class="btn btn-warn" onclick="rerollDraft('${m.id}')">Re-roll</button>
      <button class="btn btn-primary" onclick="(()=>{ commitMatch(state.draftMatches.find(d=>d.id==='${m.id}')); closeModal(); refreshAll(); showToast('Match committed to history','success'); })()">Commit to history</button>
    `;
  } else if (opts.external) {
    footer = `
      <button class="btn" onclick="copyToClipboard(bbcodeExternalMatchReport(state.externalMatches.find(e=>e.id==='${m.id}')))">Copy BBCode</button>
      <button class="btn btn-danger" onclick="if(confirm('Delete this external match?')) { deleteExternal('${m.id}'); closeModal(); }">Delete</button>
      <button class="btn" onclick="closeModal()">Close</button>
    `;
  } else {
    footer = `
      <button class="btn" onclick="copyToClipboard(bbcodeMatchReport(state.history.find(e=>e.id==='${m.id}'))); ">Copy BBCode</button>
      <button class="btn btn-danger" onclick="askStrikeRecord('${m.id}')">Strike record…</button>
      <button class="btn" onclick="closeModal()">Close</button>
    `;
  }
  openModal({ title: `${home.name} vs ${away.name}`, body, footer, wide: true });
}

function rerollDraft(draftId) {
  const draft = (state.draftMatches || []).find(d => d.id === draftId);
  if (!draft) return;
  const opts = {
    homeId: draft.homeId, awayId: draft.awayId,
    leagueId: draft.leagueId, cupId: draft.cupId,
    matchday: draft.matchday, neutral: draft.neutral,
    isKnockout: draft.isKnockout, requiresWinner: !!(draft.isKnockout)
  };
  // Replace draft in array
  const idx = state.draftMatches.findIndex(d => d.id === draftId);
  const newDraft = simulateMatch(opts);
  if (!newDraft) return;
  state.draftMatches[idx] = newDraft;
  saveState();
  closeModal();
  setTimeout(() => viewMatchModal(newDraft, { draft: true }), 50);
}

/* ===========================================================================
 * Strike-record flow: deliberately high-friction — confirm, type-confirm,
 * provide a reason, double-confirm.
 * ========================================================================= */
function askStrikeRecord(eventId) {
  const ent = state.history.find(e => e.id === eventId);
  if (!ent) return;
  if (!confirm(`Strike record from history? This is irreversible-ish: the entry stays in the ledger but is hidden from all derived views.\n\nType the next prompt carefully — the system requires double-confirmation to discourage casual edits.`)) return;
  const reason = prompt('Why are you striking this record? (required, kept on the entry as audit metadata)');
  if (!reason || reason.trim().length < 8) { showToast('Reason too short — strike cancelled', 'warning'); return; }
  const c2 = prompt('Type STRIKE to confirm:');
  if (c2 !== 'STRIKE') { showToast('Strike cancelled', 'warning'); return; }
  if (strikeRecord(eventId, reason.trim())) {
    showToast('Record struck. Visible in History Book with "struck" tag.', 'success');
    closeModal();
    refreshAll();
  }
}

/* ===========================================================================
 * Quick-action: "next matchday" router that figures out which league is up
 * ========================================================================= */
function nextLeagueForMatchday() {
  for (const lg of state.leagues) {
    if (nextMatchdayForLeague(lg.id)) return lg;
  }
  return null;
}

/* ===========================================================================
 * reconstructMatchEvents — synthesize a commentary timeline from slim
 *   committed-match data. Used for viewing historic matches whose verbose
 *   `events` array was stripped at commit time to save localStorage space.
 * ========================================================================= */
function reconstructMatchEvents(m) {
  if (!m) return [];
  const home = getClub(m.homeId);
  const away = getClub(m.awayId);
  const homeName = home?.name || '?';
  const awayName = away?.name || '?';
  const out = [];
  out.push({ minute: 0, type: 'kickoff', icon: '', text: templ(pick(COMMENTARY.kickoff), { hometeam: homeName, awayteam: awayName, stadium: home?.stadiumName || '?', attendance: '—' }) });

  // Goals — track running score so the commentary line shows it inline
  const sortedScorers = (m.scorers || []).slice().sort((a, b) => a.minute - b.minute);
  let runH = 0, runA = 0;
  for (const sc of sortedScorers) {
    const scorer = sc.playerId ? getPlayer(sc.playerId) : null;
    const sName = (scorer && scorer.name) || sc.playerName || '?';
    const assister = sc.assistId ? getPlayer(sc.assistId) : null;
    const aName = assister?.name || sc.assistName || null;
    if (sc.side === 'home') runH++; else runA++;
    let text;
    if (sc.penalty) text = templ(pick(COMMENTARY.penaltyScored), { scorer: sName });
    else if (sc.ownGoal) text = `${sName} turns the ball into his own net.`;
    else if (aName) text = templ(pick(COMMENTARY.goalAssist), { scorer: sName, assister: aName });
    else text = templ(pick(COMMENTARY.goal), { scorer: sName });
    out.push({ minute: sc.minute, type: sc.penalty ? 'penalty' : 'goal', side: sc.side, icon: '⚽', score: `${runH}–${runA}`, text });
  }
  // Cards
  for (const c of (m.cards || [])) {
    const player = getPlayer(c.playerId);
    if (c.type === 'yellow') {
      out.push({ minute: c.minute, type: 'yellow', side: c.side, icon: '▪', text: templ(pick(COMMENTARY.yellow), { fouler: player?.name || '?', fouled: 'an opponent' }) });
    } else if (c.type === 'red') {
      out.push({ minute: c.minute, type: 'red', side: c.side, icon: '■', text: templ(pick(COMMENTARY.red), { fouler: player?.name || '?', fouled: 'an opponent' }) });
    }
  }
  // Injuries
  for (const inj of (m.injuries || [])) {
    const player = getPlayer(inj.playerId);
    out.push({ minute: inj.minute, type: 'injury', side: inj.side, icon: '✚', text: templ(pick(COMMENTARY.injury), { player: player?.name || '?' }) });
  }
  // Subs
  for (const s of (m.subs || [])) {
    const off = getPlayer(s.offId);
    const on = getPlayer(s.onId);
    out.push({ minute: s.minute, type: 'sub', side: s.side, icon: '⇄', text: templ(pick(COMMENTARY.sub), { team: s.side === 'home' ? homeName : awayName, playerOff: off?.name || '?', playerOn: on?.name || '?' }) });
  }

  out.sort((a, b) => a.minute - b.minute || (a.type === 'kickoff' ? -1 : 1));
  // Insert halftime + fulltime markers at correct positions
  // Compute scores at HT
  let hAtHT = 0, aAtHT = 0;
  for (const sc of (m.scorers || [])) if (sc.minute <= 45) { if (sc.side === 'home') hAtHT++; else aAtHT++; }
  out.push({ minute: 45, type: 'halftime', icon: '', text: templ(pick(COMMENTARY.halftime), { hometeam: homeName, awayteam: awayName, hs: hAtHT, as: aAtHT }) });
  const ftMin = 90 + (m.stoppage || 0);
  out.push({ minute: ftMin, type: 'fulltime', icon: '', text: templ(pick(COMMENTARY.fulltime), { hometeam: homeName, awayteam: awayName, hs: m.hScore, as: m.aScore }) });
  if (m.penalties) {
    out.push({ minute: 121, type: 'penalties', icon: '', text: `Penalty shootout: ${homeName} ${m.penalties.homeKicks} – ${m.penalties.awayKicks} ${awayName}` });
  }
  out.sort((a, b) => a.minute - b.minute);
  return out;
}
