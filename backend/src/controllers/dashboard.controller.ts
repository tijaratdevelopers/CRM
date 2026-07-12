import { Request, Response } from 'express';
import { HttpError } from '../middleware/auth';
import * as dashboardService from '../services/dashboard.service';

export async function summary(req: Request, res: Response) {
  const data = await dashboardService.getDashboardSummary(req.user!);
  res.json(data);
}

export async function charts(req: Request, res: Response) {
  if (req.user!.role === 'staff') {
    throw new HttpError(403, 'Charts are only available to admins and team leads');
  }
  const data = await dashboardService.getDashboardCharts(req.user!);
  res.json(data);
}
