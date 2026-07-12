import crypto from 'crypto';
import { env } from '../config/env';

const GRAPH_API_VERSION = 'v20.0';

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
 * the Graph API. Requires a Page Access Token with the leads_retrieval
 * permission (env.meta.pageAccessToken) — without one, returns an empty
 * result so the webhook can still record a placeholder lead instead of failing.
 */
export async function fetchLeadDetailsFromMeta(leadgenId: string): Promise<MetaLeadDetails> {
  if (!env.meta.pageAccessToken) {
    console.warn(`META_PAGE_ACCESS_TOKEN is not set — recording lead ${leadgenId} without its form answers`);
    return { leadgenId, raw: {} };
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${leadgenId}?access_token=${env.meta.pageAccessToken}`;
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
    raw: data,
  };
}
