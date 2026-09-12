import { useState } from 'react';
import { PERIODS, periodLabel, playTypeDef, visiblePlayTypes } from '../config/rules';
import { TeamGrid } from '../components/TeamGrid';
import { go } from '../router';
import { lastLivePlay, playTotals, teamStatus } from '../store/derive';
import { dressedPlayers, gamePlays, rulesForSeason, useApp } from '../store/useApp';
import type { Game } from '../types';

export function LiveScreen({ game }: { game: Game }) {
  const s = useApp();
  const { toggleOnField, clearField, setPlayType, setPossession, logPlay, undoLastPlay, reclassifyPlay, setPeriod } = useApp.getState();
  const [side, setSide] = useState<'home' | 'opp'>('home');
  const [editLast, setEditLast] = useState(false);

  const rules = rulesForSeason(s, game.seasonId);
  const ui = s.ui[game.id];
  const home = s.teams.find((t) => t.id === game.homeTeamId)!;
  const opp = s.teams.find((t) => t.id === game.opponentTeamId)!;
  const plays = gamePlays(s, game.id);
  const homeStatus = teamStatus(rules, home.id, dressedPlayers(s, game.id, home.id), plays, game.currentPeriod);
  const oppStatus = teamStatus(rules, opp.id, dressedPlayers(s, game.id, opp.id), plays, game.currentPeriod);
  const totals = playTotals(plays);
  const last = lastLivePlay(plays);
  const types = visiblePlayTypes(rules);
  const curType = playTypeDef(ui.playType);

  const nextPeriod = async () => {
    const p = Math.min(5, game.currentPeriod + 1);
    await setPeriod(game.id, p);
    if (p === 4) go('status');
  };

  return (
    <div className="screen live">
      <div className="live-bar">
        <div className="seg">
          {PERIODS.map((p) => (
            <button key={p} className={game.currentPeriod === p ? 'active' : ''} onClick={() => setPeriod(game.id, p)}>{periodLabel(p)}</button>
          ))}
        </div>
        <button className="sm" onClick={nextPeriod} disabled={game.currentPeriod >= 5}>End {periodLabel(game.currentPeriod)} →</button>
        <div className="seg possession" title="Possession">
          <button className={ui.possessionTeamId === home.id ? 'active' : ''} onClick={() => setPossession(game.id, home.id)}>🏈 {home.name}</button>
          <button className={ui.possessionTeamId === opp.id ? 'active' : ''} onClick={() => setPossession(game.id, opp.id)}>🏈 {opp.name}</button>
        </div>
        <span className="counter">Plays <b>{totals.total}</b> · counting <b>{totals.counting}</b></span>
        <div className="seg team-toggle">
          <button className={side === 'home' ? 'active' : ''} onClick={() => setSide('home')}>{home.name}</button>
          <button className={side === 'opp' ? 'active' : ''} onClick={() => setSide('opp')}>{opp.name}</button>
        </div>
      </div>

      <div className="grids">
        <TeamGrid team={home} status={homeStatus} onField={new Set(ui.field[home.id] ?? [])} hidden={side !== 'home'} onToggle={(pid) => toggleOnField(game.id, home.id, pid)} onClear={() => clearField(game.id, home.id)} />
        <TeamGrid team={opp} status={oppStatus} onField={new Set(ui.field[opp.id] ?? [])} hidden={side !== 'opp'} onToggle={(pid) => toggleOnField(game.id, opp.id, pid)} onClear={() => clearField(game.id, opp.id)} />
      </div>

      <div className="play-bar">
        <div className="seg">
          {types.map((t) => (
            <button key={t.id} className={ui.playType === t.id ? `active ${t.counts ? '' : 'warn'}` : ''} onClick={() => setPlayType(game.id, t.id)}>{t.short}</button>
          ))}
        </div>
        <button className={`play-btn ${curType.counts ? '' : 'nc'}`} onClick={() => logPlay(game.id)}>
          PLAY{curType.counts ? '' : ` · ${curType.short}`}
        </button>
        <button className="danger" disabled={!last} onClick={() => last && confirm(`Undo play #${last.sequence} (${playTypeDef(last.playType).label})?`) && undoLastPlay(game.id)}>Undo</button>
        <button className="ghost" disabled={!last} onClick={() => setEditLast((v) => !v)}>Last: {last ? playTypeDef(last.playType).short : '—'}</button>
        {editLast && last && (
          <div className="seg">
            {types.map((t) => (
              <button key={t.id} className={last.playType === t.id ? 'active' : ''} onClick={async () => { await reclassifyPlay(last.id, t.id); setEditLast(false); }}>{t.short}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
