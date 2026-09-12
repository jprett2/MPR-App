import { EXPECTED_ON_FIELD } from '../config/rules';
import type { TeamStatus } from '../store/derive';
import type { Team } from '../types';

interface Props {
  team: Team;
  status: TeamStatus;
  onField: Set<string>;
  hidden?: boolean;
  onToggle(playerId: string): void;
  onClear(): void;
}

export function TeamGrid({ team, status, onField, hidden, onToggle, onClear }: Props) {
  const n = onField.size;
  return (
    <section className={`team-grid ${hidden ? 'hidden' : ''}`}>
      <header className={team.isHomeTeam ? 'home' : 'opp'}>
        <span className="name">{team.name}</span>
        <span className="muted" style={{ fontSize: 13 }}>min {status.threshold}{status.outOfRange ? ' ⚠' : ''}</span>
        <span className={`onfield ${n !== EXPECTED_ON_FIELD ? 'bad' : ''}`}>{n} on field</span>
        <button className="sm ghost" onClick={() => n > 0 && confirm(`Clear all ${team.name} players off the field?`) && onClear()}>Clear</button>
      </header>
      <div className="tiles">
        {status.lines.map((l) => (
          <button key={l.player.id} className={`tile status-${l.status} ${onField.has(l.player.id) ? 'on' : ''}`} onClick={() => onToggle(l.player.id)}>
            <span className="num">{l.player.jersey}</span>
            <span className="rem">{l.remaining === 0 ? '✓' : l.remaining}</span>
            {l.player.name && <span className="name">{l.player.name}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}
