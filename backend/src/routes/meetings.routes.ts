import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as meetingsController from '../controllers/meetings.controller';

export const meetingsRouter = Router();

meetingsRouter.use(requireAuth);

meetingsRouter.get('/', meetingsController.list);
meetingsRouter.get('/:id', meetingsController.getById);
meetingsRouter.post('/', meetingsController.create);
meetingsRouter.patch('/:id', meetingsController.update);
meetingsRouter.delete('/:id', meetingsController.remove);
