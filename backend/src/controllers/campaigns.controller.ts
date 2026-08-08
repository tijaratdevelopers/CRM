import { Request, Response } from 'express';
import * as campaignsService from '../services/campaigns.service';
import { HttpError } from '../middleware/auth';

export async function list(_req: Request, res: Response) {
  const data = await campaignsService.listCampaigns();
  res.json(data);
}

export async function create(req: Request, res: Response) {
  const { name, sourceId, isActive } = req.body ?? {};
  if (!name) {
    throw new HttpError(400, 'name is required');
  }
  const data = await campaignsService.createCampaign({ name, sourceId, isActive });
  res.status(201).json(data);
}

export async function update(req: Request, res: Response) {
  const { name, sourceId, isActive } = req.body ?? {};
  const data = await campaignsService.updateCampaign(req.params.id, { name, sourceId, isActive });
  res.json(data);
}

export async function remove(req: Request, res: Response) {
  await campaignsService.deleteCampaign(req.params.id);
  res.status(204).send();
}
