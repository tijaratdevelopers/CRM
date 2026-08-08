import { Request, Response } from 'express';
import { HttpError } from '../middleware/auth';
import * as teamsService from '../services/teams.service';
import { getDistributionState } from '../services/assignment.service';

export async function list(req: Request, res: Response) {
  const { projectId } = req.query;
  const data = await teamsService.listTeams(req.user!, typeof projectId === 'string' ? projectId : undefined);
  res.json(data);
}

export async function create(req: Request, res: Response) {
  const { name, teamLeadId, projectId } = req.body ?? {};
  if (!name || typeof name !== 'string') {
    throw new HttpError(400, 'name is required');
  }
  if (!projectId || typeof projectId !== 'string') {
    throw new HttpError(400, 'projectId is required');
  }
  const data = await teamsService.createTeam(req.user!, { name, teamLeadId, projectId });
  res.status(201).json(data);
}

export async function update(req: Request, res: Response) {
  const { name, teamLeadId, isActive, projectId } = req.body ?? {};
  const data = await teamsService.updateTeam(req.user!, req.params.id, {
    name,
    teamLeadId,
    isActive,
    projectId,
  });
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

/** Persists the drag-and-drop staff sequence (Features 8/9). */
export async function reorderMembers(req: Request, res: Response) {
  const { staffIds } = req.body ?? {};
  if (!Array.isArray(staffIds) || staffIds.some((id) => typeof id !== 'string')) {
    throw new HttpError(400, 'staffIds must be an array of staff user ids');
  }
  await teamsService.reorderMembers(req.user!, req.params.id, staffIds);
  res.status(204).send();
}

/** Admin-only peek at the persistent round-robin pointers for one project. */
export async function distributionState(req: Request, res: Response) {
  const { projectId } = req.query;
  if (!projectId || typeof projectId !== 'string') {
    throw new HttpError(400, 'projectId query param is required');
  }
  const data = await getDistributionState(projectId);
  res.json(data);
}
