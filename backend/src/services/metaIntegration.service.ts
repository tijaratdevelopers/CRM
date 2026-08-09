import crypto from 'crypto';
import { env } from '../config/env';
import { supabaseAdmin } from '../config/supabaseAdmin';
import { HttpError } from '../middleware/auth';
import { encryptSecret, decryptSecret } from '../utils/crypto';
import { fetchLeadDetailsFromMeta, MetaLeadDetails } from '../integrations/meta.service';
import { createNotification } from './notifications.service';
import { autoAssignLead } from './assignment.service';

export const GRAPH_API_VERSION = 'v21.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const META_LEAD_SOURCE_NAME = 'Meta Lead Ads';

// pages_manage_metadata is required to subscribe the page to the leadgen
// webhook; ads_read/ads_management + business_management are required to list
// ad accounts/campaigns/ad sets/ads/pixels for the import-and-track hierarchy.
// pages_manage_ads is required alongside leads_retrieval to list/read a
// Page's leadgen_forms (Meta's Lead Ads docs require both together).
export const OAUTH_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
  'pages_manage_ads',
  'leads_retrieval',
  'business_management',
  'whatsapp_business_management',
  'ads_read',
  'ads_management',
].join(',');

const LONG_LIVED_TOKEN_FALLBACK_DAYS = 60;
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export interface MetaForm {
  id: string;
  name: string;
}

