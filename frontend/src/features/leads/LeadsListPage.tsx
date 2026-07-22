import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Pencil, Trash2 } from 'lucide-react';

import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/features/auth/AuthContext';
import type {
  Campaign,
  Lead,
  LeadPriority,
  LeadSource,
  LeadStatus,
  PaginatedResponse,
  UserProfile,
} from '@/types';
import { LEAD_PRIORITIES, LEAD_STATUSES } from '@/types';
import { InProgressLeads } from '@/features/dashboard/InProgressLeads';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const PAGE_SIZE = 20;

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

function formatStatusLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const addLeadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.union([z.string().email('Invalid email'), z.literal('')]).optional(),
  company: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  sourceId: z.string().optional(),
  campaignId: z.string().optional(),
  assignedStaffId: z.string().optional(),
  assignedTeamLeadId: z.string().optional(),
  priority: z.enum(LEAD_PRIORITIES as [LeadPriority, ...LeadPriority[]]),
  notes: z.string().optional(),
});

type AddLeadFormValues = z.infer<typeof addLeadSchema>;

const addLeadDefaults: AddLeadFormValues = {
  name: '',
  phone: '',
  whatsapp: '',
  email: '',
  company: '',
  city: '',
  country: '',
  sourceId: 'none',
  campaignId: 'none',
  assignedStaffId: 'none',
  assignedTeamLeadId: 'none',
  priority: 'medium',
  notes: '',
};

