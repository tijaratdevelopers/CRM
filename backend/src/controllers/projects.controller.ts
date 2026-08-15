import { Request, Response } from 'express';
import { HttpError } from '../middleware/auth';
import * as projectsService from '../services/projects.service';

export async function list(req: Request, res: Response) {
  const data = await projectsService.listProjects(req.user!);
  res.json(data);
}

function parseTeamLeadIds(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every((id) => typeof id === 'string')) {
    throw new HttpError(400, 'teamLeadIds must be an array of strings');
  }
  return value;
}

export async function create(req: Request, res: Response) {
  const { name, description, directStaffId, teamLeadIds } = req.body ?? {};
  if (!name || typeof name !== 'string') {
    throw new HttpError(400, 'name is required');
  }
  const data = await projectsService.createProject(req.user!, {
    name,
    description,
    directStaffId,
    teamLeadIds: parseTeamLeadIds(teamLeadIds),
  });
  res.status(201).json(data);
}

export async function update(req: Request, res: Response) {
  const { name, description, isActive, directStaffId, teamLeadIds } = req.body ?? {};
  const data = await projectsService.updateProject(req.user!, req.params.id, {
    name,
    description,
    isActive,
    directStaffId,
    teamLeadIds: parseTeamLeadIds(teamLeadIds),
  });
  res.json(data);
}

export async function remove(req: Request, res: Response) {
  await projectsService.deleteProject(req.user!, req.params.id);
  res.status(204).send();
}
