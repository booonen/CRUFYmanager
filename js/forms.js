/* ===========================================================================
 * CRUFYmanager — forms.js
 *   Modal CRUD forms: league, cup, club (incl. bulk-create), player,
 *   manager, name bank, external match.
 * ========================================================================= */

/* ===========================================================================
 * LEAGUE form
 * ========================================================================= */
function openLeagueModal(id) {
  const lg = id ? getLeague(id) : null;
  const isEdit = !!lg;
  const draft = lg ? deepClone(lg) : {
    id: null, name: '', tier: 1, clubIds: [],
    rules: { promoted: 0, relegated: 3, playoffPromoted: 0, playoffRelegated: 0 },
    pointsSystem: { ...DEFAULT_POINTS_SYSTEM },
    tiebreakers: TIEBREAKERS.slice(),
    schedule: [], status: 'pending', season: state.settings.season
  };
  // Migrate old shape if needed
  if (draft.rules && draft.rules.playoffPromoted == null) draft.rules.playoffPromoted = 0;
  if (draft.rules && draft.rules.playoffRelegated == null) draft.rules.playoffRelegated = 0;
  const allClubOptions = state.clubs.map(c => ({ value: c.id, label: `${c.name}${c.leagueId && c.leagueId !== id ? ' (in ' + (getLeague(c.leagueId)?.name || '?') + ')' : ''}` }));
  const body = `
    <div class="form-row">
      ${formGroup('Name', `<input type="text" id="lg-name" value="${esc(draft.name)}" placeholder="e.g. Premier Division">`)}
      ${formGroup('Tier (1 = top)', `<input type="number" id="lg-tier" value="${draft.tier}" min="1" max="20">`)}
    </div>
    <h4>Promotion (places 1 → N)</h4>
    <div class="form-row">
      ${formGroup('Auto-promoted (top N)', `<input type="number" id="lg-promoted" value="${draft.rules.promoted}" min="0" max="10">`, 'These finishers move up automatically each season.')}
      ${formGroup('Playoff places (next M)', `<input type="number" id="lg-playoff-up" value="${draft.rules.playoffPromoted}" min="0" max="10">`, 'Informational slots — engine highlights these positions; you log playoff results manually.')}
    </div>
    <h4>Relegation (places ↓ from bottom)</h4>
    <div class="form-row">
      ${formGroup('Auto-relegated (bottom N)', `<input type="number" id="lg-relegated" value="${draft.rules.relegated}" min="0" max="10">`, 'These finishers drop automatically each season.')}
      ${formGroup('Playoff places (next M up)', `<input type="number" id="lg-playoff-down" value="${draft.rules.playoffRelegated}" min="0" max="10">`, 'Slots above the auto-drop zone that contest a relegation playoff.')}
    </div>
    <div class="form-row-3">
      ${formGroup('Win pts', `<input type="number" id="lg-win" value="${draft.pointsSystem.win}" min="0">`)}
      ${formGroup('Draw pts', `<input type="number" id="lg-draw" value="${draft.pointsSystem.draw}" min="0">`)}
      ${formGroup('Loss pts', `<input type="number" id="lg-loss" value="${draft.pointsSystem.loss}" min="0">`)}
    </div>
    ${formGroup('Tiebreakers (in order)', `<input type="text" id="lg-tb" value="${esc(draft.tiebreakers.join(','))}" placeholder="gd,gf,h2h,wins">`, 'Comma-separated. Allowed: gd, gf, h2h, wins')}
    <h4 style="margin-top:8px">Member clubs (${allClubOptions.length} clubs available)</h4>
    <div style="max-height:240px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius);padding:8px;background:var(--bg-input)">
      ${state.clubs.length ? state.clubs.map(c => `
        <label style="display:flex;gap:6px;align-items:center;padding:4px 0;cursor:pointer"><input type="checkbox" class="lg-club-cb" value="${c.id}" ${draft.clubIds.includes(c.id) ? 'checked' : ''}> ${esc(c.name)} ${c.leagueId && c.leagueId !== draft.id ? `<span class="text-muted" style="font-size:11px">(currently in ${esc(getLeague(c.leagueId)?.name || '?')})</span>` : ''}</label>
      `).join('') : '<p class="text-muted">No clubs yet. Add clubs first.</p>'}
    </div>
    <p class="text-muted" style="font-size:11px;margin-top:4px">Saving will (re)generate the schedule if the membership changed.</p>
  `;
  const footer = `
    <button class="btn" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="saveLeagueFromForm('${draft.id || ''}')">Save</button>
  `;
  openModal({ title: isEdit ? `Edit ${lg.name}` : 'Add league', body, footer, wide: true });
}

function saveLeagueFromForm(id) {
  const draft = id ? getLeague(id) : null;
  const data = {
    name: document.getElementById('lg-name').value.trim(),
    tier: parseInt(document.getElementById('lg-tier').value) || 1,
    rules: {
      promoted: parseInt(document.getElementById('lg-promoted').value) || 0,
      relegated: parseInt(document.getElementById('lg-relegated').value) || 0,
      playoffPromoted: parseInt(document.getElementById('lg-playoff-up').value) || 0,
      playoffRelegated: parseInt(document.getElementById('lg-playoff-down').value) || 0,
    },
    pointsSystem: {
      win: parseInt(document.getElementById('lg-win').value) || 3,
      draw: parseInt(document.getElementById('lg-draw').value) || 1,
      loss: parseInt(document.getElementById('lg-loss').value) || 0,
    },
    tiebreakers: document.getElementById('lg-tb').value.split(',').map(s => s.trim()).filter(s => TIEBREAKERS.includes(s)),
    clubIds: Array.from(document.querySelectorAll('.lg-club-cb:checked')).map(el => el.value),
  };
  if (!data.name) { showToast('Name required', 'error'); return; }
  if (data.clubIds.length < 2 && !id) { /* allow empty creation but warn */ }

  // Reassign clubs
  for (const cid of data.clubIds) {
    const c = getClub(cid);
    if (c) c.leagueId = id || draft?.id || null;
  }
  // Remove clubs no longer in this league
  if (id) {
    for (const c of state.clubs) {
      if (c.leagueId === id && !data.clubIds.includes(c.id)) c.leagueId = null;
    }
  }

  if (draft) {
    Object.assign(draft, data);
    if (data.clubIds.length >= 2) generateLeagueSchedule(draft.id);
  } else {
    const newLg = Object.assign({
      id: uid('l_'),
      schedule: [],
      status: 'pending',
      season: state.settings.season,
    }, data);
    state.leagues.push(newLg);
    for (const cid of data.clubIds) { const c = getClub(cid); if (c) c.leagueId = newLg.id; }
    if (data.clubIds.length >= 2) generateLeagueSchedule(newLg.id);
  }
  saveState();
  closeModal();
  refreshAll();
  showToast('League saved', 'success');
}

/* ===========================================================================
 * CUP form
 * ========================================================================= */
