import { Request, Response } from 'express';
import * as usersService from '../services/users.service';
import { HttpError } from '../middleware/auth';
import { Role } from '../types';

const VALID_ROLES: Role[] = ['admin', 'team_lead', 'staff'];

export async function list(req: Request, res: Response) {
  const roleQuery = req.query.role as string | undefined;
  if (roleQuery && !VALID_ROLES.includes(roleQuery as Role)) {
    throw new HttpError(400, `Invalid role filter: ${roleQuery}`);
  }

  const data = await usersService.listUsers(req.user!, roleQuery as Role | undefined);
  res.json(data);
}

export async function getById(req: Request, res: Response) {
  const data = await usersService.getUserById(req.user!, req.params.id);
  res.json(data);
}

export async function create(req: Request, res: Response) {
  const { email, fullName, phone, role, teamLeadId } = req.body ?? {};

  if (!email || !fullName || !role) {
    throw new HttpError(400, 'email, fullName and role are required');
  }
  if (!VALID_ROLES.includes(role)) {
    throw new HttpError(400, `Invalid role: ${role}`);
  }

  const data = await usersService.createUser(req.user!.id, { email, fullName, phone, role, teamLeadId });
  res.status(201).json(data);
}

export async function update(req: Request, res: Response) {
  const { fullName, phone, role, teamLeadId, isActive } = req.body ?? {};

  if (role && !VALID_ROLES.includes(role)) {
    throw new HttpError(400, `Invalid role: ${role}`);
  }

  const data = await usersService.updateUser(req.user!.id, req.params.id, {
    fullName,
    phone,
    role,
    teamLeadId,
    isActive,
  });
  res.json(data);
}

export async function deactivate(req: Request, res: Response) {
  const data = await usersService.deactivateUser(req.user!.id, req.params.id);
  res.json(data);
}
