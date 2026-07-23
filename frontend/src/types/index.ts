export type Role = 'admin' | 'team_lead' | 'staff';

export type LeadStatus =
  | 'new'
  | 'assigned'
  | 'contacted'
  | 'interested'
  | 'meeting_scheduled'
  | 'follow_up'
  | 'proposal_sent'
  | 'quotation_sent'
  | 'negotiation'
  | 'won'
  | 'lost'
  | 'duplicate'
  | 'invalid'
  | 'closed';

export type LeadPriority = 'low' | 'medium' | 'high' | 'urgent';

export const LEAD_STATUSES: LeadStatus[] = [
  'new',
  'assigned',
  'contacted',
  'interested',
  'meeting_scheduled',
  'follow_up',
  'proposal_sent',
  'quotation_sent',
  'negotiation',
  'won',
  'lost',
  'duplicate',
  'invalid',
  'closed',
];

export const LEAD_PRIORITIES: LeadPriority[] = ['low', 'medium', 'high', 'urgent'];

/** Statuses counted as "in progress" — assigned and being worked, not yet won/lost/closed. */
export const IN_PROGRESS_STATUSES: LeadStatus[] = [
  'assigned',
  'contacted',
  'interested',
  'meeting_scheduled',
  'follow_up',
  'proposal_sent',
  'quotation_sent',
  'negotiation',
];

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: Role;
  team_lead_id: string | null;
  team_id: string | null;
  is_active: boolean;
  avatar_url: string | null;
  round_robin_position: number | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  direct_staff_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  name: string;
  team_lead_id: string | null;
  project_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  team_lead: { id: string; full_name: string; email: string } | null;
  members: {
    id: string;
    full_name: string;
    email: string;
    is_active: boolean;
    round_robin_position: number | null;
  }[];
}

export interface LeadSource {
  id: string;
  name: string;
  description: string | null;
}

export interface Campaign {
  id: string;
  name: string;
  source_id: string | null;
  is_active: boolean;
}

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
  assigned_team_id: string | null;
  status: LeadStatus;
  priority: LeadPriority;
  tags: string[];
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Meeting {
  id: string;
  lead_id: string;
  staff_id: string;
  title: string;
  meeting_date: string;
  meeting_time: string;
  mode: 'online' | 'offline';
  meet_link: string | null;
  zoom_link: string | null;
  location: string | null;
  notes: string | null;
  reminder_at: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
}

export interface FollowUp {
  id: string;
  lead_id: string;
  staff_id: string;
  reminder_date: string;
  reminder_time: string;
  notes: string | null;
  status: 'pending' | 'done' | 'missed';
}

export interface CallLog {
  id: string;
  lead_id: string;
  staff_id: string;
  call_date: string;
  call_time: string;
  duration_seconds: number;
  status: 'completed' | 'no_answer' | 'busy' | 'voicemail' | 'wrong_number';
  notes: string | null;
  recording_url: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  created_by: string | null;
  assigned_to: string | null;
  status: 'pending' | 'submitted' | 'approved' | 'rejected';
  approved_by: string | null;
  due_date: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface WhatsappMessage {
  id: string;
  lead_id: string;
  direction: 'inbound' | 'outbound';
  body: string | null;
  status: string;
  created_at: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  body: string;
  variables: string[];
}

export interface ActivityLog {
  id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
