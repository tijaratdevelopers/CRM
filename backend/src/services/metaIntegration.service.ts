import crypto from 'crypto';
import { env } from '../config/env';
import { supabaseAdmin } from '../config/supabaseAdmin';
import { HttpError } from '../middleware/auth';
import { encryptSecret, decryptSecret } from '../utils/crypto';

export const GRAPH_API_VERSION = 'v21.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// pages_manage_metadata is required to subscribe the page to the leadgen webhook.
export const OAUTH_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
  'leads_retrieval',
  'business_management',
  'whatsapp_business_management',
].join(',');

const LONG_LIVED_TOKEN_FALLBACK_DAYS = 60;
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export interface MetaForm {
  id: string;
  name: string;
}

export interface MetaIntegrationRow {
  id: string;
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
// OAuth state (CSRF protection) — HMAC-signed, no server-side session needed
// ---------------------------------------------------------------------------

function signState(payload: string): string {
  return crypto.createHmac('sha256', env.meta.appSecret).update(payload).digest('hex');
}

export function createOAuthState(userId: string): string {
  const payload = `${userId}.${Date.now() + OAUTH_STATE_TTL_MS}`;
  return `${payload}.${signState(payload)}`;
}

/** Returns the connecting user's id, or null if the state is invalid/expired. */
export function verifyOAuthState(state: string | undefined): string | null {
  if (!state) return null;
  const parts = state.split('.');
  if (parts.length !== 3) return null;

  const [userId, expiresAt, signature] = parts;
  const payload = `${userId}.${expiresAt}`;
  const expected = signState(payload);

  const provided = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (provided.length !== expectedBuf.length || !crypto.timingSafeEqual(provided, expectedBuf)) {
    return null;
  }
  if (Date.now() > Number(expiresAt)) return null;
  return userId;
}

// ---------------------------------------------------------------------------
// Integration row access
// ---------------------------------------------------------------------------

export async function getIntegrationRow(): Promise<MetaIntegrationRow | null> {
  const { data, error } = await supabaseAdmin
    .from('meta_integrations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
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

async function requireUserToken(): Promise<{ row: MetaIntegrationRow; token: string }> {
  const row = await getIntegrationRow();
  const state = connectionState(row);
  if (!row || state === 'disconnected') {
    throw new HttpError(400, 'Meta account is not connected yet');
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

export function buildLoginUrl(userId: string): string {
  ensureAppConfigured();
  const url = new URL(`https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`);
  url.searchParams.set('client_id', env.meta.appId);
  url.searchParams.set('redirect_uri', env.meta.redirectUri);
  url.searchParams.set('state', createOAuthState(userId));
  url.searchParams.set('scope', OAUTH_SCOPES);
  url.searchParams.set('response_type', 'code');
  return url.toString();
}

/** Exchanges the OAuth code for a long-lived user token and stores it (encrypted). */
export async function handleOAuthCallback(code: string, userId: string): Promise<void> {
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
    user_access_token: encryptSecret(longLived.access_token),
    token_expires_at: tokenExpiresAt,
    status: 'pending_setup',
    webhook_subscribed: false,
    connected_by: userId,
  };

  const existing = await getIntegrationRow();
  const result = existing
    ? await supabaseAdmin.from('meta_integrations').update(values).eq('id', existing.id)
    : await supabaseAdmin.from('meta_integrations').insert(values);
  if (result.error) throw new HttpError(500, result.error.message);
}

// ---------------------------------------------------------------------------
// Asset listing (businesses, pages, forms)
// ---------------------------------------------------------------------------

export async function listBusinesses(): Promise<{ id: string; name: string }[]> {
  const { token } = await requireUserToken();
  const data = await graphRequest<{ data?: { id: string; name: string }[] }>('GET', '/me/businesses', {
    fields: 'id,name',
    limit: '200',
    access_token: token,
  });
  return data.data ?? [];
}

export async function listPages(): Promise<{ id: string; name: string }[]> {
  const { token } = await requireUserToken();
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

export async function listForms(pageId: string): Promise<{ id: string; name: string; status?: string }[]> {
  const { token } = await requireUserToken();
  const pageToken = await fetchPageAccessToken(pageId, token);
  const data = await graphRequest<{ data?: { id: string; name: string; status?: string }[] }>(
    'GET',
    `/${pageId}/leadgen_forms`,
    { fields: 'id,name,status', limit: '200', access_token: pageToken },
  );
  return data.data ?? [];
}

// ---------------------------------------------------------------------------
// Connect / disconnect
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

export async function connect(input: ConnectInput): Promise<ConnectResult> {
  ensureAppConfigured();
  if (!input.pageId || !input.pageName) throw new HttpError(400, 'pageId and pageName are required');
  if (!Array.isArray(input.forms) || input.forms.length === 0) {
    throw new HttpError(400, 'Select at least one lead form');
  }

  const { row, token } = await requireUserToken();
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

  return { webhookSubscribed, warning };
}

export async function disconnect(): Promise<void> {
  const row = await getIntegrationRow();
  if (!row) return;

  // Best-effort: unsubscribe the page so Meta stops sending events.
  const pageToken = decryptSecret(row.page_access_token);
  if (row.page_id && pageToken) {
    try {
      await graphRequest('DELETE', `/${row.page_id}/subscribed_apps`, { access_token: pageToken });
    } catch (err) {
      console.error('Failed to unsubscribe page from leadgen webhook (continuing):', err);
    }
  }

  const { error } = await supabaseAdmin.from('meta_integrations').delete().eq('id', row.id);
  if (error) throw new HttpError(500, error.message);
}

// ---------------------------------------------------------------------------
// Webhook-side helpers
// ---------------------------------------------------------------------------

/** Page token for fetching lead details — stored token first, env fallback. */
export async function getLeadFetchToken(): Promise<string | null> {
  const row = await getIntegrationRow();
  if (row && !isTokenExpired(row)) {
    const pageToken = decryptSecret(row.page_access_token);
    if (pageToken) return pageToken;
  }
  return env.meta.pageAccessToken || null;
}

/**
 * Whether an incoming leadgen event matches the connected page/forms.
 * With no integration configured, everything is accepted (legacy env-based setup).
 */
export async function shouldProcessLeadgenEvent(pageId?: string, formId?: string): Promise<boolean> {
  const row = await getIntegrationRow();
  if (!row || row.status !== 'connected') return true;
  if (row.page_id && pageId && row.page_id !== pageId) return false;
  if (row.forms.length > 0 && formId && !row.forms.some((f) => f.id === formId)) return false;
  return true;
}

export async function touchLastSynced(): Promise<void> {
  const row = await getIntegrationRow();
  if (!row) return;
  await supabaseAdmin
    .from('meta_integrations')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', row.id);
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export async function getStatus() {
  const row = await getIntegrationRow();
  const state = connectionState(row);

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
    },
  };
}
