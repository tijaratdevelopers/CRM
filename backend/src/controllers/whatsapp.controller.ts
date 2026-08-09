import { Request, Response } from 'express';
import { env } from '../config/env';
import { HttpError } from '../middleware/auth';
import * as whatsappDataService from '../services/whatsappData.service';
import * as whatsappIntegrationService from '../services/whatsappIntegration.service';

function requireProjectId(value: unknown): string {
  if (!value || typeof value !== 'string') {
    throw new HttpError(400, 'projectId is required');
  }
  return value;
}

/** GET /whatsapp/integration?projectId= — admin-only. */
export async function getIntegration(req: Request, res: Response) {
  const projectId = requireProjectId(req.query.projectId);
  const data = await whatsappIntegrationService.getForProject(projectId);
  res.json(data);
}

/** POST /whatsapp/integration — admin-only. Body: { projectId, phoneNumberId, displayName? }. */
export async function connectIntegration(req: Request, res: Response) {
  const { projectId, phoneNumberId, displayName } = req.body ?? {};
  if (!projectId || typeof projectId !== 'string') throw new HttpError(400, 'projectId is required');
  if (!phoneNumberId || typeof phoneNumberId !== 'string') throw new HttpError(400, 'phoneNumberId is required');
  const data = await whatsappIntegrationService.connectProject(projectId, phoneNumberId, displayName);
  res.status(201).json(data);
}

/** DELETE /whatsapp/integration?projectId= — admin-only. */
export async function disconnectIntegration(req: Request, res: Response) {
  const projectId = requireProjectId(req.query.projectId);
  await whatsappIntegrationService.disconnectProject(projectId);
  res.status(204).send();
}

/** GET /webhook — Meta/WhatsApp verification handshake. Not behind requireAuth. */
export function verifyWebhook(req: Request, res: Response) {
  const mode = req.query['hub.mode'];
  const verifyToken = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && verifyToken === env.whatsapp.verifyToken) {
    res.status(200).send(challenge);
    return;
  }
  res.sendStatus(403);
}

/**
 * POST /webhook — WhatsApp Cloud API message webhook. Not behind requireAuth.
 * Defensive/optional-chained throughout since the real payload shape is
 * complex; also accepts a simplified `{ from, body }` shape for local testing.
 * Always responds 200 quickly regardless of what happens internally.
 */
export async function receiveWebhook(req: Request, res: Response) {
  try {
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    const from: string | undefined = message?.from ?? req.body?.from;
    const body: string | undefined = message?.text?.body ?? req.body?.body;
    const phoneNumberId: string | undefined = value?.metadata?.phone_number_id ?? req.body?.phoneNumberId;

    if (from && body) {
      await whatsappDataService.recordInboundMessage(from, body, phoneNumberId);
    }
  } catch (err) {
    console.error('Failed to process WhatsApp webhook payload', err);
  }

  res.sendStatus(200);
}

export async function listMessages(req: Request, res: Response) {
  const data = await whatsappDataService.listMessagesForLead(req.user!, req.params.leadId);
  res.json(data);
}

export async function sendMessage(req: Request, res: Response) {
  const body = req.body?.body;
  if (!body || typeof body !== 'string') {
    throw new HttpError(400, 'body is required');
  }
  const data = await whatsappDataService.sendMessageToLead(req.user!, req.params.leadId, body);
  res.status(201).json(data);
}

export async function listTemplates(_req: Request, res: Response) {
  const data = await whatsappDataService.listTemplates();
  res.json(data);
}

export async function createTemplate(req: Request, res: Response) {
  const { name, body, variables } = req.body ?? {};
  if (!name || !body) {
    throw new HttpError(400, 'name and body are required');
  }
  const data = await whatsappDataService.createTemplate(req.user!, {
    name,
    body,
    variables: Array.isArray(variables) ? variables : [],
  });
  res.status(201).json(data);
}

export async function listConversations(req: Request, res: Response) {
  const data = await whatsappDataService.listConversations(req.user!);
  res.json(data);
}