function EditLeadDialog({
  open,
  onOpenChange,
  lead,
  isAdmin,
  sources,
  staff,
  teamLeads,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  isAdmin: boolean;
  sources: LeadSource[];
  staff: UserProfile[];
  teamLeads: UserProfile[];
}) {
  const queryClient = useQueryClient();

  const defaultValues = React.useCallback(
    (): AddLeadFormValues => ({
      name: lead?.name ?? '',
      phone: lead?.phone ?? '',
      whatsapp: lead?.whatsapp ?? '',
      email: lead?.email ?? '',
      company: lead?.company ?? '',
      city: lead?.city ?? '',
      country: lead?.country ?? '',
      sourceId: lead?.source_id ?? 'none',
      campaignId: lead?.campaign_id ?? 'none',
      assignedStaffId: lead?.assigned_staff_id ?? 'none',
      assignedTeamLeadId: lead?.assigned_team_lead_id ?? 'none',
      priority: lead?.priority ?? 'medium',
      notes: lead?.notes ?? '',
    }),
    [lead],
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddLeadFormValues>({
    resolver: zodResolver(addLeadSchema),
    defaultValues: defaultValues(),
  });

  React.useEffect(() => {
    if (open) reset(defaultValues());
  }, [open, defaultValues, reset]);

  const updateMutation = useMutation({
    mutationFn: async (values: AddLeadFormValues) => {
      const payload = {
        name: values.name,
        phone: values.phone || undefined,
        whatsapp: values.whatsapp || undefined,
        email: values.email || undefined,
        company: values.company || undefined,
        city: values.city || undefined,
        country: values.country || undefined,
        sourceId: values.sourceId && values.sourceId !== 'none' ? values.sourceId : undefined,
        campaignId: values.campaignId && values.campaignId !== 'none' ? values.campaignId : undefined,
        assignedStaffId:
          values.assignedStaffId && values.assignedStaffId !== 'none' ? values.assignedStaffId : null,
        assignedTeamLeadId:
          values.assignedTeamLeadId && values.assignedTeamLeadId !== 'none'
            ? values.assignedTeamLeadId
            : null,
        priority: values.priority,
        notes: values.notes || undefined,
      };
      const { data } = await apiClient.patch<Lead>(`/leads/${lead!.id}`, payload);
      return data;
    },
    onSuccess: () => {
      toast.success('Lead updated');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Lead</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit((values) => updateMutation.mutate(values))}>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Name *</Label>
              <Input id="edit-name" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input id="edit-phone" {...register('phone')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-whatsapp">WhatsApp</Label>
              <Input id="edit-whatsapp" {...register('whatsapp')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" type="email" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-company">Company</Label>
              <Input id="edit-company" {...register('company')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-city">City</Label>
              <Input id="edit-city" {...register('city')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-country">Country</Label>
              <Input id="edit-country" {...register('country')} />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {formatStatusLabel(p)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Controller
                control={control}
                name="sourceId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {sources.map((source) => (
                        <SelectItem key={source.id} value={source.id}>
                          {source.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Assign to Staff</Label>
              <Controller
                control={control}
                name="assignedStaffId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {staff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            {isAdmin && (
              <div className="space-y-1.5">
                <Label>Assign to Team Lead</Label>
                <Controller
                  control={control}
                  name="assignedTeamLeadId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {teamLeads.map((tl) => (
                          <SelectItem key={tl.id} value={tl.id}>
                            {tl.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea id="edit-notes" {...register('notes')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LeadsListPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const canManage = profile?.role === 'admin' || profile?.role === 'team_lead';
  const isAdmin = profile?.role === 'admin';

  const [searchInput, setSearchInput] = React.useState(searchParams.get('search') ?? '');
  const [debouncedSearch, setDebouncedSearch] = React.useState(searchParams.get('search') ?? '');
  const [status, setStatus] = React.useState<string>('all');
  const [priority, setPriority] = React.useState<string>('all');
  const [sourceId, setSourceId] = React.useState<string>('all');
  const [assignedStaffId, setAssignedStaffId] = React.useState<string>('all');
  const [page, setPage] = React.useState(1);

  const [addOpen, setAddOpen] = React.useState(false);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [bulkFile, setBulkFile] = React.useState<File | null>(null);
  const [editingLead, setEditingLead] = React.useState<Lead | null>(null);

  React.useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const didMount = React.useRef(false);
  React.useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    setPage(1);
  }, [debouncedSearch, status, priority, sourceId, assignedStaffId]);

  const leadsQuery = useQuery({
    queryKey: [
      'leads',
      { page, status, priority, sourceId, assignedStaffId, search: debouncedSearch },
    ],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Lead>>('/leads', {
        params: {
          page,
          pageSize: PAGE_SIZE,
          status: status !== 'all' ? status : undefined,
          priority: priority !== 'all' ? priority : undefined,
          sourceId: sourceId !== 'all' ? sourceId : undefined,
          assignedStaffId: assignedStaffId !== 'all' ? assignedStaffId : undefined,
          search: debouncedSearch.trim() || undefined,
        },
      });
      return data;
    },
  });

  const sourcesQuery = useQuery({
    queryKey: ['lead-sources'],
    queryFn: async () => {
      const { data } = await apiClient.get<LeadSource[]>('/lead-sources');
      return data;
    },
  });

  const campaignsQuery = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data } = await apiClient.get<Campaign[]>('/campaigns');
      return data;
    },
    enabled: addOpen,
  });

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
    enabled: isAdmin && (addOpen || !!editingLead),
  });

  const staffMap = React.useMemo(() => {
    const map = new Map<string, string>();
    staffQuery.data?.forEach((s) => map.set(s.id, s.full_name));
    return map;
  }, [staffQuery.data]);

  const sourceMap = React.useMemo(() => {
    const map = new Map<string, string>();
    sourcesQuery.data?.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [sourcesQuery.data]);

  function resolveStaffName(id: string | null) {
    if (!id) return '—';
    if (staffMap.has(id)) return staffMap.get(id) as string;
    if (profile?.id === id) return profile.full_name;
    return '—';
  }

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddLeadFormValues>({
    resolver: zodResolver(addLeadSchema),
    defaultValues: addLeadDefaults,
  });

  const createLeadMutation = useMutation({
    mutationFn: async (values: AddLeadFormValues) => {
      const payload = {
        name: values.name,
        phone: values.phone || undefined,
        whatsapp: values.whatsapp || undefined,
        email: values.email || undefined,
        company: values.company || undefined,
        city: values.city || undefined,
        country: values.country || undefined,
        sourceId: values.sourceId && values.sourceId !== 'none' ? values.sourceId : undefined,
        campaignId: values.campaignId && values.campaignId !== 'none' ? values.campaignId : undefined,
        assignedStaffId:
          values.assignedStaffId && values.assignedStaffId !== 'none' ? values.assignedStaffId : undefined,
        assignedTeamLeadId:
          values.assignedTeamLeadId && values.assignedTeamLeadId !== 'none'
            ? values.assignedTeamLeadId
            : undefined,
        priority: values.priority,
        notes: values.notes || undefined,
      };
      const { data } = await apiClient.post<Lead>('/leads', payload);
      return data;
    },
    onSuccess: () => {
      toast.success('Lead created');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setAddOpen(false);
      reset(addLeadDefaults);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bulkUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await apiClient.post<{ imported: number }>('/leads/bulk-upload', formData);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Imported ${data.imported} lead(s)`);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setBulkOpen(false);
      setBulkFile(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/leads/${id}`);
    },
    onSuccess: () => {
      toast.success('Lead deleted');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleDelete = (lead: Lead) => {
    if (window.confirm(`Delete lead "${lead.name}"? This also removes its meetings, follow-ups and call logs.`)) {
      deleteLeadMutation.mutate(lead.id);
    }
  };

  const columnHelper = createColumnHelper<Lead>();
  const columns = React.useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('phone', {
        header: 'Phone',
        cell: (info) => info.getValue() ?? '—',
      }),
      columnHelper.accessor('email', {
        header: 'Email',
        cell: (info) => info.getValue() ?? '—',
      }),
      columnHelper.accessor('company', {
        header: 'Company',
        cell: (info) => info.getValue() ?? '—',
      }),
      columnHelper.accessor('source_id', {
        header: 'Source',
        cell: (info) => {
          const id = info.getValue();
          return id ? (sourceMap.get(id) ?? '—') : '—';
        },
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => (
          <Badge variant={statusBadgeVariant(info.getValue())}>
            {formatStatusLabel(info.getValue())}
          </Badge>
        ),
      }),
      columnHelper.accessor('priority', {
        header: 'Priority',
        cell: (info) => (
          <Badge variant={priorityBadgeVariant(info.getValue())}>
            {formatStatusLabel(info.getValue())}
          </Badge>
        ),
      }),
      columnHelper.accessor('assigned_staff_id', {
        header: 'Assigned Staff',
        cell: (info) => resolveStaffName(info.getValue()),
      }),
      columnHelper.accessor('created_at', {
        header: 'Created',
        cell: (info) => format(new Date(info.getValue()), 'MMM d, yyyy'),
      }),
      ...(canManage
        ? [
            columnHelper.display({
              id: 'actions',
              header: () => <span className="sr-only">Actions</span>,
              cell: (info) => (
                <div className="flex justify-end gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingLead(info.row.original);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {isAdmin && (
                    <Button
                      size="icon"
                      variant="destructive"
                      disabled={deleteLeadMutation.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(info.row.original);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ),
            }),
          ]
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [staffMap, sourceMap, profile, canManage, isAdmin, deleteLeadMutation.isPending],
  );

  const table = useReactTable({
    data: leadsQuery.data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const total = leadsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-foreground">Leads</h1>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBulkOpen(true)}>
              Bulk Upload
            </Button>
            <Button onClick={() => setAddOpen(true)}>Add Lead</Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4">
        <div className="min-w-[200px] flex-1 space-y-1.5">
          <Label htmlFor="lead-search">Search</Label>
          <Input
            id="lead-search"
            placeholder="Search name, phone, email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="w-[160px] space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {LEAD_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {formatStatusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[160px] space-y-1.5">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {LEAD_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {formatStatusLabel(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[180px] space-y-1.5">
          <Label>Source</Label>
          <Select value={sourceId} onValueChange={setSourceId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {sourcesQuery.data?.map((source) => (
                <SelectItem key={source.id} value={source.id}>
                  {source.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canManage && (
          <div className="w-[180px] space-y-1.5">
            <Label>Assigned Staff</Label>
            <Select value={assignedStaffId} onValueChange={setAssignedStaffId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All staff</SelectItem>
                {staffQuery.data?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {leadsQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  Loading leads…
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No leads found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/leads/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {page} of {totalPages} ({total} total)
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      </div>

      <InProgressLeads />

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) reset(addLeadDefaults);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Lead</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={handleSubmit((values) => createLeadMutation.mutate(values))}
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" {...register('phone')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input id="whatsapp" {...register('whatsapp')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register('email')} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company">Company</Label>
                <Input id="company" {...register('company')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Input id="city" {...register('city')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="country">Country</Label>
                <Input id="country" {...register('country')} />
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Controller
                  control={control}
                  name="priority"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {formatStatusLabel(p)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Source</Label>
                <Controller
                  control={control}
                  name="sourceId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {sourcesQuery.data?.map((source) => (
                          <SelectItem key={source.id} value={source.id}>
                            {source.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Campaign</Label>
                <Controller
                  control={control}
                  name="campaignId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {campaignsQuery.data?.map((campaign) => (
                          <SelectItem key={campaign.id} value={campaign.id}>
                            {campaign.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Assign to Staff</Label>
                <Controller
                  control={control}
                  name="assignedStaffId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
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
                  )}
                />
              </div>
              {isAdmin && (
                <div className="space-y-1.5">
                  <Label>Assign to Team Lead</Label>
                  <Controller
                    control={control}
                    name="assignedTeamLeadId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
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
                    )}
                  />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" {...register('notes')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || createLeadMutation.isPending}>
                {createLeadMutation.isPending ? 'Creating…' : 'Create Lead'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkOpen}
        onOpenChange={(open) => {
          setBulkOpen(open);
          if (!open) setBulkFile(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Upload Leads</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a CSV with headers: name, phone, whatsapp, email, company, city, country
            </p>
            <Input
              type="file"
              accept=".csv"
              onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!bulkFile || bulkUploadMutation.isPending}
              onClick={() => bulkFile && bulkUploadMutation.mutate(bulkFile)}
            >
              {bulkUploadMutation.isPending ? 'Uploading…' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditLeadDialog
        open={!!editingLead}
        onOpenChange={(open) => {
          if (!open) setEditingLead(null);
        }}
        lead={editingLead}
        isAdmin={isAdmin}
        sources={sourcesQuery.data ?? []}
        staff={staffQuery.data ?? []}
        teamLeads={teamLeadsQuery.data ?? []}
      />
    </div>
  );
}
