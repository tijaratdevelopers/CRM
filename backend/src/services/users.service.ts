import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../config/supabaseAdmin';
import { HttpError } from '../middleware/auth';
import { unwrap } from '../utils/db';
import { logActivity } from '../utils/activityLog';
import { sendInviteEmail } from './email.service';
import { AuthUser, Role } from '../types';

const PROFILE_COLUMNS =
  'id, email, full_name, phone, role, team_lead_id, team_id, is_active, avatar_url, round_robin_position, created_at, updated_at';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: Role;
  team_lead_id: string | null;
  team_id: string | null;
  is_active: boolean;
  avatar_url: string | null;
  round_robin_position: number | null;
  created_at: string;
  updated_at: string;
}

interface CreateUserInput {
  email: string;
  fullName: string;
  phone?: string;
  role: Role;
  teamLeadId?: string;
  /** Admin/team-lead can set this explicitly; otherwise a random one is generated. */
  password?: string;
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
 *
 * Deactivated users are excluded everywhere by default — every staff/team-lead
 * picker in the app (lead/task/meeting assignment, project routing, etc.)
 * calls this same endpoint, so a deactivated account simply stops appearing
 * as an option anywhere the moment it's turned off. `includeInactive` is the
 * one deliberate carve-out, for the admin-only Users management page, which
 * still needs to show deactivated accounts (tagged "Inactive") so an admin
 * can reactivate them — only honored for admins, so no other caller can use
 * it to surface accounts they shouldn't see.
 */
export async function listUsers(
  requestingUser: AuthUser,
  roleFilter?: Role,
  includeInactive?: boolean,
): Promise<UserProfile[]> {
  let query = supabaseAdmin.from('users').select(PROFILE_COLUMNS).order('created_at', { ascending: false });

  if (requestingUser.role === 'team_lead') {
    query = query.or(`id.eq.${requestingUser.id},and(role.eq.staff,team_lead_id.eq.${requestingUser.id})`);
  } else if (roleFilter) {
    query = query.eq('role', roleFilter);
  }

  if (!(includeInactive && requestingUser.role === 'admin')) {
    query = query.eq('is_active', true);
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
    await supabaseAdmin
      .from('users')
      .select(PROFILE_COLUMNS)
      .eq('role', role)
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
  ) as UserProfile[];
}

export async function listStaffForTeamLead(teamLeadId: string): Promise<UserProfile[]> {
  return unwrap(
    await supabaseAdmin
      .from('users')
      .select(PROFILE_COLUMNS)
      .eq('role', 'staff')
      .eq('team_lead_id', teamLeadId)
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
  ) as UserProfile[];
}

export async function createUser(actorId: string, input: CreateUserInput): Promise<UserProfile & { tempPassword: string }> {
  if (input.password && input.password.length < 6) {
    throw new HttpError(400, 'Password must be at least 6 characters');
  }
  const tempPassword = input.password || randomUUID();

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

  await sendInviteEmail({
    toEmail: profile.email,
    fullName: profile.full_name,
    tempPassword,
    role: profile.role,
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

/**
 * Admin can reset anyone's password; a team lead may only reset their own staff's.
 */
export async function resetUserPassword(requestingUser: AuthUser, id: string, newPassword: string): Promise<void> {
  if (newPassword.length < 6) {
    throw new HttpError(400, 'Password must be at least 6 characters');
  }

  if (requestingUser.role === 'team_lead') {
    const target = unwrap(
      await supabaseAdmin.from('users').select('role, team_lead_id').eq('id', id).single(),
    ) as { role: Role; team_lead_id: string | null };
    if (target.role !== 'staff' || target.team_lead_id !== requestingUser.id) {
      throw new HttpError(403, 'Not authorized to reset this user\'s password');
    }
  } else if (requestingUser.role !== 'admin') {
    throw new HttpError(403, 'Not authorized to reset passwords');
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password: newPassword });
  if (error) {
    throw new HttpError(400, error.message);
  }

  await logActivity({ actorId: requestingUser.id, entityType: 'user', entityId: id, action: 'user_password_reset' });
}

export async function deactivateUser(actorId: string, id: string): Promise<UserProfile> {
  const profile = unwrap(
    await supabaseAdmin.from('users').update({ is_active: false }).eq('id', id).select(PROFILE_COLUMNS).single(),
  ) as UserProfile;

  await logActivity({ actorId, entityType: 'user', entityId: id, action: 'user_deactivated' });

  return profile;
}
