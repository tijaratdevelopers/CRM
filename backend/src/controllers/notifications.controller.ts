import { Request, Response } from 'express';
import * as notificationsService from '../services/notifications.service';
import { HttpError } from '../middleware/auth';

export async function list(req: Request, res: Response) {
  const unreadOnly = req.query.unread === 'true';
  const data = await notificationsService.listNotifications(req.user!.id, unreadOnly);
  res.json(data);
}

export async function markRead(req: Request, res: Response) {
  const data = await notificationsService.markNotificationRead(req.params.id, req.user!.id);
  if (!data) throw new HttpError(404, 'Notification not found');
  res.json(data);
}

export async function markAllRead(req: Request, res: Response) {
  await notificationsService.markAllNotificationsRead(req.user!.id);
  res.status(204).send();
}
