import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import * as metaController from '../controllers/meta.controller';

export const metaRouter = Router();

// Meta calls these directly — not behind requireAuth.
metaRouter.get('/webhook', metaController.verifyWebhook);
metaRouter.post('/webhook', metaController.receiveWebhook);
// Browser redirect from Facebook OAuth — authenticated via the signed `state` param.
metaRouter.get('/callback', metaController.oauthCallback);

const adminOnly = [requireAuth, requireRole('admin')] as const;

metaRouter.get('/login', ...adminOnly, metaController.getLoginUrl);
metaRouter.get('/status', ...adminOnly, metaController.getIntegrationStatus);
metaRouter.get('/businesses', ...adminOnly, metaController.listBusinesses);
metaRouter.get('/pages', ...adminOnly, metaController.listPages);
metaRouter.get('/forms', ...adminOnly, metaController.listForms);
metaRouter.post('/connect', ...adminOnly, metaController.connect);
metaRouter.post('/disconnect', ...adminOnly, metaController.disconnect);
