import { supabaseAdmin } from '../config/supabaseAdmin';
import { HttpError } from '../middleware/auth';
import { unwrap } from '../utils/db';
import { logActivity } from '../utils/activityLog';
import { AuthUser } from '../types';
import * as teamsService from './teams.service';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  direct_staff_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Admin sees every project. A team_lead/staff only sees project(s) their own
 * team belongs to (found via teams.team_lead_id for a lead, or the caller's
 * own team_id for staff — AuthUser doesn't carry team_id, so it's looked up).
 */
export async function listProjects(user: AuthUser): Promise<Project[]> {
  if (user.role === 'admin') {
    return unwrap(
      await supabaseAdmin.from('projects').select('*').order('created_at'),
    ) as Project[];
  }

  const self = unwrap(
    await supabaseAdmin.from('users').select('team_id').eq('id', user.id).single(),
  ) as { team_id: string | null };

  const teams = unwrap(
    await supabaseAdmin
      .from('teams')
      .select('project_id')
      .or(`team_lead_id.eq.${user.id}${self.team_id ? `,id.eq.${self.team_id}` : ''}`),
  ) as { project_id: string }[];

  const projectIds = Array.from(new Set(teams.map((t) => t.project_id)));
  if (projectIds.length === 0) return [];

  return unwrap(
    await supabaseAdmin.from('projects').select('*').in('id', projectIds).order('created_at'),
  ) as Project[];
}

export async function createProject(
  user: AuthUser,
  input: {
    name: string;
    description?: string;
    directStaffId?: string | null;
    teamLeadIds?: string[];
  },
): Promise<Project> {
  if (input.directStaffId) {
    await assertIsStaff(input.directStaffId);
  }

  const project = unwrap(
    await supabaseAdmin
      .from('projects')
      .insert({
        name: input.name,
        description: input.description ?? null,
        direct_staff_id: input.directStaffId ?? null,
      })
      .select()
      .single(),
  ) as Project;

  await logActivity({
    actorId: user.id,
    entityType: 'project',
    entityId: project.id,
    action: 'project_created',
    metadata: { name: project.name },
  });

  if (input.teamLeadIds && input.teamLeadIds.length > 0) {
    await ensureTeamsForTeamLeads(user, project.id, project.name, input.teamLeadIds);
  }

  return project;
}

export async function updateProject(
  user: AuthUser,
  id: string,
  patch: {
    name?: string;
    description?: string | null;
    isActive?: boolean;
    directStaffId?: string | null;
    teamLeadIds?: string[];
  },
): Promise<Project> {
  if (patch.directStaffId) {
    await assertIsStaff(patch.directStaffId);
  }

  const updates: Record<string, unknown> = {};
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.isActive !== undefined) updates.is_active = patch.isActive;
  if (patch.directStaffId !== undefined) updates.direct_staff_id = patch.directStaffId;

  const project = unwrap(
    await supabaseAdmin.from('projects').update(updates).eq('id', id).select().single(),
  ) as Project;

  await logActivity({
    actorId: user.id,
    entityType: 'project',
    entityId: id,
    action: 'project_updated',
    metadata: patch as Record<string, unknown>,
  });

  if (patch.teamLeadIds && patch.teamLeadIds.length > 0) {
    await ensureTeamsForTeamLeads(user, id, project.name, patch.teamLeadIds);
  }

  return project;
}

/**
 * Attaches team leads to a project by ensuring each one has a team on it —
 * teams are what the round-robin engine (assign_lead_round_robin) actually
 * scopes staff pools by, so this is what makes "select these team leads for
 * this project" put their staff into the project's round-robin pool. Only
 * adds missing teams; never removes one for a team lead the caller left out,
 * since that could silently strand a team lead's already-assigned leads.
 */
async function ensureTeamsForTeamLeads(
  user: AuthUser,
  projectId: string,
  projectName: string,
  teamLeadIds: string[],
): Promise<void> {
  const uniqueIds = Array.from(new Set(teamLeadIds));

  const existingTeams = unwrap(
    await supabaseAdmin.from('teams').select('team_lead_id').eq('project_id', projectId),
  ) as { team_lead_id: string | null }[];
  const alreadyCovered = new Set(existingTeams.map((t) => t.team_lead_id).filter(Boolean));

  const missingIds = uniqueIds.filter((id) => !alreadyCovered.has(id));
  if (missingIds.length === 0) return;

  const leads = unwrap(
    await supabaseAdmin.from('users').select('id, full_name').in('id', missingIds),
  ) as { id: string; full_name: string }[];
  const nameById = new Map(leads.map((l) => [l.id, l.full_name]));

  // Team names are unique across the whole table, so the project name must be
  // in there too — otherwise attaching the same team lead to a second project
  // collides on "<name>'s Team" already existing from the first one.
  await Promise.all(
    missingIds.map((teamLeadId) =>
      teamsService.createTeam(user, {
        name: `${nameById.get(teamLeadId) ?? 'Team'}'s Team — ${projectName}`,
        teamLeadId,
        projectId,
      }),
    ),
  );
}

export async function deleteProject(user: AuthUser, id: string): Promise<void> {
  // Teams/leads reference projects with `on delete restrict` — deleting a
  // project that still has teams or leads fails with a clear DB error.
  const { error } = await supabaseAdmin.from('projects').delete().eq('id', id);
  if (error) throw new HttpError(400, error.message);

  await logActivity({
    actorId: user.id,
    entityType: 'project',
    entityId: id,
    action: 'project_deleted',
  });
}

async function assertIsStaff(userId: string): Promise<void> {
  const { data } = await supabaseAdmin.from('users').select('role').eq('id', userId).maybeSingle();
  if (!data || data.role !== 'staff') {
    throw new HttpError(400, 'directStaffId must reference a user with the staff role');
  }
}
