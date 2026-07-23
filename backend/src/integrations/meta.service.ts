import crypto from 'crypto';
import { env } from '../config/env';

// Kept in sync with metaIntegration.service.ts's GRAPH_API_VERSION.
const GRAPH_API_VERSION = 'v21.0';

/**
 * Verifies the `X-Hub-Signature-256` header Meta sends on every webhook POST.
 * `payload` must be the exact raw bytes of the request body — Meta signs the
 * bytes it sent over the wire, not a re-serialized copy of the parsed JSON.
 */
export async function verifyWebhookSignature(
  payload: Buffer | string,
  signatureHeader: string | undefined,
): Promise<boolean> {
  if (!signatureHeader) return false;

  const [scheme, providedHex] = signatureHeader.split('=');
  if (scheme !== 'sha256' || !providedHex) return false;

  const expectedHex = crypto.createHmac('sha256', env.meta.appSecret).update(payload).digest('hex');

  const provided = Buffer.from(providedHex, 'hex');
  const expected = Buffer.from(expectedHex, 'hex');

  if (provided.length !== expected.length) return false;

  return crypto.timingSafeEqual(provided, expected);
}

interface MetaFieldDatum {
  name: string;
  values?: string[];
}

export interface MetaLeadDetails {
  leadgenId: string;
  fullName?: string;
  email?: string;
  phone?: string;
  company?: string;
  city?: string;
  /** Meta ad object ids for attribution (Features 2/3/12) — present when Meta includes them on the leadgen object. */
  adId?: string;
  adSetId?: string;
  campaignId?: string;
  formId?: string;
  raw: Record<string, unknown>;
}

function pickField(fieldData: MetaFieldDatum[], ...keys: string[]): string | undefined {
  for (const key of keys) {
    const match = fieldData.find((f) => f.name?.toLowerCase() === key);
    if (match?.values?.[0]) return match.values[0];
  }
  return undefined;
}

/**
 * Fetches the actual submitted answers for a Meta Lead Ads `leadgen_id` via
 * the Graph API. `accessToken` is the OAuth-stored page token (preferred) or
 * the legacy env.meta.pageAccessToken — without one, returns an empty result
 * so the webhook can still record a placeholder lead instead of failing.
 */
export async function fetchLeadDetailsFromMeta(
  leadgenId: string,
  accessToken?: string | null,
): Promise<MetaLeadDetails> {
  const token = accessToken || env.meta.pageAccessToken;
  if (!token) {
    console.warn(`No Meta page access token available — recording lead ${leadgenId} without its form answers`);
    return { leadgenId, raw: {} };
  }

  const fields = 'field_data,ad_id,adset_id,campaign_id,form_id';
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${leadgenId}?fields=${fields}&access_token=${token}`;
  const response = await fetch(url);
  const data: any = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error(`Meta Graph API error fetching lead ${leadgenId}:`, data?.error ?? data);
    return { leadgenId, raw: data ?? {} };
  }

  const fieldData: MetaFieldDatum[] = data.field_data ?? [];

  return {
    leadgenId,
    fullName: pickField(fieldData, 'full_name', 'name'),
    email: pickField(fieldData, 'email'),
    phone: pickField(fieldData, 'phone_number', 'phone'),
    company: pickField(fieldData, 'company_name', 'company'),
    city: pickField(fieldData, 'city'),
    adId: data.ad_id ?? undefined,
    adSetId: data.adset_id ?? undefined,
    campaignId: data.campaign_id ?? undefined,
    formId: data.form_id ?? undefined,
    raw: data,
  };
}
