import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { shortList, teamStatus, playTotals } from './derive';
import { dressedPlayers, gamePlays, rulesForSeason, useApp } from './useApp';

async function freshStore() {
  await db.delete();
  await db.open();
  useApp.setState({
    hydrated: false, seasons: [], teams: [], players: [], games: [], rosters: [], plays: [], ui: {},
    currentSeasonId: null, currentGameId: null,
  });
  await useApp.getState().hydrate();
}

/** Build the §11 scenario: 19 home, 22 opponents, live game. */
async function setupGame() {
  const a = useApp.getState();
  const seasonId = await a.createSeason('2026 9U', 'chicagoland', '9U', 'Home');
  const home = useApp.getState().teams.find((t) => t.isHomeTeam)!;
  for (let j = 1; j <= 19; j++) await a.addPlayer(home.id, j, `P${j}`);
  const gameId = await a.createGame(seasonId, { date: '2026-09-13', opponentName: 'Opp', location: 'Field' });
  for (let j = 1; j <= 22; j++) await a.addOpponentPlayer(gameId, j);
  await a.startGame(gameId);
  const game = useApp.getState().games.find((g) => g.id === gameId)!;
  return { seasonId, gameId, homeId: home.id, oppId: game.opponentTeamId };
}

function setField(gameId: string, teamId: string, jerseys: number[]) {
  const s = useApp.getState();
  const ids = s.players.filter((p) => p.teamId === teamId && jerseys.includes(p.jersey)).map((p) => p.id);
  useApp.setState({ ui: { ...s.ui, [gameId]: { ...s.ui[gameId], field: { ...s.ui[gameId].field, [teamId]: ids } } } });
}

beforeEach(freshStore);

