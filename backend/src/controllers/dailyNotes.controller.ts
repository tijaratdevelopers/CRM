import { Request, Response } from 'express';
import * as dailyNotesService from '../services/dailyNotes.service';
import { HttpError } from '../middleware/auth';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function upsertMine(req: Request, res: Response) {
  const body = req.body ?? {};
  if (!body.remarks || typeof body.remarks !== 'string' || !body.remarks.trim()) {
    throw new HttpError(400, 'remarks is required');
  }

  const date = typeof body.date === 'string' && body.date ? body.date : today();
  const data = await dailyNotesService.upsertMyDailyNote(req.user!, { date, remarks: body.remarks.trim() });
  res.status(201).json(data);
}

export async function getMine(req: Request, res: Response) {
  const date = typeof req.query.date === 'string' && req.query.date ? req.query.date : today();
  const data = await dailyNotesService.getMyDailyNote(req.user!, date);
  res.json(data);
}
