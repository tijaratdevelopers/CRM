import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import * as campaignsController from '../controllers/campaigns.controller';

export const campaignsRouter = Router();

campaignsRouter.use(requireAuth);

campaignsRouter.get('/', campaignsController.list);
campaignsRouter.post('/', requireRole('admin'), campaignsController.create);
campaignsRouter.patch('/:id', requireRole('admin'), campaignsController.update);
campaignsRouter.delete('/:id', requireRole('admin'), campaignsController.remove);
