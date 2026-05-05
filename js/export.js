/* ===========================================================================
 * CRUFYmanager — export.js
 *   phpBB-flavoured BBCode generators. Each fn returns a string ready
 *   to paste into a NationStates forum post.
 *
 *   Supported tags: [b] [i] [u] [color=#xxx] [size=N] [url=...] [center]
 *   [hr] [list] [table][tr][td][/td][/tr][/table]
 * ========================================================================= */

const BB_ACCENT = '#3aa066';
const BB_DIM = '#888888';
const BB_DANGER = '#c0392b';
const BB_WARN = '#e0a855';

function bb(tag, content, attr) {
  if (attr != null && attr !== '') return `[${tag}=${attr}]${content}[/${tag}]`;
  return `[${tag}]${content}[/${tag}]`;
}

function bbColour(hex, content) { return bb('color', content, hex); }
function bbBold(s) { return bb('b', s); }
function bbItalic(s) { return bb('i', s); }
function bbCentre(s) { return bb('center', s); }
function bbSize(n, s) { return bb('size', s, n); }

function bbcodeNationHeader() {
  const n = state.settings.nation;
  if (!n.name) return '';
  let s = bbCentre(bbSize(150, bbBold(n.name)));
  if (n.faName) s += '\n' + bbCentre(bbSize(85, bbItalic(n.faName)));
  return s + '\n[hr]\n';
}

/* ===========================================================================
 * Match report — full
 * ========================================================================= */
function bbcodeMatchReport(match) {
  if (!match) return '';
  const home = getClub(match.homeId);
  const away = getClub(match.awayId);
  if (!home || !away) return '';

  let s = '';
  s += bbcodeNationHeader();
  // Header
  let scoreStr = `${match.hScore} – ${match.aScore}`;
  if (match.extraTime) scoreStr += ' (a.e.t.)';
  if (match.penalties) scoreStr += ` (${match.penalties.homeKicks}–${match.penalties.awayKicks} pens)`;
  s += bbCentre(bbSize(140, `${bbBold(home.name)} ${bbColour(BB_ACCENT, scoreStr)} ${bbBold(away.name)}`)) + '\n';
  // Meta line
  const meta = [];
  if (match.leagueId) {
    const lg = getLeague(match.leagueId);
    if (lg) meta.push(`${lg.name} · Matchday ${match.matchday}`);
  }
  if (match.cupId) {
    const cp = getCup(match.cupId);
    if (cp) meta.push(`${cp.name}`);
  }
  meta.push(`Season ${match.season}`);
  meta.push(`${home.stadiumName}, attendance ${pickInt(Math.round(home.stadiumCapacity * 0.55), home.stadiumCapacity).toLocaleString()}`);
  s += bbCentre(bbSize(85, bbColour(BB_DIM, meta.join(' · ')))) + '\n[hr]\n';

  // Scorers
  const homeScorers = (match.scorers || []).filter(sc => sc.side === 'home');
  const awayScorers = (match.scorers || []).filter(sc => sc.side === 'away');
  if (homeScorers.length || awayScorers.length) {
    s += `[table][tr][td]${bbBold(home.name)}[/td][td]${bbBold(away.name)}[/td][/tr]\n`;
    const fmt = sc => `${playerName(sc.playerId)} ${sc.minute}'${sc.penalty ? ' (P)' : ''}${sc.ownGoal ? ' (OG)' : ''}`;
    s += `[tr][td]${homeScorers.map(fmt).join('[br]')}[/td]`;
    s += `[td]${awayScorers.map(fmt).join('[br]')}[/td][/tr][/table]\n\n`;
  }

  // Stats summary
  const st = match.stats || {};
  s += bbBold('Match statistics') + '\n';
  s += `[table]\n`;
  const statRow = (l, h, a) => `[tr][td]${h}[/td][td]${bbBold(l)}[/td][td]${a}[/td][/tr]\n`;
  s += statRow('Possession', `${st.possessionH ?? '-'}%`, `${st.possessionA ?? '-'}%`);
  s += statRow('Shots', st.shotsH ?? '-', st.shotsA ?? '-');
  s += statRow('On target', st.sotH ?? '-', st.sotA ?? '-');
  s += statRow('Corners', st.cornersH ?? '-', st.cornersA ?? '-');
  s += statRow('Fouls', st.foulsH ?? '-', st.foulsA ?? '-');
  s += statRow('Yellows', st.yellowsH ?? 0, st.yellowsA ?? 0);
  if ((st.redsH || 0) + (st.redsA || 0) > 0) s += statRow('Reds', st.redsH ?? 0, st.redsA ?? 0);
  s += `[/table]\n\n`;

  // Lineups
  s += bbBold('Lineups') + '\n';
  s += bbcodeLineup(home, match.homeXI) + '\n';
  s += bbcodeLineup(away, match.awayXI) + '\n';

  // Key events / commentary
  s += bbBold('Match events') + '\n';
  s += bbcodeCommentaryList(match.events) + '\n';

  return s.trim();
}

