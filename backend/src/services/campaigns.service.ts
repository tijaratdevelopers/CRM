import { supabaseAdmin } from '../config/supabaseAdmin';
import { HttpError } from '../middleware/auth';
import { unwrap } from '../utils/db';

export interface Campaign {
  id: string;
  name: string;
  source_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface CreateCampaignInput {
  name: string;
  sourceId?: string;
  isActive?: boolean;
}

interface UpdateCampaignInput {
  name?: string;
  sourceId?: string | null;
  isActive?: boolean;
}

export async function listCampaigns(): Promise<Campaign[]> {
  return unwrap(
    await supabaseAdmin.from('campaigns').select('*').order('created_at', { ascending: false }),
  ) as Campaign[];
}

export async function createCampaign(input: CreateCampaignInput): Promise<Campaign> {
  return unwrap(
    await supabaseAdmin
      .from('campaigns')
      .insert({
        name: input.name,
        source_id: input.sourceId ?? null,
        is_active: input.isActive ?? true,
      })
      .select()
      .single(),
  ) as Campaign;
}

export async function updateCampaign(id: string, patch: UpdateCampaignInput): Promise<Campaign> {
  const updates: Record<string, unknown> = {};
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.sourceId !== undefined) updates.source_id = patch.sourceId;
  if (patch.isActive !== undefined) updates.is_active = patch.isActive;

  return unwrap(
    await supabaseAdmin.from('campaigns').update(updates).eq('id', id).select().single(),
  ) as Campaign;
}

export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from('campaigns').delete().eq('id', id);
  if (error) throw new HttpError(400, error.message);
}
