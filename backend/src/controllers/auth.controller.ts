import { Request, Response } from 'express';
import * as usersService from '../services/users.service';

export async function me(req: Request, res: Response) {
  const profile = await usersService.getUserById(req.user!, req.user!.id);
  res.json(profile);
}
