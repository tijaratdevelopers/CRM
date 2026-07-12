import { Router } from 'express';
import { requireAuth, requireRole, HttpError } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabaseAdmin';
import * as usersService from '../services/users.service';

export const teamLeadsRouter = Router();

teamLeadsRouter.use(requireAuth);

// Admin only: list all team leads.
teamLeadsRouter.get('/', requireRole('admin'), async (_req, res) => {
  const data = await usersService.listByRole('team_lead');
  res.json(data);
});

// Admin, or the team lead themself: list staff under this team lead.
teamLeadsRouter.get('/:id/staff', async (req, res) => {
  const { id } = req.params;
  const user = req.user!;

  if (user.role !== 'admin' && !(user.role === 'team_lead' && user.id === id)) {
    throw new HttpError(403, 'Insufficient permissions for this action');
  }

  const data = await usersService.listStaffForTeamLead(id);
  res.json(data);
});

// Admin, or the team lead themself: team lead dashboard stats.
teamLeadsRouter.get('/:id/performance', async (req, res) => {
  const { id } = req.params;
  const user = req.user!;

  if (user.role !== 'admin' && !(user.role === 'team_lead' && user.id === id)) {
    throw new HttpError(403, 'Insufficient permissions for this action');
  }

  const { data, error } = await supabaseAdmin.rpc('get_team_lead_dashboard_stats', { p_team_lead_id: id });
  if (error) {
    throw new HttpError(400, error.message);
  }

  res.json(data?.[0] ?? null);
});
