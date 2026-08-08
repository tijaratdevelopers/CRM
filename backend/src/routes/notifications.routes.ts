import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as notificationsController from '../controllers/notifications.controller';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);
notificationsRouter.get('/', notificationsController.list);
notificationsRouter.patch('/:id/read', notificationsController.markRead);
notificationsRouter.patch('/read-all', notificationsController.markAllRead);
