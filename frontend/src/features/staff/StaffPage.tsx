import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/features/auth/AuthContext';
import type { UserProfile } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

const addStaffSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  phone: z.string().optional(),
  teamLeadId: z.string().optional(),
});

type AddStaffValues = z.infer<typeof addStaffSchema>;

interface CreatedStaffResult extends UserProfile {
  tempPassword: string;
}

function AddStaffDialog({
  open,
  onOpenChange,
  isAdmin,
  teamLeads,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  teamLeads: UserProfile[];
  onCreated: (result: CreatedStaffResult) => void;
}) {
  const queryClient = useQueryClient();
  const schema = isAdmin
    ? addStaffSchema.refine((data) => !!data.teamLeadId, {
        message: 'Team lead is required',
        path: ['teamLeadId'],
      })
    : addStaffSchema;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddStaffValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: '', email: '', phone: '', teamLeadId: undefined },
  });

  React.useEffect(() => {
    if (open) reset({ fullName: '', email: '', phone: '', teamLeadId: undefined });
  }, [open, reset]);

  const createMutation = useMutation({
    mutationFn: async (values: AddStaffValues) => {
      const { data } = await apiClient.post<CreatedStaffResult>('/users', {
        email: values.email,
        fullName: values.fullName,
        phone: values.phone || undefined,
        role: 'staff',
        teamLeadId: isAdmin ? values.teamLeadId : undefined,
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      onOpenChange(false);
      onCreated(data);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Staff</DialogTitle>
          <DialogDescription>
            An invite email with login details will be sent to this address.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((values) => createMutation.mutate(values))} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="staff-fullName">Full name</Label>
            <Input id="staff-fullName" {...register('fullName')} />
            {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-email">Email</Label>
            <Input id="staff-email" type="email" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-phone">Phone</Label>
            <Input id="staff-phone" {...register('phone')} />
          </div>
          {isAdmin && (
            <div className="space-y-1.5">
              <Label htmlFor="staff-teamLeadId">Team lead</Label>
              <Controller
                control={control}
                name="teamLeadId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="staff-teamLeadId">
                      <SelectValue placeholder="Select team lead" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamLeads.map((tl) => (
                        <SelectItem key={tl.id} value={tl.id}>
                          {tl.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.teamLeadId && (
                <p className="text-xs text-destructive">{errors.teamLeadId.message}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || createMutation.isPending}>
              {createMutation.isPending ? 'Sending invite…' : 'Add staff'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InviteSentDialog({
  result,
  onOpenChange,
}: {
  result: CreatedStaffResult | null;
  onOpenChange: (open: boolean) => void;
}) {
  const copyPassword = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.tempPassword);
    toast.success('Password copied to clipboard');
  };

  return (
    <Dialog open={!!result} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite sent</DialogTitle>
          <DialogDescription>
            An email with login details was sent to {result?.email}. You can also share this
            temporary password directly — it won't be shown again.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
          <code className="flex-1 font-mono text-sm">{result?.tempPassword}</code>
          <Button type="button" size="sm" variant="outline" onClick={copyPassword}>
            Copy password
          </Button>
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface StaffPerformance {
  my_leads: number;
  calls_today: number;
  meetings_today: number;
  pending_follow_ups: number;
  new_leads: number;
}

const STAT_LABELS: { key: keyof StaffPerformance; label: string }[] = [
  { key: 'my_leads', label: 'My leads' },
  { key: 'calls_today', label: 'Calls today' },
  { key: 'meetings_today', label: 'Meetings today' },
  { key: 'pending_follow_ups', label: 'Pending follow-ups' },
  { key: 'new_leads', label: 'New leads' },
];

async function fetchStaff(): Promise<UserProfile[]> {
  const { data } = await apiClient.get<UserProfile[]>('/staff');
  return data;
}

async function fetchTeamLeads(): Promise<UserProfile[]> {
  const { data } = await apiClient.get<UserProfile[]>('/team-leads');
  return data;
}

async function fetchStaffPerformance(id: string): Promise<StaffPerformance> {
  const { data } = await apiClient.get<StaffPerformance>(`/staff/${id}/performance`);
  return data;
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <p className="text-lg font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function StaffPerformanceDialog({
  staffMember,
  onOpenChange,
}: {
  staffMember: UserProfile | null;
  onOpenChange: (open: boolean) => void;
}) {
  const performanceQuery = useQuery({
    queryKey: ['staff-performance', staffMember?.id],
    queryFn: () => fetchStaffPerformance(staffMember!.id),
    enabled: !!staffMember,
  });

  return (
    <Dialog open={!!staffMember} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{staffMember?.full_name}'s performance</DialogTitle>
          <DialogDescription>Current performance stats for this staff member.</DialogDescription>
        </DialogHeader>
        {performanceQuery.isLoading && (
          <p className="text-sm text-muted-foreground">Loading performance…</p>
        )}
        {performanceQuery.data && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {STAT_LABELS.map(({ key, label }) => (
              <StatTile key={key} label={label} value={performanceQuery.data[key]} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function StaffPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [selectedStaff, setSelectedStaff] = React.useState<UserProfile | null>(null);
  const [addStaffOpen, setAddStaffOpen] = React.useState(false);
  const [createdStaff, setCreatedStaff] = React.useState<CreatedStaffResult | null>(null);

  const staffQuery = useQuery({
    queryKey: ['staff'],
    queryFn: fetchStaff,
  });

  const teamLeadsQuery = useQuery({
    queryKey: ['team-leads'],
    queryFn: fetchTeamLeads,
    enabled: isAdmin,
  });

  const teamLeads = teamLeadsQuery.data ?? [];
  const teamLeadNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    teamLeads.forEach((tl) => map.set(tl.id, tl.full_name));
    return map;
  }, [teamLeads]);

  const staff = staffQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{isAdmin ? 'All Staff' : 'My Staff'}</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? 'Every staff member across all teams.' : 'Staff members reporting to you.'}
          </p>
        </div>
        <Button onClick={() => setAddStaffOpen(true)}>Add Staff</Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Team lead</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staffQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Loading staff…
                </TableCell>
              </TableRow>
            )}
            {!staffQuery.isLoading && staff.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No staff found.
                </TableCell>
              </TableRow>
            )}
            {staff.map((member) => (
              <TableRow
                key={member.id}
                className="cursor-pointer"
                onClick={() => setSelectedStaff(member)}
              >
                <TableCell className="font-medium">{member.full_name}</TableCell>
                <TableCell>{member.email}</TableCell>
                <TableCell>{member.phone ?? '—'}</TableCell>
                <TableCell>
                  {isAdmin
                    ? member.team_lead_id
                      ? teamLeadNameById.get(member.team_lead_id) ?? '—'
                      : '—'
                    : 'You'}
                </TableCell>
                <TableCell>
                  <Badge variant={member.is_active ? 'success' : 'secondary'}>
                    {member.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedStaff(member);
                    }}
                  >
                    View performance
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <StaffPerformanceDialog staffMember={selectedStaff} onOpenChange={() => setSelectedStaff(null)} />

      <AddStaffDialog
        open={addStaffOpen}
        onOpenChange={setAddStaffOpen}
        isAdmin={isAdmin}
        teamLeads={teamLeads}
        onCreated={(result) => setCreatedStaff(result)}
      />

      <InviteSentDialog result={createdStaff} onOpenChange={() => setCreatedStaff(null)} />
    </div>
  );
}
