import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/features/auth/AuthContext';
import type { CallLog, Lead, PaginatedResponse, UserProfile } from '@/types';
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

type CallStatus = CallLog['status'];

const STATUS_OPTIONS: CallStatus[] = ['completed', 'no_answer', 'busy', 'voicemail', 'wrong_number'];

const STATUS_LABELS: Record<CallStatus, string> = {
  completed: 'Completed',
  no_answer: 'No answer',
  busy: 'Busy',
  voicemail: 'Voicemail',
  wrong_number: 'Wrong number',
};

const STATUS_BADGE_VARIANT: Record<CallStatus, 'secondary' | 'success' | 'destructive' | 'warning'> = {
  completed: 'success',
  no_answer: 'secondary',
  busy: 'warning',
  voicemail: 'secondary',
  wrong_number: 'destructive',
};

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

interface CallLogFilters {
  leadId: string;
  date: string;
}

async function fetchCallLogs(filters: CallLogFilters): Promise<CallLog[]> {
  const { data } = await apiClient.get<CallLog[]>('/call-logs', {
    params: {
      leadId: filters.leadId || undefined,
      date: filters.date || undefined,
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
  allowClear,
}: {
  value: string;
  onChange: (leadId: string) => void;
  error?: string;
  allowClear?: boolean;
}) {
  const [query, setQuery] = React.useState('');
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [selectedLabel, setSelectedLabel] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  React.useEffect(() => {
    if (!value) setSelectedLabel(null);
  }, [value]);

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
          {allowClear && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                onChange('');
                setSelectedLabel(null);
              }}
            >
              Clear
            </Button>
          )}
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

function buildCallLogSchema(isStaffRole: boolean) {
  return z.object({
    leadId: z.string().min(1, 'Lead is required'),
    staffId: isStaffRole ? z.string().optional() : z.string().min(1, 'Staff is required'),
    callDate: z.string().min(1, 'Date is required'),
    callTime: z.string().min(1, 'Time is required'),
    durationSeconds: z.coerce.number().int().min(0, 'Duration must be 0 or more'),
    status: z.enum(['completed', 'no_answer', 'busy', 'voicemail', 'wrong_number']),
    notes: z.string().optional(),
    recordingUrl: z.string().optional(),
  });
}

type CallLogFormValues = z.infer<ReturnType<typeof buildCallLogSchema>>;

