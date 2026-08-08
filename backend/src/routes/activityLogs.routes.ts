import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as activityLogsController from '../controllers/activityLogs.controller';

export const activityLogsRouter = Router();

activityLogsRouter.use(requireAuth);
activityLogsRouter.get('/', activityLogsController.list);
