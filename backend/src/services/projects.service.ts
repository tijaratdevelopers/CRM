import { supabaseAdmin } from '../config/supabaseAdmin';
import { HttpError } from '../middleware/auth';
import { unwrap } from '../utils/db';
import { logActivity } from '../utils/activityLog';
import { AuthUser } from '../types';

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
  input: { name: string; description?: string; directStaffId?: string | null },
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

  return project;
}

export async function updateProject(
  user: AuthUser,
  id: string,
  patch: { name?: string; description?: string | null; isActive?: boolean; directStaffId?: string | null },
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

  return project;
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