/** One row per project (unique index on project_id — see migration_06). */
export interface MetaIntegrationRow {
  id: string;
  project_id: string;
  user_access_token: string | null;
  page_access_token: string | null;
  token_expires_at: string | null;
  business_id: string | null;
  business_name: string | null;
  page_id: string | null;
  page_name: string | null;
  forms: MetaForm[];
  status: string;
  webhook_subscribed: boolean;
  connected_by: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ConnectionState = 'disconnected' | 'pending_setup' | 'connected' | 'expired';

// ---------------------------------------------------------------------------
// Graph API helpers
// ---------------------------------------------------------------------------

function graphErrorMessage(data: any): string {
  const err = data?.error;
  if (!err) return 'Meta API request failed';
  // Friendlier messages for the cases admins actually hit.
  if (err.code === 190) return 'Your Meta session has expired. Please reconnect your Meta account.';
  if (err.code === 200 || err.code === 10) {
    return 'Missing Meta permissions. Please reconnect and approve all requested permissions.';
  }
  return err.error_user_msg || err.message || 'Meta API request failed';
}

async function graphRequest<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const url = new URL(`${GRAPH}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const response = await fetch(url.toString(), { method });
  const data: any = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error(`Meta Graph API ${method} ${path} failed:`, data?.error ?? data);
    throw new HttpError(response.status === 401 ? 401 : 400, graphErrorMessage(data));
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// OAuth state (CSRF protection) — HMAC-signed, no server-side session needed.
// Now also carries the project this connection is for.
// ---------------------------------------------------------------------------

function signState(payload: string): string {
  return crypto.createHmac('sha256', env.meta.appSecret).update(payload).digest('hex');
}

export function createOAuthState(userId: string, projectId: string): string {
  const payload = `${userId}.${projectId}.${Date.now() + OAUTH_STATE_TTL_MS}`;
  return `${payload}.${signState(payload)}`;
}

export interface OAuthStatePayload {
  userId: string;
  projectId: string;
}

/** Returns the connecting user/project, or null if the state is invalid/expired. */
export function verifyOAuthState(state: string | undefined): OAuthStatePayload | null {
  if (!state) return null;
  const parts = state.split('.');
  if (parts.length !== 4) return null;

  const [userId, projectId, expiresAt, signature] = parts;
  const payload = `${userId}.${projectId}.${expiresAt}`;
  const expected = signState(payload);

  const provided = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (provided.length !== expectedBuf.length || !crypto.timingSafeEqual(provided, expectedBuf)) {
    return null;
  }
  if (Date.now() > Number(expiresAt)) return null;
  return { userId, projectId };
}

// ---------------------------------------------------------------------------
// Integration row access (per project)
// ---------------------------------------------------------------------------

let defaultProjectIdCache: string | null = null;

/** Fallback project for callers that don't specify one (legacy single-tenant setups, old frontend builds). */
export async function resolveDefaultProjectId(): Promise<string> {
  if (defaultProjectIdCache) return defaultProjectIdCache;
  const { data } = await supabaseAdmin.from('projects').select('id').eq('name', 'Default Project').maybeSingle();
  if (!data) throw new HttpError(500, 'Default Project is missing — run supabase migrations');
  defaultProjectIdCache = data.id as string;
  return defaultProjectIdCache;
}

export async function getIntegrationRow(projectId: string): Promise<MetaIntegrationRow | null> {
  const { data, error } = await supabaseAdmin
    .from('meta_integrations')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();
  if (error) throw new HttpError(500, error.message);
  return (data as MetaIntegrationRow) ?? null;
}

function isTokenExpired(row: MetaIntegrationRow): boolean {
  return Boolean(row.token_expires_at && new Date(row.token_expires_at).getTime() < Date.now());
}

export function connectionState(row: MetaIntegrationRow | null): ConnectionState {
  if (!row || !row.user_access_token) return 'disconnected';
  if (isTokenExpired(row)) return 'expired';
  if (row.status !== 'connected') return 'pending_setup';
  return 'connected';
}

async function requireUserToken(projectId: string): Promise<{ row: MetaIntegrationRow; token: string }> {
  const row = await getIntegrationRow(projectId);
  const state = connectionState(row);
  if (!row || state === 'disconnected') {
    throw new HttpError(400, 'Meta account is not connected yet for this project');
  }
  if (state === 'expired') {
    throw new HttpError(401, 'Your Meta session has expired. Please reconnect your Meta account.');
  }
  return { row, token: decryptSecret(row.user_access_token)! };
}

// ---------------------------------------------------------------------------
// OAuth flow
// ---------------------------------------------------------------------------

export function ensureAppConfigured(): void {
  if (!env.meta.appId || !env.meta.appSecret) {
    throw new HttpError(503, 'Meta integration is not configured on the server yet');
  }
}

export function buildLoginUrl(userId: string, projectId: string): string {
  ensureAppConfigured();
  const url = new URL(`https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`);
  url.searchParams.set('client_id', env.meta.appId);
  url.searchParams.set('redirect_uri', env.meta.redirectUri);
  url.searchParams.set('state', createOAuthState(userId, projectId));
  url.searchParams.set('scope', OAUTH_SCOPES);
  url.searchParams.set('response_type', 'code');
  return url.toString();
}

/** Exchanges the OAuth code for a long-lived user token and stores it (encrypted), scoped to one project. */
export async function handleOAuthCallback(code: string, userId: string, projectId: string): Promise<void> {
  ensureAppConfigured();

  const shortLived = await graphRequest<{ access_token: string }>('GET', '/oauth/access_token', {
    client_id: env.meta.appId,
    client_secret: env.meta.appSecret,
    redirect_uri: env.meta.redirectUri,
    code,
  });

  const longLived = await graphRequest<{ access_token: string; expires_in?: number }>(
    'GET',
    '/oauth/access_token',
    {
      grant_type: 'fb_exchange_token',
      client_id: env.meta.appId,
      client_secret: env.meta.appSecret,
      fb_exchange_token: shortLived.access_token,
    },
  );

  const expiresInSeconds = longLived.expires_in ?? LONG_LIVED_TOKEN_FALLBACK_DAYS * 24 * 60 * 60;
  const tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

  const values = {
    project_id: projectId,
    user_access_token: encryptSecret(longLived.access_token),
    token_expires_at: tokenExpiresAt,
    status: 'pending_setup',
    webhook_subscribed: false,
    connected_by: userId,
  };

  const existing = await getIntegrationRow(projectId);
  const result = existing
    ? await supabaseAdmin.from('meta_integrations').update(values).eq('id', existing.id)
    : await supabaseAdmin.from('meta_integrations').insert(values);
  if (result.error) throw new HttpError(500, result.error.message);
}

// ---------------------------------------------------------------------------
// Asset listing (businesses, pages, forms, ad accounts, pixels)
// ---------------------------------------------------------------------------

export async function listBusinesses(projectId: string): Promise<{ id: string; name: string }[]> {
  const { token } = await requireUserToken(projectId);
  const data = await graphRequest<{ data?: { id: string; name: string }[] }>('GET', '/me/businesses', {
    fields: 'id,name',
    limit: '200',
    access_token: token,
  });
  return data.data ?? [];
}

export async function listPages(projectId: string): Promise<{ id: string; name: string }[]> {
  const { token } = await requireUserToken(projectId);
  const data = await graphRequest<{ data?: { id: string; name: string }[] }>('GET', '/me/accounts', {
    fields: 'id,name',
    limit: '200',
    access_token: token,
  });
  return data.data ?? [];
}

async function fetchPageAccessToken(pageId: string, userToken: string): Promise<string> {
  const page = await graphRequest<{ access_token?: string }>('GET', `/${pageId}`, {
    fields: 'access_token',
    access_token: userToken,
  });
  if (!page.access_token) {
    throw new HttpError(400, 'You need admin access to this Facebook Page to connect it.');
  }
  return page.access_token;
}

export async function listForms(
  pageId: string,
  projectId: string,
): Promise<{ id: string; name: string; status?: string }[]> {
  const { token } = await requireUserToken(projectId);
  const pageToken = await fetchPageAccessToken(pageId, token);
  const data = await graphRequest<{ data?: { id: string; name: string; status?: string }[] }>(
    'GET',
    `/${pageId}/leadgen_forms`,
    { fields: 'id,name,status', limit: '200', access_token: pageToken },
  );
  return data.data ?? [];
}

export async function listAdAccounts(
  projectId: string,
): Promise<{ id: string; name: string; currency?: string; account_status?: number }[]> {
  const { token } = await requireUserToken(projectId);
  const data = await graphRequest<{
    data?: { id: string; name: string; currency?: string; account_status?: number }[];
  }>('GET', '/me/adaccounts', {
    fields: 'id,name,currency,account_status',
    limit: '200',
    access_token: token,
  });
  return data.data ?? [];
}

// ---------------------------------------------------------------------------
// Connect / disconnect (Business + Page + Forms)
// ---------------------------------------------------------------------------

export interface ConnectInput {
  businessId?: string;
  businessName?: string;
  pageId: string;
  pageName: string;
  forms: MetaForm[];
}

export interface ConnectResult {
  webhookSubscribed: boolean;
  warning?: string;
}

/**
 * Registers the app-level page webhook (callback URL + verify token) so no
 * manual Meta Developer Portal setup is needed. Meta synchronously calls our
 * GET /webhook to verify, so this fails when the backend isn't publicly
 * reachable (e.g. plain localhost) — callers treat that as a warning.
 */
async function registerAppWebhook(): Promise<void> {
  await graphRequest('POST', `/${env.meta.appId}/subscriptions`, {
    object: 'page',
    callback_url: `${env.publicBackendUrl}/api/meta/webhook`,
    fields: 'leadgen',
    verify_token: env.meta.verifyToken,
    include_values: 'true',
    access_token: `${env.meta.appId}|${env.meta.appSecret}`,
  });
}

export async function connect(projectId: string, input: ConnectInput): Promise<ConnectResult> {
  ensureAppConfigured();
  if (!input.pageId || !input.pageName) throw new HttpError(400, 'pageId and pageName are required');
  if (!Array.isArray(input.forms) || input.forms.length === 0) {
    throw new HttpError(400, 'Select at least one lead form');
  }

  const { row, token } = await requireUserToken(projectId);
  const pageToken = await fetchPageAccessToken(input.pageId, token);

  // Subscribe the page to this app's leadgen webhook. Idempotent — safe to
  // repeat on reconnect, so duplicate subscriptions are not possible.
  await graphRequest('POST', `/${input.pageId}/subscribed_apps`, {
    subscribed_fields: 'leadgen',
    access_token: pageToken,
  });

  let webhookSubscribed = true;
  let warning: string | undefined;
  try {
    await registerAppWebhook();
  } catch (err) {
    webhookSubscribed = false;
    warning =
      'Connected, but the webhook could not be verified automatically. ' +
      'Make sure the backend is reachable over HTTPS and try Reconnect.';
    console.error('Meta app webhook registration failed:', err);
  }

  const { error } = await supabaseAdmin
    .from('meta_integrations')
    .update({
      business_id: input.businessId ?? null,
      business_name: input.businessName ?? null,
      // Legacy single-page display fields — mirror the most recently
      // connected page for the old status view / back-compat.
      page_id: input.pageId,
      page_name: input.pageName,
      forms: input.forms,
      page_access_token: encryptSecret(pageToken),
      status: 'connected',
      webhook_subscribed: webhookSubscribed,
      last_synced_at: new Date().toISOString(),
    })
    .eq('id', row.id);
  if (error) throw new HttpError(500, error.message);

  // Multi-page support (Feature 2): upsert the relational meta_pages/meta_forms
  // rows too, so a project can have more than one page connected by running
  // Connect again with a different pageId — each call adds/updates one page.
  const pageRow = unwrap1(
    await supabaseAdmin
      .from('meta_pages')
      .upsert(
        {
          integration_id: row.id,
          project_id: projectId,
          page_id: input.pageId,
          name: input.pageName,
          page_access_token: encryptSecret(pageToken),
          is_active: true,
        },
        { onConflict: 'integration_id,page_id' },
      )
      .select()
      .single(),
  ) as { id: string };

  // Replace this page's form set with the newly selected one.
  await supabaseAdmin.from('meta_forms').delete().eq('page_id', pageRow.id);
  if (input.forms.length > 0) {
    await supabaseAdmin.from('meta_forms').insert(
      input.forms.map((f) => ({ page_id: pageRow.id, form_id: f.id, name: f.name, is_active: true })),
    );
  }

  return { webhookSubscribed, warning };
}

function unwrap1<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new HttpError(500, result.error.message);
  if (!result.data) throw new HttpError(500, 'Expected a row back from Supabase');
  return result.data;
}

export async function disconnect(projectId: string): Promise<void> {
  const row = await getIntegrationRow(projectId);
  if (!row) return;

  // Best-effort: unsubscribe every connected page so Meta stops sending events.
  const { data: pages } = await supabaseAdmin
    .from('meta_pages')
    .select('page_id, page_access_token')
    .eq('integration_id', row.id);

  await Promise.all(
    (pages ?? []).map(async (page) => {
      const pageToken = decryptSecret(page.page_access_token);
      if (!pageToken) return;
      try {
        await graphRequest('DELETE', `/${page.page_id}/subscribed_apps`, { access_token: pageToken });
      } catch (err) {
        console.error('Failed to unsubscribe page from leadgen webhook (continuing):', err);
      }
    }),
  );

  // meta_pages/meta_forms/meta_ad_accounts (and their campaigns/ad sets/ads/
  // pixels) cascade-delete via their FK to this row.
  const { error } = await supabaseAdmin.from('meta_integrations').delete().eq('id', row.id);
  if (error) throw new HttpError(500, error.message);
}

// ---------------------------------------------------------------------------
// Ad hierarchy sync (import & track only — no campaign creation/editing)
// ---------------------------------------------------------------------------

export interface MetaAdAccountRow {
  id: string;
  project_id: string;
  ad_account_id: string;
  name: string | null;
  currency: string | null;
  status: string | null;
}

/** Saves the admin's picked ad accounts (from listAdAccounts) so they can be synced. */
export async function saveAdAccounts(
  projectId: string,
  accounts: { id: string; name: string; currency?: string; account_status?: number }[],
): Promise<MetaAdAccountRow[]> {
  const { row } = await requireUserToken(projectId);
  if (accounts.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from('meta_ad_accounts')
    .upsert(
      accounts.map((a) => ({
        project_id: projectId,
        integration_id: row.id,
        ad_account_id: a.id,
        name: a.name,
        currency: a.currency ?? null,
        status: a.account_status != null ? String(a.account_status) : null,
      })),
      { onConflict: 'project_id,ad_account_id' },
    )
    .select();
  if (error) throw new HttpError(500, error.message);
  return (data as MetaAdAccountRow[]) ?? [];
}

async function tokenForProject(projectId: string): Promise<string> {
  const { token } = await requireUserToken(projectId);
  return token;
}

/** Pulls this ad account's campaigns from Meta and upserts them locally, backfilling any leads already tagged with a matching raw campaign id. */
export async function syncCampaigns(adAccountRowId: string): Promise<number> {
  const adAccount = unwrap1<MetaAdAccountRow>(
    await supabaseAdmin.from('meta_ad_accounts').select('*').eq('id', adAccountRowId).single(),
  );
  const token = await tokenForProject(adAccount.project_id);

  const data = await graphRequest<{ data?: { id: string; name: string; objective?: string; status?: string }[] }>(
    'GET',
    `/${adAccount.ad_account_id}/campaigns`,
    { fields: 'id,name,objective,status', limit: '200', access_token: token },
  );
  const campaigns = data.data ?? [];
  if (campaigns.length === 0) return 0;

  const { error } = await supabaseAdmin.from('meta_campaigns').upsert(
    campaigns.map((c) => ({
      ad_account_id: adAccountRowId,
      campaign_id: c.id,
      name: c.name,
      objective: c.objective ?? null,
      status: c.status ?? null,
    })),
    { onConflict: 'ad_account_id,campaign_id' },
  );
  if (error) throw new HttpError(500, error.message);

  await backfillLeadRefs('meta_campaigns', 'campaign_id', 'meta_campaign_ref', 'meta_campaign_id', adAccount.project_id);
  return campaigns.length;
}

export async function syncAdSets(campaignRowId: string): Promise<number> {
  const campaign = unwrap1<{ id: string; campaign_id: string; ad_account_id: string }>(
    await supabaseAdmin.from('meta_campaigns').select('id, campaign_id, ad_account_id').eq('id', campaignRowId).single(),
  );
  const adAccount = unwrap1<MetaAdAccountRow>(
    await supabaseAdmin.from('meta_ad_accounts').select('*').eq('id', campaign.ad_account_id).single(),
  );
  const token = await tokenForProject(adAccount.project_id);

  const data = await graphRequest<{ data?: { id: string; name: string; status?: string }[] }>(
    'GET',
    `/${campaign.campaign_id}/adsets`,
    { fields: 'id,name,status', limit: '200', access_token: token },
  );
  const adSets = data.data ?? [];
  if (adSets.length === 0) return 0;

  const { error } = await supabaseAdmin.from('meta_ad_sets').upsert(
    adSets.map((s) => ({ campaign_id: campaignRowId, ad_set_id: s.id, name: s.name, status: s.status ?? null })),
    { onConflict: 'campaign_id,ad_set_id' },
  );
  if (error) throw new HttpError(500, error.message);

  await backfillLeadRefs('meta_ad_sets', 'ad_set_id', 'meta_ad_set_ref', 'meta_ad_set_id', adAccount.project_id);
  return adSets.length;
}

export async function syncAds(adSetRowId: string): Promise<number> {
  const adSet = unwrap1<{ id: string; ad_set_id: string; campaign_id: string }>(
    await supabaseAdmin.from('meta_ad_sets').select('id, ad_set_id, campaign_id').eq('id', adSetRowId).single(),
  );
  const campaign = unwrap1<{ ad_account_id: string }>(
    await supabaseAdmin.from('meta_campaigns').select('ad_account_id').eq('id', adSet.campaign_id).single(),
  );
  const adAccount = unwrap1<MetaAdAccountRow>(
    await supabaseAdmin.from('meta_ad_accounts').select('*').eq('id', campaign.ad_account_id).single(),
  );
  const token = await tokenForProject(adAccount.project_id);

  const data = await graphRequest<{ data?: { id: string; name: string; status?: string }[] }>(
    'GET',
    `/${adSet.ad_set_id}/ads`,
    { fields: 'id,name,status', limit: '200', access_token: token },
  );
  const ads = data.data ?? [];
  if (ads.length === 0) return 0;

  const { error } = await supabaseAdmin.from('meta_ads').upsert(
    ads.map((a) => ({ ad_set_id: adSetRowId, ad_id: a.id, name: a.name, status: a.status ?? null })),
    { onConflict: 'ad_set_id,ad_id' },
  );
  if (error) throw new HttpError(500, error.message);

  await backfillLeadRefs('meta_ads', 'ad_id', 'meta_ad_ref', 'meta_ad_id', adAccount.project_id);
  return ads.length;
}

export async function syncPixels(adAccountRowId: string): Promise<number> {
  const adAccount = unwrap1<MetaAdAccountRow>(
    await supabaseAdmin.from('meta_ad_accounts').select('*').eq('id', adAccountRowId).single(),
  );
  const token = await tokenForProject(adAccount.project_id);

  const data = await graphRequest<{ data?: { id: string; name: string }[] }>(
    'GET',
    `/${adAccount.ad_account_id}/adspixels`,
    { fields: 'id,name', limit: '200', access_token: token },
  );
  const pixels = data.data ?? [];
  if (pixels.length === 0) return 0;

  const { error } = await supabaseAdmin.from('meta_pixels').upsert(
    pixels.map((p) => ({ ad_account_id: adAccountRowId, pixel_id: p.id, name: p.name })),
    { onConflict: 'ad_account_id,pixel_id' },
  );
  if (error) throw new HttpError(500, error.message);
  return pixels.length;
}

/**
 * Links leads that were auto-imported from the webhook (raw text id only,
 * captured before this hierarchy level existed locally) to the newly synced
 * row, once it exists. See migration_06's leads.meta_*_ref columns.
 */
async function backfillLeadRefs(
  table: 'meta_campaigns' | 'meta_ad_sets' | 'meta_ads',
  idColumn: 'campaign_id' | 'ad_set_id' | 'ad_id',
  refColumn: 'meta_campaign_ref' | 'meta_ad_set_ref' | 'meta_ad_ref',
  fkColumn: 'meta_campaign_id' | 'meta_ad_set_id' | 'meta_ad_id',
  projectId: string,
): Promise<void> {
  const { data: rows } = await supabaseAdmin.from(table).select(`id, ${idColumn}`);
  for (const row of (rows as any[]) ?? []) {
    await supabaseAdmin
      .from('leads')
      .update({ [fkColumn]: row.id })
      .eq('project_id', projectId)
      .eq(refColumn, row[idColumn])
      .is(fkColumn, null);
  }
}

export interface AdHierarchyNode {
  id: string;
  externalId: string;
  name: string | null;
  status: string | null;
  children?: AdHierarchyNode[];
}

/** Read-only tree for the frontend's Ad Accounts -> Campaigns -> Ad Sets -> Ads browser. */
export async function getAdHierarchy(projectId: string): Promise<{
  adAccounts: (AdHierarchyNode & { currency: string | null; pixels: AdHierarchyNode[] })[];
}> {
  const adAccounts = unwrap1<MetaAdAccountRow[]>(
    await supabaseAdmin.from('meta_ad_accounts').select('*').eq('project_id', projectId).order('created_at'),
  );
  if (adAccounts.length === 0) return { adAccounts: [] };

  const adAccountIds = adAccounts.map((a) => a.id);
  const campaigns = unwrap1<any[]>(
    await supabaseAdmin.from('meta_campaigns').select('*').in('ad_account_id', adAccountIds).order('created_at'),
  );
  const campaignIds = campaigns.map((c) => c.id);
  const adSets = campaignIds.length
    ? unwrap1<any[]>(
        await supabaseAdmin.from('meta_ad_sets').select('*').in('campaign_id', campaignIds).order('created_at'),
      )
    : [];
  const adSetIds = adSets.map((s) => s.id);
  const ads = adSetIds.length
    ? unwrap1<any[]>(await supabaseAdmin.from('meta_ads').select('*').in('ad_set_id', adSetIds).order('created_at'))
    : [];
  const pixels = unwrap1<any[]>(
    await supabaseAdmin.from('meta_pixels').select('*').in('ad_account_id', adAccountIds).order('created_at'),
  );

  return {
    adAccounts: adAccounts.map((account) => ({
      id: account.id,
      externalId: account.ad_account_id,
      name: account.name,
      status: account.status,
      currency: account.currency,
      pixels: pixels
        .filter((p) => p.ad_account_id === account.id)
        .map((p) => ({ id: p.id, externalId: p.pixel_id, name: p.name, status: null })),
      children: campaigns
        .filter((c) => c.ad_account_id === account.id)
        .map((campaign) => ({
          id: campaign.id,
          externalId: campaign.campaign_id,
          name: campaign.name,
          status: campaign.status,
          children: adSets
            .filter((s) => s.campaign_id === campaign.id)
            .map((adSet) => ({
              id: adSet.id,
              externalId: adSet.ad_set_id,
              name: adSet.name,
              status: adSet.status,
              children: ads
                .filter((a) => a.ad_set_id === adSet.id)
                .map((ad) => ({ id: ad.id, externalId: ad.ad_id, name: ad.name, status: ad.status })),
            })),
        })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Webhook-side helpers
// ---------------------------------------------------------------------------

export interface LeadgenEventTarget {
  projectId: string;
  pageRowId: string | null;
  formRowId: string | null;
  pageAccessToken: string | null;
}

/**
 * Resolves which project an incoming leadgen webhook event belongs to, so
 * projects never mix leads (Feature 2/3). Matches by form first (most
 * specific), then page. If no project has connected any page yet (fresh /
 * legacy single-tenant install), falls back to the Default Project using the
 * env-configured page token — preserves pre-multi-project behavior.
 */
export async function resolveLeadgenEventTarget(pageId?: string, formId?: string): Promise<LeadgenEventTarget | null> {
  if (formId) {
    const { data: formData } = await supabaseAdmin
      .from('meta_forms')
      .select('id, page_id, is_active, meta_pages!inner(id, project_id, page_access_token, is_active)')
      .eq('form_id', formId)
      .maybeSingle();
    const form = formData as any;
    if (form && form.meta_pages?.is_active && form.is_active) {
      const page = form.meta_pages;
      return {
        projectId: page.project_id,
        pageRowId: page.id,
        formRowId: form.id,
        pageAccessToken: decryptSecret(page.page_access_token),
      };
    }
  }

  if (pageId) {
    const { data: page } = await supabaseAdmin
      .from('meta_pages')
      .select('id, project_id, page_access_token, is_active')
      .eq('page_id', pageId)
      .maybeSingle();
    if (page && page.is_active) {
      return {
        projectId: page.project_id,
        pageRowId: page.id,
        formRowId: null,
        pageAccessToken: decryptSecret(page.page_access_token),
      };
    }
  }

  const { count } = await supabaseAdmin.from('meta_pages').select('id', { count: 'exact', head: true });
  if (count && count > 0) {
    // At least one project has completed real setup — an unrecognized
    // page/form belongs to nobody here, don't guess which project gets it.
    return null;
  }

  // Nothing configured anywhere yet — legacy env-based single-tenant mode.
  return {
    projectId: await resolveDefaultProjectId(),
    pageRowId: null,
    formRowId: null,
    pageAccessToken: env.meta.pageAccessToken || null,
  };
}

export async function touchLastSynced(projectId: string): Promise<void> {
  const row = await getIntegrationRow(projectId);
  if (!row) return;
  await supabaseAdmin.from('meta_integrations').update({ last_synced_at: new Date().toISOString() }).eq('id', row.id);
}

// ---------------------------------------------------------------------------
// Lead ingestion — shared by the webhook handler and the polling fallback
// below (Meta occasionally accepts a lead but never calls our webhook; see
// the Developer settings panel in Settings > Integrations for the checks
// that ruled out a config problem on our side).
// ---------------------------------------------------------------------------

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

/** Returns true if a new lead row was created (false if already recorded or ignored). */
export async function processLeadgenEvent(leadgenId: string, pageId?: string, formId?: string): Promise<boolean> {
  // Resolves which project this event belongs to (by form, then page) — null
  // means it belongs to no configured project, so it's ignored entirely.
  const target = await resolveLeadgenEventTarget(pageId, formId);
  if (!target || !target.pageAccessToken) return false;

  // Meta can redeliver the same event on retry (and the poller re-checks
  // recent leads every run) — skip if we already recorded this leadgen_id.
  const existing = await supabaseAdmin.from('leads').select('id').ilike('notes', `%leadgen_id: ${leadgenId}%`).maybeSingle();
  if (existing.data) return false;

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
    return false;
  }

  await touchLastSynced(target.projectId);

  // Round-robin auto-assignment (notifies the chosen staff member itself);
  // only fall back to notifying admins when nobody was available.
  const assigned = await autoAssignLead(lead.id, lead.name, lead.project_id);
  if (!assigned) {
    await notifyAdminsOfNewLead(lead.id, lead.name);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Polling fallback — Vercel's free-tier cron only runs once a day, which
// isn't often enough on its own, so this also gets a fire-and-forget nudge
// from maybePollForNewLeads() on ordinary authenticated traffic (see
// notifications.controller.ts) so leads still show up promptly whenever
// someone has the CRM open, without needing a paid Vercel plan.
// ---------------------------------------------------------------------------

interface PollableForm {
  formId: string;
  pageId: string;
  pageAccessToken: string;
}

async function listActiveFormsForPolling(): Promise<PollableForm[]> {
  const { data, error } = await supabaseAdmin
    .from('meta_forms')
    .select('form_id, is_active, meta_pages!inner(page_id, page_access_token, is_active)')
    .eq('is_active', true);
  if (error) throw new HttpError(500, error.message);

  return ((data as any[]) ?? [])
    .filter((f) => f.meta_pages?.is_active && f.meta_pages?.page_access_token)
    .map((f) => ({
      formId: f.form_id as string,
      pageId: f.meta_pages.page_id as string,
      pageAccessToken: decryptSecret(f.meta_pages.page_access_token as string)!,
    }));
}

async function listRecentLeadIds(formId: string, pageAccessToken: string): Promise<string[]> {
  const data = await graphRequest<{ data?: { id: string }[] }>('GET', `/${formId}/leads`, {
    fields: 'id',
    limit: '50',
    access_token: pageAccessToken,
  });
  return (data.data ?? []).map((l) => l.id);
}

/** Checks every connected form's most recent leads and ingests any this project doesn't have yet. */
export async function pollAllFormsForNewLeads(): Promise<{ checked: number; inserted: number }> {
  const forms = await listActiveFormsForPolling();
  let checked = 0;
  let inserted = 0;

  for (const form of forms) {
    try {
      const leadIds = await listRecentLeadIds(form.formId, form.pageAccessToken);
      for (const leadgenId of leadIds) {
        checked += 1;
        const created = await processLeadgenEvent(leadgenId, form.pageId, form.formId);
        if (created) inserted += 1;
      }
    } catch (err) {
      console.error('Meta lead poll failed for form', form.formId, err);
    }
  }

  return { checked, inserted };
}

let lastPollAttemptAt = 0;
const POLL_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Fire-and-forget, self-throttled to once per POLL_INTERVAL_MS regardless of
 * how often the caller is hit — safe to call from a frequently-polled
 * endpoint like GET /api/notifications so leads sync roughly every 5 minutes
 * whenever the CRM is open, without needing Vercel's paid cron tier.
 */
export function maybePollForNewLeads(): void {
  if (!env.meta.appId || !env.meta.appSecret) return;
  const now = Date.now();
  if (now - lastPollAttemptAt < POLL_INTERVAL_MS) return;
  lastPollAttemptAt = now;
  pollAllFormsForNewLeads().catch((err) => console.error('Meta lead poll failed', err));
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * The Page-level check (below) only proves the Page opted into notifying
 * this app. Delivery also requires the app-level webhook subscription
 * (object: 'page', a separate registration from the page's own opt-in) to
 * still be active with the right callback URL — this can silently drift
 * from what registerAppWebhook() last set without breaking the page-level
 * check, so verify it independently using the app access token (never
 * exposed to the client — this runs server-side only).
 */
async function checkAppWebhookSubscription(): Promise<{
  active: boolean;
  callbackUrl?: string;
  fields?: string[];
  error?: string;
}> {
  try {
    const data = await graphRequest<{
      data?: { object: string; callback_url: string; active: boolean; fields: (string | { name: string })[] }[];
    }>('GET', `/${env.meta.appId}/subscriptions`, {
      access_token: `${env.meta.appId}|${env.meta.appSecret}`,
    });
    const pageSub = (data.data ?? []).find((s) => s.object === 'page');
    if (!pageSub) return { active: false, error: 'No "page" object subscription registered at the app level' };
    const fields = (pageSub.fields ?? []).map((f) => (typeof f === 'string' ? f : f.name));
    return { active: pageSub.active, callbackUrl: pageSub.callback_url, fields };
  } catch (err) {
    return { active: false, error: err instanceof HttpError ? err.message : 'Check failed' };
  }
}

/**
 * Asks Facebook directly (using our own stored page token, not a manually
 * pasted Graph Explorer token) whether this app is actually subscribed to
 * the page's leadgen field — ground truth for "why aren't leads arriving?"
 * without fighting Graph Explorer's own permission prompts.
 */
async function checkPageWebhookSubscription(
  row: MetaIntegrationRow,
): Promise<{ subscribed: boolean; fields: string[]; error?: string }> {
  if (!row.page_id || !row.page_access_token) {
    return { subscribed: false, fields: [], error: 'No page connected yet' };
  }
  try {
    const pageToken = decryptSecret(row.page_access_token)!;
    const data = await graphRequest<{ data?: { id: string; subscribed_fields?: string[] }[] }>(
      'GET',
      `/${row.page_id}/subscribed_apps`,
      { access_token: pageToken },
    );
    const entry = (data.data ?? []).find((app) => app.id === env.meta.appId);
    return { subscribed: Boolean(entry), fields: entry?.subscribed_fields ?? [] };
  } catch (err) {
    return { subscribed: false, fields: [], error: err instanceof HttpError ? err.message : 'Check failed' };
  }
}

export async function getStatus(projectId: string) {
  const row = await getIntegrationRow(projectId);
  const state = connectionState(row);

  const pageWebhookSubscription = row && state === 'connected' ? await checkPageWebhookSubscription(row) : null;
  const appWebhookSubscription =
    row && state === 'connected' && env.meta.appId && env.meta.appSecret
      ? await checkAppWebhookSubscription()
      : null;

  return {
    status: state,
    appConfigured: Boolean(env.meta.appId && env.meta.appSecret),
    businessName: row?.business_name ?? null,
    pageName: row?.page_name ?? null,
    forms: row?.forms ?? [],
    lastSyncedAt: row?.last_synced_at ?? null,
    tokenExpiresAt: row?.token_expires_at ?? null,
    webhookSubscribed: row?.webhook_subscribed ?? false,
    // Developer-mode details only — never shown in the normal client UI.
    developer: {
      webhookUrl: `${env.publicBackendUrl}/api/meta/webhook`,
      redirectUri: env.meta.redirectUri,
      verifyToken: env.meta.verifyToken,
      appSecretConfigured: Boolean(env.meta.appSecret),
      pageWebhookSubscription,
      appWebhookSubscription,
    },
  };
}