function openCupModal(id) {
  const cp = id ? getCup(id) : null;
  const draft = cp ? deepClone(cp) : {
    id: null, name: '', format: 'knockout',
    eligibleLeagueIds: [], entrantIds: [],
    groupSize: 4, groupAdvance: 2,
    rounds: [], groups: [], status: 'pending'
  };
  const body = `
    <div class="form-row">
      ${formGroup('Name', `<input type="text" id="cp-name" value="${esc(draft.name)}" placeholder="e.g. National Cup">`)}
      ${formGroup('Format', formSelect('cp-format', draft.format, [{value: 'knockout', label: 'Single-leg knockout'}, {value: 'group_knockout', label: 'Group stage → knockout'}]))}
    </div>
    <div class="form-row" id="cp-group-opts" ${draft.format === 'knockout' ? 'style="display:none"' : ''}>
      ${formGroup('Group size', `<input type="number" id="cp-group-size" value="${draft.groupSize}" min="2" max="8">`)}
      ${formGroup('Advance per group', `<input type="number" id="cp-group-advance" value="${draft.groupAdvance}" min="1" max="6">`)}
    </div>
    <h4>Eligible leagues (clubs from these enter automatically)</h4>
    <div style="max-height:140px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius);padding:8px;background:var(--bg-input)">
      ${state.leagues.length ? state.leagues.map(l => `
        <label style="display:flex;gap:6px;align-items:center;padding:4px 0;cursor:pointer"><input type="checkbox" class="cp-lg-cb" value="${l.id}" ${draft.eligibleLeagueIds.includes(l.id) ? 'checked' : ''}> ${esc(l.name)} <span class="text-muted" style="font-size:11px">(${l.clubIds.length} clubs)</span></label>
      `).join('') : '<p class="text-muted">No leagues yet.</p>'}
    </div>
  `;
  const footer = `
    <button class="btn" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="saveCupFromForm('${draft.id || ''}')">Save</button>
  `;
  openModal({ title: cp ? `Edit ${cp.name}` : 'Add cup', body, footer });
  // Toggle group-opts on format change
  const sel = document.getElementById('cp-format');
  if (sel) sel.addEventListener('change', () => {
    document.getElementById('cp-group-opts').style.display = sel.value === 'group_knockout' ? '' : 'none';
  });
}

function saveCupFromForm(id) {
  const draft = id ? getCup(id) : null;
  const data = {
    name: document.getElementById('cp-name').value.trim(),
    format: document.getElementById('cp-format').value,
    eligibleLeagueIds: Array.from(document.querySelectorAll('.cp-lg-cb:checked')).map(el => el.value),
    groupSize: parseInt(document.getElementById('cp-group-size').value) || 4,
    groupAdvance: parseInt(document.getElementById('cp-group-advance').value) || 2,
  };
  if (!data.name) { showToast('Name required', 'error'); return; }
  if (draft) Object.assign(draft, data);
  else state.cups.push(Object.assign({ id: uid('cp_'), entrantIds: [], rounds: [], groups: [], status: 'pending' }, data));
  saveState(); closeModal(); refreshAll();
  showToast('Cup saved', 'success');
}

/* ===========================================================================
 * CLUB form
 * ========================================================================= */
function openClubModal(id) {
  const c = id ? getClub(id) : null;
  const draft = c ? deepClone(c) : {
    id: null, name: '', shortName: '',
    kitPrimary: randomKitColour(), kitSecondary: '#ffffff',
    stadiumName: '', stadiumCapacity: 25000,
    captainId: null, viceCaptainId: null,
    formation: DEFAULT_FORMATION,
    tactics: { mentality: 50, tempo: 50, pressing: 50 },
    nameBankPref: state.settings.defaultNameBank,
    nationality: state.settings.nation?.name || '',
    managerId: null,
    leagueId: null,
    reputation: 50,
    foundedSeason: state.settings.season
  };
  const squadOptions = c ? playersByClub(c.id).filter(p => !p.isRetired) : [];

  const body = `
    <div class="form-row">
      ${formGroup('Name', `<input type="text" id="cl-name" value="${esc(draft.name)}" placeholder="e.g. Riverside FC">`)}
      ${formGroup('Short name (3 chars)', `<input type="text" id="cl-short" maxlength="6" value="${esc(draft.shortName)}" placeholder="RIV">`)}
    </div>
    <div class="form-row">
      ${formGroup('League', formSelect('cl-league', draft.leagueId || '', [{value:'', label:'(none)'}, ...state.leagues.map(l => ({value: l.id, label: l.name}))]))}
      ${formGroup('Reputation (0–99)', `<input type="number" id="cl-rep" min="0" max="99" value="${draft.reputation}">`)}
    </div>
    <div class="form-row">
      ${formGroup('Stadium name', `<input type="text" id="cl-st-name" value="${esc(draft.stadiumName)}" placeholder="${esc(generateStadiumName(draft.name || 'Park'))}">`)}
      ${formGroup('Stadium capacity', `<input type="number" id="cl-st-cap" min="500" max="200000" step="500" value="${draft.stadiumCapacity}">`)}
    </div>
    <div class="form-row">
      ${formGroup('Kit primary', `<input type="text" id="cl-kit1" value="${esc(draft.kitPrimary)}" placeholder="#3aa066">`)}
      ${formGroup('Kit secondary', `<input type="text" id="cl-kit2" value="${esc(draft.kitSecondary)}" placeholder="#ffffff">`)}
    </div>
    <div class="form-row">
      ${formGroup('Default formation', formSelect('cl-form', draft.formation, Object.keys(FORMATIONS)))}
      ${formGroup('Club nationality', `<input type="text" id="cl-nat" value="${esc(draft.nationality || '')}" placeholder="${esc(state.settings.nation?.name || 'England')}" list="nat-list-cl"><datalist id="nat-list-cl">${[...new Set(state.clubs.map(cc => cc.nationality).filter(Boolean))].map(n => `<option value="${esc(n)}">`).join('')}</datalist>`, 'Auto-generated players inherit this.')}
    </div>
    ${formGroup('Name bank for new players from this club', formSelect('cl-bank', draft.nameBankPref, Object.keys(state.nameBanks)), 'Naming source only — has no effect on stored nationality.')}
    <h4>Tactics</h4>
    <div class="slider-row"><label>Mentality</label><input type="range" id="cl-mentality" min="0" max="100" value="${draft.tactics.mentality}" oninput="this.nextElementSibling.textContent=this.value"><div class="slider-val">${draft.tactics.mentality}</div></div>
    <div class="slider-scale" style="margin-left:122px;margin-top:-2px"><span>defensive</span><span>balanced</span><span>attacking</span></div>
    <div class="slider-row"><label>Tempo</label><input type="range" id="cl-tempo" min="0" max="100" value="${draft.tactics.tempo}" oninput="this.nextElementSibling.textContent=this.value"><div class="slider-val">${draft.tactics.tempo}</div></div>
    <div class="slider-scale" style="margin-left:122px;margin-top:-2px"><span>slow</span><span>balanced</span><span>fast</span></div>
    <div class="slider-row"><label>Pressing</label><input type="range" id="cl-pressing" min="0" max="100" value="${draft.tactics.pressing}" oninput="this.nextElementSibling.textContent=this.value"><div class="slider-val">${draft.tactics.pressing}</div></div>
    <div class="slider-scale" style="margin-left:122px;margin-top:-2px"><span>low</span><span>balanced</span><span>high</span></div>
    ${c ? `<div class="form-row" style="margin-top:12px">
      ${formGroup('Captain', formSelect('cl-cap', draft.captainId || '', [{value:'', label:'(none)'}, ...squadOptions.map(p => ({value: p.id, label: p.name}))]))}
      ${formGroup('Vice-captain', formSelect('cl-vice', draft.viceCaptainId || '', [{value:'', label:'(none)'}, ...squadOptions.map(p => ({value: p.id, label: p.name}))]))}
    </div>
    ${formGroup('Manager', formSelect('cl-manager', draft.managerId || '', [{value:'', label:'(none)'}, ...state.managers.map(m => ({value: m.id, label: `${m.firstName} ${m.lastName}${m.isUnemployed ? '' : ' (employed)'}`}))]))}
    ` : ''}
    ${!c ? `<h4>Auto-generate squad</h4>
    <div class="form-row">
      ${formGroup('Squad size', `<input type="number" id="cl-squad-size" value="22" min="11" max="40">`)}
      ${formGroup('Quality (0–99)', `<input type="number" id="cl-squad-qual" value="55" min="0" max="99">`)}
    </div>
    <label style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" id="cl-gen-squad" checked> Auto-generate a squad on creation</label>
    <label style="display:flex;gap:6px;align-items:center;cursor:pointer;margin-top:6px"><input type="checkbox" id="cl-gen-mgr" checked> Auto-generate a manager</label>` : ''}
  `;
  const footer = `
    <button class="btn" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="saveClubFromForm('${draft.id || ''}')">Save</button>
  `;
  openModal({ title: c ? `Edit ${c.name}` : 'Add club', body, footer, wide: true });
}

