import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import * as projectsController from '../controllers/projects.controller';

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

projectsRouter.get('/', projectsController.list);
projectsRouter.post('/', requireRole('admin'), projectsController.create);
projectsRouter.patch('/:id', requireRole('admin'), projectsController.update);
projectsRouter.delete('/:id', requireRole('admin'), projectsController.remove);
