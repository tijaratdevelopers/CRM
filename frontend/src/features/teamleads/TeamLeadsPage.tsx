import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import type { UserProfile } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface TeamLeadPerformance {
  assigned_staff: number;
  assigned_leads: number;
  pending_follow_ups: number;
  meetings_today: number;
  won_leads: number;
  lost_leads: number;
}

async function fetchTeamLeads(): Promise<UserProfile[]> {
  const { data } = await apiClient.get<UserProfile[]>('/team-leads');
  return data;
}

async function fetchPerformance(id: string): Promise<TeamLeadPerformance> {
  const { data } = await apiClient.get<TeamLeadPerformance>(`/team-leads/${id}/performance`);
  return data;
}

async function fetchStaff(id: string): Promise<UserProfile[]> {
  const { data } = await apiClient.get<UserProfile[]>(`/team-leads/${id}/staff`);
  return data;
}

const STAT_LABELS: { key: keyof TeamLeadPerformance; label: string }[] = [
  { key: 'assigned_staff', label: 'Assigned staff' },
  { key: 'assigned_leads', label: 'Assigned leads' },
  { key: 'pending_follow_ups', label: 'Pending follow-ups' },
  { key: 'meetings_today', label: 'Meetings today' },
  { key: 'won_leads', label: 'Won leads' },
  { key: 'lost_leads', label: 'Lost leads' },
];

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <p className="text-lg font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function TeamLeadCard({
  teamLead,
  onViewStaff,
}: {
  teamLead: UserProfile;
  onViewStaff: (teamLead: UserProfile) => void;
}) {
  const [showPerformance, setShowPerformance] = React.useState(false);

  const performanceQuery = useQuery({
    queryKey: ['team-lead-performance', teamLead.id],
    queryFn: () => fetchPerformance(teamLead.id),
    enabled: showPerformance,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">{teamLead.full_name}</CardTitle>
        <p className="text-sm text-muted-foreground">{teamLead.email}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowPerformance((prev) => !prev)}
          >
            {showPerformance ? 'Hide performance' : 'View performance'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onViewStaff(teamLead)}>
            View staff
          </Button>
        </div>

        {showPerformance && (
          <>
            <Separator />
            {performanceQuery.isLoading && (
              <p className="text-sm text-muted-foreground">Loading performance…</p>
            )}
            {performanceQuery.data && (
              <div className="grid grid-cols-2 gap-2">
                {STAT_LABELS.map(({ key, label }) => (
                  <StatTile key={key} label={label} value={performanceQuery.data[key]} />
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StaffListDialog({
  teamLead,
  onOpenChange,
}: {
  teamLead: UserProfile | null;
  onOpenChange: (open: boolean) => void;
}) {
  const staffQuery = useQuery({
    queryKey: ['team-lead-staff', teamLead?.id],
    queryFn: () => fetchStaff(teamLead!.id),
    enabled: !!teamLead,
  });

  const staff = staffQuery.data ?? [];

  return (
    <Dialog open={!!teamLead} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{teamLead?.full_name}'s staff</DialogTitle>
          <DialogDescription>Staff members assigned to this team lead.</DialogDescription>
        </DialogHeader>
        {staffQuery.isLoading && <p className="text-sm text-muted-foreground">Loading staff…</p>}
        {!staffQuery.isLoading && staff.length === 0 && (
          <p className="text-sm text-muted-foreground">No staff assigned yet.</p>
        )}
        <div className="space-y-2">
          {staff.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">{s.full_name}</p>
                <p className="text-xs text-muted-foreground">{s.email}</p>
              </div>
              <Badge variant={s.is_active ? 'success' : 'secondary'}>
                {s.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TeamLeadsPage() {
  const [staffDialogTeamLead, setStaffDialogTeamLead] = React.useState<UserProfile | null>(null);

  const teamLeadsQuery = useQuery({
    queryKey: ['team-leads'],
    queryFn: fetchTeamLeads,
  });

  const teamLeads = teamLeadsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Team Leads</h1>
        <p className="text-sm text-muted-foreground">Overview of all team leads and their performance.</p>
      </div>

      {teamLeadsQuery.isLoading && <p className="text-sm text-muted-foreground">Loading team leads…</p>}
      {!teamLeadsQuery.isLoading && teamLeads.length === 0 && (
        <p className="text-sm text-muted-foreground">No team leads found.</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teamLeads.map((teamLead) => (
          <TeamLeadCard key={teamLead.id} teamLead={teamLead} onViewStaff={setStaffDialogTeamLead} />
        ))}
      </div>

      <StaffListDialog teamLead={staffDialogTeamLead} onOpenChange={() => setStaffDialogTeamLead(null)} />
    </div>
  );
}
