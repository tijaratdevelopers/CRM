import { supabaseAdmin } from '../config/supabaseAdmin';
import { HttpError } from '../middleware/auth';
import { unwrap } from '../utils/db';
import { logActivity } from '../utils/activityLog';
import { AuthUser } from '../types';

export interface Team {
  id: string;
  name: string;
  team_lead_id: string | null;
  project_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamWithMembers extends Team {
  team_lead: { id: string; full_name: string; email: string } | null;
  members: {
    id: string;
    full_name: string;
    email: string;
    is_active: boolean;
    round_robin_position: number | null;
  }[];
}

async function attachMembers(teams: Team[]): Promise<TeamWithMembers[]> {
  if (teams.length === 0) return [];

  const leadIds = teams.map((t) => t.team_lead_id).filter((id): id is string => Boolean(id));
  const teamIds = teams.map((t) => t.id);

  const leads =
    leadIds.length > 0
      ? (unwrap(
          await supabaseAdmin.from('users').select('id, full_name, email').in('id', leadIds),
        ) as { id: string; full_name: string; email: string }[])
      : [];
  const leadById = new Map(leads.map((l) => [l.id, l]));

  const members = unwrap(
    await supabaseAdmin
      .from('users')
      .select('id, full_name, email, is_active, team_id, round_robin_position')
      .in('team_id', teamIds)
      .eq('role', 'staff')
      .order('round_robin_position', { ascending: true, nullsFirst: false })
      .order('created_at'),
  ) as {
    id: string;
    full_name: string;
    email: string;
    is_active: boolean;
    team_id: string;
    round_robin_position: number | null;
  }[];

  return teams.map((team) => ({
    ...team,
    team_lead: team.team_lead_id ? (leadById.get(team.team_lead_id) ?? null) : null,
    members: members
      .filter((m) => m.team_id === team.id)
      .map(({ team_id: _teamId, ...rest }) => rest),
  }));
}

/** Admin sees all teams (optionally filtered to one project); a team lead sees only their own team. */
export async function listTeams(user: AuthUser, projectId?: string): Promise<TeamWithMembers[]> {
  let query = supabaseAdmin.from('teams').select('*').order('created_at');
  if (user.role === 'team_lead') {
    query = query.eq('team_lead_id', user.id);
  }
  if (projectId) {
    query = query.eq('project_id', projectId);
  }
  const teams = unwrap(await query) as Team[];
  return attachMembers(teams);
}

export async function createTeam(
  user: AuthUser,
  input: { name: string; teamLeadId?: string; projectId: string },
): Promise<Team> {
  if (input.teamLeadId) {
    await assertIsTeamLead(input.teamLeadId);
  }

  const team = unwrap(
    await supabaseAdmin
      .from('teams')
      .insert({ name: input.name, team_lead_id: input.teamLeadId ?? null, project_id: input.projectId })
      .select()
      .single(),
  ) as Team;

  await logActivity({
    actorId: user.id,
    entityType: 'team',
    entityId: team.id,
    action: 'team_created',
    metadata: { name: team.name },
  });

  return team;
}

export async function updateTeam(
  user: AuthUser,
  id: string,
  patch: { name?: string; teamLeadId?: string | null; isActive?: boolean; projectId?: string },
): Promise<Team> {
  if (patch.teamLeadId) {
    await assertIsTeamLead(patch.teamLeadId);
  }

  const updates: Record<string, unknown> = {};
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.teamLeadId !== undefined) updates.team_lead_id = patch.teamLeadId;
  if (patch.isActive !== undefined) updates.is_active = patch.isActive;
  if (patch.projectId !== undefined) updates.project_id = patch.projectId;

  const team = unwrap(
    await supabaseAdmin.from('teams').update(updates).eq('id', id).select().single(),
  ) as Team;

  // Keep the legacy users.team_lead_id scoping column in sync for this team's staff.
  if (patch.teamLeadId !== undefined) {
    await supabaseAdmin
      .from('users')
      .update({ team_lead_id: patch.teamLeadId })
      .eq('team_id', id)
      .eq('role', 'staff');
  }

