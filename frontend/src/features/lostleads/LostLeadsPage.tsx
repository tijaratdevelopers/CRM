import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/features/auth/AuthContext';
import { useProject } from '@/features/projects/ProjectContext';
import type { Lead, PaginatedResponse, UserProfile } from '@/types';
import { LEAD_LOST_REASONS } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const PAGE_SIZE = 15;

const REASON_LABEL = new Map(LEAD_LOST_REASONS.map((r) => [r.value, r.label]));

export function LostLeadsPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { selectedProjectId } = useProject();
  const [page, setPage] = React.useState(1);
  const canManage = profile?.role === 'admin' || profile?.role === 'team_lead';

  const leadsQuery = useQuery({
    queryKey: ['leads', 'lost', page, selectedProjectId],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Lead>>('/leads', {
        params: {
          page,
          pageSize: PAGE_SIZE,
          statuses: 'lost',
          ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
        },
      });
      return data;
    },
  });

  const staffQuery = useQuery({
    queryKey: ['users', 'staff'],
    queryFn: async () => {
      const { data } = await apiClient.get<UserProfile[]>('/users', { params: { role: 'staff' } });
      return data;
    },
    enabled: canManage,
  });

  const staffMap = React.useMemo(() => {
    const map = new Map<string, string>();
    staffQuery.data?.forEach((s) => map.set(s.id, s.full_name));
    if (profile) map.set(profile.id, profile.full_name);
    return map;
  }, [staffQuery.data, profile]);

  const leads = leadsQuery.data?.data ?? [];
  const total = leadsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Lost Leads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Leads marked lost — with the reason and any note recorded at the time.
        </p>
      </div>

      <Card className="neon-panel rounded-2xl p-4">
        {leadsQuery.isLoading ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : leads.length === 0 ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            No lost leads.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Lost Reason</TableHead>
                    <TableHead>Note</TableHead>
                    {canManage && <TableHead>Assigned Staff</TableHead>}
                    <TableHead>Lost On</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/leads/${lead.id}`)}
                    >
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell>{lead.phone ?? '—'}</TableCell>
                      <TableCell>{lead.company ?? '—'}</TableCell>
                      <TableCell>
                        {lead.lost_reason ? (
                          <Badge variant="destructive">
                            {REASON_LABEL.get(lead.lost_reason) ?? lead.lost_reason}
                          </Badge>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate text-muted-foreground">
                        {lead.lost_reason_note || '—'}
                      </TableCell>
                      {canManage && <TableCell>{lead.assigned_staff_id ? staffMap.get(lead.assigned_staff_id) ?? '—' : '—'}</TableCell>}
                      <TableCell>{format(new Date(lead.updated_at), 'MMM d, yyyy')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages} · {total} total
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