function bbcodeLineup(club, xi) {
  if (!xi || !xi.slots) return '';
  let s = `${bbBold(club.name)} (${xi.formation})\n[list]`;
  for (const slot of xi.slots) {
    const p = getPlayer(slot.playerId);
    if (!p) continue;
    s += `[*]${slot.role}: ${p.shirtNumber ? `#${p.shirtNumber} ` : ''}${p.name}`;
  }
  if (xi.benchIds && xi.benchIds.length) {
    s += `[*]${bbItalic('Bench: ' + xi.benchIds.map(playerName).join(', '))}`;
  }
  s += '[/list]';
  return s;
}

function bbcodeCommentaryList(events) {
  if (!events || !events.length) return '';
  let s = '[list]';
  const wanted = new Set(['kickoff', 'goal', 'penalty', 'pen_missed', 'yellow', 'red', 'injury', 'sub', 'halftime', 'fulltime', 'penalties']);
  for (const e of events) {
    if (!wanted.has(e.type)) continue;
    const minLabel = e.minute > 90 ? `90+${e.minute - 90}'` : `${e.minute}'`;
    let coloured = e.text;
    if (e.type === 'goal' || e.type === 'penalty') coloured = bbColour(BB_ACCENT, coloured);
    if (e.type === 'red') coloured = bbColour(BB_DANGER, coloured);
    if (e.type === 'yellow') coloured = bbColour(BB_WARN, coloured);
    s += `[*]${bbBold(minLabel)} — ${coloured}`;
  }
  s += '[/list]';
  return s;
}

/* ===========================================================================
 * League table
 * ========================================================================= */
function bbcodeLeagueTable(leagueId, season) {
  const lg = getLeague(leagueId);
  if (!lg) return '';
  season = season ?? state.settings.season;
  const table = leagueTable(leagueId, season);
  const promoted = lg.rules?.promoted ?? 0;
  const relegated = lg.rules?.relegated ?? 0;

  let s = '';
  s += bbcodeNationHeader();
  s += bbCentre(bbSize(140, bbBold(`${lg.name} — Season ${season}`))) + '\n';
  s += '[hr]\n';
  s += '[table]\n';
  s += `[tr][td]${bbBold('#')}[/td][td]${bbBold('Club')}[/td][td]${bbBold('P')}[/td][td]${bbBold('W')}[/td][td]${bbBold('D')}[/td][td]${bbBold('L')}[/td][td]${bbBold('GF')}[/td][td]${bbBold('GA')}[/td][td]${bbBold('GD')}[/td][td]${bbBold('Pts')}[/td][/tr]\n`;
  table.forEach((r, i) => {
    const pos = i + 1;
    let posLabel = `${pos}`;
    if (pos <= promoted) posLabel = bbColour('#55c07a', posLabel);
    else if (pos > table.length - relegated) posLabel = bbColour('#e05555', posLabel);
    s += `[tr][td]${posLabel}[/td][td]${bbBold(clubName(r.clubId))}[/td][td]${r.p}[/td][td]${r.w}[/td][td]${r.d}[/td][td]${r.l}[/td][td]${r.gf}[/td][td]${r.ga}[/td][td]${r.gd > 0 ? '+' : ''}${r.gd}[/td][td]${bbBold(r.pts)}[/td][/tr]\n`;
  });
  s += '[/table]\n';
  if (promoted || relegated) {
    s += bbItalic(bbColour(BB_DIM, `${promoted ? `Top ${promoted} promoted. ` : ''}${relegated ? `Bottom ${relegated} relegated.` : ''}`)) + '\n';
  }
  return s;
}

/* ===========================================================================
 * Top scorers
 * ========================================================================= */
function bbcodeTopScorers(leagueId, season, limit = 10) {
  const lg = getLeague(leagueId);
  if (!lg) return '';
  season = season ?? state.settings.season;
  const ts = topScorers(leagueId, season, limit);
  let s = '';
  s += bbCentre(bbSize(120, bbBold(`${lg.name} — Top scorers — Season ${season}`))) + '\n';
  s += '[table]\n';
  s += `[tr][td]${bbBold('#')}[/td][td]${bbBold('Player')}[/td][td]${bbBold('Club')}[/td][td]${bbBold('Goals')}[/td][/tr]\n`;
  ts.forEach((row, i) => {
    const p = getPlayer(row.playerId);
    s += `[tr][td]${i + 1}[/td][td]${bbBold(p ? p.name : '?')}[/td][td]${p ? clubName(p.clubId) : '?'}[/td][td]${bbBold(row.goals)}[/td][/tr]\n`;
  });
  s += '[/table]\n';
  return s;
}

