import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/features/auth/AuthContext';
import type { Role, UserProfile } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ROLE_OPTIONS: Role[] = ['admin', 'team_lead', 'staff'];

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  team_lead: 'Team Lead',
  staff: 'Staff',
};

const ROLE_BADGE_VARIANT: Record<Role, 'default' | 'secondary' | 'outline'> = {
  admin: 'default',
  team_lead: 'secondary',
  staff: 'outline',
};

type RoleFilter = 'all' | Role;

const userFormSchema = z
  .object({
    fullName: z.string().min(1, 'Full name is required'),
    email: z.string().min(1, 'Email is required').email('Enter a valid email'),
    phone: z.string().optional(),
    role: z.enum(['admin', 'team_lead', 'staff']),
    teamLeadId: z.string().optional(),
  })
  .refine((data) => data.role !== 'staff' || !!data.teamLeadId, {
    message: 'Team lead is required for staff',
    path: ['teamLeadId'],
  });

type UserFormValues = z.infer<typeof userFormSchema>;

interface CreatedUserResult extends UserProfile {
  tempPassword: string;
}

async function fetchUsers(role: RoleFilter): Promise<UserProfile[]> {
  const { data } = await apiClient.get<UserProfile[]>('/users', {
    params: role === 'all' ? undefined : { role },
  });
  return data;
}

async function fetchTeamLeads(): Promise<UserProfile[]> {
  const { data } = await apiClient.get<UserProfile[]>('/team-leads');
  return data;
}

function UserFormDialog({
  open,
  onOpenChange,
  user,
  teamLeads,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile | null;
  teamLeads: UserProfile[];
  onCreated: (result: CreatedUserResult) => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!user;

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      fullName: user?.full_name ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      role: user?.role ?? 'staff',
      teamLeadId: user?.team_lead_id ?? undefined,
    },
  });

  const role = watch('role');

  React.useEffect(() => {
    if (open) {
      reset({
        fullName: user?.full_name ?? '',
        email: user?.email ?? '',
        phone: user?.phone ?? '',
        role: user?.role ?? 'staff',
        teamLeadId: user?.team_lead_id ?? undefined,
      });
    }
  }, [open, user, reset]);

  const createMutation = useMutation({
    mutationFn: async (values: UserFormValues) => {
      const { data } = await apiClient.post<CreatedUserResult>('/users', {
        email: values.email,
        fullName: values.fullName,
        phone: values.phone || undefined,
        role: values.role,
        teamLeadId: values.role === 'staff' ? values.teamLeadId : undefined,
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onOpenChange(false);
      onCreated(data);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: UserFormValues) => {
      const { data } = await apiClient.patch<UserProfile>(`/users/${user!.id}`, {
        fullName: values.fullName,
        phone: values.phone || undefined,
        role: values.role,
        teamLeadId: values.role === 'staff' ? values.teamLeadId : null,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User updated');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (values: UserFormValues) => {
    if (isEdit) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  const submitting = isSubmitting || createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit User' : 'Add User'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update this user\'s details.' : 'Create a new user account.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" {...register('fullName')} />
            {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" disabled={isEdit} {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" {...register('phone')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          {role === 'staff' && (
            <div className="space-y-1.5">
              <Label htmlFor="teamLeadId">Team lead</Label>
              <Controller
                control={control}
                name="teamLeadId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="teamLeadId">
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
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create user'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TempPasswordDialog({
  result,
  onOpenChange,
}: {
  result: CreatedUserResult | null;
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
          <DialogTitle>User created</DialogTitle>
          <DialogDescription>
            Share this temporary password with {result?.full_name}. It will not be shown again.
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

export function UsersPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [roleFilter, setRoleFilter] = React.useState<RoleFilter>('all');
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<UserProfile | null>(null);
  const [createdUser, setCreatedUser] = React.useState<CreatedUserResult | null>(null);

  const usersQuery = useQuery({
    queryKey: ['users', roleFilter],
    queryFn: () => fetchUsers(roleFilter),
  });

  const teamLeadsQuery = useQuery({
    queryKey: ['team-leads'],
    queryFn: fetchTeamLeads,
  });

  const teamLeads = teamLeadsQuery.data ?? [];
  const teamLeadNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    teamLeads.forEach((tl) => map.set(tl.id, tl.full_name));
    return map;
  }, [teamLeads]);

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch<UserProfile>(`/users/${id}/deactivate`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deactivated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleAddClick = () => {
    setEditingUser(null);
    setFormOpen(true);
  };

  const handleEditClick = (user: UserProfile) => {
    setEditingUser(user);
    setFormOpen(true);
  };

  const handleDeactivate = (user: UserProfile) => {
    if (window.confirm(`Deactivate ${user.full_name}?`)) {
      deactivateMutation.mutate(user.id);
    }
  };

  const users = usersQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground">
            {profile?.role === 'admin' ? 'Manage all users in the system.' : 'Users in your scope.'}
          </p>
        </div>
        <Button onClick={handleAddClick}>Add User</Button>
      </div>

      <Tabs value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="admin">Admin</TabsTrigger>
          <TabsTrigger value="team_lead">Team Lead</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Team lead</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Loading users…
                </TableCell>
              </TableRow>
            )}
            {!usersQuery.isLoading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            )}
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.full_name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge variant={ROLE_BADGE_VARIANT[user.role]}>{ROLE_LABELS[user.role]}</Badge>
                </TableCell>
                <TableCell>
                  {user.team_lead_id ? teamLeadNameById.get(user.team_lead_id) ?? '—' : '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={user.is_active ? 'success' : 'secondary'}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEditClick(user)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={!user.is_active || deactivateMutation.isPending}
                      onClick={() => handleDeactivate(user)}
                    >
                      Deactivate
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        user={editingUser}
        teamLeads={teamLeads}
        onCreated={(result) => setCreatedUser(result)}
      />

      <TempPasswordDialog result={createdUser} onOpenChange={() => setCreatedUser(null)} />
    </div>
  );
}
