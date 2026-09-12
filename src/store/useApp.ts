import { create } from 'zustand';
import { DEFAULT_PLAY_TYPE, playCounts, type Division, type League, type PlayType, type RuleSet } from '../config/rules';
import { db, newId } from '../db/db';
import type { Game, GameRoster, GameUiState, Id, Play, Player, Season, Team } from '../types';

export interface AppState {
  hydrated: boolean;
  seasons: Season[];
  teams: Team[];
  players: Player[];
  games: Game[];
  rosters: GameRoster[];
  /** Plays for every game, ordered by sequence within a game. */
  plays: Play[];
  ui: Record<Id, GameUiState>;
  currentSeasonId: Id | null;
  currentGameId: Id | null;

  hydrate(): Promise<void>;

  // Season & roster
  createSeason(name: string, league: League, division: Division, homeTeamName: string): Promise<Id>;
  selectSeason(id: Id): void;
  addPlayer(teamId: Id, jersey: number, name?: string): Promise<Id>;
  updatePlayer(id: Id, patch: Partial<Pick<Player, 'jersey' | 'name' | 'active'>>): Promise<void>;
  removePlayer(id: Id): Promise<void>;

  // Game
  createGame(seasonId: Id, input: { date: string; opponentName: string; location: string }): Promise<Id>;
  selectGame(id: Id | null): void;
  updateGame(id: Id, patch: Partial<Pick<Game, 'date' | 'opponentName' | 'location'>>): Promise<void>;
  setDressed(gameId: Id, playerId: Id, dressed: boolean): Promise<void>;
  addOpponentPlayer(gameId: Id, jersey: number): Promise<Id | null>;
  importOpponentRoster(gameId: Id, fromTeamId: Id): Promise<void>;
  startGame(gameId: Id): Promise<void>;
  finalizeGame(gameId: Id): Promise<void>;
  reopenGame(gameId: Id): Promise<void>;
  setPeriod(gameId: Id, period: number): Promise<void>;

  // Live tracking
  toggleOnField(gameId: Id, teamId: Id, playerId: Id): Promise<void>;
  clearField(gameId: Id, teamId?: Id): Promise<void>;
  setPlayType(gameId: Id, playType: PlayType): Promise<void>;
  setPossession(gameId: Id, teamId: Id | null): Promise<void>;
  logPlay(gameId: Id): Promise<Id>;
  undoLastPlay(gameId: Id): Promise<void>;
  reclassifyPlay(playId: Id, playType: PlayType): Promise<void>;
  setPlayParticipants(playId: Id, participants: { playerId: Id; teamId: Id }[]): Promise<void>;
  setPlayVoided(playId: Id, voided: boolean): Promise<void>;
}

function shareCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

function emptyUi(gameId: Id, homeTeamId: Id, oppTeamId: Id): GameUiState {
  return { gameId, field: { [homeTeamId]: [], [oppTeamId]: [] }, playType: DEFAULT_PLAY_TYPE, possessionTeamId: homeTeamId };
}

