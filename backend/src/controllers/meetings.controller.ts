import { Request, Response } from 'express';
import * as meetingsService from '../services/meetings.service';
import { HttpError } from '../middleware/auth';
import { MeetingStatus } from '../services/meetings.service';

export async function list(req: Request, res: Response) {
  const filters = {
    date: req.query.date as string | undefined,
    status: req.query.status as MeetingStatus | undefined,
    leadId: req.query.leadId as string | undefined,
  };

  const data = await meetingsService.listMeetings(req.user!, filters);
  res.json(data);
}

export async function getById(req: Request, res: Response) {
  const data = await meetingsService.getMeetingById(req.user!, req.params.id);
  res.json(data);
}

export async function create(req: Request, res: Response) {
  const body = req.body ?? {};
  if (!body.leadId) throw new HttpError(400, 'leadId is required');
  if (!body.title) throw new HttpError(400, 'title is required');
  if (!body.meetingDate) throw new HttpError(400, 'meetingDate is required');
  if (!body.meetingTime) throw new HttpError(400, 'meetingTime is required');
  if (!body.mode) throw new HttpError(400, 'mode is required');

  const data = await meetingsService.createMeeting(req.user!, body);
  res.status(201).json(data);
}

export async function update(req: Request, res: Response) {
  const data = await meetingsService.updateMeeting(req.user!, req.params.id, req.body ?? {});
  res.json(data);
}

export async function remove(req: Request, res: Response) {
  await meetingsService.deleteMeeting(req.user!, req.params.id);
  res.status(204).send();
}
