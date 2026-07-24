import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import * as usersController from '../controllers/users.controller';

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get('/', requireRole('admin', 'team_lead'), usersController.list);
usersRouter.get('/:id', requireRole('admin', 'team_lead'), usersController.getById);
usersRouter.post('/', requireRole('admin', 'team_lead'), usersController.create);
usersRouter.patch('/:id', requireRole('admin'), usersController.update);
usersRouter.patch('/:id/deactivate', requireRole('admin'), usersController.deactivate);
