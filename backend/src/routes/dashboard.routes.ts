import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as dashboardController from '../controllers/dashboard.controller';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);
dashboardRouter.get('/summary', dashboardController.summary);
dashboardRouter.get('/charts', dashboardController.charts);