describe('Phase 1 acceptance scenario', () => {
  it('thresholds: 19 home -> 12, 22 opp -> 12, 27 opp -> 10', async () => {
    const { seasonId, gameId, homeId, oppId } = await setupGame();
    const s = useApp.getState();
    const rules = rulesForSeason(s, seasonId);
    expect(teamStatus(rules, homeId, dressedPlayers(s, gameId, homeId), [], 1).threshold).toBe(12);
    expect(teamStatus(rules, oppId, dressedPlayers(s, gameId, oppId), [], 1).threshold).toBe(12);
    for (let j = 23; j <= 27; j++) await s.addOpponentPlayer(gameId, j);
    const s2 = useApp.getState();
    const opp = teamStatus(rules, oppId, dressedPlayers(s2, gameId, oppId), [], 1);
    expect(opp.dressed).toBe(27);
    expect(opp.threshold).toBe(10);
  });

  it('50 plays with PATs, penalty replays, undo, reclassify, and Q3 list', async () => {
    const { seasonId, gameId, homeId, oppId } = await setupGame();
    const a = useApp.getState();
    const rules = rulesForSeason(a, seasonId);

    // Two home units and two opponent units, swapped every 6 plays.
    const homeA = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const homeB = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
    const oppA = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const oppB = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

    const patAt = new Set([10, 25, 40]);
    const flagAt = new Set([15, 33]);
    for (let n = 1; n <= 50; n++) {
      const unit = Math.floor((n - 1) / 6) % 2;
      setField(gameId, homeId, unit ? homeB : homeA);
      setField(gameId, oppId, unit ? oppB : oppA);
      if (n === 26) await a.setPeriod(gameId, 3);
      if (patAt.has(n)) await a.setPlayType(gameId, 'pat');
      if (flagAt.has(n)) await a.setPlayType(gameId, 'penalty_replay');
      await a.logPlay(gameId);
      // play type resets to scrimmage after each play
      expect(useApp.getState().ui[gameId].playType).toBe('scrimmage');
    }

    let plays = gamePlays(useApp.getState(), gameId);
    expect(plays).toHaveLength(50);
    expect(playTotals(plays)).toEqual({ total: 50, counting: 45 });

    // 1. non-counting plays are in the log but don't add to anyone's count.
    const byJersey = (teamId: string) => {
      const st = teamStatus(rules, teamId, dressedPlayers(useApp.getState(), gameId, teamId), plays, 3);
      return Object.fromEntries(st.lines.map((l) => [l.player.jersey, l.played]));
    };
    // Unit A plays on blocks 1-6,13-18,25-30,37-42,49-50 = 26 plays; PAT at 25 and 40, flag at 15 -> 23 counting.
    // Unit B plays on 7-12,19-24,31-36,43-48 = 24 plays; PAT at 10, flag at 33 -> 22 counting.
    // Jerseys 9-11 are in both home units -> 45.
    const home = byJersey(homeId);
    expect(home[1]).toBe(23);
    expect(home[12]).toBe(22);
    expect(home[9]).toBe(45);
    const opp = byJersey(oppId);
    expect(opp[1]).toBe(23);
    expect(opp[22]).toBe(22);

    // 4. Q3 list: exactly players with remaining > 0, sorted by remaining desc.
    // Everyone has >= 22 plays against a 12 threshold, so nobody is short yet.
    const st = teamStatus(rules, homeId, dressedPlayers(useApp.getState(), gameId, homeId), plays, 3);
    expect(shortList(st)).toHaveLength(0);
    expect(st.met).toBe(19);

    // 2. Undo removes last play from affected counts and restores field state.
    setField(gameId, homeId, [1, 2, 3]); // tracker started changing tiles after last snap
    await a.undoLastPlay(gameId);
    plays = gamePlays(useApp.getState(), gameId);
    expect(plays.filter((p) => !p.voided)).toHaveLength(49);
    expect(plays[49].voided).toBe(true);
    expect(byJersey(homeId)[1]).toBe(22);
    expect(byJersey(homeId)[12]).toBe(22);
    const restored = useApp.getState().ui[gameId].field[homeId];
    const restoredJerseys = useApp.getState().players.filter((p) => restored.includes(p.id)).map((p) => p.jersey).sort((x, y) => x - y);
    expect(restoredJerseys).toEqual(homeA);

    // 3. Reclassify a scrimmage play to penalty replay decrements counts.
    const p1 = plays[0];
    expect(p1.counts).toBe(true);
    await a.reclassifyPlay(p1.id, 'penalty_replay');
    plays = gamePlays(useApp.getState(), gameId);
    expect(plays[0].counts).toBe(false);
    expect(byJersey(homeId)[1]).toBe(21);
    // and back
    await a.reclassifyPlay(p1.id, 'scrimmage');
    plays = gamePlays(useApp.getState(), gameId);
    expect(byJersey(homeId)[1]).toBe(22);

    // Short list ordering with a realistic short situation.
    const stShort = teamStatus(rules, homeId, dressedPlayers(useApp.getState(), gameId, homeId), plays.slice(0, 8), 3);
    const short = shortList(stShort);
    // Plays 1-6 unit A, 7-8 unit B. A-only players (1-8) have 6 -> remaining 6; B-only (12-19) have 2 -> 10; 9-11 have 8 -> 4.
    expect(short.map((l) => l.remaining)).toEqual([...Array(8).fill(10), ...Array(8).fill(6), 4, 4, 4]);
    expect(short[0].player.jersey).toBe(12);
    expect(short[8].player.jersey).toBe(1);

    // 6. Reload from IndexedDB: all state intact.
    useApp.setState({ plays: [], ui: {}, games: [], players: [], rosters: [], teams: [], seasons: [] });
    await useApp.getState().hydrate();
    const after = useApp.getState();
    expect(after.currentGameId).toBe(gameId);
    expect(gamePlays(after, gameId)).toHaveLength(50);
    expect(after.ui[gameId].field[homeId]).toHaveLength(11);
    expect(after.games[0].currentPeriod).toBe(3);
  });

  it('status colors follow period', async () => {
    const { seasonId, gameId, homeId } = await setupGame();
    const s = useApp.getState();
    const rules = rulesForSeason(s, seasonId);
    const st1 = teamStatus(rules, homeId, dressedPlayers(s, gameId, homeId), [], 1);
    expect(st1.lines[0].status).toBe('default');
    const st4 = teamStatus(rules, homeId, dressedPlayers(s, gameId, homeId), [], 4);
    expect(st4.lines[0].status).toBe('short');
  });

  it('undressing a player removes them from the field', async () => {
    const { gameId, homeId } = await setupGame();
    setField(gameId, homeId, [1, 2, 3]);
    const p1 = useApp.getState().players.find((p) => p.teamId === homeId && p.jersey === 1)!;
    await useApp.getState().setDressed(gameId, p1.id, false);
    expect(useApp.getState().ui[gameId].field[homeId]).toHaveLength(2);
  });
});
