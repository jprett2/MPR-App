import { playTypeDef, periodLabel } from './config/rules';
import type { TeamStatus } from './store/derive';
import type { Play, Player, Team } from './types';

export function summaryText(game: { date: string; opponentName: string }, teams: { team: Team; status: TeamStatus }[]): string {
  const lines: string[] = [`MPR Summary — ${game.date} vs ${game.opponentName}`, ''];
  for (const { team, status } of teams) {
    lines.push(`${team.name}: ${status.dressed} dressed, min ${status.threshold} plays, ${status.met} met / ${status.short} short`);
    for (const l of status.lines) {
      const nm = l.player.name ? ` ${l.player.name}` : '';
      lines.push(`  #${l.player.jersey}${nm}: ${l.played} plays, ${l.remaining === 0 ? 'MET' : `short ${l.remaining}`}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function csvCell(v: string | number | boolean): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function playLogCsv(plays: Play[], players: Player[], teams: Team[]): string {
  const byId = new Map(players.map((p) => [p.id, p]));
  const teamName = (id: string | null) => teams.find((t) => t.id === id)?.name ?? '';
  const header = ['sequence', 'period', 'play_type', 'counts', 'voided', 'possession', 'team', 'jersey', 'player_name'];
  const rows: string[] = [header.join(',')];
  for (const p of plays) {
    const base = [p.sequence, periodLabel(p.period), playTypeDef(p.playType).label, p.counts, p.voided, teamName(p.offenseTeamId)];
    if (!p.participants.length) rows.push([...base, '', '', ''].map(csvCell).join(','));
    for (const part of p.participants) {
      const pl = byId.get(part.playerId);
      rows.push([...base, teamName(part.teamId), pl?.jersey ?? '', pl?.name ?? ''].map(csvCell).join(','));
    }
  }
  return rows.join('\n');
}

export function summaryCsv(teams: { team: Team; status: TeamStatus }[]): string {
  const rows = ['team,jersey,name,counting_plays,threshold,met'];
  for (const { team, status } of teams) {
    for (const l of status.lines) {
      rows.push([team.name, l.player.jersey, l.player.name, l.played, status.threshold, l.remaining === 0 ? 'Y' : 'N'].map(csvCell).join(','));
    }
  }
  return rows.join('\n');
}
