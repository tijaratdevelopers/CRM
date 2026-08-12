import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as dailyNotesController from '../controllers/dailyNotes.controller';

export const dailyNotesRouter = Router();

dailyNotesRouter.use(requireAuth);

dailyNotesRouter.get('/me', dailyNotesController.getMine);
dailyNotesRouter.post('/', dailyNotesController.upsertMine);
