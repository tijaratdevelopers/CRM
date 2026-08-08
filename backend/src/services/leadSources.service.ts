import { supabaseAdmin } from '../config/supabaseAdmin';
import { HttpError } from '../middleware/auth';
import { unwrap } from '../utils/db';

export interface LeadSource {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface CreateLeadSourceInput {
  name: string;
  description?: string;
}

interface UpdateLeadSourceInput {
  name?: string;
  description?: string;
}

export async function listLeadSources(): Promise<LeadSource[]> {
  return unwrap(
    await supabaseAdmin.from('lead_sources').select('*').order('name', { ascending: true }),
  ) as LeadSource[];
}

export async function createLeadSource(input: CreateLeadSourceInput): Promise<LeadSource> {
  return unwrap(
    await supabaseAdmin
      .from('lead_sources')
      .insert({ name: input.name, description: input.description ?? null })
      .select()
      .single(),
  ) as LeadSource;
}

export async function updateLeadSource(id: string, patch: UpdateLeadSourceInput): Promise<LeadSource> {
  const updates: Record<string, unknown> = {};
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.description !== undefined) updates.description = patch.description;

  return unwrap(
    await supabaseAdmin.from('lead_sources').update(updates).eq('id', id).select().single(),
  ) as LeadSource;
}

export async function deleteLeadSource(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from('lead_sources').delete().eq('id', id);
  if (error) throw new HttpError(400, error.message);
}
