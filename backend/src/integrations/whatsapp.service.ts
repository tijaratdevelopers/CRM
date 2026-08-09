import { env } from '../config/env';
import { HttpError } from '../middleware/auth';

const GRAPH_API_VERSION = 'v20.0';

function assertConfigured(phoneNumberId: string | undefined): void {
  if (!phoneNumberId || !env.whatsapp.accessToken) {
    throw new HttpError(
      500,
      'WhatsApp is not configured yet — connect a phone number for this project in Settings > Integrations, or set WHATSAPP_PHONE_NUMBER_ID/WHATSAPP_ACCESS_TOKEN in backend/.env',
    );
  }
}

/** POSTs a payload to the WhatsApp Cloud API's /messages endpoint and returns the wamid, or throws with Meta's own error message. */
async function postToGraphMessagesEndpoint(
  payload: Record<string, unknown>,
  phoneNumberId: string,
): Promise<{ waMessageId: string }> {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.whatsapp.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
  });

  const data: any = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error?.message ?? `WhatsApp API request failed with status ${response.status}`;
    throw new HttpError(502, message);
  }

  const waMessageId = data?.messages?.[0]?.id;
  if (!waMessageId) {
    throw new HttpError(502, 'WhatsApp API returned no message id');
  }

  return { waMessageId };
}

/**
 * Sends a free-form text message. Only works within Meta's 24h customer-service
 * window. `phoneNumberId` is the project's own WhatsApp number (see
 * whatsappIntegration.service.ts) — falls back to the single global
 * WHATSAPP_PHONE_NUMBER_ID env var for setups that haven't configured
 * per-project numbers yet.
 */
export async function sendWhatsAppMessage(
  to: string,
  body: string,
  phoneNumberId?: string,
): Promise<{ waMessageId: string }> {
  const resolvedPhoneNumberId = phoneNumberId || env.whatsapp.phoneNumberId;
  assertConfigured(resolvedPhoneNumberId);
  return postToGraphMessagesEndpoint({ to, type: 'text', text: { body } }, resolvedPhoneNumberId!);
}

/** Sends a pre-approved template message — required to start a conversation outside the 24h window. */
export async function sendTemplateMessage(
  to: string,
  templateName: string,
  variables: string[],
  phoneNumberId?: string,
): Promise<{ waMessageId: string }> {
  const resolvedPhoneNumberId = phoneNumberId || env.whatsapp.phoneNumberId;
  assertConfigured(resolvedPhoneNumberId);
  return postToGraphMessagesEndpoint(
    {
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en_US' },
        components:
          variables.length > 0
            ? [{ type: 'body', parameters: variables.map((text) => ({ type: 'text', text })) }]
            : undefined,
      },
    },
    resolvedPhoneNumberId!,
  );
}
