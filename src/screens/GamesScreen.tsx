import { useState } from 'react';
import { go } from '../router';
import { useApp } from '../store/useApp';

export function GamesScreen() {
  const st = useApp();
  const seasonId = st.currentSeasonId;
  const games = st.games.filter((g) => g.seasonId === seasonId).slice().reverse();
  const currentGameId = st.currentGameId;
  const { createGame, selectGame } = useApp.getState();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [opp, setOpp] = useState('');
  const [loc, setLoc] = useState('');

  const create = async () => {
    if (!seasonId) return;
    const id = await createGame(seasonId, { date, opponentName: opp.trim(), location: loc.trim() });
    go(`setup/${id}`);
  };

  return (
    <div className="screen">
      <div className="card">
        <h2>New game</h2>
        <div className="stack">
          <label className="field">Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="field">Opponent<input value={opp} onChange={(e) => setOpp(e.target.value)} placeholder="Opponent name" /></label>
          <label className="field">Location<input value={loc} onChange={(e) => setLoc(e.target.value)} /></label>
          <button className="primary" disabled={!opp.trim()} onClick={create}>Create game</button>
        </div>
      </div>
      <div className="card">
        <h2>Games</h2>
        <div className="stack">
          {games.length === 0 && <div className="muted">No games yet.</div>}
          {games.map((g) => (
            <div key={g.id} className="row">
              <div>
                <b>{g.date}</b> vs {g.opponentName} {g.id === currentGameId && <span className="muted">· current</span>}
                <div className="muted">{g.status.toUpperCase()}{g.location ? ` · ${g.location}` : ''}</div>
              </div>
              <button className="sm fixed" onClick={() => { selectGame(g.id); go(g.status === 'setup' ? `setup/${g.id}` : 'live'); }}>Open</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