function saveClubFromForm(id) {
  const club = id ? getClub(id) : null;
  const data = {
    name: document.getElementById('cl-name').value.trim(),
    shortName: document.getElementById('cl-short').value.trim().toUpperCase().slice(0, 6),
    leagueId: document.getElementById('cl-league').value || null,
    reputation: clamp(parseInt(document.getElementById('cl-rep').value) || 50, 0, 99),
    stadiumName: document.getElementById('cl-st-name').value.trim() || generateStadiumName(document.getElementById('cl-name').value || 'Park'),
    stadiumCapacity: clamp(parseInt(document.getElementById('cl-st-cap').value) || 25000, 500, 200000),
    kitPrimary: document.getElementById('cl-kit1').value.trim() || randomKitColour(),
    kitSecondary: document.getElementById('cl-kit2').value.trim() || '#ffffff',
    formation: document.getElementById('cl-form').value,
    nameBankPref: document.getElementById('cl-bank').value,
    nationality: document.getElementById('cl-nat').value.trim(),
    tactics: {
      mentality: parseInt(document.getElementById('cl-mentality').value) || 50,
      tempo: parseInt(document.getElementById('cl-tempo').value) || 50,
      pressing: parseInt(document.getElementById('cl-pressing').value) || 50,
    },
  };
  if (!data.name) { showToast('Name required', 'error'); return; }
  if (!data.shortName) data.shortName = data.name.split(' ')[0].slice(0, 3).toUpperCase();

  if (club) {
    const oldLeague = club.leagueId;
    Object.assign(club, data);
    club.captainId = document.getElementById('cl-cap')?.value || null;
    club.viceCaptainId = document.getElementById('cl-vice')?.value || null;
    const newMgr = document.getElementById('cl-manager')?.value || null;
    if (newMgr !== club.managerId) {
      if (club.managerId) {
        const oldM = getManager(club.managerId);
        if (oldM) { oldM.isUnemployed = true; oldM.clubId = null; }
      }
      club.managerId = newMgr;
      if (newMgr) {
        const m = getManager(newMgr);
        if (m) { m.isUnemployed = false; m.clubId = club.id; historyAppend('manager_hired', { managerId: m.id, clubId: club.id }); }
      }
    }
    if (oldLeague !== club.leagueId) {
      if (oldLeague) { const ol = getLeague(oldLeague); if (ol) ol.clubIds = ol.clubIds.filter(x => x !== club.id); }
      if (club.leagueId) { const nl = getLeague(club.leagueId); if (nl && !nl.clubIds.includes(club.id)) nl.clubIds.push(club.id); }
    }
  } else {
    const newClub = Object.assign({
      id: uid('c_'),
      captainId: null, viceCaptainId: null, managerId: null,
      foundedSeason: state.settings.season,
    }, data);
    state.clubs.push(newClub);
    if (newClub.leagueId) {
      const lg = getLeague(newClub.leagueId);
      if (lg && !lg.clubIds.includes(newClub.id)) lg.clubIds.push(newClub.id);
    }
    if (document.getElementById('cl-gen-squad')?.checked) {
      const size = parseInt(document.getElementById('cl-squad-size').value) || 22;
      const qual = parseInt(document.getElementById('cl-squad-qual').value) || 55;
      generateSquad(newClub.id, { size, quality: qual, nameBank: newClub.nameBankPref });
    }
    if (document.getElementById('cl-gen-mgr')?.checked) {
      const m = generateManager({ nationality: newClub.nameBankPref });
      m.clubId = newClub.id; m.isUnemployed = false; newClub.managerId = m.id;
      historyAppend('manager_hired', { managerId: m.id, clubId: newClub.id });
    }
  }
  saveState(); closeModal(); refreshAll();
  showToast('Club saved', 'success');
}

/* ===========================================================================
 * Bulk-create clubs
 * ========================================================================= */
function openGenerateClubsModal() {
  const body = `
    <p class="text-muted">Quickly seed an entire league with auto-generated clubs.</p>
    <div class="form-row">
      ${formGroup('Number of clubs', `<input type="number" id="gen-count" value="12" min="2" max="40">`)}
      ${formGroup('League', formSelect('gen-league', '', [{value:'', label:'(none)'}, ...state.leagues.map(l => ({value: l.id, label: l.name}))]))}
    </div>
    <div class="form-row">
      ${formGroup('Name bank (for naming)', formSelect('gen-bank', state.settings.defaultNameBank, Object.keys(state.nameBanks)))}
      ${formGroup('Nationality (display)', `<input type="text" id="gen-nat" value="${esc(state.settings.nation?.name || '')}" placeholder="${esc(state.settings.nation?.name || 'e.g. Demolandia')}">`)}
    </div>
    <div class="form-row">
      ${formGroup('Avg quality (0–99)', `<input type="number" id="gen-quality" value="55" min="20" max="90">`)}
      ${formGroup('Variance (±)', `<input type="number" id="gen-var" value="10" min="0" max="40">`)}
    </div>
    ${formGroup('Squad size per club', `<input type="number" id="gen-squad" value="22" min="11" max="40">`)}
    <label style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" id="gen-mgrs" checked> Generate a manager per club</label>
    <label style="display:flex;gap:6px;align-items:center;cursor:pointer;margin-top:4px"><input type="checkbox" id="gen-schedule" checked> Generate league schedule after</label>
  `;
  const footer = `
    <button class="btn" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="runBulkClubGeneration()">Generate</button>
  `;
  openModal({ title: 'Bulk-create clubs', body, footer });
}

