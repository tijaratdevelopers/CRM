import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as authController from '../controllers/auth.controller';

export const authRouter = Router();

authRouter.get('/me', requireAuth, authController.me);
