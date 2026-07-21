import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import * as whatsappController from '../controllers/whatsapp.controller';

export const whatsappRouter = Router();

// Meta/WhatsApp calls these directly — not behind requireAuth.
whatsappRouter.get('/webhook', whatsappController.verifyWebhook);
whatsappRouter.post('/webhook', whatsappController.receiveWebhook);

whatsappRouter.get('/conversations', requireAuth, whatsappController.listConversations);
whatsappRouter.get('/templates', requireAuth, whatsappController.listTemplates);
whatsappRouter.post(
  '/templates',
  requireAuth,
  requireRole('admin', 'team_lead'),
  whatsappController.createTemplate,
);
whatsappRouter.get('/messages/:leadId', requireAuth, whatsappController.listMessages);
whatsappRouter.post('/messages/:leadId/send', requireAuth, whatsappController.sendMessage);