function runBulkClubGeneration() {
  const n = clamp(parseInt(document.getElementById('gen-count').value) || 12, 2, 40);
  const leagueId = document.getElementById('gen-league').value || null;
  const bank = document.getElementById('gen-bank').value;
  const nationality = document.getElementById('gen-nat').value.trim() || state.settings.nation?.name || bankToCountryLabel(bank);
  const baseQ = clamp(parseInt(document.getElementById('gen-quality').value) || 55, 20, 90);
  const variance = clamp(parseInt(document.getElementById('gen-var').value) || 10, 0, 40);
  const squad = clamp(parseInt(document.getElementById('gen-squad').value) || 22, 11, 40);
  const genMgrs = document.getElementById('gen-mgrs').checked;
  const genSched = document.getElementById('gen-schedule').checked;

  const created = [];
  for (let i = 0; i < n; i++) {
    const q = baseQ + pickInt(-variance, variance);
    const nameBank = state.nameBanks[bank] ? bank : state.settings.defaultNameBank;
    const c = generateClub({ leagueId, quality: q, nameBankPref: nameBank, nationality });
    if (leagueId) {
      const lg = getLeague(leagueId);
      if (lg && !lg.clubIds.includes(c.id)) lg.clubIds.push(c.id);
    }
    generateSquad(c.id, { size: squad, quality: q, nameBank, nationality });
    if (genMgrs) {
      const m = generateManager({ nameBank, nationality });
      m.clubId = c.id; m.isUnemployed = false; c.managerId = m.id;
      historyAppend('manager_hired', { managerId: m.id, clubId: c.id });
    }
    created.push(c);
  }
  if (genSched && leagueId) generateLeagueSchedule(leagueId);
  saveState(); closeModal(); refreshAll();
  showToast(`Created ${created.length} clubs`, 'success');
}

/* ===========================================================================
 * PLAYER form (light — most players are auto-generated)
 * ========================================================================= */
function openPlayerModal(id) {
  const p = id ? getPlayer(id) : null;
  const draft = p ? deepClone(p) : {
    id: null, firstName: '', lastName: '', name: '',
    nationality: state.settings.nation?.name || bankToCountryLabel(state.settings.defaultNameBank),
    nameBankUsed: state.settings.defaultNameBank,
    age: 22, position: 'MF', role: 'CM',
    attrs: { pace: 50, strength: 50, technique: 50, passing: 50, defending: 50, shooting: 50, mental: 50, goalkeeping: 1 },
    potential: 70, injuryProneness: 20,
    clubId: null, shirtNumber: null,
    contract: { wage: 1000, years: 3 },
    status: { injuredUntil: 0, suspendedFor: 0, yellowsThisSeason: 0, fatigue: 0 },
    seasonStats: { apps: 0, goals: 0, assists: 0, yellows: 0, reds: 0 },
    isRetired: false,
  };
  const body = `
    <div class="form-row">
      ${formGroup('First name', `<input type="text" id="pl-first" value="${esc(draft.firstName)}">`)}
      ${formGroup('Last name', `<input type="text" id="pl-last" value="${esc(draft.lastName)}">`)}
    </div>
    <div class="form-row-3">
      ${formGroup('Age', `<input type="number" id="pl-age" min="14" max="50" value="${draft.age}">`)}
      ${formGroup('Nationality', `<input type="text" id="pl-nat" value="${esc(draft.nationality || '')}" placeholder="e.g. ${esc(state.settings.nation?.name || 'England')}" list="nat-list"><datalist id="nat-list">${[...new Set(state.players.map(p => p.nationality).filter(Boolean))].map(n => `<option value="${esc(n)}">`).join('')}</datalist>`, 'Free-form: country, region, anything you like.')}
      ${formGroup('Shirt number', `<input type="number" id="pl-shirt" min="1" max="99" value="${draft.shirtNumber ?? ''}">`)}
    </div>
    <div class="form-row-3">
      ${formGroup('Position', formSelect('pl-pos', draft.position, POSITIONS))}
      ${formGroup('Role', `<input type="text" id="pl-role" value="${esc(draft.role)}" placeholder="e.g. CB, CM, ST">`)}
      ${formGroup('Club', formSelect('pl-club', draft.clubId || '', [{value:'', label:'(free agent)'}, ...state.clubs.map(c => ({value: c.id, label: c.name}))]))}
    </div>
    ${!p ? formGroup('Auto-name source bank', formSelect('pl-bank', draft.nameBankUsed, Object.keys(state.nameBanks)), 'Used only if first/last names are blank — picks a random matching name.') : ''}
    <h4>Attributes (1–99)</h4>
    <div class="form-row-4">
      ${formGroup('Pace', `<input type="number" id="pl-pace" min="1" max="99" value="${draft.attrs.pace}">`)}
      ${formGroup('Strength', `<input type="number" id="pl-str" min="1" max="99" value="${draft.attrs.strength}">`)}
      ${formGroup('Technique', `<input type="number" id="pl-tec" min="1" max="99" value="${draft.attrs.technique}">`)}
      ${formGroup('Passing', `<input type="number" id="pl-pas" min="1" max="99" value="${draft.attrs.passing}">`)}
    </div>
    <div class="form-row-4">
      ${formGroup('Defending', `<input type="number" id="pl-def" min="1" max="99" value="${draft.attrs.defending}">`)}
      ${formGroup('Shooting', `<input type="number" id="pl-shoot" min="1" max="99" value="${draft.attrs.shooting}">`)}
      ${formGroup('Mental', `<input type="number" id="pl-men" min="1" max="99" value="${draft.attrs.mental}">`)}
      ${formGroup('Goalkeeping', `<input type="number" id="pl-gk" min="1" max="99" value="${draft.attrs.goalkeeping}">`)}
    </div>
    <h4>Hidden</h4>
    <div class="form-row">
      ${formGroup('Potential (1–99)', `<input type="number" id="pl-pot" min="1" max="99" value="${draft.potential}">`)}
      ${formGroup('Injury proneness (1–99)', `<input type="number" id="pl-prone" min="1" max="99" value="${draft.injuryProneness}">`)}
    </div>
    <label style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" id="pl-retired" ${draft.isRetired ? 'checked' : ''}> Retired</label>
  `;
  const footer = `
    <button class="btn" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="savePlayerFromForm('${draft.id || ''}')">Save</button>
  `;
  openModal({ title: p ? `Edit ${p.name}` : 'Add player', body, footer, wide: true });
}

