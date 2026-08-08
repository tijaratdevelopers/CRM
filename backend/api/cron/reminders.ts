import type { Request, Response } from 'express';
import { checkMeetingReminders, checkFollowUpReminders } from '../../src/jobs/reminderChecker';

// Triggered by the Vercel Cron schedule in vercel.json — replaces the
// setInterval-based poller from src/jobs/reminderChecker.ts, which only
// works in the local long-running dev server.
export default async function handler(_req: Request, res: Response) {
  await Promise.all([checkMeetingReminders(), checkFollowUpReminders()]);
  res.status(200).json({ ok: true });
}
