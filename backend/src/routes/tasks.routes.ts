import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import * as tasksController from '../controllers/tasks.controller';

export const tasksRouter = Router();

tasksRouter.use(requireAuth);

tasksRouter.get('/', tasksController.list);
tasksRouter.post('/', requireRole('admin', 'team_lead'), tasksController.create);
tasksRouter.patch('/:id', requireRole('admin', 'team_lead'), tasksController.update);
tasksRouter.patch('/:id/submit', requireRole('staff'), tasksController.submit);
tasksRouter.patch('/:id/approve', requireRole('admin', 'team_lead'), tasksController.approve);
tasksRouter.patch('/:id/reject', requireRole('admin', 'team_lead'), tasksController.reject);
tasksRouter.delete('/:id', requireRole('admin', 'team_lead'), tasksController.remove);
