import { Request, Response } from 'express';
import * as leadSourcesService from '../services/leadSources.service';
import { HttpError } from '../middleware/auth';

export async function list(_req: Request, res: Response) {
  const data = await leadSourcesService.listLeadSources();
  res.json(data);
}

export async function create(req: Request, res: Response) {
  const { name, description } = req.body ?? {};
  if (!name) {
    throw new HttpError(400, 'name is required');
  }
  const data = await leadSourcesService.createLeadSource({ name, description });
  res.status(201).json(data);
}

export async function update(req: Request, res: Response) {
  const { name, description } = req.body ?? {};
  const data = await leadSourcesService.updateLeadSource(req.params.id, { name, description });
  res.json(data);
}

export async function remove(req: Request, res: Response) {
  await leadSourcesService.deleteLeadSource(req.params.id);
  res.status(204).send();
}
