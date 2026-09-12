import { describe, expect, it } from 'vitest';
import { playLogCsv, summaryCsv, summaryText } from './export';
import { teamStatus } from './store/derive';
import type { Play, Player, Team } from './types';

const team: Team = { id: 't1', seasonId: 's', name: 'Home', isHomeTeam: true, color: '' };
const players: Player[] = [
  { id: 'p1', teamId: 't1', jersey: 5, name: 'Ace', active: true },
  { id: 'p2', teamId: 't1', jersey: 12, name: '', active: true },
];
const mk = (seq: number, playType: Play['playType'], counts: boolean, ids: string[], voided = false): Play => ({
  id: `pl${seq}`, gameId: 'g', sequence: seq, period: 1, playType, counts, offenseTeamId: 't1', createdAt: 0, voided,
  participants: ids.map((playerId) => ({ playerId, teamId: 't1' })),
});
const plays = [mk(1, 'scrimmage', true, ['p1', 'p2']), mk(2, 'pat', false, ['p1']), mk(3, 'scrimmage', true, ['p1'], true)];
// 16 dressed is required for a real threshold; pad the roster so the bracket resolves to 12.
const dressed = [...players, ...Array.from({ length: 14 }, (_, i) => ({ id: `x${i}`, teamId: 't1', jersey: 20 + i, name: '', active: true }))];
const status = teamStatus({ league: 'chicagoland', division: '9U' }, 't1', dressed, plays, 1);

describe('exports match the log', () => {
  it('summary text reflects counting, non-voided plays only', () => {
    const t = summaryText({ date: '2026-09-13', opponentName: 'Opp' }, [{ team, status }]);
    expect(t).toContain('#5 Ace: 1 plays, short 11');
    expect(t).toContain('#12: 1 plays, short 11');
    expect(t).toContain('Home: 16 dressed, min 12 plays, 0 met / 16 short');
  });
  it('summary csv has one row per dressed player', () => {
    const rows = summaryCsv([{ team, status }]).split('\n');
    expect(rows[0]).toBe('team,jersey,name,counting_plays,threshold,met');
    expect(rows).toHaveLength(17);
    expect(rows[1]).toBe('Home,5,Ace,1,12,N');
  });
  it('play log csv has one row per participant and keeps voided/non-counting plays', () => {
    const rows = playLogCsv(plays, players, [team]).split('\n');
    expect(rows[0]).toBe('sequence,period,play_type,counts,voided,possession,team,jersey,player_name');
    expect(rows.slice(1)).toEqual([
      '1,Q1,Scrimmage,true,false,Home,Home,5,Ace',
      '1,Q1,Scrimmage,true,false,Home,Home,12,',
      '2,Q1,Extra point (PAT),false,false,Home,Home,5,Ace',
      '3,Q1,Scrimmage,true,true,Home,Home,5,Ace',
    ]);
  });
});
