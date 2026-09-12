/**
 * Rules config: MPR thresholds, play types, and status colors.
 * This module is the single source of truth for the counting rules.
 * Keep it pure (no React, no store) so it stays trivially testable.
 */

export type League = 'popwarner' | 'chicagoland';
export type Division = '6U' | '7U' | '8U' | '9U' | '10U' | '11U' | '12U' | '13U';

export interface RuleSet {
  league: League;
  division: Division;
}

interface Bracket {
  minDressed: number;
  maxDressed: number;
  minPlays: number;
}

const NATIONAL: Bracket[] = [
  { minDressed: 16, maxDressed: 25, minPlays: 10 },
  { minDressed: 26, maxDressed: 30, minPlays: 8 },
  { minDressed: 31, maxDressed: 35, minPlays: 6 },
];

/** Chicagoland 6U–9U adds two plays to every bracket. */
const CHICAGOLAND_YOUNG: Bracket[] = NATIONAL.map((b) => ({ ...b, minPlays: b.minPlays + 2 }));

const YOUNG_DIVISIONS: Division[] = ['6U', '7U', '8U', '9U'];

export function bracketsFor(rules: RuleSet): Bracket[] {
  if (rules.league === 'chicagoland' && YOUNG_DIVISIONS.includes(rules.division)) {
    return CHICAGOLAND_YOUNG;
  }
  return NATIONAL;
}

export interface ThresholdResult {
  minPlays: number;
  /** True when dressed count is outside the table; nearest bracket was used. */
  outOfRange: boolean;
}

/**
 * Threshold for a team given its dressed player count.
 * Below the table uses the lowest bracket; above uses the highest.
 */
export function thresholdFor(rules: RuleSet, dressed: number): ThresholdResult {
  const brackets = bracketsFor(rules);
  const first = brackets[0];
  const last = brackets[brackets.length - 1];
  if (dressed < first.minDressed) return { minPlays: first.minPlays, outOfRange: true };
  if (dressed > last.maxDressed) return { minPlays: last.minPlays, outOfRange: true };
  const hit = brackets.find((b) => dressed >= b.minDressed && dressed <= b.maxDressed);
  // Brackets are contiguous, so this always hits; the fallback is defensive.
  return { minPlays: hit ? hit.minPlays : first.minPlays, outOfRange: false };
}

// ---------------------------------------------------------------------------
// Play types
// ---------------------------------------------------------------------------

export type PlayType = 'scrimmage' | 'pat' | 'penalty_replay' | 'kickoff' | 'spike';

export interface PlayTypeDef {
  id: PlayType;
  label: string;
  /** Short label for the sideline button. */
  short: string;
  counts: boolean;
  /** Divisions where this type is hidden from the selector. */
  hiddenFor?: Partial<Record<League, Division[]>>;
}

export const PLAY_TYPES: PlayTypeDef[] = [
  { id: 'scrimmage', label: 'Scrimmage', short: 'SCRIM', counts: true },
  { id: 'pat', label: 'Extra point (PAT)', short: 'PAT', counts: false },
  { id: 'penalty_replay', label: 'Penalty, down replayed', short: 'FLAG', counts: false },
  {
    id: 'kickoff',
    label: 'Kickoff / free kick / return',
    short: 'KICK',
    counts: false,
    hiddenFor: { chicagoland: ['6U', '7U', '8U', '9U'] },
  },
  { id: 'spike', label: 'QB intentional spike', short: 'SPIKE', counts: false },
];

export const DEFAULT_PLAY_TYPE: PlayType = 'scrimmage';

export function playTypeDef(id: PlayType): PlayTypeDef {
  const def = PLAY_TYPES.find((p) => p.id === id);
  if (!def) throw new Error(`Unknown play type: ${id}`);
  return def;
}

export function playCounts(id: PlayType): boolean {
  return playTypeDef(id).counts;
}

/** Play types visible in the selector for this rule set. */
export function visiblePlayTypes(rules: RuleSet): PlayTypeDef[] {
  return PLAY_TYPES.filter((p) => !(p.hiddenFor?.[rules.league] ?? []).includes(rules.division));
}

// ---------------------------------------------------------------------------
// Status colors
// ---------------------------------------------------------------------------

export type Status = 'met' | 'default' | 'warn' | 'short';

export const STATUS_RULES = {
  /** Yellow when remaining is 1..warnRemaining. */
  warnRemaining: 3,
  /** Red when remaining > 0 and period >= redPeriod. */
  redPeriod: 4,
};

export function statusFor(remaining: number, period: number): Status {
  if (remaining <= 0) return 'met';
  if (period >= STATUS_RULES.redPeriod) return 'short';
  if (remaining <= STATUS_RULES.warnRemaining) return 'warn';
  return 'default';
}

// ---------------------------------------------------------------------------
// Game structure
// ---------------------------------------------------------------------------

export const PERIODS = [1, 2, 3, 4, 5] as const;
export type Period = (typeof PERIODS)[number];

export function periodLabel(p: number): string {
  return p === 5 ? 'OT' : `Q${p}`;
}

export const EXPECTED_ON_FIELD = 11;