function savePlayerFromForm(id) {
  const player = id ? getPlayer(id) : null;
  const data = {
    firstName: document.getElementById('pl-first').value.trim(),
    lastName: document.getElementById('pl-last').value.trim(),
    age: parseInt(document.getElementById('pl-age').value) || 22,
    nationality: document.getElementById('pl-nat').value.trim(),
    shirtNumber: parseInt(document.getElementById('pl-shirt').value) || null,
    position: document.getElementById('pl-pos').value,
    role: document.getElementById('pl-role').value.trim().toUpperCase() || 'CM',
    clubId: document.getElementById('pl-club').value || null,
    isRetired: document.getElementById('pl-retired').checked,
    attrs: {
      pace: parseInt(document.getElementById('pl-pace').value) || 50,
      strength: parseInt(document.getElementById('pl-str').value) || 50,
      technique: parseInt(document.getElementById('pl-tec').value) || 50,
      passing: parseInt(document.getElementById('pl-pas').value) || 50,
      defending: parseInt(document.getElementById('pl-def').value) || 50,
      shooting: parseInt(document.getElementById('pl-shoot').value) || 50,
      mental: parseInt(document.getElementById('pl-men').value) || 50,
      goalkeeping: parseInt(document.getElementById('pl-gk').value) || 1,
    },
    potential: parseInt(document.getElementById('pl-pot').value) || 70,
    injuryProneness: parseInt(document.getElementById('pl-prone').value) || 20,
  };
  // Auto-fill names if blank using selected bank
  if (!player && (!data.firstName || !data.lastName)) {
    const bankName = document.getElementById('pl-bank')?.value || state.settings.defaultNameBank;
    const bank = state.nameBanks[bankName] || DEFAULT_NAME_BANKS[bankName] || DEFAULT_NAME_BANKS['Generic English'];
    if (!data.firstName) data.firstName = pick(bank.firstNames);
    if (!data.lastName) data.lastName = pick(bank.lastNames);
    data.nameBankUsed = bankName;
  }
  if (!data.firstName || !data.lastName) { showToast('First and last names required', 'error'); return; }
  if (!data.nationality) data.nationality = state.settings.nation?.name || '';
  data.name = `${data.firstName} ${data.lastName}`;

  if (player) {
    Object.assign(player, data);
  } else {
    state.players.push(Object.assign({
      id: uid('p_'),
      dob: { year: state.settings.season - data.age },
      contract: { wage: 1000, years: 3 },
      status: { injuredUntil: 0, suspendedFor: 0, yellowsThisSeason: 0, fatigue: 0 },
      seasonStats: { apps: 0, goals: 0, assists: 0, yellows: 0, reds: 0 },
    }, data));
  }
  saveState(); closeModal(); refreshAll();
  showToast('Player saved', 'success');
}

/* ===========================================================================
 * TRANSFER form
 * ========================================================================= */
function openTransferModal(playerId) {
  const p = getPlayer(playerId);
  if (!p) return;
  const fromClub = p.clubId ? getClub(p.clubId) : null;
  const otherClubs = state.clubs.filter(c => c.id !== p.clubId);
  const body = `
    <p style="margin-bottom:12px">Move <strong>${esc(p.name)}</strong> ${fromClub ? `from <strong>${esc(fromClub.name)}</strong>` : '(currently free agent)'} to a new club.</p>
    ${formGroup('New club', formSelect('tx-to', '', [{value:'', label:'(release as free agent)'}, ...otherClubs.map(c => ({value: c.id, label: c.name + (c.leagueId ? ` (${getLeague(c.leagueId)?.name || ''})` : '')}))]))}
    <div class="form-row">
      ${formGroup('Fee', `<input type="number" id="tx-fee" min="0" value="0" step="100">`)}
      ${formGroup('Free transfer', `<label style="display:flex;gap:6px;align-items:center;cursor:pointer;padding-top:8px"><input type="checkbox" id="tx-free"> mark as free transfer</label>`)}
    </div>
    <p class="form-hint">An entry is appended to the history book either way. Pick "(release)" to send the player to the free-agent pool.</p>
  `;
  const footer = `
    <button class="btn" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="confirmTransfer('${playerId}')">Move</button>
  `;
  openModal({ title: 'Transfer player', body, footer });
}

function confirmTransfer(playerId) {
  const toClubId = document.getElementById('tx-to').value || null;
  const fee = parseInt(document.getElementById('tx-fee').value) || 0;
  const free = document.getElementById('tx-free').checked;
  if (transferPlayer(playerId, toClubId, fee, free)) {
    closeModal(); refreshAll();
    showToast(toClubId ? `Transferred to ${clubName(toClubId)}` : 'Released as free agent', 'success');
  }
}

/* ===========================================================================
 * MANAGER form
 * ========================================================================= */
function openManagerModal(id) {
  const m = id ? getManager(id) : null;
  const draft = m ? deepClone(m) : {
    id: null, firstName: '', lastName: '',
    nationality: state.settings.nation?.name || bankToCountryLabel(state.settings.defaultNameBank),
    nameBankUsed: state.settings.defaultNameBank,
    attrs: { tactical: 60, manManagement: 60, youthDev: 60, reputation: 60 },
    formerPlayerId: null, clubId: null, isUnemployed: true
  };
  const body = `
    <div class="form-row">
      ${formGroup('First name', `<input type="text" id="mg-first" value="${esc(draft.firstName)}">`)}
      ${formGroup('Last name', `<input type="text" id="mg-last" value="${esc(draft.lastName)}">`)}
    </div>
    <div class="form-row">
      ${formGroup('Nationality', `<input type="text" id="mg-nat" value="${esc(draft.nationality || '')}" placeholder="${esc(state.settings.nation?.name || 'England')}">`)}
      ${formGroup('Club', formSelect('mg-club', draft.clubId || '', [{value:'', label:'(unemployed)'}, ...state.clubs.map(c => ({value: c.id, label: c.name}))]))}
    </div>
    <h4>Attributes (1–99)</h4>
    <div class="form-row-4">
      ${formGroup('Tactical', `<input type="number" id="mg-tac" min="1" max="99" value="${draft.attrs.tactical}">`)}
      ${formGroup('Man-management', `<input type="number" id="mg-mm" min="1" max="99" value="${draft.attrs.manManagement}">`)}
      ${formGroup('Youth dev.', `<input type="number" id="mg-yd" min="1" max="99" value="${draft.attrs.youthDev}">`)}
      ${formGroup('Reputation', `<input type="number" id="mg-rep" min="1" max="99" value="${draft.attrs.reputation}">`)}
    </div>
  `;
  const footer = `
    <button class="btn" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="saveManagerFromForm('${draft.id || ''}')">Save</button>
  `;
  openModal({ title: m ? `Edit ${m.firstName} ${m.lastName}` : 'Add manager', body, footer });
}

