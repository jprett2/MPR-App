import Dexie, { type Table } from 'dexie';
import type { Game, GameRoster, GameUiState, Play, Player, Season, Team } from '../types';

export class MprDb extends Dexie {
  seasons!: Table<Season, string>;
  teams!: Table<Team, string>;
  players!: Table<Player, string>;
  games!: Table<Game, string>;
  gameRosters!: Table<GameRoster, [string, string]>;
  plays!: Table<Play, string>;
  gameUi!: Table<GameUiState, string>;

  constructor(name = 'mpr-tracker') {
    super(name);
    this.version(1).stores({
      seasons: 'id, createdAt',
      teams: 'id, seasonId',
      players: 'id, teamId',
      games: 'id, seasonId, createdAt',
      gameRosters: '[gameId+playerId], gameId',
      plays: 'id, gameId, [gameId+sequence]',
      gameUi: 'gameId',
    });
  }
}

export const db = new MprDb();

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
