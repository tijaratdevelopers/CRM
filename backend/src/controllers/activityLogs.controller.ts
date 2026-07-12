import { Request, Response } from 'express';
import * as activityLogsService from '../services/activityLogs.service';

function toPositiveInt(value: unknown, fallback: number, max?: number): number {
  const parsed = parseInt(String(value ?? ''), 10);
  const n = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  return max ? Math.min(n, max) : n;
}

export async function list(req: Request, res: Response) {
  const page = toPositiveInt(req.query.page, 1);
  const pageSize = toPositiveInt(req.query.pageSize, 20, 100);

  const filters = {
    entityType: req.query.entityType as string | undefined,
    entityId: req.query.entityId as string | undefined,
  };

  const result = await activityLogsService.listActivityLogs(req.user!, filters, page, pageSize);
  res.json(result);
}