function saveManagerFromForm(id) {
  const mgr = id ? getManager(id) : null;
  const data = {
    firstName: document.getElementById('mg-first').value.trim(),
    lastName: document.getElementById('mg-last').value.trim(),
    nationality: document.getElementById('mg-nat').value.trim(),
    clubId: document.getElementById('mg-club').value || null,
    attrs: {
      tactical: parseInt(document.getElementById('mg-tac').value) || 60,
      manManagement: parseInt(document.getElementById('mg-mm').value) || 60,
      youthDev: parseInt(document.getElementById('mg-yd').value) || 60,
      reputation: parseInt(document.getElementById('mg-rep').value) || 60,
    }
  };
  if (!data.firstName || !data.lastName) { showToast('Name required', 'error'); return; }
  data.isUnemployed = !data.clubId;

  if (mgr) {
    const oldClub = mgr.clubId;
    Object.assign(mgr, data);
    if (oldClub !== mgr.clubId) {
      if (oldClub) { const c = getClub(oldClub); if (c && c.managerId === mgr.id) c.managerId = null; }
      if (mgr.clubId) { const c = getClub(mgr.clubId); if (c) c.managerId = mgr.id; historyAppend('manager_hired', { managerId: mgr.id, clubId: mgr.clubId }); }
    }
  } else {
    const newM = Object.assign({ id: uid('m_'), formerPlayerId: null, seasonsAtClub: 0 }, data);
    state.managers.push(newM);
    if (newM.clubId) { const c = getClub(newM.clubId); if (c) c.managerId = newM.id; historyAppend('manager_hired', { managerId: newM.id, clubId: newM.clubId }); }
  }
  saveState(); closeModal(); refreshAll();
  showToast('Manager saved', 'success');
}

/* ===========================================================================
 * NAME BANK editor
 * ========================================================================= */
function openNameBankModal(name) {
  const bank = name ? state.nameBanks[name] : null;
  const isEdit = !!bank;
  const body = `
    ${formGroup('Bank name', `<input type="text" id="nb-name" value="${esc(name || '')}" ${isEdit ? 'readonly' : ''} placeholder="Generic Foo">`)}
    ${formGroup('First names (one per line)', `<textarea id="nb-first">${esc(bank ? bank.firstNames.join('\n') : '')}</textarea>`)}
    ${formGroup('Last names (one per line)', `<textarea id="nb-last">${esc(bank ? bank.lastNames.join('\n') : '')}</textarea>`)}
  `;
  const footer = `
    <button class="btn" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="saveNameBankFromForm('${esc(name || '')}')">Save</button>
  `;
  openModal({ title: isEdit ? `Edit "${name}"` : 'Add name bank', body, footer });
}

function saveNameBankFromForm(name) {
  const newName = document.getElementById('nb-name').value.trim();
  const firstNames = document.getElementById('nb-first').value.split('\n').map(s => s.trim()).filter(Boolean);
  const lastNames = document.getElementById('nb-last').value.split('\n').map(s => s.trim()).filter(Boolean);
  if (!newName) { showToast('Name required', 'error'); return; }
  if (!firstNames.length || !lastNames.length) { showToast('Need at least one first and one last name', 'error'); return; }
  state.nameBanks[newName] = { firstNames, lastNames };
  saveState(); closeModal(); refreshAll();
  showToast('Name bank saved', 'success');
}

/* ===========================================================================
 * EXTERNAL match generator
 *
 *   Two-step modal: configure both sides + final score, then a draft is
 *   generated by scriptedMatch() and the user can commit, re-roll, or edit.
 *
 *   In-flight draft state is held in window._exDraftState while the modal
 *   is open so re-renders preserve the user's selections.
 * ========================================================================= */
let _exDraftState = null;

function openExternalModal() {
  const nat = state.settings.nation.name || '';
  _exDraftState = {
    type: 'NT friendly',
    competition: '',
    home: { source: nat ? 'nt' : 'custom', clubId: null, customName: nat || 'Home team', formation: DEFAULT_FORMATION, xi: null, strength: 65, customRoster: '' },
    away: { source: 'custom', clubId: null, customName: '', formation: DEFAULT_FORMATION, xi: null, strength: 60, customRoster: '' },
    hScore: 0, aScore: 0,
    goesToET: false, goesToPens: false,
    hPenScore: 0, aPenScore: 0,
  };
  // Pre-populate XIs
  refreshExSideXI('home');
  refreshExSideXI('away');
  renderExternalModal();
}

function renderExternalModal() {
  const s = _exDraftState;
  if (!s) return;
  const body = `
    <div class="form-row">
      ${formGroup('Match type', formSelect('ex-type', s.type, ['NT friendly','NT qualifier','NT competitive','Continental club','Friendly','Other']))}
      ${formGroup('Competition / round', `<input type="text" id="ex-comp" value="${esc(s.competition)}" placeholder="e.g. World Cup qualifier R3">`)}
    </div>

    <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:start">
      ${renderExSideHTML('home')}
      <div style="display:flex;align-items:center;justify-content:center;height:60px"><button class="btn btn-sm" title="Swap home / away" onclick="exSwapSides()" style="margin-top:36px">⇄</button></div>
      ${renderExSideHTML('away')}
    </div>

    <h4>Final score</h4>
    <div class="form-row-3">
      ${formGroup(s.home.customName || 'Home', `<input type="number" id="ex-h" min="0" max="20" value="${s.hScore}">`)}
      <div class="form-group" style="display:flex;align-items:end;justify-content:center"><span class="text-muted">–</span></div>
      ${formGroup(s.away.customName || 'Away', `<input type="number" id="ex-a" min="0" max="20" value="${s.aScore}">`)}
    </div>
    <label style="display:flex;gap:8px;align-items:center;cursor:pointer;font-size:13px">
      <input type="checkbox" id="ex-toET" ${s.goesToET ? 'checked' : ''} onchange="exFlagToggle('goesToET', this.checked)"> Match went to extra time
    </label>
    <label style="display:flex;gap:8px;align-items:center;cursor:pointer;font-size:13px;margin-top:4px">
      <input type="checkbox" id="ex-toPens" ${s.goesToPens ? 'checked' : ''} onchange="exFlagToggle('goesToPens', this.checked)"> Decided on penalties
    </label>
    <div class="form-row" id="ex-pens-row" style="display:${s.goesToPens ? 'grid' : 'none'};margin-top:8px">
      ${formGroup('Pens (home)', `<input type="number" id="ex-hpen" min="0" max="20" value="${s.hPenScore}">`)}
      ${formGroup('Pens (away)', `<input type="number" id="ex-apen" min="0" max="20" value="${s.aPenScore}">`)}
    </div>
  `;
  const footer = `
    <button class="btn" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="generateExternalAndPreview()">⚡ Generate report</button>
  `;
  openModal({ title: 'Generate external match', body, footer, wide: true });
}

