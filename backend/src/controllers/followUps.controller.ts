import { Request, Response } from 'express';
import * as followUpsService from '../services/followUps.service';
import { HttpError } from '../middleware/auth';
import { FollowUpStatus } from '../services/followUps.service';

export async function list(req: Request, res: Response) {
  const filters = {
    status: req.query.status as FollowUpStatus | undefined,
    date: req.query.date as string | undefined,
    leadId: req.query.leadId as string | undefined,
  };

  const data = await followUpsService.listFollowUps(req.user!, filters);
  res.json(data);
}

export async function getById(req: Request, res: Response) {
  const data = await followUpsService.getFollowUpById(req.user!, req.params.id);
  res.json(data);
}

export async function create(req: Request, res: Response) {
  const body = req.body ?? {};
  if (!body.leadId) throw new HttpError(400, 'leadId is required');
  if (!body.reminderDate) throw new HttpError(400, 'reminderDate is required');
  if (!body.reminderTime) throw new HttpError(400, 'reminderTime is required');

  const data = await followUpsService.createFollowUp(req.user!, body);
  res.status(201).json(data);
}

export async function update(req: Request, res: Response) {
  const data = await followUpsService.updateFollowUp(req.user!, req.params.id, req.body ?? {});
  res.json(data);
}

export async function remove(req: Request, res: Response) {
  await followUpsService.deleteFollowUp(req.user!, req.params.id);
  res.status(204).send();
}
