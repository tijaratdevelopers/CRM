import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import * as metaController from '../controllers/meta.controller';

export const metaRouter = Router();

// Meta calls these directly — not behind requireAuth.
metaRouter.get('/webhook', metaController.verifyWebhook);
metaRouter.post('/webhook', metaController.receiveWebhook);

metaRouter.get('/status', requireAuth, requireRole('admin'), metaController.getIntegrationStatus);
