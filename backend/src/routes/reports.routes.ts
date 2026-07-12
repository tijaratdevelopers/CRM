import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as reportsController from '../controllers/reports.controller';

export const reportsRouter = Router();

reportsRouter.use(requireAuth);

reportsRouter.get('/:type/export', reportsController.exportReport);
reportsRouter.get('/:type', reportsController.preview);
