import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/features/auth/AuthContext';
import type { Lead, Meeting, PaginatedResponse, UserProfile } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

type MeetingStatus = Meeting['status'];
type MeetingStatusFilter = 'all' | MeetingStatus;

const STATUS_OPTIONS: MeetingStatus[] = ['scheduled', 'completed', 'cancelled'];

const STATUS_LABELS: Record<MeetingStatus, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_BADGE_VARIANT: Record<MeetingStatus, 'secondary' | 'success' | 'destructive'> = {
  scheduled: 'secondary',
  completed: 'success',
  cancelled: 'destructive',
};

interface MeetingFilters {
  date: string;
  status: MeetingStatusFilter;
}

async function fetchMeetings(filters: MeetingFilters): Promise<Meeting[]> {
  const { data } = await apiClient.get<Meeting[]>('/meetings', {
    params: {
      date: filters.date || undefined,
      status: filters.status === 'all' ? undefined : filters.status,
    },
  });
  return data;
}

async function fetchStaffUsers(): Promise<UserProfile[]> {
  const { data } = await apiClient.get<UserProfile[]>('/users', { params: { role: 'staff' } });
  return data;
}

function LeadNameCell({ leadId }: { leadId: string }) {
  const leadQuery = useQuery({
    queryKey: ['lead-name', leadId],
    queryFn: async () => {
      const { data } = await apiClient.get<Lead>(`/leads/${leadId}`);
      return data;
    },
    staleTime: 5 * 60_000,
  });

  if (leadQuery.isLoading) return <span className="text-muted-foreground">Loading…</span>;
  if (leadQuery.isError || !leadQuery.data) {
    return <span className="text-muted-foreground">{leadId.slice(0, 8)}…</span>;
  }
  return <span>{leadQuery.data.name}</span>;
}

function LeadSearchField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (leadId: string) => void;
  error?: string;
}) {
  const [query, setQuery] = React.useState('');
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [selectedLabel, setSelectedLabel] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const selectedLeadQuery = useQuery({
    queryKey: ['lead-name', value],
    queryFn: async () => {
      const { data } = await apiClient.get<Lead>(`/leads/${value}`);
      return data;
    },
    enabled: !!value && !selectedLabel,
  });

  React.useEffect(() => {
    if (selectedLeadQuery.data) setSelectedLabel(selectedLeadQuery.data.name);
  }, [selectedLeadQuery.data]);

  const searchQuery = useQuery({
    queryKey: ['leads-search', debouncedQuery],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Lead>>('/leads', {
        params: { pageSize: 50, search: debouncedQuery || undefined },
      });
      return data.data;
    },
    enabled: open,
  });

  return (
    <div className="relative space-y-1.5">
      <Label>Lead</Label>
      {selectedLabel && !open ? (
        <div className="flex items-center gap-2">
          <div className="flex h-9 flex-1 items-center rounded-md border border-input bg-background px-3 text-sm">
            {selectedLabel}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setOpen(true);
              setQuery('');
            }}
          >
            Change
          </Button>
        </div>
      ) : (
        <Input
          placeholder="Search leads by name…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
      )}
      {open && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-background shadow-md">
          {searchQuery.isLoading && (
            <div className="px-3 py-2 text-sm text-muted-foreground">Searching…</div>
          )}
          {!searchQuery.isLoading && (searchQuery.data ?? []).length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">No leads found.</div>
          )}
          {(searchQuery.data ?? []).map((lead) => (
            <button
              key={lead.id}
              type="button"
              className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                onChange(lead.id);
                setSelectedLabel(lead.name);
                setOpen(false);
              }}
            >
              <span className="font-medium">{lead.name}</span>
              {lead.company && <span className="text-xs text-muted-foreground">{lead.company}</span>}
            </button>
          ))}
          <div className="border-t px-3 py-1.5 text-right">
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function buildMeetingSchema(isStaffRole: boolean) {
  return z.object({
    leadId: z.string().min(1, 'Lead is required'),
    staffId: isStaffRole ? z.string().optional() : z.string().min(1, 'Staff is required'),
    title: z.string().min(1, 'Title is required'),
    meetingDate: z.string().min(1, 'Date is required'),
    meetingTime: z.string().min(1, 'Time is required'),
    mode: z.enum(['online', 'offline']),
    meetLink: z.string().optional(),
    zoomLink: z.string().optional(),
    location: z.string().optional(),
    notes: z.string().optional(),
    reminderAt: z.string().optional(),
  });
}

