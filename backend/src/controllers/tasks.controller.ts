import { Request, Response } from 'express';
import * as tasksService from '../services/tasks.service';
import { HttpError } from '../middleware/auth';

export async function list(req: Request, res: Response) {
  const data = await tasksService.listTasks(req.user!);
  res.json(data);
}

export async function create(req: Request, res: Response) {
  const body = req.body ?? {};
  if (!body.title) throw new HttpError(400, 'title is required');
  if (!body.assignedTo) throw new HttpError(400, 'assignedTo is required');

  const data = await tasksService.createTask(req.user!, body);
  res.status(201).json(data);
}

export async function update(req: Request, res: Response) {
  const data = await tasksService.updateTask(req.user!, req.params.id, req.body ?? {});
  res.json(data);
}

export async function submit(req: Request, res: Response) {
  const data = await tasksService.submitTask(req.user!, req.params.id);
  res.json(data);
}

export async function approve(req: Request, res: Response) {
  const data = await tasksService.approveTask(req.user!, req.params.id);
  res.json(data);
}

export async function reject(req: Request, res: Response) {
  const data = await tasksService.rejectTask(req.user!, req.params.id);
  res.json(data);
}

export async function remove(req: Request, res: Response) {
  await tasksService.deleteTask(req.user!, req.params.id);
  res.status(204).send();
}
