import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as bookingsController from '../controllers/bookings.controller';

export const bookingsRouter = Router();

bookingsRouter.use(requireAuth);

bookingsRouter.post('/', bookingsController.create);
