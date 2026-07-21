import { Request, Response } from 'express';
import { HttpError } from '../middleware/auth';
import * as teamsService from '../services/teams.service';
import { getDistributionState } from '../services/assignment.service';

export async function list(req: Request, res: Response) {
  const data = await teamsService.listTeams(req.user!);
  res.json(data);
}

export async function create(req: Request, res: Response) {
  const { name, teamLeadId } = req.body ?? {};
  if (!name || typeof name !== 'string') {
    throw new HttpError(400, 'name is required');
  }
  const data = await teamsService.createTeam(req.user!, { name, teamLeadId });
  res.status(201).json(data);
}

export async function update(req: Request, res: Response) {
  const { name, teamLeadId, isActive } = req.body ?? {};
  const data = await teamsService.updateTeam(req.user!, req.params.id, { name, teamLeadId, isActive });
  res.json(data);
}

export async function remove(req: Request, res: Response) {
  await teamsService.deleteTeam(req.user!, req.params.id);
  res.status(204).send();
}

export async function addMember(req: Request, res: Response) {
  const { staffId } = req.body ?? {};
  if (!staffId) {
    throw new HttpError(400, 'staffId is required');
  }
  await teamsService.addMember(req.user!, req.params.id, staffId);
  res.status(204).send();
}

export async function removeMember(req: Request, res: Response) {
  await teamsService.removeMember(req.user!, req.params.id, req.params.staffId);
  res.status(204).send();
}

/** Admin-only peek at the persistent round-robin pointers. */
export async function distributionState(_req: Request, res: Response) {
  const data = await getDistributionState();
  res.json(data);
}