function renderExSideHTML(side) {
  const s = _exDraftState[side];
  const xi = s.xi;
  const xiSummary = xi && xi.slots.length
    ? xi.slots.map(slot => `<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0;border-bottom:1px dashed var(--border)"><span><span class="text-muted" style="font-family:var(--font-mono);font-size:11px;width:32px;display:inline-block">${slot.role}</span> ${esc(slot.player?.name || '—')}</span><span class="text-muted" style="font-family:var(--font-mono);font-size:11px">${slot.player ? playerOverall(slot.player) : '—'}</span></div>`).join('')
    : '<p class="text-muted" style="font-size:12px">No XI yet — pick a source above.</p>';
  const benchSummary = xi && xi.bench && xi.bench.length
    ? `<h4 style="margin-top:12px;font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em">Bench (${xi.bench.length})</h4>
       <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 8px;background:var(--bg-input)">
         ${xi.bench.map(b => `<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0"><span><span class="text-muted" style="font-family:var(--font-mono);font-size:11px;width:32px;display:inline-block">${b.player?.role || '—'}</span> ${esc(b.player?.name || '—')}</span><span class="text-muted" style="font-family:var(--font-mono);font-size:11px">${b.player ? playerOverall(b.player) : '—'}</span></div>`).join('')}
       </div>`
    : '';

  let sourceForm = '';
  const ntAvail = (state.settings.ntSquad || []).length >= 11;
  if (s.source === 'nt') {
    sourceForm = `<p class="text-muted" style="font-size:12px">Using your nation's NT squad. ${ntAvail ? `Squad has ${state.settings.ntSquad.length} players.` : `<span class="text-warn">Need at least 11 players in NT squad. Go to National Team to call players up first.</span>`}</p>`;
  } else if (s.source === 'club') {
    sourceForm = `${formGroup('Club', formSelect(`ex-${side}-club`, s.clubId || '', [{value:'', label:'(pick a club)'}, ...state.clubs.map(c => ({value: c.id, label: c.name}))]))}<script>document.getElementById('ex-${side}-club').addEventListener('change', e => exSideChanged('${side}', 'clubId', e.target.value));</script>`;
  } else {
    const rosterPlaceholder = `GK John Goalie #1\nRB Quick Smith #2\nCB Rock Solid #4\nCB Tank Big #5\nLB Lefty Run #3\nCDM Anchor Mid #6\nCM Pass Master #8\nCAM Creative Ace #10\nRW Wing Wizard #7\nLW Speed Demon #11\nST Goal Striker #9\n---\nGK Backup Keeper #13\nCB Reserve Wall #14\nCM Bench Mid #16\nST Sub Forward #19`;
    sourceForm = `
      ${formGroup('Team name', `<input type="text" id="ex-${side}-name" value="${esc(s.customName)}" placeholder="e.g. Vexillium FC">`)}
      <div class="form-row">
        ${formGroup('Strength (0–99)', `<input type="number" id="ex-${side}-str" min="0" max="99" value="${s.strength}">`)}
        ${formGroup('Name bank', formSelect(`ex-${side}-bank`, state.settings.defaultNameBank, Object.keys(state.nameBanks)))}
      </div>
      ${formGroup(`Roster <span class="text-muted" style="text-transform:none;letter-spacing:0;font-weight:400;font-size:11px">— optional. One player per line: <code>ROLE Name #shirt ~strength</code>. Use <code>---</code> to mark the bench. Empty = randomise.</span>`,
        `<textarea id="ex-${side}-roster" rows="8" style="width:100%;font-family:var(--font-mono);font-size:12px" placeholder="${esc(rosterPlaceholder)}">${esc(s.customRoster || '')}</textarea>`)}
      <button class="btn btn-sm" onclick="exSideRegenerateCustom('${side}')">↻ Regenerate XI</button>
    `;
  }

  return `<div class="card" style="padding:14px">
    <h3 style="font-size:14px;margin-bottom:10px">${side === 'home' ? 'Home team' : 'Away team'}</h3>
    <div class="form-row">
      ${formGroup('Source', formSelect(`ex-${side}-source`, s.source, [
        ...(state.settings.nation.name ? [{value: 'nt', label: `Use NT (${esc(state.settings.nation.name)})`}] : []),
        {value: 'club', label: 'Existing club'},
        {value: 'custom', label: 'Custom external'}
      ]))}
      ${formGroup('Formation', formSelect(`ex-${side}-form`, s.formation, Object.keys(FORMATIONS)))}
    </div>
    <script>
      document.getElementById('ex-${side}-source').addEventListener('change', e => exSideChanged('${side}', 'source', e.target.value));
      document.getElementById('ex-${side}-form').addEventListener('change', e => exSideChanged('${side}', 'formation', e.target.value));
    </script>
    ${sourceForm}
    <h4 style="margin-top:12px">Starting XI ${xi ? `<span class="text-muted" style="font-size:11px">(${xi.formation})</span>` : ''}</h4>
    <div style="max-height:280px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px;background:var(--bg-input)">
      ${xiSummary}
    </div>
    ${benchSummary}
  </div>`;
}

function exSideChanged(side, field, value) {
  const s = _exDraftState[side];
  // Capture custom-name + custom-roster + score + ET/pens before re-render
  captureExFormState();
  s[field] = field === 'strength' ? (parseInt(value) || 60) : value;
  if (field === 'source') {
    if (value === 'nt') s.clubId = null;
    if (value === 'club') s.clubId = state.clubs[0]?.id || null;
  }
  refreshExSideXI(side);
  renderExternalModal();
}

function exSideRegenerateCustom(side) {
  captureExFormState();
  refreshExSideXI(side);
  renderExternalModal();
}

function exFlagToggle(field, checked) {
  captureExFormState();
  _exDraftState[field] = !!checked;
  renderExternalModal();
}

function exSwapSides() {
  captureExFormState();
  const s = _exDraftState;
  [s.home, s.away] = [s.away, s.home];
  [s.hScore, s.aScore] = [s.aScore, s.hScore];
  [s.hPenScore, s.aPenScore] = [s.aPenScore, s.hPenScore];
  // Re-derive XIs since formation/source might have moved
  refreshExSideXI('home');
  refreshExSideXI('away');
  renderExternalModal();
}

function captureExFormState() {
  const s = _exDraftState;
  const t = document.getElementById('ex-type'); if (t) s.type = t.value;
  const c = document.getElementById('ex-comp'); if (c) s.competition = c.value.trim();
  const h = document.getElementById('ex-h'); if (h) s.hScore = clamp(parseInt(h.value) || 0, 0, 20);
  const a = document.getElementById('ex-a'); if (a) s.aScore = clamp(parseInt(a.value) || 0, 0, 20);
  const hp = document.getElementById('ex-hpen'); if (hp) s.hPenScore = clamp(parseInt(hp.value) || 0, 0, 20);
  const ap = document.getElementById('ex-apen'); if (ap) s.aPenScore = clamp(parseInt(ap.value) || 0, 0, 20);
  for (const side of ['home', 'away']) {
    const ss = s[side];
    const nameEl = document.getElementById(`ex-${side}-name`);
    if (nameEl) ss.customName = nameEl.value.trim();
    const strEl = document.getElementById(`ex-${side}-str`);
    if (strEl) ss.strength = clamp(parseInt(strEl.value) || 60, 0, 99);
    const bankEl = document.getElementById(`ex-${side}-bank`);
    if (bankEl) ss.nameBank = bankEl.value;
    const rosterEl = document.getElementById(`ex-${side}-roster`);
    if (rosterEl) ss.customRoster = rosterEl.value;
  }
}

function refreshExSideXI(side) {
  const s = _exDraftState[side];
  if (s.source === 'nt') {
    if ((state.settings.ntSquad || []).length >= 11) {
      s.xi = autoPickXIFromPool(state.settings.ntSquad, s.formation);
      s.customName = state.settings.nation.name || 'National team';
    } else {
      s.xi = null;
    }
  } else if (s.source === 'club') {
    if (s.clubId) {
      const ids = playersByClub(s.clubId).filter(p => !p.isRetired).map(p => p.id);
      s.xi = autoPickXIFromPool(ids, s.formation);
      s.customName = getClub(s.clubId)?.name || '?';
    } else {
      s.xi = null;
    }
  } else {
    const bank = s.nameBank || state.settings.defaultNameBank;
    if ((s.customRoster || '').trim()) {
      s.xi = parseCustomRoster(s.customRoster, {
        formation: s.formation,
        baseStrength: s.strength,
        nameBank: bank,
        nationality: '',
      });
    } else {
      s.xi = synthesizeXI({ formation: s.formation, strength: s.strength, nameBank: bank, nationality: '', teamName: s.customName });
    }
  }
}

function generateExternalAndPreview() {
  captureExFormState();
  // Re-derive XIs from the latest captured state so unsaved roster edits
  // (typed but no Regenerate click) are reflected in the generated match.
  refreshExSideXI('home');
  refreshExSideXI('away');
  const s = _exDraftState;
  if (!s.home.xi || !s.away.xi) { showToast('Both sides need a starting XI', 'error'); return; }
  // Final-score sanity
  if (s.goesToPens && s.hScore !== s.aScore) {
    if (!confirm(`The score ${s.hScore}-${s.aScore} isn't level — penalties usually decide drawn ties. Generate anyway?`)) return;
  }
  const draft = scriptedMatch({
    homeName: s.home.customName,
    awayName: s.away.customName,
    homeXI: s.home.xi,
    awayXI: s.away.xi,
    hScore: s.hScore, aScore: s.aScore,
    type: s.type, competition: s.competition,
    goesToET: s.goesToET, goesToPens: s.goesToPens,
    hPenScore: s.hPenScore, aPenScore: s.aPenScore,
  });
  if (!draft) return;
  // Preview the report; user can save / re-roll
  closeModal();
  setTimeout(() => previewExternalDraft(draft), 50);
}

