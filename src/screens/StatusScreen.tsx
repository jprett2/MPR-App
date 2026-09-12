import { periodLabel } from '../config/rules';
import { shortList, teamStatus, type TeamStatus } from '../store/derive';
import { dressedPlayers, gamePlays, rulesForSeason, useApp } from '../store/useApp';
import type { Game, Team } from '../types';

function TeamBlock({ team, status }: { team: Team; status: TeamStatus }) {
  const short = shortList(status);
  return (
    <div className="card">
      <h2 style={{ color: team.isHomeTeam ? '#93c5fd' : '#fca5a5' }}>{team.name}</h2>
      <div className="big" style={{ marginBottom: 8 }}>
        {status.dressed} dressed · min <b>{status.threshold}</b>{status.outOfRange && <span className="warn-text"> ⚠ out of range</span>} · <span className="met-text">{status.met} met</span> · <span className={status.short ? 'short-text' : ''}>{status.short} short</span>
      </div>
      {short.length === 0 ? (
        <div className="met-text big">All players have met the minimum.</div>
      ) : (
        <table className="status-table">
          <thead><tr><th>#</th><th>Name</th><th>Played</th><th>Needs</th></tr></thead>
          <tbody>
            {short.map((l) => (
              <tr key={l.player.id}>
                <td className="num">{l.player.jersey}</td>
                <td>{l.player.name}</td>
                <td>{l.played}</td>
                <td className={`num ${l.status === 'short' ? 'short-text' : l.status === 'warn' ? 'warn-text' : ''}`}>{l.remaining}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function StatusScreen({ game }: { game: Game }) {
  const s = useApp();
  const rules = rulesForSeason(s, game.seasonId);
  const plays = gamePlays(s, game.id);
  const home = s.teams.find((t) => t.id === game.homeTeamId)!;
  const opp = s.teams.find((t) => t.id === game.opponentTeamId)!;
  const hs = teamStatus(rules, home.id, dressedPlayers(s, game.id, home.id), plays, game.currentPeriod);
  const os = teamStatus(rules, opp.id, dressedPlayers(s, game.id, opp.id), plays, game.currentPeriod);
  return (
    <div className="screen">
      <div className="muted" style={{ marginBottom: 8 }}>{game.date} vs {game.opponentName} · {periodLabel(game.currentPeriod)} · {plays.filter((p) => !p.voided).length} plays</div>
      <TeamBlock team={home} status={hs} />
      <TeamBlock team={opp} status={os} />
    </div>
  );
}
