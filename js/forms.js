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
    rules: { promoted: 0, relegated: 3, playoffsEnabled: false },
    pointsSystem: { ...DEFAULT_POINTS_SYSTEM },
    tiebreakers: TIEBREAKERS.slice(),
    schedule: [], status: 'pending', season: state.settings.season
  };
  const allClubOptions = state.clubs.map(c => ({ value: c.id, label: `${c.name}${c.leagueId && c.leagueId !== id ? ' (in ' + (getLeague(c.leagueId)?.name || '?') + ')' : ''}` }));
  const body = `
    <div class="form-row">
      ${formGroup('Name', `<input type="text" id="lg-name" value="${esc(draft.name)}" placeholder="e.g. Premier Division">`)}
      ${formGroup('Tier (1 = top)', `<input type="number" id="lg-tier" value="${draft.tier}" min="1" max="20">`)}
    </div>
    <div class="form-row-3">
      ${formGroup('Promoted (top N)', `<input type="number" id="lg-promoted" value="${draft.rules.promoted}" min="0" max="10">`)}
      ${formGroup('Relegated (bottom N)', `<input type="number" id="lg-relegated" value="${draft.rules.relegated}" min="0" max="10">`)}
      ${formGroup('Promotion playoffs', `<label style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" id="lg-playoffs" ${draft.rules.playoffsEnabled ? 'checked' : ''}> enabled</label>`)}
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
      playoffsEnabled: document.getElementById('lg-playoffs').checked
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
      ${formGroup('Player nationality bank', formSelect('cl-bank', draft.nameBankPref, Object.keys(state.nameBanks)))}
    </div>
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
      ${formGroup('Default name bank', formSelect('gen-bank', state.settings.defaultNameBank, Object.keys(state.nameBanks)))}
      ${formGroup('Avg quality (0–99)', `<input type="number" id="gen-quality" value="55" min="20" max="90">`)}
    </div>
    <div class="form-row">
      ${formGroup('Squad size per club', `<input type="number" id="gen-squad" value="22" min="11" max="40">`)}
      ${formGroup('Quality variance (±)', `<input type="number" id="gen-var" value="10" min="0" max="40">`)}
    </div>
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
  const baseQ = clamp(parseInt(document.getElementById('gen-quality').value) || 55, 20, 90);
  const variance = clamp(parseInt(document.getElementById('gen-var').value) || 10, 0, 40);
  const squad = clamp(parseInt(document.getElementById('gen-squad').value) || 22, 11, 40);
  const genMgrs = document.getElementById('gen-mgrs').checked;
  const genSched = document.getElementById('gen-schedule').checked;

  const created = [];
  for (let i = 0; i < n; i++) {
    const q = baseQ + pickInt(-variance, variance);
    const nameBank = state.nameBanks[bank] ? bank : state.settings.defaultNameBank;
    const c = generateClub({ leagueId, quality: q, nameBankPref: nameBank });
    if (leagueId) {
      const lg = getLeague(leagueId);
      if (lg && !lg.clubIds.includes(c.id)) lg.clubIds.push(c.id);
    }
    generateSquad(c.id, { size: squad, quality: q, nameBank });
    if (genMgrs) {
      const m = generateManager({ nationality: nameBank });
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
    nationality: state.settings.defaultNameBank,
    age: 22, position: 'MF', role: 'CM',
    attrs: { pace: 50, strength: 50, technique: 50, passing: 50, defending: 50, shooting: 50, mental: 50, goalkeeping: 1 },
    potential: 70, injuryProneness: 20,
    clubId: null, shirtNumber: null,
    contract: { wage: 1000, years: 3 },
    status: { injuredUntil: 0, suspendedFor: 0, yellowsThisSeason: 0 },
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
      ${formGroup('Nationality', formSelect('pl-nat', draft.nationality, Object.keys(state.nameBanks)))}
      ${formGroup('Shirt number', `<input type="number" id="pl-shirt" min="1" max="99" value="${draft.shirtNumber ?? ''}">`)}
    </div>
    <div class="form-row-3">
      ${formGroup('Position', formSelect('pl-pos', draft.position, POSITIONS))}
      ${formGroup('Role', `<input type="text" id="pl-role" value="${esc(draft.role)}" placeholder="e.g. CB, CM, ST">`)}
      ${formGroup('Club', formSelect('pl-club', draft.clubId || '', [{value:'', label:'(free agent)'}, ...state.clubs.map(c => ({value: c.id, label: c.name}))]))}
    </div>
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
    nationality: document.getElementById('pl-nat').value,
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
  if (!data.firstName || !data.lastName) { showToast('First and last names required', 'error'); return; }
  data.name = `${data.firstName} ${data.lastName}`;

  if (player) {
    Object.assign(player, data);
  } else {
    state.players.push(Object.assign({
      id: uid('p_'),
      dob: { year: state.settings.season - data.age },
      contract: { wage: 1000, years: 3 },
      status: { injuredUntil: 0, suspendedFor: 0, yellowsThisSeason: 0 },
      seasonStats: { apps: 0, goals: 0, assists: 0, yellows: 0, reds: 0 },
    }, data));
  }
  saveState(); closeModal(); refreshAll();
  showToast('Player saved', 'success');
}

/* ===========================================================================
 * MANAGER form
 * ========================================================================= */
function openManagerModal(id) {
  const m = id ? getManager(id) : null;
  const draft = m ? deepClone(m) : {
    id: null, firstName: '', lastName: '', nationality: state.settings.defaultNameBank,
    attrs: { tactical: 60, manManagement: 60, youthDev: 60, reputation: 60 },
    formerPlayerId: null, clubId: null, isUnemployed: true
  };
  const body = `
    <div class="form-row">
      ${formGroup('First name', `<input type="text" id="mg-first" value="${esc(draft.firstName)}">`)}
      ${formGroup('Last name', `<input type="text" id="mg-last" value="${esc(draft.lastName)}">`)}
    </div>
    <div class="form-row">
      ${formGroup('Nationality', formSelect('mg-nat', draft.nationality, Object.keys(state.nameBanks)))}
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
    nationality: document.getElementById('mg-nat').value,
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
 * EXTERNAL match form
 * ========================================================================= */
function openExternalModal() {
  const nat = state.settings.nation.name || 'Your nation';
  const body = `
    <div class="form-row">
      ${formGroup('Type', formSelect('ex-type', 'NT friendly', ['NT friendly','NT qualifier','NT competitive','Continental club','Friendly']))}
      ${formGroup('Competition / round', `<input type="text" id="ex-comp" placeholder="e.g. World Cup qualifier R3">`)}
    </div>
    <div class="form-row">
      ${formGroup('Home team', `<input type="text" id="ex-home" placeholder="${esc(nat)}" value="${esc(nat)}">`)}
      ${formGroup('Away team', `<input type="text" id="ex-away" placeholder="Opponent">`)}
    </div>
    <div class="form-row">
      ${formGroup('Home score', `<input type="number" id="ex-h" min="0" value="0">`)}
      ${formGroup('Away score', `<input type="number" id="ex-a" min="0" value="0">`)}
    </div>
    ${formGroup('Notes', `<textarea id="ex-notes" placeholder="Goal-scorers, key incidents..."></textarea>`)}
  `;
  const footer = `
    <button class="btn" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="saveExternalFromForm()">Save</button>
  `;
  openModal({ title: 'Log external match', body, footer });
}

function saveExternalFromForm() {
  const m = {
    id: uid('ex_'),
    season: state.settings.season,
    type: document.getElementById('ex-type').value,
    competition: document.getElementById('ex-comp').value.trim(),
    homeName: document.getElementById('ex-home').value.trim(),
    awayName: document.getElementById('ex-away').value.trim(),
    hScore: parseInt(document.getElementById('ex-h').value) || 0,
    aScore: parseInt(document.getElementById('ex-a').value) || 0,
    notes: document.getElementById('ex-notes').value.trim(),
    ts: Date.now()
  };
  if (!m.homeName || !m.awayName) { showToast('Both teams required', 'error'); return; }
  state.externalMatches = state.externalMatches || [];
  state.externalMatches.push(m);
  saveState(); closeModal(); refreshAll();
  showToast('External match logged', 'success');
}