function CallLogFormDialog({
  open,
  onOpenChange,
  callLog,
  staffUsers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callLog: CallLog | null;
  staffUsers: UserProfile[];
}) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isStaffRole = profile?.role === 'staff';
  const isEdit = !!callLog;
  const schema = React.useMemo(() => buildCallLogSchema(isStaffRole), [isStaffRole]);

  const defaultValues = React.useCallback(
    (): CallLogFormValues => ({
      leadId: callLog?.lead_id ?? '',
      staffId: callLog?.staff_id ?? undefined,
      callDate: callLog?.call_date ?? '',
      callTime: callLog?.call_time ?? '',
      durationSeconds: callLog?.duration_seconds ?? 0,
      status: callLog?.status ?? 'completed',
      notes: callLog?.notes ?? '',
      recordingUrl: callLog?.recording_url ?? '',
    }),
    [callLog],
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CallLogFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(),
  });

  React.useEffect(() => {
    if (open) reset(defaultValues());
  }, [open, defaultValues, reset]);

  const createMutation = useMutation({
    mutationFn: async (values: CallLogFormValues) => {
      const { data } = await apiClient.post<CallLog>('/call-logs', {
        leadId: values.leadId,
        staffId: isStaffRole ? undefined : values.staffId,
        callDate: values.callDate,
        callTime: values.callTime,
        durationSeconds: values.durationSeconds,
        status: values.status,
        notes: values.notes || undefined,
        recordingUrl: values.recordingUrl || undefined,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-logs'] });
      toast.success('Call logged');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: CallLogFormValues) => {
      const { data } = await apiClient.patch<CallLog>(`/call-logs/${callLog!.id}`, {
        leadId: values.leadId,
        staffId: isStaffRole ? undefined : values.staffId,
        callDate: values.callDate,
        callTime: values.callTime,
        durationSeconds: values.durationSeconds,
        status: values.status,
        notes: values.notes || undefined,
        recordingUrl: values.recordingUrl || undefined,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-logs'] });
      toast.success('Call log updated');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (values: CallLogFormValues) => {
    if (isEdit) updateMutation.mutate(values);
    else createMutation.mutate(values);
  };

  const submitting = isSubmitting || createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Call Log' : 'Log Call'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the details of this call.' : 'Record a call made to a lead.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Controller
            control={control}
            name="leadId"
            render={({ field }) => (
              <LeadSearchField value={field.value} onChange={field.onChange} error={errors.leadId?.message} />
            )}
          />

          {!isStaffRole && (
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="callDate">Date</Label>
              <Input id="callDate" type="date" {...register('callDate')} />
              {errors.callDate && <p className="text-xs text-destructive">{errors.callDate.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="callTime">Time</Label>
              <Input id="callTime" type="time" {...register('callTime')} />
              {errors.callTime && <p className="text-xs text-destructive">{errors.callTime.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="durationSeconds">Duration</Label>
            <Input id="durationSeconds" type="number" min={0} {...register('durationSeconds')} />
            <p className="text-xs text-muted-foreground">In seconds</p>
            {errors.durationSeconds && (
              <p className="text-xs text-destructive">{errors.durationSeconds.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...register('notes')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recordingUrl">Recording URL</Label>
            <Input id="recordingUrl" placeholder="https://…" {...register('recordingUrl')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Log call'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CallLogsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const canSeeStaff = profile?.role === 'admin' || profile?.role === 'team_lead';
  const [filters, setFilters] = React.useState<CallLogFilters>({ leadId: '', date: '' });
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingCallLog, setEditingCallLog] = React.useState<CallLog | null>(null);

  const callLogsQuery = useQuery({
    queryKey: ['call-logs', filters],
    queryFn: () => fetchCallLogs(filters),
  });

  const staffQuery = useQuery({
    queryKey: ['staff-users'],
    queryFn: fetchStaffUsers,
    enabled: canSeeStaff,
  });

  const staffUsers = staffQuery.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/call-logs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-logs'] });
      toast.success('Call log deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleAddClick = () => {
    setEditingCallLog(null);
    setDialogOpen(true);
  };

  const handleEditClick = (callLog: CallLog) => {
    setEditingCallLog(callLog);
    setDialogOpen(true);
  };

  const handleDelete = (callLog: CallLog) => {
    if (window.confirm('Delete this call log?')) {
      deleteMutation.mutate(callLog.id);
    }
  };

  const callLogs = callLogsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Call Logs</h1>
          <p className="text-sm text-muted-foreground">Track calls made to leads.</p>
        </div>
        <Button onClick={handleAddClick}>Log Call</Button>
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <div className="w-64">
          <LeadSearchField
            value={filters.leadId}
            onChange={(leadId) => setFilters((f) => ({ ...f, leadId }))}
            allowClear
          />
        </div>
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
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Date &amp; time</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Recording</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {callLogsQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Loading call logs…
                </TableCell>
              </TableRow>
            )}
            {!callLogsQuery.isLoading && callLogs.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No call logs found.
                </TableCell>
              </TableRow>
            )}
            {callLogs.map((callLog) => (
              <TableRow key={callLog.id}>
                <TableCell>
                  <LeadNameCell leadId={callLog.lead_id} />
                </TableCell>
                <TableCell>
                  {format(new Date(`${callLog.call_date}T${callLog.call_time}`), 'MMM d, yyyy · h:mm a')}
                </TableCell>
                <TableCell>{formatDuration(callLog.duration_seconds)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE_VARIANT[callLog.status]}>{STATUS_LABELS[callLog.status]}</Badge>
                </TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground">{callLog.notes ?? '—'}</TableCell>
                <TableCell>
                  {callLog.recording_url ? (
                    <a
                      href={callLog.recording_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      Listen
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEditClick(callLog)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={deleteMutation.isPending}
                      onClick={() => handleDelete(callLog)}
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

      <CallLogFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        callLog={editingCallLog}
        staffUsers={staffUsers}
      />
    </div>
  );
}
