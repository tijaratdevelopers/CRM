import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/features/auth/AuthContext';
import type { Lead, LeadPriority, LeadStatus, PaginatedResponse, UserProfile } from '@/types';
import { IN_PROGRESS_STATUSES } from '@/types';

import { Button } from '@/components/ui/button';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const PAGE_SIZE = 10;

function statusBadgeVariant(status: LeadStatus): NonNullable<BadgeProps['variant']> {
  switch (status) {
    case 'negotiation':
    case 'proposal_sent':
      return 'warning';
    case 'assigned':
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

export function InProgressLeads() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = React.useState(1);

  const canManage = profile?.role === 'admin' || profile?.role === 'team_lead';

  const leadsQuery = useQuery({
    queryKey: ['leads', 'in-progress', page],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Lead>>('/leads', {
        params: {
          page,
          pageSize: PAGE_SIZE,
          statuses: IN_PROGRESS_STATUSES.join(','),
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
    return map;
  }, [staffQuery.data]);

  function resolveStaffName(id: string | null) {
    if (!id) return '—';
    if (staffMap.has(id)) return staffMap.get(id) as string;
    if (profile?.id === id) return profile.full_name;
    return '—';
  }

  const leads = leadsQuery.data?.data ?? [];
  const total = leadsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card className="animate-fade-in-up">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>In Progress Leads</CardTitle>
        <Badge variant="secondary">{total} total</Badge>
      </CardHeader>
      <CardContent>
        {leadsQuery.isLoading ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : leads.length === 0 ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            No leads in progress right now.
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
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    {canManage && <TableHead>Assigned Staff</TableHead>}
                    <TableHead>Created</TableHead>
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
                        <Badge variant={statusBadgeVariant(lead.status)}>
                          {formatStatusLabel(lead.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={priorityBadgeVariant(lead.priority)}>
                          {formatStatusLabel(lead.priority)}
                        </Badge>
                      </TableCell>
                      {canManage && <TableCell>{resolveStaffName(lead.assigned_staff_id)}</TableCell>}
                      <TableCell>{format(new Date(lead.created_at), 'MMM d, yyyy')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
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
      </CardContent>
    </Card>
  );
}
