import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

import { apiClient } from '@/lib/apiClient';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/features/auth/AuthContext';
import type {
  ActivityLog,
  CallLog,
  FollowUp,
  Lead,
  LeadPriority,
  LeadStatus,
  Meeting,
  PaginatedResponse,
  UserProfile,
} from '@/types';
import { LEAD_PRIORITIES, LEAD_STATUSES } from '@/types';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

interface LeadDocument {
  id: string;
  lead_id: string;
  uploaded_by: string;
  file_path: string;
  file_name: string;
  created_at: string;
}

function statusBadgeVariant(status: LeadStatus): NonNullable<BadgeProps['variant']> {
  switch (status) {
    case 'won':
      return 'success';
    case 'lost':
      return 'destructive';
    case 'negotiation':
    case 'proposal_sent':
      return 'warning';
    case 'new':
    case 'closed':
      return 'outline';
    default:
      return 'secondary';
  }
}

function priorityBadgeVariant(priority: LeadPriority): NonNullable<BadgeProps['variant']> {
  switch (priority) {
    case 'urgent':
      return 'destructive';
    case 'high':
      return 'warning';
    case 'medium':
      return 'secondary';
    default:
      return 'outline';
  }
}

function formatLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const canManage = profile?.role === 'admin' || profile?.role === 'team_lead';
  const isAdmin = profile?.role === 'admin';

  const leadQuery = useQuery({
    queryKey: ['lead', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Lead>(`/leads/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const [notes, setNotes] = React.useState('');
  const [assignedStaffId, setAssignedStaffId] = React.useState('none');
  const [assignedTeamLeadId, setAssignedTeamLeadId] = React.useState('none');

  React.useEffect(() => {
    if (leadQuery.data) {
      setNotes(leadQuery.data.notes ?? '');
      setAssignedStaffId(leadQuery.data.assigned_staff_id ?? 'none');
      setAssignedTeamLeadId(leadQuery.data.assigned_team_lead_id ?? 'none');
    }
  }, [leadQuery.data]);

  const staffQuery = useQuery({
    queryKey: ['users', 'staff'],
    queryFn: async () => {
      const { data } = await apiClient.get<UserProfile[]>('/users', { params: { role: 'staff' } });
      return data;
    },
    enabled: canManage,
  });

  const teamLeadsQuery = useQuery({
    queryKey: ['team-leads'],
    queryFn: async () => {
      const { data } = await apiClient.get<UserProfile[]>('/team-leads');
      return data;
    },
    enabled: isAdmin,
  });

  const patchMutation = useMutation({
    mutationFn: async (payload: Partial<Pick<Lead, 'status' | 'priority' | 'notes'>>) => {
      const { data } = await apiClient.patch<Lead>(`/leads/${id}`, payload);
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['lead', id], data);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.patch<Lead>(`/leads/${id}/assign`, {
        assignedStaffId: assignedStaffId !== 'none' ? assignedStaffId : null,
        assignedTeamLeadId: assignedTeamLeadId !== 'none' ? assignedTeamLeadId : null,
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['lead', id], data);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead reassigned');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const activityQuery = useQuery({
    queryKey: ['lead-activity', id],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<ActivityLog>>('/activity-logs', {
        params: { entityType: 'lead', entityId: id },
      });
      return data;
    },
    enabled: !!id,
  });

  const meetingsQuery = useQuery({
    queryKey: ['lead-meetings', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Meeting[]>('/meetings', { params: { leadId: id } });
      return data;
    },
    enabled: !!id,
  });

  const followUpsQuery = useQuery({
    queryKey: ['lead-follow-ups', id],
    queryFn: async () => {
      const { data } = await apiClient.get<FollowUp[]>('/follow-ups', { params: { leadId: id } });
      return data;
    },
    enabled: !!id,
  });

  const callLogsQuery = useQuery({
    queryKey: ['lead-call-logs', id],
    queryFn: async () => {
      const { data } = await apiClient.get<CallLog[]>('/call-logs', { params: { leadId: id } });
      return data;
    },
    enabled: !!id,
  });

  const documentsQuery = useQuery({
    queryKey: ['lead-documents', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_documents')
        .select('*')
        .eq('lead_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as LeadDocument[];
    },
    enabled: !!id,
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async (file: File) => {
      const path = `${id}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('lead-documents')
        .upload(path, file);
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from('lead_documents').insert({
        lead_id: id,
        uploaded_by: profile?.id,
        file_path: path,
        file_name: file.name,
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      toast.success('Document uploaded');
      queryClient.invalidateQueries({ queryKey: ['lead-documents', id] });
    },
    onError: (error: Error) => toast.error(error.message ?? 'Failed to upload document'),
  });

  async function handleViewDocument(doc: LeadDocument) {
    try {
      const { data, error } = await supabase.storage
        .from('lead-documents')
        .createSignedUrl(doc.file_path, 60);
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to open document');
    }
  }

  if (leadQuery.isLoading || !leadQuery.data) {
    return <p className="text-sm text-muted-foreground">Loading lead…</p>;
  }

  const lead = leadQuery.data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{lead.name}</h1>
            <p className="text-sm text-muted-foreground">{lead.company ?? '—'}</p>
            <div className="mt-2 space-y-0.5 text-sm text-muted-foreground">
              <p>Phone: {lead.phone ?? '—'}</p>
              <p>WhatsApp: {lead.whatsapp ?? '—'}</p>
              <p>Email: {lead.email ?? '—'}</p>
              <p>
                Location: {[lead.city, lead.country].filter(Boolean).join(', ') || '—'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant={statusBadgeVariant(lead.status)}>{formatLabel(lead.status)}</Badge>
            <Badge variant={priorityBadgeVariant(lead.priority)}>{formatLabel(lead.priority)}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={lead.status}
              onValueChange={(value) => patchMutation.mutate({ status: value as LeadStatus })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {formatLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select
              value={lead.priority}
              onValueChange={(value) => patchMutation.mutate({ priority: value as LeadPriority })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {formatLabel(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Add notes about this lead…"
          />
          <Button
            size="sm"
            disabled={patchMutation.isPending}
            onClick={() => patchMutation.mutate({ notes })}
          >
            {patchMutation.isPending ? 'Saving…' : 'Save Notes'}
          </Button>
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Reassign Lead</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-4">
            <div className="w-[220px] space-y-1.5">
              <Label>Assigned Staff</Label>
              <Select value={assignedStaffId} onValueChange={setAssignedStaffId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {staffQuery.data?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isAdmin && (
              <div className="w-[220px] space-y-1.5">
                <Label>Assigned Team Lead</Label>
                <Select value={assignedTeamLeadId} onValueChange={setAssignedTeamLeadId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {teamLeadsQuery.data?.map((tl) => (
                      <SelectItem key={tl.id} value={tl.id}>
                        {tl.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button disabled={assignMutation.isPending} onClick={() => assignMutation.mutate()}>
              {assignMutation.isPending ? 'Assigning…' : 'Assign'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4">
          <Tabs defaultValue="activity">
            <TabsList>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="meetings">Meetings</TabsTrigger>
              <TabsTrigger value="follow-ups">Follow-ups</TabsTrigger>
              <TabsTrigger value="call-logs">Call Logs</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>

            <TabsContent value="activity">
              {activityQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading activity…</p>
              ) : activityQuery.data?.data.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <ul className="space-y-3">
                  {activityQuery.data?.data.map((log) => (
                    <li key={log.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{formatLabel(log.action)}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <code className="mt-1 block whitespace-pre-wrap break-all text-xs text-muted-foreground">
                          {JSON.stringify(log.metadata)}
                        </code>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="meetings">
              <div className="mb-2">
                <Link to="/meetings" className="text-sm text-primary underline-offset-4 hover:underline">
                  Go to Meetings
                </Link>
              </div>
              {meetingsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading meetings…</p>
              ) : meetingsQuery.data?.length === 0 ? (
                <p className="text-sm text-muted-foreground">No meetings scheduled.</p>
              ) : (
                <ul className="space-y-2">
                  {meetingsQuery.data?.map((meeting) => (
                    <li key={meeting.id} className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <p className="text-sm font-medium">{meeting.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {meeting.meeting_date} at {meeting.meeting_time} ({meeting.mode})
                        </p>
                      </div>
                      <Badge variant="secondary">{formatLabel(meeting.status)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="follow-ups">
              <div className="mb-2">
                <Link to="/follow-ups" className="text-sm text-primary underline-offset-4 hover:underline">
                  Go to Follow-ups
                </Link>
              </div>
              {followUpsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading follow-ups…</p>
              ) : followUpsQuery.data?.length === 0 ? (
                <p className="text-sm text-muted-foreground">No follow-ups scheduled.</p>
              ) : (
                <ul className="space-y-2">
                  {followUpsQuery.data?.map((followUp) => (
                    <li key={followUp.id} className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <p className="text-sm font-medium">
                          {followUp.reminder_date} at {followUp.reminder_time}
                        </p>
                        {followUp.notes && (
                          <p className="text-xs text-muted-foreground">{followUp.notes}</p>
                        )}
                      </div>
                      <Badge variant="secondary">{formatLabel(followUp.status)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="call-logs">
              <div className="mb-2">
                <Link to="/call-logs" className="text-sm text-primary underline-offset-4 hover:underline">
                  Go to Call Logs
                </Link>
              </div>
              {callLogsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading call logs…</p>
              ) : callLogsQuery.data?.length === 0 ? (
                <p className="text-sm text-muted-foreground">No call logs yet.</p>
              ) : (
                <ul className="space-y-2">
                  {callLogsQuery.data?.map((call) => (
                    <li key={call.id} className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <p className="text-sm font-medium">
                          {call.call_date} at {call.call_time} ({call.duration_seconds}s)
                        </p>
                        {call.notes && <p className="text-xs text-muted-foreground">{call.notes}</p>}
                      </div>
                      <Badge variant="secondary">{formatLabel(call.status)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="documents">
              <div className="mb-3 flex items-center gap-2">
                <input
                  type="file"
                  className="text-sm"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      uploadDocumentMutation.mutate(file);
                      e.target.value = '';
                    }
                  }}
                />
                {uploadDocumentMutation.isPending && (
                  <span className="text-xs text-muted-foreground">Uploading…</span>
                )}
              </div>
              {documentsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading documents…</p>
              ) : documentsQuery.data?.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents uploaded.</p>
              ) : (
                <ul className="space-y-2">
                  {documentsQuery.data?.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between rounded-md border p-3">
                      <span className="text-sm">{doc.file_name}</span>
                      <Button variant="outline" size="sm" onClick={() => handleViewDocument(doc)}>
                        View
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
