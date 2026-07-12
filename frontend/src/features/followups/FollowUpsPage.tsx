import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/features/auth/AuthContext';
import type { FollowUp, Lead, PaginatedResponse, UserProfile } from '@/types';
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

type FollowUpStatus = FollowUp['status'];
type FollowUpStatusFilter = 'all' | FollowUpStatus;

const STATUS_OPTIONS: FollowUpStatus[] = ['pending', 'done', 'missed'];

const STATUS_LABELS: Record<FollowUpStatus, string> = {
  pending: 'Pending',
  done: 'Done',
  missed: 'Missed',
};

const STATUS_BADGE_VARIANT: Record<FollowUpStatus, 'secondary' | 'success' | 'destructive'> = {
  pending: 'secondary',
  done: 'success',
  missed: 'destructive',
};

interface FollowUpFilters {
  date: string;
  status: FollowUpStatusFilter;
}

async function fetchFollowUps(filters: FollowUpFilters): Promise<FollowUp[]> {
  const { data } = await apiClient.get<FollowUp[]>('/follow-ups', {
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

function buildFollowUpSchema(isStaffRole: boolean) {
  return z.object({
    leadId: z.string().min(1, 'Lead is required'),
    staffId: isStaffRole ? z.string().optional() : z.string().min(1, 'Staff is required'),
    reminderDate: z.string().min(1, 'Date is required'),
    reminderTime: z.string().min(1, 'Time is required'),
    notes: z.string().min(1, 'Notes are required'),
  });
}

type FollowUpFormValues = z.infer<ReturnType<typeof buildFollowUpSchema>>;

function NewFollowUpDialog({
  open,
  onOpenChange,
  staffUsers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffUsers: UserProfile[];
}) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isStaffRole = profile?.role === 'staff';
  const schema = React.useMemo(() => buildFollowUpSchema(isStaffRole), [isStaffRole]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FollowUpFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      leadId: '',
      staffId: undefined,
      reminderDate: '',
      reminderTime: '',
      notes: '',
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({ leadId: '', staffId: undefined, reminderDate: '', reminderTime: '', notes: '' });
    }
  }, [open, reset]);

  const createMutation = useMutation({
    mutationFn: async (values: FollowUpFormValues) => {
      const { data } = await apiClient.post<FollowUp>('/follow-ups', {
        leadId: values.leadId,
        staffId: isStaffRole ? undefined : values.staffId,
        reminderDate: values.reminderDate,
        reminderTime: values.reminderTime,
        notes: values.notes,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-ups'] });
      toast.success('Follow-up created');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (values: FollowUpFormValues) => createMutation.mutate(values);
  const submitting = isSubmitting || createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Follow-up</DialogTitle>
          <DialogDescription>Set a reminder to follow up with a lead.</DialogDescription>
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
              <Label htmlFor="reminderDate">Date</Label>
              <Input id="reminderDate" type="date" {...register('reminderDate')} />
              {errors.reminderDate && <p className="text-xs text-destructive">{errors.reminderDate.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reminderTime">Time</Label>
              <Input id="reminderTime" type="time" {...register('reminderTime')} />
              {errors.reminderTime && <p className="text-xs text-destructive">{errors.reminderTime.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...register('notes')} />
            {errors.notes && <p className="text-xs text-destructive">{errors.notes.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Create follow-up'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FollowUpsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const canSeeStaff = profile?.role === 'admin' || profile?.role === 'team_lead';
  const [filters, setFilters] = React.useState<FollowUpFilters>({ date: '', status: 'all' });
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const followUpsQuery = useQuery({
    queryKey: ['follow-ups', filters],
    queryFn: () => fetchFollowUps(filters),
  });

  const staffQuery = useQuery({
    queryKey: ['staff-users'],
    queryFn: fetchStaffUsers,
    enabled: canSeeStaff,
  });

  const staffUsers = staffQuery.data ?? [];

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: FollowUpStatus }) => {
      const { data } = await apiClient.patch<FollowUp>(`/follow-ups/${id}`, { status });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-ups'] });
      toast.success('Follow-up updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/follow-ups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-ups'] });
      toast.success('Follow-up deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleDelete = (followUp: FollowUp) => {
    if (window.confirm('Delete this follow-up?')) {
      deleteMutation.mutate(followUp.id);
    }
  };

  const followUps = followUpsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Follow-ups</h1>
          <p className="text-sm text-muted-foreground">Track reminders for leads that need a follow-up.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>New Follow-up</Button>
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
            onValueChange={(v) => setFilters((f) => ({ ...f, status: v as FollowUpStatusFilter }))}
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
              <TableHead>Lead</TableHead>
              <TableHead>Reminder</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {followUpsQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Loading follow-ups…
                </TableCell>
              </TableRow>
            )}
            {!followUpsQuery.isLoading && followUps.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No follow-ups found.
                </TableCell>
              </TableRow>
            )}
            {followUps.map((followUp) => (
              <TableRow key={followUp.id}>
                <TableCell>
                  <LeadNameCell leadId={followUp.lead_id} />
                </TableCell>
                <TableCell>
                  {format(
                    new Date(`${followUp.reminder_date}T${followUp.reminder_time}`),
                    'MMM d, yyyy · h:mm a',
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE_VARIANT[followUp.status]}>
                    {STATUS_LABELS[followUp.status]}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground">
                  {followUp.notes ?? '—'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {followUp.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updateStatusMutation.isPending}
                          onClick={() => updateStatusMutation.mutate({ id: followUp.id, status: 'done' })}
                        >
                          Mark done
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updateStatusMutation.isPending}
                          onClick={() => updateStatusMutation.mutate({ id: followUp.id, status: 'missed' })}
                        >
                          Mark missed
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={deleteMutation.isPending}
                      onClick={() => handleDelete(followUp)}
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

      <NewFollowUpDialog open={dialogOpen} onOpenChange={setDialogOpen} staffUsers={staffUsers} />
    </div>
  );
}
