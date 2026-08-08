import { Request, Response } from 'express';
import { env } from '../config/env';
import { supabaseAdmin } from '../config/supabaseAdmin';
import { verifyWebhookSignature, fetchLeadDetailsFromMeta, MetaLeadDetails } from '../integrations/meta.service';
import { createNotification } from '../services/notifications.service';
import { autoAssignLead } from '../services/assignment.service';
import * as metaIntegration from '../services/metaIntegration.service';
import { HttpError } from '../middleware/auth';

const META_LEAD_SOURCE_NAME = 'Meta Lead Ads';

function requireProjectId(value: unknown): string {
  if (!value || typeof value !== 'string') {
    throw new HttpError(400, 'projectId is required');
  }
  return value;
}

// ---------------------------------------------------------------------------
// OAuth connection flow
// ---------------------------------------------------------------------------

/** GET /login?projectId= — admin-only. Returns the Facebook OAuth dialog URL to redirect to. */
export function getLoginUrl(req: Request, res: Response) {
  const projectId = requireProjectId(req.query.projectId);
  res.json({ url: metaIntegration.buildLoginUrl(req.user!.id, projectId) });
}

function redirectToSettings(res: Response, params: Record<string, string>) {
  const query = new URLSearchParams({ tab: 'integrations', ...params });
  res.redirect(`${env.frontendUrl}/settings?${query.toString()}`);
}

/**
 * GET /callback — Meta redirects the admin's browser here after OAuth.
 * Not behind requireAuth (no bearer header on a browser redirect) — the
 * HMAC-signed `state` parameter authenticates the request instead.
 */
export async function oauthCallback(req: Request, res: Response) {
  // User pressed "Cancel" on the Facebook dialog.
  if (req.query.error || req.query.error_reason) {
    const cancelled = req.query.error_reason === 'user_denied';
    redirectToSettings(res, { meta_error: cancelled ? 'cancelled' : 'oauth_failed' });
    return;
  }

  const code = typeof req.query.code === 'string' ? req.query.code : undefined;
  const state = metaIntegration.verifyOAuthState(
    typeof req.query.state === 'string' ? req.query.state : undefined,
  );

  if (!code || !state) {
    redirectToSettings(res, { meta_error: 'invalid_state' });
    return;
  }

  try {
    await metaIntegration.handleOAuthCallback(code, state.userId, state.projectId);
    redirectToSettings(res, { meta: 'connected', projectId: state.projectId });
  } catch (err) {
    console.error('Meta OAuth callback failed:', err);
    redirectToSettings(res, { meta_error: 'exchange_failed', projectId: state.projectId });
  }
}

/** GET /businesses?projectId= — admin-only. */
export async function listBusinesses(req: Request, res: Response) {
  const projectId = requireProjectId(req.query.projectId);
  res.json(await metaIntegration.listBusinesses(projectId));
}

/** GET /pages?projectId= — admin-only. */
export async function listPages(req: Request, res: Response) {
  const projectId = requireProjectId(req.query.projectId);
  res.json(await metaIntegration.listPages(projectId));
}

/** GET /forms?pageId=&projectId= — admin-only. */
export async function listForms(req: Request, res: Response) {
  const pageId = typeof req.query.pageId === 'string' ? req.query.pageId : '';
  if (!pageId) throw new HttpError(400, 'pageId is required');
  const projectId = requireProjectId(req.query.projectId);
  res.json(await metaIntegration.listForms(pageId, projectId));
}

/** POST /connect — admin-only. Saves the selection and wires up the webhook. */
export async function connect(req: Request, res: Response) {
  const body = req.body ?? {};
  const projectId = requireProjectId(body.projectId);
  const result = await metaIntegration.connect(projectId, {
    businessId: body.businessId || undefined,
    businessName: body.businessName || undefined,
    pageId: body.pageId,
    pageName: body.pageName,
    forms: body.forms ?? [],
  });
  res.json(result);
}

/** POST /disconnect — admin-only. */
export async function disconnect(req: Request, res: Response) {
  const projectId = requireProjectId((req.body ?? {}).projectId);
  await metaIntegration.disconnect(projectId);
  res.json({ ok: true });
}