/* ===========================================================================
 * Matchday round-up
 * ========================================================================= */
function bbcodeMatchdayResults(leagueId, matchday) {
  const lg = getLeague(leagueId);
  if (!lg) return '';
  const matches = state.history.filter(e =>
    e.type === 'match_committed' && !e.struck && e.leagueId === leagueId &&
    e.season === state.settings.season && e.matchday === matchday
  );
  let s = '';
  s += bbcodeNationHeader();
  s += bbCentre(bbSize(140, bbBold(`${lg.name} — Matchday ${matchday} round-up`))) + '\n[hr]\n';
  s += '[table]\n';
  for (const m of matches) {
    s += `[tr][td]${clubName(m.homeId)}[/td][td]${bbBold(`${m.hScore} – ${m.aScore}`)}[/td][td]${clubName(m.awayId)}[/td][/tr]\n`;
    const sc = (m.scorers || []).map(x => `${playerName(x.playerId)} ${x.minute}'${x.penalty ? '(p)' : ''}${x.ownGoal ? '(OG)' : ''}`);
    if (sc.length) s += `[tr][td][/td][td]${bbColour(BB_DIM, bbItalic(sc.join('; ')))}[/td][td][/td][/tr]\n`;
  }
  s += '[/table]\n';
  return s;
}

/* ===========================================================================
 * Cup bracket
 * ========================================================================= */
function bbcodeCupBracket(cupId) {
  const cp = getCup(cupId);
  if (!cp) return '';
  let s = '';
  s += bbcodeNationHeader();
  s += bbCentre(bbSize(140, bbBold(`${cp.name} — Season ${cp.season}`))) + '\n[hr]\n';
  if (cp.format === 'group_knockout' && cp.groups && cp.groups.length) {
    s += bbBold('Group stage') + '\n';
    for (const g of cp.groups) {
      s += bbBold(g.name) + '\n[table]\n';
      s += `[tr][td]#[/td][td]Club[/td][td]P[/td][td]W[/td][td]D[/td][td]L[/td][td]GF[/td][td]GA[/td][td]GD[/td][td]Pts[/td][/tr]\n`;
      const tbl = groupTable(g);
      tbl.forEach((r, i) => {
        s += `[tr][td]${i + 1}[/td][td]${bbBold(clubName(r.clubId))}[/td][td]${r.p}[/td][td]${r.w}[/td][td]${r.d}[/td][td]${r.l}[/td][td]${r.gf}[/td][td]${r.ga}[/td][td]${r.gd > 0 ? '+' : ''}${r.gd}[/td][td]${bbBold(r.pts)}[/td][/tr]\n`;
      });
      s += '[/table]\n';
    }
    s += '\n';
  }
  if (cp.rounds && cp.rounds.length) {
    s += bbBold('Knockout rounds') + '\n[list]';
    for (const rd of cp.rounds) {
      s += `[*]${bbBold(rd.name)}\n[list]`;
      for (const t of rd.ties) {
        const home = clubName(t.homeId);
        const away = t.awayId ? clubName(t.awayId) : '(bye)';
        let line = `${home} vs ${away}`;
        if (t.played) line += ' — see match report';
        if (t.winnerId) line += `   → ${bbBold(clubName(t.winnerId))}`;
        s += `[*]${line}`;
      }
      s += '[/list]';
    }
    s += '[/list]';
  }
  return s;
}

/* ===========================================================================
 * Plain news feed compilation (BBCode list)
 * ========================================================================= */
function bbcodeNewsFeed(maxItems = 30) {
  const items = compileNewsItems(maxItems);
  if (!items.length) return '(no news yet)';
  let s = bbcodeNationHeader() + bbCentre(bbSize(120, bbBold('News'))) + '\n[hr]\n[list]';
  for (const it of items) s += `[*]${it.text}`;
  s += '[/list]';
  return s;
}

/* ===========================================================================
 * News derivation — read from history book
 * ========================================================================= */
