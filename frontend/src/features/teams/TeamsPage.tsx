import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Shuffle } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/features/auth/AuthContext';
import type { Team, UserProfile } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface DistributionState {
  teamPointer: number;
  staffPointer: number;
  updatedAt: string | null;
}

async function fetchTeams(): Promise<Team[]> {
  const { data } = await apiClient.get<Team[]>('/teams');
  return data;
}

async function fetchUsers(): Promise<UserProfile[]> {
  const { data } = await apiClient.get<UserProfile[]>('/users');
  return data;
}

async function fetchDistributionState(): Promise<DistributionState> {
  const { data } = await apiClient.get<DistributionState>('/teams/distribution-state');
  return data;
}

const NONE = '__none__';

function TeamFormDialog({
  open,
  team,
  teamLeads,
  onOpenChange,
}: {
  open: boolean;
  team: Team | null;
  teamLeads: UserProfile[];
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState('');
  const [teamLeadId, setTeamLeadId] = React.useState<string>(NONE);

  React.useEffect(() => {
    if (open) {
      setName(team?.name ?? '');
      setTeamLeadId(team?.team_lead_id ?? NONE);
    }
  }, [open, team]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { name, teamLeadId: teamLeadId === NONE ? null : teamLeadId };
      if (team) {
        await apiClient.patch(`/teams/${team.id}`, payload);
      } else {
        await apiClient.post('/teams', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success(team ? 'Team updated' : 'Team created');
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{team ? 'Edit team' : 'Create team'}</DialogTitle>
          <DialogDescription>
            Teams are the first tier of the round-robin lead distribution engine.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team-name">Team name</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Team Alpha"
            />
          </div>
          <div className="space-y-2">
            <Label>Team lead</Label>
            <Select value={teamLeadId} onValueChange={setTeamLeadId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a team lead" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No team lead</SelectItem>
                {teamLeads.map((tl) => (
                  <SelectItem key={tl.id} value={tl.id}>
                    {tl.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!name.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Saving…' : team ? 'Save changes' : 'Create team'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageMembersDialog({
  team,
  allStaff,
  onOpenChange,
}: {
  team: Team | null;
  allStaff: UserProfile[];
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [staffToAdd, setStaffToAdd] = React.useState<string>('');

  const availableStaff = React.useMemo(() => {
    if (!team) return [];
    const memberIds = new Set(team.members.map((m) => m.id));
    return allStaff.filter((s) => s.role === 'staff' && !memberIds.has(s.id) && !s.team_id);
  }, [team, allStaff]);

  const addMutation = useMutation({
    mutationFn: async (staffId: string) => {
      await apiClient.post(`/teams/${team!.id}/members`, { staffId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setStaffToAdd('');
      toast.success('Staff added to team');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (staffId: string) => {
      await apiClient.delete(`/teams/${team!.id}/members/${staffId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Staff removed from team');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={!!team} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{team?.name} — members</DialogTitle>
          <DialogDescription>
            Active members receive leads in round-robin order. Inactive staff are skipped automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {team?.members.length === 0 && (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          )}
          {team?.members.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">{m.full_name}</p>
                <p className="text-xs text-muted-foreground">{m.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={m.is_active ? 'success' : 'secondary'}>
                  {m.is_active ? 'Active' : 'Inactive'}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={removeMutation.isPending}
                  onClick={() => removeMutation.mutate(m.id)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Separator />

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-2">
            <Label>Add staff</Label>
            <Select value={staffToAdd} onValueChange={setStaffToAdd}>
              <SelectTrigger>
                <SelectValue placeholder={availableStaff.length ? 'Select unassigned staff' : 'No unassigned staff'} />
              </SelectTrigger>
              <SelectContent>
                {availableStaff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={!staffToAdd || addMutation.isPending}
            onClick={() => addMutation.mutate(staffToAdd)}
          >
            Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TeamsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingTeam, setEditingTeam] = React.useState<Team | null>(null);
  const [membersTeam, setMembersTeam] = React.useState<Team | null>(null);

  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: fetchTeams });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: fetchUsers, enabled: isAdmin });
  const stateQuery = useQuery({
    queryKey: ['distribution-state'],
    queryFn: fetchDistributionState,
    enabled: isAdmin,
    refetchInterval: 30_000,
  });

  const teams = teamsQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const teamLeads = users.filter((u) => u.role === 'team_lead');

  // Keep the members dialog in sync after add/remove refetches.
  React.useEffect(() => {
    if (membersTeam) {
      const fresh = teams.find((t) => t.id === membersTeam.id);
      if (fresh && fresh !== membersTeam) setMembersTeam(fresh);
    }
  }, [teams, membersTeam]);

  const toggleActiveMutation = useMutation({
    mutationFn: async (team: Team) => {
      await apiClient.patch(`/teams/${team.id}`, { isActive: !team.is_active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Team updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (teamId: string) => {
      await apiClient.delete(`/teams/${teamId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Team deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Teams</h1>
          <p className="text-sm text-muted-foreground">
            New leads are distributed automatically — teams first, then staff, in strict round-robin order.
          </p>
        </div>
        {isAdmin && <Button onClick={() => { setEditingTeam(null); setFormOpen(true); }}>Create team</Button>}
      </div>

      {isAdmin && stateQuery.data && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          <Shuffle className="h-4 w-4" />
          <span>
            Distribution engine — next team index: <strong>{stateQuery.data.teamPointer + 1}</strong>, staff
            round: <strong>{stateQuery.data.staffPointer + 1}</strong>
            {stateQuery.data.updatedAt
              ? ` · last assignment ${new Date(stateQuery.data.updatedAt).toLocaleString()}`
              : ' · no assignments yet'}
          </span>
        </div>
      )}

      {teamsQuery.isLoading && <p className="text-sm text-muted-foreground">Loading teams…</p>}
      {!teamsQuery.isLoading && teams.length === 0 && (
        <p className="text-sm text-muted-foreground">No teams yet. Create one to start auto-distribution.</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => (
          <Card key={team.id} className={team.is_active ? '' : 'opacity-60'}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold text-foreground">{team.name}</CardTitle>
                <Badge variant={team.is_active ? 'success' : 'secondary'}>
                  {team.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Lead: {team.team_lead?.full_name ?? 'Unassigned'}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {team.members.length} member{team.members.length === 1 ? '' : 's'} ·{' '}
                {team.members.filter((m) => m.is_active).length} receiving leads
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setMembersTeam(team)}>
                  Members
                </Button>
                {isAdmin && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => { setEditingTeam(team); setFormOpen(true); }}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={toggleActiveMutation.isPending}
                      onClick={() => toggleActiveMutation.mutate(team)}
                    >
                      {team.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (window.confirm(`Delete ${team.name}? Members become unassigned.`)) {
                          deleteMutation.mutate(team.id);
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <TeamFormDialog open={formOpen} team={editingTeam} teamLeads={teamLeads} onOpenChange={setFormOpen} />
      <ManageMembersDialog team={membersTeam} allStaff={users} onOpenChange={() => setMembersTeam(null)} />
    </div>
  );
}
