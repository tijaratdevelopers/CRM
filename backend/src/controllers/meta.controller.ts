import { Request, Response } from 'express';
import { env } from '../config/env';
import { supabaseAdmin } from '../config/supabaseAdmin';
import { verifyWebhookSignature, fetchLeadDetailsFromMeta, MetaLeadDetails } from '../integrations/meta.service';
import { createNotification } from '../services/notifications.service';

const META_LEAD_SOURCE_NAME = 'Meta Lead Ads';

/** GET /webhook — Meta verification handshake. Not behind requireAuth. */
export function verifyWebhook(req: Request, res: Response) {
  const mode = req.query['hub.mode'];
  const verifyToken = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && verifyToken === env.meta.verifyToken) {
    res.status(200).send(challenge);
    return;
  }
  res.sendStatus(403);
}

function buildLeadNotes(details: MetaLeadDetails): string {
  const lines = [`Meta leadgen_id: ${details.leadgenId}`, 'Source: Facebook/Instagram Lead Ad'];
  if (details.company) lines.push(`Company: ${details.company}`);
  if (details.city) lines.push(`City: ${details.city}`);
  return lines.join('\n');
}

/** Notifies every active admin — Meta leads land unassigned, so admins are who needs to know. */
async function notifyAdminsOfNewLead(leadId: string, leadName: string): Promise<void> {
  const { data: admins } = await supabaseAdmin.from('users').select('id').eq('role', 'admin').eq('is_active', true);

  await Promise.all(
    (admins ?? []).map((admin: { id: string }) =>
      createNotification({
        userId: admin.id,
        type: 'lead_new_unassigned',
        title: 'New lead from Meta Ads',
        body: leadName,
        payload: { leadId },
      }),
    ),
  );
}

async function processLeadgenEvent(leadgenId: string): Promise<void> {
  // Meta can redeliver the same event on retry — skip if we already recorded this leadgen_id.
  const existing = await supabaseAdmin.from('leads').select('id').ilike('notes', `%leadgen_id: ${leadgenId}%`).maybeSingle();
  if (existing.data) return;

  const details = await fetchLeadDetailsFromMeta(leadgenId);

  const source = await supabaseAdmin.from('lead_sources').select('id').eq('name', META_LEAD_SOURCE_NAME).maybeSingle();

  const { data: lead, error } = await supabaseAdmin
    .from('leads')
    .insert({
      name: details.fullName || `Meta Lead ${leadgenId}`,
      phone: details.phone ?? null,
      email: details.email ?? null,
      company: details.company ?? null,
      city: details.city ?? null,
      source_id: source.data?.id ?? null,
      status: 'new',
      priority: 'medium',
      notes: buildLeadNotes(details),
      created_by: null,
      last_modified_by: null,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to insert Meta lead', leadgenId, error);
    return;
  }

  await notifyAdminsOfNewLead(lead.id, lead.name);
}

/**
 * POST /webhook — Meta Lead Ads webhook. Not behind requireAuth. Verifies the
 * X-Hub-Signature-256 header only when a real app secret is configured (so
 * local testing without real Meta credentials still works). Each leadgen
 * event is processed independently so one bad entry doesn't drop the rest.
 * Always responds 200 quickly, except for a failed signature check (403).
 */
export async function receiveWebhook(req: Request, res: Response) {
  if (env.meta.appSecret) {
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const valid = await verifyWebhookSignature(req.rawBody ?? JSON.stringify(req.body ?? {}), signature);
    if (!valid) {
      res.sendStatus(403);
      return;
    }
  }

  const entries: unknown[] = req.body?.entry ?? [];
  for (const entry of entries) {
    const changes: unknown[] = (entry as { changes?: unknown[] })?.changes ?? [];
    for (const change of changes) {
      const leadgenId: string | undefined = (change as { value?: { leadgen_id?: string } })?.value?.leadgen_id;
      if (!leadgenId) continue;

      try {
        await processLeadgenEvent(leadgenId);
      } catch (err) {
        console.error('Failed to process Meta leadgen event', leadgenId, err);
      }
    }
  }

  res.sendStatus(200);
}

/** GET /status — admin-only. Reports whether Meta is wired up for real, for the Settings > Integrations page. */
export function getIntegrationStatus(_req: Request, res: Response) {
  res.json({
    webhookUrl: `${env.publicBackendUrl}/api/meta/webhook`,
    verifyToken: env.meta.verifyToken,
    pageAccessTokenConfigured: Boolean(env.meta.pageAccessToken),
    appSecretConfigured: Boolean(env.meta.appSecret),
  });
}
