import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as followUpsController from '../controllers/followUps.controller';

export const followUpsRouter = Router();

followUpsRouter.use(requireAuth);

followUpsRouter.get('/', followUpsController.list);
followUpsRouter.get('/:id', followUpsController.getById);
followUpsRouter.post('/', followUpsController.create);
followUpsRouter.patch('/:id', followUpsController.update);
followUpsRouter.delete('/:id', followUpsController.remove);
