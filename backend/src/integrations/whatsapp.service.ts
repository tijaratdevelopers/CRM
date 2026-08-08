import { env } from '../config/env';
import { HttpError } from '../middleware/auth';

const GRAPH_API_VERSION = 'v20.0';

function assertConfigured(): void {
  if (!env.whatsapp.phoneNumberId || !env.whatsapp.accessToken) {
    throw new HttpError(
      500,
      'WhatsApp is not configured yet — set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN in backend/.env',
    );
  }
}

/** POSTs a payload to the WhatsApp Cloud API's /messages endpoint and returns the wamid, or throws with Meta's own error message. */
async function postToGraphMessagesEndpoint(payload: Record<string, unknown>): Promise<{ waMessageId: string }> {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${env.whatsapp.phoneNumberId}/messages`;

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

/** Sends a free-form text message. Only works within Meta's 24h customer-service window. */
export async function sendWhatsAppMessage(to: string, body: string): Promise<{ waMessageId: string }> {
  assertConfigured();
  return postToGraphMessagesEndpoint({
    to,
    type: 'text',
    text: { body },
  });
}

/** Sends a pre-approved template message — required to start a conversation outside the 24h window. */
export async function sendTemplateMessage(
  to: string,
  templateName: string,
  variables: string[],
): Promise<{ waMessageId: string }> {
  assertConfigured();
  return postToGraphMessagesEndpoint({
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
  });
}
