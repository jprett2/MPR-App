import { useState } from 'react';
import { thresholdFor } from '../config/rules';
import { go } from '../router';
import { dressedPlayers, rulesForSeason, useApp } from '../store/useApp';

export function GameSetupScreen({ gameId }: { gameId: string }) {
  const s = useApp();
  const game = s.games.find((g) => g.id === gameId);
  const { setDressed, addOpponentPlayer, importOpponentRoster, startGame, updateGame, removePlayer } = useApp.getState();
  const [jersey, setJersey] = useState('');
  if (!game) return <div className="screen">Game not found.</div>;

  const rules = rulesForSeason(s, game.seasonId);
  const homeTeam = s.teams.find((t) => t.id === game.homeTeamId)!;
  const homePlayers = s.players.filter((p) => p.teamId === game.homeTeamId && p.active).sort((a, b) => a.jersey - b.jersey);
  const dressedSet = new Set(s.rosters.filter((r) => r.gameId === gameId && r.dressed).map((r) => r.playerId));
  const oppPlayers = dressedPlayers(s, gameId, game.opponentTeamId);
  const homeDressed = dressedPlayers(s, gameId, game.homeTeamId).length;
  const ht = thresholdFor(rules, homeDressed);
  const ot = thresholdFor(rules, oppPlayers.length);
  const priorOpponents = s.teams.filter((t) => !t.isHomeTeam && t.id !== game.opponentTeamId && t.seasonId === game.seasonId);

  const addOpp = async () => {
    const j = parseInt(jersey, 10);
    if (Number.isNaN(j)) return;
    await addOpponentPlayer(gameId, j);
    setJersey('');
    document.getElementById('opp-jersey')?.focus();
  };

  return (
    <div className="screen">
      <div className="card">
        <div className="row">
          <label className="field">Date<input type="date" value={game.date} onChange={(e) => updateGame(gameId, { date: e.target.value })} /></label>
          <label className="field">Opponent<input value={game.opponentName} onChange={(e) => updateGame(gameId, { opponentName: e.target.value })} /></label>
          <label className="field">Location<input value={game.location} onChange={(e) => updateGame(gameId, { location: e.target.value })} /></label>
        </div>
        <div className="muted" style={{ marginTop: 8 }}>Share code: <b>{game.shareCode}</b> (coach view arrives in Phase 2)</div>
      </div>

      <div className="card">
        <h2>{homeTeam.name} · {homeDressed} dressed · min <b>{ht.minPlays}</b> plays {ht.outOfRange && <span className="warn-text">⚠ out of table range</span>}</h2>
        <div className="muted" style={{ marginBottom: 8 }}>Tap to toggle dressed.</div>
        <div className="grid-list">
          {homePlayers.map((p) => (
            <button key={p.id} className={`chip ${dressedSet.has(p.id) ? '' : 'off'}`} onClick={() => setDressed(gameId, p.id, !dressedSet.has(p.id))}>
              #{p.jersey} {p.name && <small>{p.name}</small>}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>{game.opponentName || 'Opponent'} · {oppPlayers.length} dressed · min <b>{ot.minPlays}</b> plays {ot.outOfRange && <span className="warn-text">⚠ out of table range</span>}</h2>
        <form className="row" onSubmit={(e) => { e.preventDefault(); void addOpp(); }}>
          <input id="opp-jersey" inputMode="numeric" pattern="[0-9]*" placeholder="Jersey #" value={jersey} onChange={(e) => setJersey(e.target.value)} autoFocus />
          <button type="submit" className="primary fixed">Add</button>
          {priorOpponents.length > 0 && (
            <select className="fixed" style={{ width: 'auto' }} value="" onChange={(e) => e.target.value && importOpponentRoster(gameId, e.target.value)}>
              <option value="">Import roster…</option>
              {priorOpponents.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
        </form>
        <div className="grid-list" style={{ marginTop: 8 }}>
          {oppPlayers.map((p) => (
            <button key={p.id} className="chip" onClick={() => confirm(`Remove #${p.jersey}?`) && removePlayer(p.id)}>#{p.jersey}</button>
          ))}
        </div>
      </div>

      {game.status === 'setup' ? (
        <button className="primary" style={{ width: '100%', minHeight: 64, fontSize: 20 }} disabled={homeDressed === 0} onClick={async () => { await startGame(gameId); go('live'); }}>Start game →</button>
      ) : (
        <button className="primary" style={{ width: '100%' }} onClick={() => go('live')}>Back to live →</button>
      )}
    </div>
  );
}
