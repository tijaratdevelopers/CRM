import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requireRole } from '../middleware/auth';
import * as leadsController from '../controllers/leads.controller';

const upload = multer({ storage: multer.memoryStorage() });

export const leadsRouter = Router();

leadsRouter.use(requireAuth);

leadsRouter.get('/', leadsController.list);
leadsRouter.get('/:id', leadsController.getById);
leadsRouter.post('/', requireRole('admin', 'team_lead'), leadsController.create);
leadsRouter.patch('/:id', requireRole('admin', 'team_lead', 'staff'), leadsController.update);
leadsRouter.patch('/:id/assign', requireRole('admin', 'team_lead'), leadsController.assign);
leadsRouter.post(
  '/bulk-upload',
  requireRole('admin', 'team_lead'),
  upload.single('file'),
  leadsController.bulkUpload,
);
