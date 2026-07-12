import { supabaseAdmin } from '../config/supabaseAdmin';
import { createNotification } from '../services/notifications.service';

const CHECK_INTERVAL_MS = 60_000;
const LOOKAHEAD_MINUTES = 15;

/**
 * Polls meetings/follow_ups for reminders due in the next LOOKAHEAD_MINUTES
 * and not yet notified, then fires a notification to the assigned staff.
 * A simple in-process poller is sufficient for a localhost dev CRM; swap for
 * a real cron/queue (e.g. Supabase Edge Function on a schedule) in production.
 */
export function startReminderChecker() {
  setInterval(checkMeetingReminders, CHECK_INTERVAL_MS);
  setInterval(checkFollowUpReminders, CHECK_INTERVAL_MS);
}

async function checkMeetingReminders() {
  const cutoff = new Date(Date.now() + LOOKAHEAD_MINUTES * 60_000).toISOString();

  const { data: meetings, error } = await supabaseAdmin
    .from('meetings')
    .select('id, staff_id, title, reminder_at')
    .eq('reminder_sent', false)
    .eq('status', 'scheduled')
    .not('reminder_at', 'is', null)
    .lte('reminder_at', cutoff);

  if (error || !meetings?.length) return;

  for (const meeting of meetings) {
    await createNotification({
      userId: meeting.staff_id,
      type: 'meeting_reminder',
      title: 'Upcoming meeting',
      body: `"${meeting.title}" is coming up soon.`,
      payload: { meetingId: meeting.id },
    });
    await supabaseAdmin.from('meetings').update({ reminder_sent: true }).eq('id', meeting.id);
  }
}

async function checkFollowUpReminders() {
  const now = new Date();
  const cutoff = new Date(now.getTime() + LOOKAHEAD_MINUTES * 60_000);

  const { data: followUps, error } = await supabaseAdmin
    .from('follow_ups')
    .select('id, staff_id, notes, reminder_date, reminder_time')
    .eq('reminder_sent', false)
    .eq('status', 'pending');

  if (error || !followUps?.length) return;

  for (const followUp of followUps) {
    const reminderAt = new Date(`${followUp.reminder_date}T${followUp.reminder_time}`);
    if (reminderAt <= cutoff) {
      await createNotification({
        userId: followUp.staff_id,
        type: 'follow_up_reminder',
        title: 'Follow-up due soon',
        body: followUp.notes ?? 'You have a follow-up coming up.',
        payload: { followUpId: followUp.id },
      });
      await supabaseAdmin.from('follow_ups').update({ reminder_sent: true }).eq('id', followUp.id);
    }
  }
}
