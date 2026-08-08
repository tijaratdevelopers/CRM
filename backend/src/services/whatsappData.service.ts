import { supabaseAdmin } from '../config/supabaseAdmin';
import { HttpError } from '../middleware/auth';
import { unwrap } from '../utils/db';
import { applyLeadScope } from '../utils/scope';
import { logActivity } from '../utils/activityLog';
import { createNotification } from './notifications.service';
import { autoAssignLead } from './assignment.service';
import { sendWhatsAppMessage } from '../integrations/whatsapp.service';
import { AuthUser } from '../types';

export interface WhatsappMessage {
  id: string;
  lead_id: string | null;
  direction: 'inbound' | 'outbound';
  body: string | null;
  template_id: string | null;
  status: string;
  wa_message_id: string | null;
  assigned_to: string | null;
  created_at: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  body: string;
  variables: string[];
  created_by: string | null;
  created_at: string;
}

interface ScopedLeadRow {
  id: string;
  name: string;
  whatsapp: string | null;
  assigned_staff_id: string | null;
  assigned_team_lead_id: string | null;
}

/** Fetches a lead scoped to the requesting user's role; 404s (never 403s) if out of scope. */
async function getScopedLead(user: AuthUser, leadId: string): Promise<ScopedLeadRow> {
  let query = supabaseAdmin
    .from('leads')
    .select('id, name, whatsapp, assigned_staff_id, assigned_team_lead_id')
    .eq('id', leadId);
  query = applyLeadScope(query, user);

  const { data, error } = await query.single();
  if (error || !data) {
    throw new HttpError(404, 'Lead not found');
  }
  return data as ScopedLeadRow;
}

export async function listMessagesForLead(user: AuthUser, leadId: string): Promise<WhatsappMessage[]> {
  await getScopedLead(user, leadId); // enforces access; throws 404 if the lead is out of scope

  return unwrap(
    await supabaseAdmin
      .from('whatsapp_messages')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true }),
  ) as WhatsappMessage[];
}

export async function sendMessageToLead(
  user: AuthUser,
  leadId: string,
  body: string,
): Promise<WhatsappMessage> {
  const lead = await getScopedLead(user, leadId);
  if (!lead.whatsapp) {
    throw new HttpError(400, 'This lead has no WhatsApp number on file');
  }

  const { waMessageId } = await sendWhatsAppMessage(lead.whatsapp, body);

  const message = unwrap(
    await supabaseAdmin
      .from('whatsapp_messages')
      .insert({
        lead_id: leadId,
        direction: 'outbound',
        body,
        status: 'sent',
        wa_message_id: waMessageId,
        assigned_to: user.id,
      })
      .select()
      .single(),
  ) as WhatsappMessage;

  await logActivity({
    actorId: user.id,
    entityType: 'lead',
    entityId: leadId,
    action: 'whatsapp_message_sent',
    metadata: { waMessageId },
  });

  return message;
}

export async function listTemplates(): Promise<MessageTemplate[]> {
  return unwrap(
    await supabaseAdmin.from('message_templates').select('*').order('created_at', { ascending: false }),
  ) as MessageTemplate[];
}

interface CreateTemplateInput {
  name: string;
  body: string;
  variables: string[];
}

export async function createTemplate(user: AuthUser, input: CreateTemplateInput): Promise<MessageTemplate> {
  return unwrap(
    await supabaseAdmin
      .from('message_templates')
      .insert({
        name: input.name,
        body: input.body,
        variables: input.variables ?? [],
        created_by: user.id,
      })
      .select()
      .single(),
  ) as MessageTemplate;
}

export interface ConversationSummary {
  leadId: string;
  leadName: string;
  lastMessageBody: string | null;
  lastMessageAt: string;
}

/**
 * Lists leads (scoped by role, same semantics as applyLeadScope) that have at
 * least one whatsapp_messages row, with each lead's most recent message.
 * Read receipts / unread counts are out of scope.
 */
export async function listConversations(user: AuthUser): Promise<ConversationSummary[]> {
  let leadsQuery = supabaseAdmin.from('leads').select('id, name');
  leadsQuery = applyLeadScope(leadsQuery, user);
  const scopedLeads = unwrap(await leadsQuery) as { id: string; name: string }[];

  if (scopedLeads.length === 0) return [];

  const leadIds = scopedLeads.map((l) => l.id);
  const leadNameById = new Map(scopedLeads.map((l) => [l.id, l.name]));

  const messages = unwrap(
    await supabaseAdmin
      .from('whatsapp_messages')
      .select('lead_id, body, created_at')
      .in('lead_id', leadIds)
      .order('created_at', { ascending: false }),
  ) as { lead_id: string | null; body: string | null; created_at: string }[];

  const seen = new Set<string>();
  const conversations: ConversationSummary[] = [];
  for (const msg of messages) {
    if (!msg.lead_id || seen.has(msg.lead_id)) continue;
    seen.add(msg.lead_id);
    conversations.push({
      leadId: msg.lead_id,
      leadName: leadNameById.get(msg.lead_id) ?? 'Unknown',
      lastMessageBody: msg.body,
      lastMessageAt: msg.created_at,
    });
  }

  return conversations;
}

interface InboundLeadRow {
  id: string;
  assigned_staff_id: string | null;
  project_id: string;
}

/**
 * Handles an inbound WhatsApp message from the webhook: matches (or creates)
 * a lead by `whatsapp` phone number, records the message, and notifies the
 * assigned staff member if there is one. Never throws — the webhook
 * controller always needs to respond 200 quickly regardless of what happens
 * here, so callers should still wrap this in a try/catch defensively.
 */
export async function recordInboundMessage(phone: string, body: string): Promise<void> {
  let lead = unwrap(
    await supabaseAdmin
      .from('leads')
      .select('id, assigned_staff_id, project_id')
      .eq('whatsapp', phone)
      .maybeSingle(),
  ) as InboundLeadRow | null;

  if (!lead) {
    // Unknown number — create a lead tagged with the WhatsApp source and let
    // the round-robin engine pick who works it.
    const existingSource = unwrap(
      await supabaseAdmin.from('lead_sources').select('id').eq('name', 'WhatsApp').maybeSingle(),
    ) as { id: string } | null;
    const source =
      existingSource ??
      (unwrap(
        await supabaseAdmin
          .from('lead_sources')
          .insert({ name: 'WhatsApp', description: 'Leads created from inbound WhatsApp messages' })
          .select('id')
          .single(),
      ) as { id: string });

    lead = unwrap(
      await supabaseAdmin
        .from('leads')
        .insert({
          name: phone,
          phone,
          whatsapp: phone,
          source_id: source.id,
          status: 'new',
          created_by: null,
          last_modified_by: null,
        })
        .select('id, assigned_staff_id, project_id')
        .single(),
    ) as InboundLeadRow;

    const assigned = await autoAssignLead(lead.id, phone, lead.project_id);
    if (assigned) {
      lead.assigned_staff_id = assigned.staffId;
    }
  }

  await supabaseAdmin.from('whatsapp_messages').insert({
    lead_id: lead.id,
    direction: 'inbound',
    body,
    status: 'received',
    assigned_to: lead.assigned_staff_id ?? null,
  });

  if (lead.assigned_staff_id) {
    await createNotification({
      userId: lead.assigned_staff_id,
      type: 'whatsapp_message',
      title: 'New WhatsApp message',
      body,
      payload: { leadId: lead.id },
    });
  }
}
