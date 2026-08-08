import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as callLogsController from '../controllers/callLogs.controller';

export const callLogsRouter = Router();

callLogsRouter.use(requireAuth);

callLogsRouter.get('/', callLogsController.list);
callLogsRouter.get('/:id', callLogsController.getById);
callLogsRouter.post('/', callLogsController.create);
callLogsRouter.patch('/:id', callLogsController.update);
callLogsRouter.delete('/:id', callLogsController.remove);
