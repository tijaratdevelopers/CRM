import { Request, Response } from 'express';
import * as callLogsService from '../services/callLogs.service';
import { HttpError } from '../middleware/auth';

export async function list(req: Request, res: Response) {
  const filters = {
    leadId: req.query.leadId as string | undefined,
    date: req.query.date as string | undefined,
  };

  const data = await callLogsService.listCallLogs(req.user!, filters);
  res.json(data);
}

export async function getById(req: Request, res: Response) {
  const data = await callLogsService.getCallLogById(req.user!, req.params.id);
  res.json(data);
}

export async function create(req: Request, res: Response) {
  const body = req.body ?? {};
  if (!body.leadId) throw new HttpError(400, 'leadId is required');
  if (!body.callDate) throw new HttpError(400, 'callDate is required');
  if (!body.callTime) throw new HttpError(400, 'callTime is required');
  if (body.durationSeconds === undefined || body.durationSeconds === null) {
    throw new HttpError(400, 'durationSeconds is required');
  }
  if (!body.status) throw new HttpError(400, 'status is required');

  const data = await callLogsService.createCallLog(req.user!, body);
  res.status(201).json(data);
}

export async function update(req: Request, res: Response) {
  const data = await callLogsService.updateCallLog(req.user!, req.params.id, req.body ?? {});
  res.json(data);
}

export async function remove(req: Request, res: Response) {
  await callLogsService.deleteCallLog(req.user!, req.params.id);
  res.status(204).send();
}
