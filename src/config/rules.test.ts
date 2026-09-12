import { describe, expect, it } from 'vitest';
import {
  playCounts,
  statusFor,
  thresholdFor,
  visiblePlayTypes,
  type RuleSet,
} from './rules';

const chi9: RuleSet = { league: 'chicagoland', division: '9U' };
const chi10: RuleSet = { league: 'chicagoland', division: '10U' };
const pw12: RuleSet = { league: 'popwarner', division: '12U' };

describe('thresholdFor', () => {
  it('Chicagoland 9U brackets are national + 2', () => {
    expect(thresholdFor(chi9, 16)).toEqual({ minPlays: 12, outOfRange: false });
    expect(thresholdFor(chi9, 19)).toEqual({ minPlays: 12, outOfRange: false });
    expect(thresholdFor(chi9, 22)).toEqual({ minPlays: 12, outOfRange: false });
    expect(thresholdFor(chi9, 25)).toEqual({ minPlays: 12, outOfRange: false });
    expect(thresholdFor(chi9, 26)).toEqual({ minPlays: 10, outOfRange: false });
    expect(thresholdFor(chi9, 27)).toEqual({ minPlays: 10, outOfRange: false });
    expect(thresholdFor(chi9, 30)).toEqual({ minPlays: 10, outOfRange: false });
    expect(thresholdFor(chi9, 31)).toEqual({ minPlays: 8, outOfRange: false });
    expect(thresholdFor(chi9, 35)).toEqual({ minPlays: 8, outOfRange: false });
  });

  it('Chicagoland 10U falls back to national', () => {
    expect(thresholdFor(chi10, 19).minPlays).toBe(10);
    expect(thresholdFor(chi10, 27).minPlays).toBe(8);
    expect(thresholdFor(chi10, 33).minPlays).toBe(6);
  });

  it('Pop Warner national', () => {
    expect(thresholdFor(pw12, 20).minPlays).toBe(10);
    expect(thresholdFor(pw12, 30).minPlays).toBe(8);
    expect(thresholdFor(pw12, 31).minPlays).toBe(6);
  });

  it('out of range uses nearest bracket and flags it', () => {
    expect(thresholdFor(chi9, 0)).toEqual({ minPlays: 12, outOfRange: true });
    expect(thresholdFor(chi9, 15)).toEqual({ minPlays: 12, outOfRange: true });
    expect(thresholdFor(chi9, 36)).toEqual({ minPlays: 8, outOfRange: true });
    expect(thresholdFor(chi9, 99)).toEqual({ minPlays: 8, outOfRange: true });
    expect(thresholdFor(pw12, 10)).toEqual({ minPlays: 10, outOfRange: true });
    expect(thresholdFor(pw12, 40)).toEqual({ minPlays: 6, outOfRange: true });
  });
});

describe('play types', () => {
  it('only scrimmage counts', () => {
    expect(playCounts('scrimmage')).toBe(true);
    expect(playCounts('pat')).toBe(false);
    expect(playCounts('penalty_replay')).toBe(false);
    expect(playCounts('kickoff')).toBe(false);
    expect(playCounts('spike')).toBe(false);
  });

  it('kickoff hidden at Chicagoland 9U, visible elsewhere', () => {
    const ids9 = visiblePlayTypes(chi9).map((p) => p.id);
    expect(ids9).not.toContain('kickoff');
    expect(ids9).toEqual(['scrimmage', 'pat', 'penalty_replay', 'spike']);
    expect(visiblePlayTypes(chi10).map((p) => p.id)).toContain('kickoff');
    expect(visiblePlayTypes(pw12).map((p) => p.id)).toContain('kickoff');
  });
});

describe('statusFor', () => {
  it('met when remaining is zero regardless of period', () => {
    expect(statusFor(0, 1)).toBe('met');
    expect(statusFor(0, 4)).toBe('met');
  });
  it('default above warn threshold before Q4', () => {
    expect(statusFor(4, 1)).toBe('default');
    expect(statusFor(12, 3)).toBe('default');
  });
  it('warn at 1..3 before Q4', () => {
    expect(statusFor(3, 1)).toBe('warn');
    expect(statusFor(1, 3)).toBe('warn');
  });
  it('short (red) when any remaining in Q4 or OT', () => {
    expect(statusFor(1, 4)).toBe('short');
    expect(statusFor(12, 4)).toBe('short');
    expect(statusFor(2, 5)).toBe('short');
  });
});