function previewExternalDraft(draft) {
  const home = draft.homeName;
  const away = draft.awayName;
  const events = draft.events || [];
  let body = `<div class="match-report">
    <div class="match-report-header">
      <div class="team-block home"><div class="team-name">${esc(home)}</div><div class="team-tactics">${esc(draft.homeFormation || '')}</div></div>
      <div>
        <div class="score-big">${draft.hScore} – ${draft.aScore}</div>
        <div class="score-meta">${draft.extraTime ? 'a.e.t. · ' : ''}${draft.penalties ? `${draft.penalties.homeKicks}–${draft.penalties.awayKicks} pens · ` : ''}+${draft.stoppage || 0}</div>
      </div>
      <div class="team-block away"><div class="team-name">${esc(away)}</div><div class="team-tactics">${esc(draft.awayFormation || '')}</div></div>
    </div>
    <div class="match-meta-row"><div>${esc(draft.type || '')}${draft.competition ? ` · ${esc(draft.competition)}` : ''}</div><div>Season ${draft.season}</div></div>`;
  const st = draft.stats || {};
  body += `<div class="match-stats-row"><div class="stat-h">${st.possessionH ?? '-'}%</div><div class="stat-l">Possession</div><div class="stat-a">${st.possessionA ?? '-'}%</div></div>`;
  body += `<div class="match-stats-row"><div class="stat-h">${st.shotsH ?? '-'} (${st.sotH ?? '-'})</div><div class="stat-l">Shots (on tgt)</div><div class="stat-a">${st.shotsA ?? '-'} (${st.sotA ?? '-'})</div></div>`;
  body += `<div class="commentary-log">`;
  for (const ev of events) {
    const minLabel = ev.minute > 90 ? `90+${ev.minute - 90}'` : `${ev.minute}'`;
    const score = ev.score ? `<span class="ce-running-score">${esc(ev.score)}</span>` : '';
    body += `<div class="commentary-event ce-${ev.type}"><div class="ce-min">${minLabel}</div><div class="ce-icon">${ev.icon || ''}</div><div class="ce-text">${esc(ev.text || '')}${score}</div></div>`;
  }
  body += `</div></div>`;

  // Stash the draft so the buttons can find it
  window._exDraftPreview = draft;
  const footer = `
    <button class="btn" onclick="closeModal()">Discard</button>
    <button class="btn btn-warn" onclick="rerollExternalDraft()">↻ Re-roll</button>
    <button class="btn btn-primary" onclick="saveExternalDraft()">✓ Save to External Matches</button>
  `;
  openModal({ title: `${home} vs ${away}`, body, footer, wide: true });
}

function rerollExternalDraft() {
  const old = window._exDraftPreview;
  if (!old) return;
  const fresh = scriptedMatch({
    homeName: old.homeName, awayName: old.awayName,
    homeXI: old.homeXI, awayXI: old.awayXI,
    hScore: old.hScore, aScore: old.aScore,
    type: old.type, competition: old.competition,
    goesToET: !!old.extraTime, goesToPens: !!old.penalties,
    hPenScore: old.penalties?.homeKicks, aPenScore: old.penalties?.awayKicks,
  });
  if (!fresh) return;
  closeModal();
  setTimeout(() => previewExternalDraft(fresh), 50);
}

function saveExternalDraft() {
  const draft = window._exDraftPreview;
  if (!draft) return;
  state.externalMatches = state.externalMatches || [];
  state.externalMatches.push(draft);
  // Light-touch stat side-effects: apps/goals/assists only, no ban/injury/fatigue.
  applyExternalMatchStats(draft);
  // Also append to history book so it surfaces in player ledgers
  historyAppend('external_match', {
    matchId: draft.id,
    type: draft.type, competition: draft.competition,
    homeName: draft.homeName, awayName: draft.awayName,
    hScore: draft.hScore, aScore: draft.aScore,
    scorers: draft.scorers, cards: draft.cards,
    extraTime: draft.extraTime, penalties: draft.penalties,
    appearances: draft.appearances,
  });
  saveState();
  window._exDraftPreview = null;
  closeModal();
  refreshAll();
  showToast('External match saved', 'success');
}
