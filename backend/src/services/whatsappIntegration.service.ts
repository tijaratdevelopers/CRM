import { supabaseAdmin } from '../config/supabaseAdmin';
import { HttpError } from '../middleware/auth';

export interface WhatsappIntegrationRow {
  id: string;
  project_id: string;
  phone_number_id: string;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function getForProject(projectId: string): Promise<WhatsappIntegrationRow | null> {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_integrations')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();
  if (error) throw new HttpError(500, error.message);
  return (data as WhatsappIntegrationRow) ?? null;
}

export async function connectProject(
  projectId: string,
  phoneNumberId: string,
  displayName?: string,
): Promise<WhatsappIntegrationRow> {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_integrations')
    .upsert(
      { project_id: projectId, phone_number_id: phoneNumberId, display_name: displayName ?? null, is_active: true },
      { onConflict: 'project_id' },
    )
    .select()
    .single();
  if (error) {
    // Unique violation on phone_number_id — another project already claimed this number.
    if (error.code === '23505') {
      throw new HttpError(409, 'This WhatsApp phone number is already connected to a different project');
    }
    throw new HttpError(500, error.message);
  }
  return data as WhatsappIntegrationRow;
}

export async function disconnectProject(projectId: string): Promise<void> {
  const { error } = await supabaseAdmin.from('whatsapp_integrations').delete().eq('project_id', projectId);
  if (error) throw new HttpError(500, error.message);
}

/** Used by the inbound webhook to route a message to the right project via the Cloud API's metadata.phone_number_id. */
export async function resolveProjectIdByPhoneNumberId(phoneNumberId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('whatsapp_integrations')
    .select('project_id')
    .eq('phone_number_id', phoneNumberId)
    .eq('is_active', true)
    .maybeSingle();
  return data?.project_id ?? null;
}

/** Used when sending an outbound message — falls back to null (caller falls back to the global env var) if this project hasn't configured its own number. */
export async function getPhoneNumberIdForProject(projectId: string | null | undefined): Promise<string | null> {
  if (!projectId) return null;
  const { data } = await supabaseAdmin
    .from('whatsapp_integrations')
    .select('phone_number_id')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .maybeSingle();
  return data?.phone_number_id ?? null;
}