function compileNewsItems(maxItems = 30) {
  const out = [];
  // Iterate history newest first
  const entries = state.history.slice().reverse();
  for (const e of entries) {
    if (e.struck) continue;
    let text = null, severity = '';
    switch (e.type) {
      case 'player_retired': {
        const p = getPlayer(e.playerId);
        if (!p) break;
        text = templ(pick(NEWS_TEMPLATES.retire), { player: p.name, age: e.age, apps: '?' });
        severity = 'major';
        break;
      }
      case 'player_to_manager': {
        const p = getPlayer(e.playerId);
        const m = getManager(e.managerId);
        if (!p || !m) break;
        text = templ(pick(NEWS_TEMPLATES.retireToManager), { player: p.name, age: p.age });
        severity = 'major';
        break;
      }
      case 'manager_hired': {
        const m = getManager(e.managerId);
        const c = getClub(e.clubId);
        if (!m || !c) break;
        text = templ(pick(NEWS_TEMPLATES.hire), { manager: `${m.firstName} ${m.lastName}`, club: c.name });
        severity = 'major';
        break;
      }
      case 'manager_sacked': {
        const m = getManager(e.managerId);
        const c = getClub(e.clubId);
        if (!m || !c) break;
        text = templ(pick(NEWS_TEMPLATES.sack), { manager: `${m.firstName} ${m.lastName}`, club: c.name });
        severity = 'warn';
        break;
      }
      case 'season_ended': {
        const lg = getLeague(e.leagueId);
        if (!lg) break;
        if (e.championId) {
          out.push({ ts: e.ts, text: templ(pick(NEWS_TEMPLATES.champion), { club: clubName(e.championId), league: lg.name }), severity: 'major' });
        }
        for (const id of (e.promoted || [])) out.push({ ts: e.ts, text: templ(pick(NEWS_TEMPLATES.promoted), { club: clubName(id), league: lg.name }), severity: '' });
        for (const id of (e.relegated || [])) out.push({ ts: e.ts, text: templ(pick(NEWS_TEMPLATES.relegated), { club: clubName(id), league: lg.name }), severity: 'warn' });
        continue;
      }
      case 'cup_won': {
        const cp = getCup(e.cupId);
        if (!cp) break;
        text = templ(pick(NEWS_TEMPLATES.cupWin), { club: clubName(e.winnerId), cup: cp.name });
        severity = 'major';
        break;
      }
      case 'youth_intake': {
        const c = getClub(e.clubId);
        if (!c) break;
        text = templ(pick(NEWS_TEMPLATES.youthIntake), { club: c.name, n: (e.playerIds || []).length });
        break;
      }
      case 'player_signed': {
        const p = getPlayer(e.playerId);
        if (!p) break;
        const fromClub = e.fromClubId ? getClub(e.fromClubId) : null;
        const toClub = e.toClubId ? getClub(e.toClubId) : null;
        if (toClub && fromClub) {
          if (e.freeTransfer) text = templ(pick(NEWS_TEMPLATES.transferFree), { player: p.name, club: toClub.name, fromClub: fromClub.name });
          else text = templ(pick(NEWS_TEMPLATES.transferIn), { player: p.name, club: toClub.name, fromClub: fromClub.name, fee: '£' + (e.fee || 0).toLocaleString() });
          severity = 'major';
        } else if (toClub && !fromClub) {
          text = templ(pick(NEWS_TEMPLATES.transferFree), { player: p.name, club: toClub.name, fromClub: 'free agency' });
        } else if (!toClub && fromClub) {
          text = templ(pick(NEWS_TEMPLATES.released), { player: p.name, fromClub: fromClub.name });
          severity = 'warn';
        }
        break;
      }
      case 'player_injured': {
        const p = getPlayer(e.playerId);
        if (!p) break;
        text = templ(pick(NEWS_TEMPLATES.injury), { player: p.name, weeks: e.matches, plural: e.matches === 1 ? '' : 'es' });
        severity = 'warn';
        break;
      }
      case 'player_suspended': {
        const p = getPlayer(e.playerId);
        if (!p) break;
        if (e.reason === 'yellow_accumulation') {
          text = templ(pick(NEWS_TEMPLATES.yellowBan), { player: p.name });
        } else {
          text = templ(pick(NEWS_TEMPLATES.suspension), { player: p.name, games: e.games, plural: e.games === 1 ? '' : 'es' });
        }
        severity = 'warn';
        break;
      }
      case 'nt_callup': {
        const p = getPlayer(e.playerId);
        if (!p) break;
        text = templ(pick(NEWS_TEMPLATES.ntCallup), { player: p.name, nation: e.nation || state.settings.nation.name || 'national' });
        break;
      }
    }
    if (text) out.push({ ts: e.ts, text, severity, eventId: e.id, season: e.season });
    if (out.length >= maxItems) break;
  }
  return out;
}

/* ===========================================================================
 * Convenience: copy text to clipboard
 * ========================================================================= */
function copyToClipboard(text) {
  try {
    navigator.clipboard.writeText(text).then(
      () => showToast('Copied to clipboard', 'success'),
      () => fallbackCopy(text)
    );
  } catch (e) { fallbackCopy(text); }
}
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed'; ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); showToast('Copied', 'success'); }
  catch { showToast('Copy failed — select & copy manually', 'error'); }
  ta.remove();
}