/** GET /status?projectId= — admin-only. Connection state for the Settings > Integrations page. */
export async function getIntegrationStatus(req: Request, res: Response) {
  const projectId = requireProjectId(req.query.projectId);
  res.json(await metaIntegration.getStatus(projectId));
}

// ---------------------------------------------------------------------------
// Ad hierarchy (import & track)
// ---------------------------------------------------------------------------

/** GET /ad-accounts?projectId= — admin-only. Live list from the Graph API. */
export async function listAdAccounts(req: Request, res: Response) {
  const projectId = requireProjectId(req.query.projectId);
  res.json(await metaIntegration.listAdAccounts(projectId));
}

/** POST /ad-accounts/save — admin-only. Persists the admin's picked ad accounts. */
export async function saveAdAccounts(req: Request, res: Response) {
  const body = req.body ?? {};
  const projectId = requireProjectId(body.projectId);
  const accounts = Array.isArray(body.accounts) ? body.accounts : [];
  res.json(await metaIntegration.saveAdAccounts(projectId, accounts));
}

/** POST /ad-accounts/:id/sync-campaigns — admin-only. */
export async function syncCampaigns(req: Request, res: Response) {
  const count = await metaIntegration.syncCampaigns(req.params.id);
  res.json({ synced: count });
}

/** POST /campaigns/:id/sync-ad-sets — admin-only. */
export async function syncAdSets(req: Request, res: Response) {
  const count = await metaIntegration.syncAdSets(req.params.id);
  res.json({ synced: count });
}

/** POST /ad-sets/:id/sync-ads — admin-only. */
export async function syncAds(req: Request, res: Response) {
  const count = await metaIntegration.syncAds(req.params.id);
  res.json({ synced: count });
}

/** POST /ad-accounts/:id/sync-pixels — admin-only. */
export async function syncPixels(req: Request, res: Response) {
  const count = await metaIntegration.syncPixels(req.params.id);
  res.json({ synced: count });
}

/** GET /ad-hierarchy?projectId= — admin-only. Read-only tree for the Ad Accounts browser. */
export async function getAdHierarchy(req: Request, res: Response) {
  const projectId = requireProjectId(req.query.projectId);
  res.json(await metaIntegration.getAdHierarchy(projectId));
}

// ---------------------------------------------------------------------------
// Webhook (called by Meta directly)
// ---------------------------------------------------------------------------

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

/** Fallback when the round-robin engine has no one to assign to — admins need to know. */
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

async function processLeadgenEvent(leadgenId: string, pageId?: string, formId?: string): Promise<void> {
  // Resolves which project this event belongs to (by form, then page) — null
  // means it belongs to no configured project, so it's ignored entirely.
  const target = await metaIntegration.resolveLeadgenEventTarget(pageId, formId);
  if (!target || !target.pageAccessToken) return;

  // Meta can redeliver the same event on retry — skip if we already recorded this leadgen_id.
  const existing = await supabaseAdmin.from('leads').select('id').ilike('notes', `%leadgen_id: ${leadgenId}%`).maybeSingle();
  if (existing.data) return;

  const details = await fetchLeadDetailsFromMeta(leadgenId, target.pageAccessToken);

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
      project_id: target.projectId,
      meta_page_id: target.pageRowId,
      meta_form_id: target.formRowId,
      meta_campaign_ref: details.campaignId ?? null,
      meta_ad_set_ref: details.adSetId ?? null,
      meta_ad_ref: details.adId ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to insert Meta lead', leadgenId, error);
    return;
  }

  await metaIntegration.touchLastSynced(target.projectId);

  // Round-robin auto-assignment (notifies the chosen staff member itself);
  // only fall back to notifying admins when nobody was available.
  const assigned = await autoAssignLead(lead.id, lead.name, lead.project_id);
  if (!assigned) {
    await notifyAdminsOfNewLead(lead.id, lead.name);
  }
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
      const value = (change as { value?: { leadgen_id?: string; page_id?: string; form_id?: string } })?.value;
      const leadgenId = value?.leadgen_id;
      if (!leadgenId) continue;

      try {
        await processLeadgenEvent(leadgenId, value?.page_id, value?.form_id);
      } catch (err) {
        console.error('Failed to process Meta leadgen event', leadgenId, err);
      }
    }
  }

  res.sendStatus(200);
}
