import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/features/auth/AuthContext';
import type { UserProfile } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

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
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{isAdmin ? 'All Staff' : 'My Staff'}</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? 'Every staff member across all teams.' : 'Staff members reporting to you.'}
        </p>
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
    </div>
  );
}
