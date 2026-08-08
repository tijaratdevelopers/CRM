import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import * as teamsController from '../controllers/teams.controller';

export const teamsRouter = Router();

teamsRouter.use(requireAuth);

teamsRouter.get('/', requireRole('admin', 'team_lead'), teamsController.list);
teamsRouter.get('/distribution-state', requireRole('admin'), teamsController.distributionState);
teamsRouter.post('/', requireRole('admin'), teamsController.create);
teamsRouter.patch('/:id', requireRole('admin'), teamsController.update);
teamsRouter.delete('/:id', requireRole('admin'), teamsController.remove);
teamsRouter.post('/:id/members', requireRole('admin', 'team_lead'), teamsController.addMember);
teamsRouter.delete('/:id/members/:staffId', requireRole('admin', 'team_lead'), teamsController.removeMember);
teamsRouter.patch('/:id/members/order', requireRole('admin', 'team_lead'), teamsController.reorderMembers);
