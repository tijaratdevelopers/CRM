import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../config/supabaseAdmin';
import { HttpError } from '../middleware/auth';
import { unwrap } from '../utils/db';
import { logActivity } from '../utils/activityLog';
import { AuthUser, Role } from '../types';

const PROFILE_COLUMNS =
  'id, email, full_name, phone, role, team_lead_id, is_active, avatar_url, created_at, updated_at';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: Role;
  team_lead_id: string | null;
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface CreateUserInput {
  email: string;
  fullName: string;
  phone?: string;
  role: Role;
  teamLeadId?: string;
}

interface UpdateUserInput {
  fullName?: string;
  phone?: string;
  role?: Role;
  teamLeadId?: string | null;
  isActive?: boolean;
}

/**
 * Admin sees everyone (optionally filtered by role). Team lead sees only their
 * own staff (role='staff' and team_lead_id = their id) plus their own row.
 */
export async function listUsers(requestingUser: AuthUser, roleFilter?: Role): Promise<UserProfile[]> {
  let query = supabaseAdmin.from('users').select(PROFILE_COLUMNS).order('created_at', { ascending: false });

  if (requestingUser.role === 'team_lead') {
    query = query.or(`id.eq.${requestingUser.id},and(role.eq.staff,team_lead_id.eq.${requestingUser.id})`);
  } else if (roleFilter) {
    query = query.eq('role', roleFilter);
  }

  return unwrap(await query) as UserProfile[];
}

export async function getUserById(requestingUser: AuthUser, id: string): Promise<UserProfile> {
  const row = unwrap(await supabaseAdmin.from('users').select(PROFILE_COLUMNS).eq('id', id).single()) as UserProfile;

  if (requestingUser.role === 'team_lead') {
    const isSelf = row.id === requestingUser.id;
    const isOwnStaff = row.role === 'staff' && row.team_lead_id === requestingUser.id;
    if (!isSelf && !isOwnStaff) {
      throw new HttpError(403, 'Not authorized to view this user');
    }
  }

  return row;
}

export async function listByRole(role: Role): Promise<UserProfile[]> {
  return unwrap(
    await supabaseAdmin.from('users').select(PROFILE_COLUMNS).eq('role', role).order('created_at', { ascending: false }),
  ) as UserProfile[];
}

export async function listStaffForTeamLead(teamLeadId: string): Promise<UserProfile[]> {
  return unwrap(
    await supabaseAdmin
      .from('users')
      .select(PROFILE_COLUMNS)
      .eq('role', 'staff')
      .eq('team_lead_id', teamLeadId)
      .order('created_at', { ascending: false }),
  ) as UserProfile[];
}

export async function createUser(actorId: string, input: CreateUserInput): Promise<UserProfile & { tempPassword: string }> {
  const tempPassword = randomUUID();

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: tempPassword,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    throw new HttpError(400, authError?.message ?? 'Failed to create auth user');
  }

  const profile = unwrap(
    await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email: input.email,
        full_name: input.fullName,
        phone: input.phone ?? null,
        role: input.role,
        team_lead_id: input.teamLeadId ?? null,
      })
      .select(PROFILE_COLUMNS)
      .single(),
  ) as UserProfile;

  await logActivity({
    actorId,
    entityType: 'user',
    entityId: profile.id,
    action: 'user_created',
    metadata: { role: input.role },
  });

  return { ...profile, tempPassword };
}

export async function updateUser(actorId: string, id: string, patch: UpdateUserInput): Promise<UserProfile> {
  const updates: Record<string, unknown> = {};
  if (patch.fullName !== undefined) updates.full_name = patch.fullName;
  if (patch.phone !== undefined) updates.phone = patch.phone;
  if (patch.role !== undefined) updates.role = patch.role;
  if (patch.teamLeadId !== undefined) updates.team_lead_id = patch.teamLeadId;
  if (patch.isActive !== undefined) updates.is_active = patch.isActive;

  if (Object.keys(updates).length === 0) {
    throw new HttpError(400, 'No fields provided to update');
  }

  const profile = unwrap(
    await supabaseAdmin.from('users').update(updates).eq('id', id).select(PROFILE_COLUMNS).single(),
  ) as UserProfile;

  await logActivity({ actorId, entityType: 'user', entityId: id, action: 'user_updated', metadata: updates });

  return profile;
}

export async function deactivateUser(actorId: string, id: string): Promise<UserProfile> {
  const profile = unwrap(
    await supabaseAdmin.from('users').update({ is_active: false }).eq('id', id).select(PROFILE_COLUMNS).single(),
  ) as UserProfile;

  await logActivity({ actorId, entityType: 'user', entityId: id, action: 'user_deactivated' });

  return profile;
}
