import { useState } from 'react';
import type { Division, League } from '../config/rules';
import { go } from '../router';
import { useApp } from '../store/useApp';

const DIVISIONS: Division[] = ['6U', '7U', '8U', '9U', '10U', '11U', '12U', '13U'];

export function SeasonScreen() {
  const st = useApp();
  const season = st.seasons.find((x) => x.id === st.currentSeasonId);
  const seasons = st.seasons;
  const home = st.teams.find((t) => t.seasonId === season?.id && t.isHomeTeam);
  const players = st.players.filter((p) => p.teamId === home?.id).sort((a, b) => a.jersey - b.jersey);
  const { createSeason, selectSeason, addPlayer, updatePlayer, removePlayer } = useApp.getState();

  const [name, setName] = useState('2026 9U');
  const [league, setLeague] = useState<League>('chicagoland');
  const [division, setDivision] = useState<Division>('9U');
  const [teamName, setTeamName] = useState('');
  const [jersey, setJersey] = useState('');
  const [pname, setPname] = useState('');

  const add = async () => {
    const j = parseInt(jersey, 10);
    if (!home || Number.isNaN(j)) return;
    await addPlayer(home.id, j, pname.trim());
    setJersey('');
    setPname('');
    document.getElementById('jersey-input')?.focus();
  };

  return (
    <div className="screen">
      {seasons.length > 1 && (
        <div className="card row">
          <label className="field">
            Season
            <select value={season?.id} onChange={(e) => selectSeason(e.target.value)}>
              {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        </div>
      )}
      {season && home ? (
        <>
          <div className="card">
            <h2>{season.name} · {home.name}</h2>
            <div className="muted">{season.league === 'chicagoland' ? 'Chicagoland Pop Warner' : 'Pop Warner'} · {season.division}</div>
          </div>
          <div className="card">
            <h2>Add player</h2>
            <form className="row" onSubmit={(e) => { e.preventDefault(); void add(); }}>
              <input id="jersey-input" inputMode="numeric" pattern="[0-9]*" placeholder="#" value={jersey} onChange={(e) => setJersey(e.target.value)} style={{ flex: '0 0 90px' }} />
              <input placeholder="Name (optional)" value={pname} onChange={(e) => setPname(e.target.value)} />
              <button type="submit" className="primary fixed">Add</button>
            </form>
          </div>
          <div className="card">
            <h2>Roster ({players.filter((p) => p.active).length} active)</h2>
            <div className="stack">
              {players.map((p) => (
                <div key={p.id} className="row">
                  <input inputMode="numeric" value={p.jersey} onChange={(e) => updatePlayer(p.id, { jersey: parseInt(e.target.value || '0', 10) })} style={{ flex: '0 0 80px' }} />
                  <input value={p.name} placeholder="Name" onChange={(e) => updatePlayer(p.id, { name: e.target.value })} />
                  <button className={`sm fixed ${p.active ? 'ghost' : 'primary'}`} onClick={() => updatePlayer(p.id, { active: !p.active })}>{p.active ? 'Deactivate' : 'Activate'}</button>
                  <button className="sm danger fixed" onClick={() => confirm(`Remove #${p.jersey}?`) && removePlayer(p.id)}>✕</button>
                </div>
              ))}
            </div>
          </div>
          <button className="primary" onClick={() => go('games')}>Games →</button>
        </>
      ) : null}
      <div className="card" style={{ marginTop: 16 }}>
        <h2>{season ? 'New season' : 'Create season'}</h2>
        <div className="stack">
          <label className="field">Season name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <div className="row">
            <label className="field">League
              <select value={league} onChange={(e) => setLeague(e.target.value as League)}>
                <option value="chicagoland">Chicagoland Pop Warner</option>
                <option value="popwarner">Pop Warner (national)</option>
              </select>
            </label>
            <label className="field">Division
              <select value={division} onChange={(e) => setDivision(e.target.value as Division)}>
                {DIVISIONS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </label>
          </div>
          <label className="field">Our team name<input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. Wildcats" /></label>
          <button className="primary" disabled={!name || !teamName} onClick={async () => { await createSeason(name, league, division, teamName); go('season'); }}>Create season</button>
        </div>
      </div>
    </div>
  );
}
