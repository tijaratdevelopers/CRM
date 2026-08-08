import { supabaseAdmin } from '../config/supabaseAdmin';
import { emitToUser } from '../sockets';
import { unwrap } from '../utils/db';

export type NotificationType =
  | 'lead_assigned'
  | 'meeting_reminder'
  | 'follow_up_reminder'
  | 'whatsapp_message'
  | 'lead_status_updated'
  | 'task_assigned'
  | 'lead_new_unassigned';

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  payload?: Record<string, unknown>;
}

/**
 * Single entry point for creating a notification: writes the row (so it shows
 * up via Supabase Realtime / the notifications list) AND pushes it over the
 * user's Socket.io room immediately, so there's no wait on Realtime replication.
 */
export async function createNotification(input: CreateNotificationInput) {
  const notification = unwrap(
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        payload: input.payload ?? {},
      })
      .select()
      .single(),
  );

  emitToUser(input.userId, 'notification:new', notification);
  return notification;
}

export async function listNotifications(userId: string, unreadOnly: boolean) {
  let query = supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (unreadOnly) {
    query = query.eq('is_read', false);
  }

  return unwrap(await query);
}

export async function markNotificationRead(id: string, userId: string) {
  return unwrap(
    await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single(),
  );
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw error;
}