type MeetingFormValues = z.infer<ReturnType<typeof buildMeetingSchema>>;

function NewMeetingDialog({
  open,
  onOpenChange,
  staffUsers,
  meeting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffUsers: UserProfile[];
  meeting?: Meeting | null;
}) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isStaffRole = profile?.role === 'staff';
  const isEdit = !!meeting;
  const schema = React.useMemo(() => buildMeetingSchema(isStaffRole), [isStaffRole]);

  const defaultValues = React.useCallback(
    (): MeetingFormValues => ({
      leadId: meeting?.lead_id ?? '',
      staffId: meeting?.staff_id ?? undefined,
      title: meeting?.title ?? '',
      meetingDate: meeting?.meeting_date ?? '',
      meetingTime: meeting?.meeting_time ?? '',
      mode: meeting?.mode ?? 'online',
      meetLink: meeting?.meet_link ?? '',
      zoomLink: meeting?.zoom_link ?? '',
      location: meeting?.location ?? '',
      notes: meeting?.notes ?? '',
      reminderAt: meeting?.reminder_at ? meeting.reminder_at.slice(0, 16) : '',
    }),
    [meeting],
  );

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MeetingFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(),
  });

  const mode = watch('mode');

  React.useEffect(() => {
    if (open) reset(defaultValues());
  }, [open, defaultValues, reset]);

  const createMutation = useMutation({
    mutationFn: async (values: MeetingFormValues) => {
      const { data } = await apiClient.post<Meeting>('/meetings', {
        leadId: values.leadId,
        staffId: isStaffRole ? undefined : values.staffId,
        title: values.title,
        meetingDate: values.meetingDate,
        meetingTime: values.meetingTime,
        mode: values.mode,
        meetLink: values.mode === 'online' ? values.meetLink || undefined : undefined,
        zoomLink: values.mode === 'online' ? values.zoomLink || undefined : undefined,
        location: values.mode === 'offline' ? values.location || undefined : undefined,
        notes: values.notes || undefined,
        reminderAt: values.reminderAt ? new Date(values.reminderAt).toISOString() : undefined,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast.success('Meeting scheduled');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: MeetingFormValues) => {
      const { data } = await apiClient.patch<Meeting>(`/meetings/${meeting!.id}`, {
        title: values.title,
        meetingDate: values.meetingDate,
        meetingTime: values.meetingTime,
        mode: values.mode,
        meetLink: values.mode === 'online' ? values.meetLink || undefined : undefined,
        zoomLink: values.mode === 'online' ? values.zoomLink || undefined : undefined,
        location: values.mode === 'offline' ? values.location || undefined : undefined,
        notes: values.notes || undefined,
        reminderAt: values.reminderAt ? new Date(values.reminderAt).toISOString() : undefined,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast.success('Meeting updated');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (values: MeetingFormValues) => {
    if (isEdit) updateMutation.mutate(values);
    else createMutation.mutate(values);
  };
  const submitting = isSubmitting || createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Meeting' : 'New Meeting'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the details of this meeting.' : 'Schedule a meeting with a lead.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {isEdit ? (
            <div className="space-y-1.5">
              <Label>Lead</Label>
              <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                <LeadNameCell leadId={meeting!.lead_id} />
              </div>
            </div>
          ) : (
            <Controller
              control={control}
              name="leadId"
              render={({ field }) => (
                <LeadSearchField value={field.value} onChange={field.onChange} error={errors.leadId?.message} />
              )}
            />
          )}

          {!isStaffRole && !isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="staffId">Staff</Label>
              <Controller
                control={control}
                name="staffId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="staffId">
                      <SelectValue placeholder="Select staff member" />
                    </SelectTrigger>
                    <SelectContent>
                      {staffUsers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.staffId && <p className="text-xs text-destructive">{errors.staffId.message}</p>}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...register('title')} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="meetingDate">Date</Label>
              <Input id="meetingDate" type="date" {...register('meetingDate')} />
              {errors.meetingDate && <p className="text-xs text-destructive">{errors.meetingDate.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meetingTime">Time</Label>
              <Input id="meetingTime" type="time" {...register('meetingTime')} />
              {errors.meetingTime && <p className="text-xs text-destructive">{errors.meetingTime.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mode">Mode</Label>
            <Controller
              control={control}
              name="mode"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="mode">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {mode === 'online' ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="meetLink">Google Meet link</Label>
                <Input id="meetLink" placeholder="https://meet.google.com/…" {...register('meetLink')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="zoomLink">Zoom link</Label>
                <Input id="zoomLink" placeholder="https://zoom.us/j/…" {...register('zoomLink')} />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <Input id="location" {...register('location')} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...register('notes')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reminderAt">Reminder</Label>
            <Input id="reminderAt" type="datetime-local" {...register('reminderAt')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Schedule meeting'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MeetingsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const canSeeStaff = profile?.role === 'admin' || profile?.role === 'team_lead';
  const [filters, setFilters] = React.useState<MeetingFilters>({ date: '', status: 'all' });
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingMeeting, setEditingMeeting] = React.useState<Meeting | null>(null);

  const meetingsQuery = useQuery({
    queryKey: ['meetings', filters],
    queryFn: () => fetchMeetings(filters),
  });

  const staffQuery = useQuery({
    queryKey: ['staff-users'],
    queryFn: fetchStaffUsers,
    enabled: canSeeStaff,
  });

  const staffUsers = staffQuery.data ?? [];
  const staffNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    staffUsers.forEach((s) => map.set(s.id, s.full_name));
    return map;
  }, [staffUsers]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: MeetingStatus }) => {
      const { data } = await apiClient.patch<Meeting>(`/meetings/${id}`, { status });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast.success('Meeting updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/meetings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast.success('Meeting deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleDelete = (meeting: Meeting) => {
    if (window.confirm(`Delete meeting "${meeting.title}"?`)) {
      deleteMutation.mutate(meeting.id);
    }
  };

  const handleAddClick = () => {
    setEditingMeeting(null);
    setDialogOpen(true);
  };

  const handleEditClick = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    setDialogOpen(true);
  };

  const meetings = meetingsQuery.data ?? [];
  const colCount = canSeeStaff ? 7 : 6;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Meetings</h1>
          <p className="text-sm text-muted-foreground">Schedule and track meetings with leads.</p>
        </div>
        <Button onClick={handleAddClick}>New Meeting</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="date-filter">Date</Label>
          <Input
            id="date-filter"
            type="date"
            className="w-44"
            value={filters.date}
            onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="status-filter">Status</Label>
          <Select
            value={filters.status}
            onValueChange={(v) => setFilters((f) => ({ ...f, status: v as MeetingStatusFilter }))}
          >
            <SelectTrigger id="status-filter" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Lead</TableHead>
              <TableHead>Date &amp; time</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Status</TableHead>
              {canSeeStaff && <TableHead>Staff</TableHead>}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {meetingsQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center text-muted-foreground">
                  Loading meetings…
                </TableCell>
              </TableRow>
            )}
            {!meetingsQuery.isLoading && meetings.length === 0 && (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center text-muted-foreground">
                  No meetings found.
                </TableCell>
              </TableRow>
            )}
            {meetings.map((meeting) => (
              <TableRow key={meeting.id}>
                <TableCell className="font-medium">{meeting.title}</TableCell>
                <TableCell>
                  <LeadNameCell leadId={meeting.lead_id} />
                </TableCell>
                <TableCell>
                  {format(new Date(`${meeting.meeting_date}T${meeting.meeting_time}`), 'MMM d, yyyy · h:mm a')}
                </TableCell>
                <TableCell>
                  <Badge variant={meeting.mode === 'online' ? 'default' : 'secondary'}>
                    {meeting.mode === 'online' ? 'Online' : 'Offline'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE_VARIANT[meeting.status]}>{STATUS_LABELS[meeting.status]}</Badge>
                </TableCell>
                {canSeeStaff && (
                  <TableCell>{staffNameById.get(meeting.staff_id) ?? meeting.staff_id.slice(0, 8)}</TableCell>
                )}
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {meeting.status === 'scheduled' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updateStatusMutation.isPending}
                          onClick={() => updateStatusMutation.mutate({ id: meeting.id, status: 'completed' })}
                        >
                          Mark completed
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updateStatusMutation.isPending}
                          onClick={() => updateStatusMutation.mutate({ id: meeting.id, status: 'cancelled' })}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleEditClick(meeting)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={deleteMutation.isPending}
                      onClick={() => handleDelete(meeting)}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <NewMeetingDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingMeeting(null);
        }}
        staffUsers={staffUsers}
        meeting={editingMeeting}
      />
    </div>
  );
}
