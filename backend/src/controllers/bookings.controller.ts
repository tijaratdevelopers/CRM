import { Request, Response } from 'express';
import * as bookingsService from '../services/bookings.service';
import { HttpError } from '../middleware/auth';

export async function list(req: Request, res: Response) {
  const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
  const data = await bookingsService.listBookings(req.user!, projectId);
  res.json(data);
}

export async function create(req: Request, res: Response) {
  const body = req.body ?? {};
  if (!body.leadId) throw new HttpError(400, 'leadId is required');
  if (!body.propertyPlot) throw new HttpError(400, 'propertyPlot is required');
  if (body.amount === undefined || body.amount === null || Number.isNaN(Number(body.amount))) {
    throw new HttpError(400, 'amount is required');
  }

  const data = await bookingsService.createBooking(req.user!, {
    leadId: body.leadId,
    propertyPlot: body.propertyPlot,
    amount: Number(body.amount),
    downPaymentDone: Boolean(body.downPaymentDone),
    notes: body.notes,
  });
  res.status(201).json(data);
}