export const useApp = create<AppState>((set, get) => ({
  hydrated: false,
  seasons: [],
  teams: [],
  players: [],
  games: [],
  rosters: [],
  plays: [],
  ui: {},
  currentSeasonId: null,
  currentGameId: null,

  async hydrate() {
    const [seasons, teams, players, games, rosters, plays, uiRows] = await Promise.all([
      db.seasons.orderBy('createdAt').toArray(),
      db.teams.toArray(),
      db.players.toArray(),
      db.games.orderBy('createdAt').toArray(),
      db.gameRosters.toArray(),
      db.plays.toArray(),
      db.gameUi.toArray(),
    ]);
    plays.sort((a, b) => a.gameId.localeCompare(b.gameId) || a.sequence - b.sequence);
    const ui: Record<Id, GameUiState> = {};
    for (const u of uiRows) ui[u.gameId] = u;
    const currentSeasonId = seasons.length ? seasons[seasons.length - 1].id : null;
    const live = games.filter((g) => g.status === 'live');
    const currentGameId = live.length ? live[live.length - 1].id : null;
    set({ hydrated: true, seasons, teams, players, games, rosters, plays, ui, currentSeasonId, currentGameId });
  },

  async createSeason(name, league, division, homeTeamName) {
    const season: Season = { id: newId(), name, league, division, createdAt: Date.now() };
    const team: Team = { id: newId(), seasonId: season.id, name: homeTeamName, isHomeTeam: true, color: '#1d4ed8' };
    await db.transaction('rw', db.seasons, db.teams, async () => {
      await db.seasons.add(season);
      await db.teams.add(team);
    });
    set((s) => ({ seasons: [...s.seasons, season], teams: [...s.teams, team], currentSeasonId: season.id }));
    return season.id;
  },

  selectSeason(id) {
    set({ currentSeasonId: id });
  },

  async addPlayer(teamId, jersey, name = '') {
    const player: Player = { id: newId(), teamId, jersey, name, active: true };
    await db.players.add(player);
    set((s) => ({ players: [...s.players, player] }));
    return player.id;
  },

  async updatePlayer(id, patch) {
    await db.players.update(id, patch);
    set((s) => ({ players: s.players.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  },

  async removePlayer(id) {
    const used = get().plays.some((p) => p.participants.some((x) => x.playerId === id));
    if (used) {
      await get().updatePlayer(id, { active: false });
      return;
    }
    await db.transaction('rw', db.players, db.gameRosters, async () => {
      await db.players.delete(id);
      await db.gameRosters.filter((r) => r.playerId === id).delete();
    });
    set((s) => ({
      players: s.players.filter((p) => p.id !== id),
      rosters: s.rosters.filter((r) => r.playerId !== id),
    }));
  },

  async createGame(seasonId, input) {
    const home = get().teams.find((t) => t.seasonId === seasonId && t.isHomeTeam);
    if (!home) throw new Error('Season has no home team');
    const opp: Team = { id: newId(), seasonId, name: input.opponentName || 'Opponent', isHomeTeam: false, color: '#b91c1c' };
    const game: Game = {
      id: newId(),
      seasonId,
      date: input.date,
      homeTeamId: home.id,
      opponentTeamId: opp.id,
      opponentName: input.opponentName,
      location: input.location,
      shareCode: shareCode(),
      status: 'setup',
      currentPeriod: 1,
      createdAt: Date.now(),
    };
    const homePlayers = get().players.filter((p) => p.teamId === home.id && p.active);
    const rosterRows: GameRoster[] = homePlayers.map((p) => ({ gameId: game.id, playerId: p.id, dressed: true }));
    const ui = emptyUi(game.id, home.id, opp.id);
    await db.transaction('rw', db.teams, db.games, db.gameRosters, db.gameUi, async () => {
      await db.teams.add(opp);
      await db.games.add(game);
      await db.gameRosters.bulkAdd(rosterRows);
      await db.gameUi.put(ui);
    });
    set((s) => ({
      teams: [...s.teams, opp],
      games: [...s.games, game],
      rosters: [...s.rosters, ...rosterRows],
      ui: { ...s.ui, [game.id]: ui },
      currentGameId: game.id,
    }));
    return game.id;
  },

  selectGame(id) {
    set({ currentGameId: id });
  },

  async updateGame(id, patch) {
    await db.games.update(id, patch);
    const game = get().games.find((g) => g.id === id);
    if (game && patch.opponentName !== undefined) {
      await db.teams.update(game.opponentTeamId, { name: patch.opponentName });
    }
    set((s) => ({
      games: s.games.map((g) => (g.id === id ? { ...g, ...patch } : g)),
      teams:
        game && patch.opponentName !== undefined
          ? s.teams.map((t) => (t.id === game.opponentTeamId ? { ...t, name: patch.opponentName! } : t))
          : s.teams,
    }));
  },

  async setDressed(gameId, playerId, dressed) {
    const row: GameRoster = { gameId, playerId, dressed };
    await db.gameRosters.put(row);
    set((s) => {
      const rest = s.rosters.filter((r) => !(r.gameId === gameId && r.playerId === playerId));
      const ui = s.ui[gameId];
      let nextUi = s.ui;
      if (!dressed && ui) {
        // An undressed player can't be on the field.
        const field: Record<Id, Id[]> = {};
        for (const [teamId, ids] of Object.entries(ui.field)) field[teamId] = ids.filter((x) => x !== playerId);
        const u = { ...ui, field };
        void db.gameUi.put(u);
        nextUi = { ...s.ui, [gameId]: u };
      }
      return { rosters: [...rest, row], ui: nextUi };
    });
  },

  async addOpponentPlayer(gameId, jersey) {
    const game = get().games.find((g) => g.id === gameId);
    if (!game) return null;
    const existing = get().players.find((p) => p.teamId === game.opponentTeamId && p.jersey === jersey);
    if (existing) {
      const roster = get().rosters.find((r) => r.gameId === gameId && r.playerId === existing.id);
      if (!roster?.dressed) await get().setDressed(gameId, existing.id, true);
      return existing.id;
    }
    const id = await get().addPlayer(game.opponentTeamId, jersey);
    await get().setDressed(gameId, id, true);
    return id;
  },

  async importOpponentRoster(gameId, fromTeamId) {
    const jerseys = get()
      .players.filter((p) => p.teamId === fromTeamId && p.active)
      .map((p) => p.jersey);
    for (const j of jerseys) await get().addOpponentPlayer(gameId, j);
  },

  async startGame(gameId) {
    await db.games.update(gameId, { status: 'live' });
    set((s) => ({
      games: s.games.map((g) => (g.id === gameId ? { ...g, status: 'live' } : g)),
      currentGameId: gameId,
    }));
  },

  async finalizeGame(gameId) {
    await db.games.update(gameId, { status: 'final' });
    set((s) => ({ games: s.games.map((g) => (g.id === gameId ? { ...g, status: 'final' } : g)) }));
  },

  async reopenGame(gameId) {
    await db.games.update(gameId, { status: 'live' });
    set((s) => ({
      games: s.games.map((g) => (g.id === gameId ? { ...g, status: 'live' } : g)),
      currentGameId: gameId,
    }));
  },

  async setPeriod(gameId, period) {
    await db.games.update(gameId, { currentPeriod: period });
    set((s) => ({ games: s.games.map((g) => (g.id === gameId ? { ...g, currentPeriod: period } : g)) }));
  },

  async toggleOnField(gameId, teamId, playerId) {
    const ui = get().ui[gameId];
    if (!ui) return;
    const cur = ui.field[teamId] ?? [];
    const next = cur.includes(playerId) ? cur.filter((x) => x !== playerId) : [...cur, playerId];
    const u: GameUiState = { ...ui, field: { ...ui.field, [teamId]: next } };
    await db.gameUi.put(u);
    set((s) => ({ ui: { ...s.ui, [gameId]: u } }));
  },

  async clearField(gameId, teamId) {
    const ui = get().ui[gameId];
    if (!ui) return;
    const field: Record<Id, Id[]> = {};
    for (const k of Object.keys(ui.field)) field[k] = teamId && k !== teamId ? ui.field[k] : [];
    const u: GameUiState = { ...ui, field };
    await db.gameUi.put(u);
    set((s) => ({ ui: { ...s.ui, [gameId]: u } }));
  },

  async setPlayType(gameId, playType) {
    const ui = get().ui[gameId];
    if (!ui) return;
    const u = { ...ui, playType };
    await db.gameUi.put(u);
    set((s) => ({ ui: { ...s.ui, [gameId]: u } }));
  },

  async setPossession(gameId, teamId) {
    const ui = get().ui[gameId];
    if (!ui) return;
    const u = { ...ui, possessionTeamId: teamId };
    await db.gameUi.put(u);
    set((s) => ({ ui: { ...s.ui, [gameId]: u } }));
  },

  async logPlay(gameId) {
    const s = get();
    const game = s.games.find((g) => g.id === gameId);
    const ui = s.ui[gameId];
    if (!game || !ui) throw new Error('No live game');
    const gamePlays = s.plays.filter((p) => p.gameId === gameId);
    const sequence = gamePlays.length ? gamePlays[gamePlays.length - 1].sequence + 1 : 1;
    const participants = Object.entries(ui.field).flatMap(([teamId, ids]) => ids.map((playerId) => ({ playerId, teamId })));
    const play: Play = {
      id: newId(),
      gameId,
      sequence,
      period: game.currentPeriod,
      playType: ui.playType,
      counts: playCounts(ui.playType),
      offenseTeamId: ui.possessionTeamId,
      createdAt: Date.now(),
      voided: false,
      participants,
    };
    const u: GameUiState = { ...ui, playType: DEFAULT_PLAY_TYPE };
    await db.transaction('rw', db.plays, db.gameUi, async () => {
      await db.plays.add(play);
      await db.gameUi.put(u);
    });
    set((st) => ({ plays: [...st.plays, play], ui: { ...st.ui, [gameId]: u } }));
    return play.id;
  },

  async undoLastPlay(gameId) {
    const s = get();
    const gamePlays = s.plays.filter((p) => p.gameId === gameId);
    let last: Play | undefined;
    for (let i = gamePlays.length - 1; i >= 0; i--) if (!gamePlays[i].voided) { last = gamePlays[i]; break; }
    if (!last) return;
    const ui = s.ui[gameId];
    // Restore the field to what it was when that play was logged.
    const field: Record<Id, Id[]> = {};
    for (const k of Object.keys(ui.field)) field[k] = [];
    for (const part of last.participants) (field[part.teamId] ??= []).push(part.playerId);
    const u: GameUiState = { ...ui, field, possessionTeamId: last.offenseTeamId ?? ui.possessionTeamId };
    await db.transaction('rw', db.plays, db.gameUi, async () => {
      await db.plays.update(last!.id, { voided: true });
      await db.gameUi.put(u);
    });
    set((st) => ({
      plays: st.plays.map((p) => (p.id === last!.id ? { ...p, voided: true } : p)),
      ui: { ...st.ui, [gameId]: u },
    }));
  },

  async reclassifyPlay(playId, playType) {
    const counts = playCounts(playType);
    await db.plays.update(playId, { playType, counts });
    set((s) => ({ plays: s.plays.map((p) => (p.id === playId ? { ...p, playType, counts } : p)) }));
  },

  async setPlayParticipants(playId, participants) {
    await db.plays.update(playId, { participants });
    set((s) => ({ plays: s.plays.map((p) => (p.id === playId ? { ...p, participants } : p)) }));
  },

  async setPlayVoided(playId, voided) {
    await db.plays.update(playId, { voided });
    set((s) => ({ plays: s.plays.map((p) => (p.id === playId ? { ...p, voided } : p)) }));
  },
}));

// ---------------------------------------------------------------------------
// Selectors (pure, take state)
// ---------------------------------------------------------------------------

export function rulesForSeason(s: AppState, seasonId: Id | null): RuleSet {
  const season = s.seasons.find((x) => x.id === seasonId);
  return season ? { league: season.league, division: season.division } : { league: 'chicagoland', division: '9U' };
}

export function dressedPlayers(s: AppState, gameId: Id, teamId: Id): Player[] {
  const dressedIds = new Set(s.rosters.filter((r) => r.gameId === gameId && r.dressed).map((r) => r.playerId));
  return s.players.filter((p) => p.teamId === teamId && dressedIds.has(p.id)).sort((a, b) => a.jersey - b.jersey);
}

export function gamePlays(s: AppState, gameId: Id): Play[] {
  return s.plays.filter((p) => p.gameId === gameId);
}