  await logActivity({
    actorId: user.id,
    entityType: 'team',
    entityId: id,
    action: 'team_updated',
    metadata: patch as Record<string, unknown>,
  });

  return team;
}

export async function deleteTeam(user: AuthUser, id: string): Promise<void> {
  // Members fall back to unassigned (team_id set null by FK); leads keep history.
  const { error } = await supabaseAdmin.from('teams').delete().eq('id', id);
  if (error) throw new HttpError(400, error.message);

  await logActivity({
    actorId: user.id,
    entityType: 'team',
    entityId: id,
    action: 'team_deleted',
  });
}

/**
 * Adds a staff member to a team. Admin can touch any team; a team lead only
 * their own. Also syncs users.team_lead_id so all existing scoping keeps working.
 */
export async function addMember(user: AuthUser, teamId: string, staffId: string): Promise<void> {
  const team = await getTeamOrThrow(teamId);
  if (user.role === 'team_lead' && team.team_lead_id !== user.id) {
    throw new HttpError(403, 'You can only manage your own team');
  }

  const staff = unwrap(
    await supabaseAdmin.from('users').select('id, role').eq('id', staffId).maybeSingle(),
  ) as { id: string; role: string } | null;
  if (!staff || staff.role !== 'staff') {
    throw new HttpError(400, 'staffId must reference an existing staff user');
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update({ team_id: teamId, team_lead_id: team.team_lead_id })
    .eq('id', staffId);
  if (error) throw new HttpError(400, error.message);

  await logActivity({
    actorId: user.id,
    entityType: 'team',
    entityId: teamId,
    action: 'team_member_added',
    metadata: { staffId },
  });
}

export async function removeMember(user: AuthUser, teamId: string, staffId: string): Promise<void> {
  const team = await getTeamOrThrow(teamId);
  if (user.role === 'team_lead' && team.team_lead_id !== user.id) {
    throw new HttpError(403, 'You can only manage your own team');
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update({ team_id: null, team_lead_id: null })
    .eq('id', staffId)
    .eq('team_id', teamId);
  if (error) throw new HttpError(400, error.message);

  await logActivity({
    actorId: user.id,
    entityType: 'team',
    entityId: teamId,
    action: 'team_member_removed',
    metadata: { staffId },
  });
}

/**
 * Persists the admin-configured staff round-robin order (Features 8/9).
 * `staffIds` must be exactly the team's current active+inactive staff, in the
 * desired order — position = array index. The round-robin engine
 * (assign_lead_round_robin) orders by this column, falling back to
 * created_at for any staff member who has never been explicitly reordered.
 */
export async function reorderMembers(user: AuthUser, teamId: string, staffIds: string[]): Promise<void> {
  const team = await getTeamOrThrow(teamId);
  if (user.role === 'team_lead' && team.team_lead_id !== user.id) {
    throw new HttpError(403, 'You can only manage your own team');
  }

  const members = unwrap(
    await supabaseAdmin.from('users').select('id').eq('team_id', teamId).eq('role', 'staff'),
  ) as { id: string }[];
  const memberIds = new Set(members.map((m) => m.id));

  if (staffIds.length !== memberIds.size || staffIds.some((id) => !memberIds.has(id))) {
    throw new HttpError(400, 'staffIds must contain exactly this team\'s staff members');
  }

  await Promise.all(
    staffIds.map((staffId, index) =>
      supabaseAdmin.from('users').update({ round_robin_position: index }).eq('id', staffId),
    ),
  );

  await logActivity({
    actorId: user.id,
    entityType: 'team',
    entityId: teamId,
    action: 'team_members_reordered',
    metadata: { order: staffIds },
  });
}

async function getTeamOrThrow(id: string): Promise<Team> {
  const team = unwrap(
    await supabaseAdmin.from('teams').select('*').eq('id', id).maybeSingle(),
  ) as Team | null;
  if (!team) throw new HttpError(404, 'Team not found');
  return team;
}

async function assertIsTeamLead(userId: string): Promise<void> {
  const { data } = await supabaseAdmin.from('users').select('role').eq('id', userId).maybeSingle();
  if (!data || data.role !== 'team_lead') {
    throw new HttpError(400, 'teamLeadId must reference a user with the team_lead role');
  }
}
