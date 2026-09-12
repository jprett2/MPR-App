/**
 * Pure derivations from the play log. Nothing here is stored.
 */
import { statusFor, thresholdFor, type RuleSet, type Status } from '../config/rules';
import type { Id, Play, Player } from '../types';

export interface PlayerLine {
  player: Player;
  played: number;
  remaining: number;
  status: Status;
}

export interface TeamStatus {
  teamId: Id;
  dressed: number;
  threshold: number;
  outOfRange: boolean;
  lines: PlayerLine[];
  met: number;
  short: number;
}

/** playerId -> number of counting, non-voided plays. */
export function countingPlaysByPlayer(plays: Play[]): Map<Id, number> {
  const m = new Map<Id, number>();
  for (const p of plays) {
    if (p.voided || !p.counts) continue;
    for (const part of p.participants) {
      m.set(part.playerId, (m.get(part.playerId) ?? 0) + 1);
    }
  }
  return m;
}

export function teamStatus(
  rules: RuleSet,
  teamId: Id,
  dressedPlayers: Player[],
  plays: Play[],
  period: number,
): TeamStatus {
  const counts = countingPlaysByPlayer(plays);
  const { minPlays, outOfRange } = thresholdFor(rules, dressedPlayers.length);
  const lines: PlayerLine[] = dressedPlayers
    .map((player) => {
      const played = counts.get(player.id) ?? 0;
      const remaining = Math.max(0, minPlays - played);
      return { player, played, remaining, status: statusFor(remaining, period) };
    })
    .sort((a, b) => a.player.jersey - b.player.jersey);
  const met = lines.filter((l) => l.remaining === 0).length;
  return {
    teamId,
    dressed: dressedPlayers.length,
    threshold: minPlays,
    outOfRange,
    lines,
    met,
    short: lines.length - met,
  };
}

/** Players still short, sorted by remaining descending then jersey. */
export function shortList(status: TeamStatus): PlayerLine[] {
  return status.lines
    .filter((l) => l.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining || a.player.jersey - b.player.jersey);
}

export function playTotals(plays: Play[]): { total: number; counting: number } {
  const live = plays.filter((p) => !p.voided);
  return { total: live.length, counting: live.filter((p) => p.counts).length };
}

export function lastLivePlay(plays: Play[]): Play | undefined {
  for (let i = plays.length - 1; i >= 0; i--) {
    if (!plays[i].voided) return plays[i];
  }
  return undefined;
}
