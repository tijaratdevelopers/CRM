import { describe, expect, it } from 'vitest';
import { RoundRobinState, TeamSnapshot, computeNextAssignment, simulateAssignments } from './roundRobin';

function makeTeams(teamCount: number, staffPerTeam: number): TeamSnapshot[] {
  return Array.from({ length: teamCount }, (_, t) => ({
    id: `T${t + 1}`,
    staffIds: Array.from({ length: staffPerTeam }, (_, s) => `T${t + 1}S${s + 1}`),
  }));
}

const START: RoundRobinState = { teamPointer: 0, staffPointer: 0 };

describe('round robin assignment engine', () => {
  it('follows the spec order: T1S1, T2S1, T3S1, T1S2, ...', () => {
    const teams = makeTeams(3, 10);
    const { assignments } = simulateAssignments(teams, START, 7);

    expect(assignments.map((a) => a.staffId)).toEqual([
      'T1S1',
      'T2S1',
      'T3S1',
      'T1S2',
      'T2S2',
      'T3S2',
      'T1S3',
    ]);
  });

  it('gives every staff member exactly one lead per full cycle (3 teams x 10 staff = 30 leads)', () => {
    const teams = makeTeams(3, 10);
    const { assignments } = simulateAssignments(teams, START, 30);

    const seen = new Set(assignments.map((a) => a.staffId));
    expect(seen.size).toBe(30);
  });

  it('restarts from T1S1 on lead 31 (wrap-around forever)', () => {
    const teams = makeTeams(3, 10);
    const { assignments, finalState } = simulateAssignments(teams, START, 31);

    expect(assignments[30].staffId).toBe('T1S1');
    expect(finalState).toEqual({ teamPointer: 1, staffPointer: 0 });
  });

  it('never assigns the same staff twice before everyone has received one (fairness over 300 leads)', () => {
    const teams = makeTeams(3, 10);
    const { assignments } = simulateAssignments(teams, START, 300);

    const counts = new Map<string, number>();
    for (const a of assignments) {
      counts.set(a.staffId, (counts.get(a.staffId) ?? 0) + 1);
    }
    // 300 leads / 30 staff = exactly 10 each.
    expect(new Set(counts.values())).toEqual(new Set([10]));

    // Within each block of 30, all 30 staff appear exactly once.
    for (let block = 0; block < 10; block++) {
      const slice = assignments.slice(block * 30, block * 30 + 30);
      expect(new Set(slice.map((a) => a.staffId)).size).toBe(30);
    }
  });

  it('skips teams with no available staff (inactive/on-leave staff filtered out)', () => {
    const teams: TeamSnapshot[] = [
      { id: 'T1', staffIds: ['T1S1'] },
      { id: 'T2', staffIds: [] }, // whole team unavailable
      { id: 'T3', staffIds: ['T3S1'] },
    ];
    const { assignments } = simulateAssignments(teams, START, 4);

    expect(assignments.map((a) => a.teamId)).toEqual(['T1', 'T3', 'T1', 'T3']);
  });

  it('returns null when no team has any available staff', () => {
    const teams: TeamSnapshot[] = [
      { id: 'T1', staffIds: [] },
      { id: 'T2', staffIds: [] },
    ];
    expect(computeNextAssignment(teams, START)).toBeNull();
    expect(computeNextAssignment([], START)).toBeNull();
  });

  it('handles uneven team sizes without starving the smaller team', () => {
    const teams: TeamSnapshot[] = [
      { id: 'T1', staffIds: ['T1S1', 'T1S2', 'T1S3'] },
      { id: 'T2', staffIds: ['T2S1'] },
    ];
    const { assignments } = simulateAssignments(teams, START, 6);

    // Teams alternate every lead; the small team's single staff cycles.
    expect(assignments.map((a) => a.staffId)).toEqual([
      'T1S1',
      'T2S1',
      'T1S2',
      'T2S1',
      'T1S3',
      'T2S1',
    ]);
  });

  it('recovers when stored pointers are out of range (staff removed since last run)', () => {
    const teams = makeTeams(2, 2);
    const decision = computeNextAssignment(teams, { teamPointer: 9, staffPointer: 17 });

    expect(decision).not.toBeNull();
    expect(decision!.teamId).toBe('T1');
    // 17 % 2 = 1 → second staff member.
    expect(decision!.staffId).toBe('T1S2');
  });

  it('is deterministic: same state + same teams = same decision (restart/deployment safety)', () => {
    const teams = makeTeams(3, 10);
    const state: RoundRobinState = { teamPointer: 2, staffPointer: 7 };

    const a = computeNextAssignment(teams, state);
    const b = computeNextAssignment(teams, state);
    expect(a).toEqual(b);
  });
});
