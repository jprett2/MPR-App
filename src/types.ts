import type { Division, League, PlayType } from './config/rules';

export type Id = string;

export interface Season {
  id: Id;
  name: string;
  league: League;
  division: Division;
  createdAt: number;
}

export interface Team {
  id: Id;
  seasonId: Id;
  name: string;
  isHomeTeam: boolean;
  color: string;
}

export interface Player {
  id: Id;
  teamId: Id;
  jersey: number;
  name: string;
  active: boolean;
}

export type GameStatus = 'setup' | 'live' | 'final';

export interface Game {
  id: Id;
  seasonId: Id;
  date: string; // ISO date (YYYY-MM-DD)
  homeTeamId: Id;
  opponentTeamId: Id;
  opponentName: string;
  location: string;
  shareCode: string;
  status: GameStatus;
  currentPeriod: number;
  createdAt: number;
}

export interface GameRoster {
  gameId: Id;
  playerId: Id;
  dressed: boolean;
}

export interface PlayParticipant {
  playerId: Id;
  teamId: Id;
}

export interface Play {
  id: Id;
  gameId: Id;
  sequence: number;
  period: number;
  playType: PlayType;
  /** Derived from playType at write time; recomputed on reclassify. */
  counts: boolean;
  offenseTeamId: Id | null;
  createdAt: number;
  voided: boolean;
  participants: PlayParticipant[];
}

/** Sideline UI state that must survive an app restart mid-game. */
export interface GameUiState {
  gameId: Id;
  /** teamId -> playerIds currently marked on the field. */
  field: Record<Id, Id[]>;
  playType: PlayType;
  possessionTeamId: Id | null;
}
