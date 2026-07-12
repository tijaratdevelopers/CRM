import { supabaseAdmin } from '../config/supabaseAdmin';
import { HttpError } from '../middleware/auth';
import { unwrap } from '../utils/db';
import { getTeamStaffIds } from '../utils/scope';
import { createNotification } from './notifications.service';
import { AuthUser } from '../types';

export type TaskStatus = 'pending' | 'submitted' | 'approved' | 'rejected';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  created_by: string | null;
  assigned_to: string | null;
  status: TaskStatus;
  approved_by: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  assignedTo: string;
  dueDate?: string;
}

async function fetchTaskOrThrow(id: string): Promise<Task> {
  const { data, error } = await supabaseAdmin.from('tasks').select('*').eq('id', id).maybeSingle();
  if (error) {
    throw new HttpError(400, error.message);
  }
  if (!data) {
    throw new HttpError(404, 'Task not found');
  }
  return data as Task;
}

async function isTeamLeadOfUser(teamLeadId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('team_lead_id')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    throw new HttpError(400, error.message);
  }
  return data?.team_lead_id === teamLeadId;
}

async function assertCanApproveOrReject(user: AuthUser, task: Task): Promise<void> {
  if (user.role === 'admin') return;
  if (user.role === 'team_lead') {
    if (task.created_by === user.id) return;
    if (task.assigned_to && (await isTeamLeadOfUser(user.id, task.assigned_to))) return;
  }
  throw new HttpError(403, 'Not authorized to approve or reject this task');
}

/**
 * Admin sees all tasks. Team lead sees tasks they created, plus tasks assigned to
 * one of their staff. Staff sees only tasks assigned to them.
 */
export async function listTasks(user: AuthUser): Promise<Task[]> {
  let query = supabaseAdmin.from('tasks').select('*');

  if (user.role === 'staff') {
    query = query.eq('assigned_to', user.id);
  } else if (user.role === 'team_lead') {
    const staffIds = await getTeamStaffIds(user.id);
    let orFilter = `created_by.eq.${user.id}`;
    if (staffIds.length > 0) {
      orFilter += `,assigned_to.in.(${staffIds.join(',')})`;
    }
    query = query.or(orFilter);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
    throw new HttpError(400, error.message);
  }
  return (data ?? []) as Task[];
}

export async function createTask(user: AuthUser, input: CreateTaskInput): Promise<Task> {
  const task = unwrap(
    await supabaseAdmin
      .from('tasks')
      .insert({
        title: input.title,
        description: input.description ?? null,
        created_by: user.id,
        assigned_to: input.assignedTo,
        status: 'pending',
        due_date: input.dueDate ?? null,
      })
      .select()
      .single(),
  ) as Task;

  await createNotification({
    userId: input.assignedTo,
    type: 'task_assigned',
    title: 'New task assigned',
    body: input.title,
    payload: { taskId: task.id },
  });

  return task;
}

export async function submitTask(user: AuthUser, id: string): Promise<Task> {
  const current = await fetchTaskOrThrow(id);
  if (current.assigned_to !== user.id) {
    throw new HttpError(403, 'Not authorized to submit this task');
  }

  return unwrap(
    await supabaseAdmin.from('tasks').update({ status: 'submitted' }).eq('id', id).select().single(),
  ) as Task;
}

export async function approveTask(user: AuthUser, id: string): Promise<Task> {
  const current = await fetchTaskOrThrow(id);
  await assertCanApproveOrReject(user, current);

  return unwrap(
    await supabaseAdmin
      .from('tasks')
      .update({ status: 'approved', approved_by: user.id })
      .eq('id', id)
      .select()
      .single(),
  ) as Task;
}

export async function rejectTask(user: AuthUser, id: string): Promise<Task> {
  const current = await fetchTaskOrThrow(id);
  await assertCanApproveOrReject(user, current);

  return unwrap(
    await supabaseAdmin
      .from('tasks')
      .update({ status: 'rejected', approved_by: user.id })
      .eq('id', id)
      .select()
      .single(),
  ) as Task;
}

export async function deleteTask(user: AuthUser, id: string): Promise<void> {
  const current = await fetchTaskOrThrow(id);

  const isAdmin = user.role === 'admin';
  const isCreatorTeamLead = user.role === 'team_lead' && current.created_by === user.id;
  if (!isAdmin && !isCreatorTeamLead) {
    throw new HttpError(403, 'Not authorized to delete this task');
  }

  const { error } = await supabaseAdmin.from('tasks').delete().eq('id', id);
  if (error) {
    throw new HttpError(400, error.message);
  }
}
