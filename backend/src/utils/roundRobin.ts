/**
 * Pure round-robin pointer logic — the TypeScript mirror of the
 * `assign_lead_round_robin` Postgres function (which is the authoritative,
 * DB-locked implementation used in production). Kept side-effect free so the
 * distribution algorithm itself is unit-testable: teams first, then staff
 * (T1S1, T2S1, T3S1, T1S2, ...), skipping teams with no available staff.
 */

export interface TeamSnapshot {
  id: string;
  /** Active staff ids in stable (created_at) order. Inactive staff must already be filtered out. */
  staffIds: string[];
}

export interface RoundRobinState {
  teamPointer: number;
  staffPointer: number;
}

export interface AssignmentDecision {
  teamId: string;
  staffId: string;
  nextState: RoundRobinState;
}

export function computeNextAssignment(
  teams: TeamSnapshot[],
  state: RoundRobinState,
): AssignmentDecision | null {
  const eligible = teams.filter((t) => t.staffIds.length > 0);
  if (eligible.length === 0) return null;

  const teamCount = eligible.length;
  const maxStaff = Math.max(...eligible.map((t) => t.staffIds.length));

  let teamPointer = state.teamPointer;
  let staffPointer = state.staffPointer;

  // Normalize pointers in case teams/staff shrank since the last assignment.
  if (teamPointer >= teamCount || teamPointer < 0) teamPointer = 0;
  if (staffPointer >= maxStaff || staffPointer < 0) {
    staffPointer = ((staffPointer % maxStaff) + maxStaff) % maxStaff;
  }

  const teamIdx = teamPointer;
  const team = eligible[teamIdx];
  const staffId = team.staffIds[staffPointer % team.staffIds.length];

  let nextTeamPointer = teamIdx + 1;
  let nextStaffPointer = staffPointer;
  if (nextTeamPointer >= teamCount) {
    nextTeamPointer = 0;
    nextStaffPointer = staffPointer + 1;
    if (nextStaffPointer >= maxStaff) {
      nextStaffPointer = 0;
    }
  }

  return {
    teamId: team.id,
    staffId,
    nextState: { teamPointer: nextTeamPointer, staffPointer: nextStaffPointer },
  };
}

/** Convenience for tests/simulations: run the engine n times, threading state. */
export function simulateAssignments(
  teams: TeamSnapshot[],
  state: RoundRobinState,
  count: number,
): { assignments: { teamId: string; staffId: string }[]; finalState: RoundRobinState } {
  const assignments: { teamId: string; staffId: string }[] = [];
  let current = state;
  for (let i = 0; i < count; i++) {
    const decision = computeNextAssignment(teams, current);
    if (!decision) break;
    assignments.push({ teamId: decision.teamId, staffId: decision.staffId });
    current = decision.nextState;
  }
  return { assignments, finalState: current };
}
