import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import * as leadSourcesController from '../controllers/leadSources.controller';

export const leadSourcesRouter = Router();

leadSourcesRouter.use(requireAuth);

leadSourcesRouter.get('/', leadSourcesController.list);
leadSourcesRouter.post('/', requireRole('admin'), leadSourcesController.create);
leadSourcesRouter.patch('/:id', requireRole('admin'), leadSourcesController.update);
leadSourcesRouter.delete('/:id', requireRole('admin'), leadSourcesController.remove);
