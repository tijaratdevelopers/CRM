import { Router } from 'express';
import { requireAuth, HttpError } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabaseAdmin';
import { unwrap } from '../utils/db';
import * as usersService from '../services/users.service';

export const staffRouter = Router();

staffRouter.use(requireAuth);

// Admin: all staff. Team lead: only their own staff. Staff: not permitted.
staffRouter.get('/', async (req, res) => {
  const user = req.user!;

  if (user.role === 'admin') {
    const data = await usersService.listByRole('staff');
    return res.json(data);
  }
  if (user.role === 'team_lead') {
    const data = await usersService.listStaffForTeamLead(user.id);
    return res.json(data);
  }
  throw new HttpError(403, 'Insufficient permissions for this action');
});

// Admin, the staffer's team lead, or the staffer themself: staff dashboard stats.
staffRouter.get('/:id/performance', async (req, res) => {
  const { id } = req.params;
  const user = req.user!;

  if (user.role === 'staff') {
    if (user.id !== id) {
      throw new HttpError(403, 'Insufficient permissions for this action');
    }
  } else if (user.role === 'team_lead') {
    const staffRow = unwrap(
      await supabaseAdmin.from('users').select('team_lead_id').eq('id', id).single(),
    ) as { team_lead_id: string | null };
    if (staffRow.team_lead_id !== user.id) {
      throw new HttpError(403, 'Insufficient permissions for this action');
    }
  } else if (user.role !== 'admin') {
    throw new HttpError(403, 'Insufficient permissions for this action');
  }

  const { data, error } = await supabaseAdmin.rpc('get_staff_dashboard_stats', { p_staff_id: id });
  if (error) {
    throw new HttpError(400, error.message);
  }

  res.json(data?.[0] ?? null);
});
