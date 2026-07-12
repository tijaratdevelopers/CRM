import { parse } from 'csv-parse/sync';
import { supabaseAdmin } from '../config/supabaseAdmin';
import { HttpError } from '../middleware/auth';
import { unwrap } from '../utils/db';
import { logActivity } from '../utils/activityLog';
import { applyLeadScope } from '../utils/scope';
import { createNotification } from './notifications.service';
import { AuthUser, LeadPriority, LeadStatus } from '../types';

export interface Lead {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  company: string | null;
  city: string | null;
  country: string | null;
  source_id: string | null;
  campaign_id: string | null;
  assigned_staff_id: string | null;
  assigned_team_lead_id: string | null;
  status: LeadStatus;
  priority: LeadPriority;
  notes: string | null;
  created_by: string | null;
  last_modified_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListLeadsFilters {
  status?: LeadStatus;
  priority?: LeadPriority;
  sourceId?: string;
  assignedStaffId?: string;
  assignedTeamLeadId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ListLeadsResult {
  data: Lead[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateLeadInput {
  name: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  company?: string;
  city?: string;
  country?: string;
  sourceId?: string;
  campaignId?: string;
  assignedStaffId?: string;
  assignedTeamLeadId?: string;
  priority?: LeadPriority;
  notes?: string;
}

export interface UpdateLeadInput {
  name?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  company?: string;
  city?: string;
  country?: string;
  sourceId?: string;
  campaignId?: string;
  assignedStaffId?: string | null;
  assignedTeamLeadId?: string | null;
  status?: LeadStatus;
  priority?: LeadPriority;
  notes?: string;
}

export interface AssignLeadInput {
  assignedStaffId?: string | null;
  assignedTeamLeadId?: string | null;
}

const STAFF_EDITABLE_FIELDS: (keyof UpdateLeadInput)[] = ['status', 'priority', 'notes'];

/** Admin sees all leads; team_lead sees their team's leads; staff sees only their own. */
export async function listLeads(
  user: AuthUser,
  filters: ListLeadsFilters,
  page: number,
  pageSize: number,
): Promise<ListLeadsResult> {
  let query = supabaseAdmin.from('leads').select('*', { count: 'exact' });
  query = applyLeadScope(query, user);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.priority) query = query.eq('priority', filters.priority);
  if (filters.sourceId) query = query.eq('source_id', filters.sourceId);
  if (filters.assignedStaffId) query = query.eq('assigned_staff_id', filters.assignedStaffId);
  if (filters.assignedTeamLeadId) query = query.eq('assigned_team_lead_id', filters.assignedTeamLeadId);
  if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
  if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
  if (filters.search) {
    const term = filters.search.replace(/[%,()]/g, '');
    query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%,company.ilike.%${term}%`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
  if (error) {
    throw new HttpError(400, error.message);
  }

  return { data: (data ?? []) as Lead[], total: count ?? 0, page, pageSize };
}

/** Fetches a single lead, scoped to the requesting user's role. 404s (never 403s) if out of scope. */
export async function getLeadById(user: AuthUser, id: string): Promise<Lead> {
  let query = supabaseAdmin.from('leads').select('*').eq('id', id);
  query = applyLeadScope(query, user);

  const { data, error } = await query.single();
  if (error || !data) {
    throw new HttpError(404, 'Lead not found');
  }
  return data as Lead;
}

export async function createLead(user: AuthUser, input: CreateLeadInput): Promise<Lead> {
  const status: LeadStatus = input.assignedStaffId ? 'assigned' : 'new';

  const lead = unwrap(
    await supabaseAdmin
      .from('leads')
      .insert({
        name: input.name,
        phone: input.phone ?? null,
        whatsapp: input.whatsapp ?? null,
        email: input.email ?? null,
        company: input.company ?? null,
        city: input.city ?? null,
        country: input.country ?? null,
        source_id: input.sourceId ?? null,
        campaign_id: input.campaignId ?? null,
        assigned_staff_id: input.assignedStaffId ?? null,
        assigned_team_lead_id: input.assignedTeamLeadId ?? null,
        status,
        priority: input.priority ?? 'medium',
        notes: input.notes ?? null,
        created_by: user.id,
        last_modified_by: user.id,
      })
      .select()
      .single(),
  ) as Lead;

  if (input.assignedStaffId) {
    await createNotification({
      userId: input.assignedStaffId,
      type: 'lead_assigned',
      title: 'New lead assigned',
      body: lead.name,
      payload: { leadId: lead.id },
    });
  }

  return lead;
}

export async function updateLead(user: AuthUser, id: string, patch: UpdateLeadInput): Promise<Lead> {
  // Scoped fetch: 404s (not 403) if this lead is outside the user's visibility,
  // and for staff this also guarantees current.assigned_staff_id === user.id.
  const current = await getLeadById(user, id);

  if (user.role === 'staff') {
    const disallowed = Object.keys(patch).filter(
      (key) => !STAFF_EDITABLE_FIELDS.includes(key as keyof UpdateLeadInput),
    );
    if (disallowed.length > 0) {
      throw new HttpError(403, `Not authorized to update fields: ${disallowed.join(', ')}`);
    }
  }

  const updates: Record<string, unknown> = { last_modified_by: user.id };
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.phone !== undefined) updates.phone = patch.phone;
  if (patch.whatsapp !== undefined) updates.whatsapp = patch.whatsapp;
  if (patch.email !== undefined) updates.email = patch.email;
  if (patch.company !== undefined) updates.company = patch.company;
  if (patch.city !== undefined) updates.city = patch.city;
  if (patch.country !== undefined) updates.country = patch.country;
  if (patch.sourceId !== undefined) updates.source_id = patch.sourceId;
  if (patch.campaignId !== undefined) updates.campaign_id = patch.campaignId;
  if (patch.assignedStaffId !== undefined) updates.assigned_staff_id = patch.assignedStaffId;
  if (patch.assignedTeamLeadId !== undefined) updates.assigned_team_lead_id = patch.assignedTeamLeadId;
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.priority !== undefined) updates.priority = patch.priority;
  if (patch.notes !== undefined) updates.notes = patch.notes;

  const updated = unwrap(
    await supabaseAdmin.from('leads').update(updates).eq('id', id).select().single(),
  ) as Lead;

  if (
    patch.assignedStaffId !== undefined &&
    patch.assignedStaffId !== null &&
    patch.assignedStaffId !== current.assigned_staff_id
  ) {
    await createNotification({
      userId: patch.assignedStaffId,
      type: 'lead_assigned',
      title: 'New lead assigned',
      body: updated.name,
      payload: { leadId: updated.id },
    });
  }

  if (
    patch.status !== undefined &&
    patch.status !== current.status &&
    updated.assigned_team_lead_id &&
    updated.assigned_team_lead_id !== user.id
  ) {
    await createNotification({
      userId: updated.assigned_team_lead_id,
      type: 'lead_status_updated',
      title: 'Lead status updated',
      body: `${updated.name} is now ${updated.status}`,
      payload: { leadId: updated.id },
    });
  }

  return updated;
}

export async function assignLead(user: AuthUser, id: string, input: AssignLeadInput): Promise<Lead> {
  const current = await getLeadById(user, id);

  const updates: Record<string, unknown> = { last_modified_by: user.id };
  if (input.assignedStaffId !== undefined) updates.assigned_staff_id = input.assignedStaffId;
  if (input.assignedTeamLeadId !== undefined) updates.assigned_team_lead_id = input.assignedTeamLeadId;
  if (current.status === 'new') updates.status = 'assigned';

  const updated = unwrap(
    await supabaseAdmin.from('leads').update(updates).eq('id', id).select().single(),
  ) as Lead;

  if (
    input.assignedStaffId !== undefined &&
    input.assignedStaffId !== null &&
    input.assignedStaffId !== current.assigned_staff_id
  ) {
    await createNotification({
      userId: input.assignedStaffId,
      type: 'lead_assigned',
      title: 'New lead assigned',
      body: updated.name,
      payload: { leadId: updated.id },
    });
  }

  return updated;
}

interface BulkUploadRow {
  name?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  company?: string;
  city?: string;
  country?: string;
}

export async function bulkUploadLeads(user: AuthUser, fileBuffer: Buffer): Promise<{ imported: number }> {
  let records: BulkUploadRow[];
  try {
    records = parse(fileBuffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as BulkUploadRow[];
  } catch (err) {
    throw new HttpError(400, `Failed to parse CSV: ${(err as Error).message}`);
  }

  const validRows = records.filter((row) => row.name && row.name.trim().length > 0);
  if (validRows.length === 0) {
    throw new HttpError(400, 'CSV file contains no rows with a name');
  }

  const existingSource = unwrap(
    await supabaseAdmin.from('lead_sources').select('id').eq('name', 'CSV Upload').maybeSingle(),
  ) as { id: string } | null;

  const source =
    existingSource ??
    (unwrap(
      await supabaseAdmin
        .from('lead_sources')
        .insert({ name: 'CSV Upload', description: 'Leads imported via CSV bulk upload' })
        .select('id')
        .single(),
    ) as { id: string });

  const rowsToInsert = validRows.map((row) => ({
    name: row.name!.trim(),
    phone: row.phone?.trim() || null,
    whatsapp: row.whatsapp?.trim() || null,
    email: row.email?.trim() || null,
    company: row.company?.trim() || null,
    city: row.city?.trim() || null,
    country: row.country?.trim() || null,
    source_id: source.id,
    status: 'new' as LeadStatus,
    priority: 'medium' as LeadPriority,
    created_by: user.id,
    last_modified_by: user.id,
  }));

  const inserted = unwrap(
    await supabaseAdmin.from('leads').insert(rowsToInsert).select('id'),
  ) as { id: string }[];

  await logActivity({
    actorId: user.id,
    entityType: 'lead',
    entityId: inserted[0]?.id ?? '00000000-0000-0000-0000-000000000000',
    action: 'leads_bulk_imported',
    metadata: { count: inserted.length },
  });

  return { imported: inserted.length };
}
