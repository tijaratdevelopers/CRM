import * as React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import type { Lead, LeadSource, LeadStatus, PaginatedResponse } from '@/types';
import { IN_PROGRESS_STATUSES } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const PREVIEW_SIZE = 4;

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

function formatLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function initialsOf(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** A compact preview of in-progress leads for the dashboard — the full,
 * filterable table lives on the "In Progress Leads" tab/page. */
export function DashboardInProgressLeadsCard({ delay = 0 }: { delay?: number }) {
  const leadsQuery = useQuery({
    queryKey: ['leads', 'in-progress', 'preview'],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Lead>>('/leads', {
        params: { page: 1, pageSize: PREVIEW_SIZE, statuses: IN_PROGRESS_STATUSES.join(',') },
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

  const sourceMap = React.useMemo(() => {
    const map = new Map<string, string>();
    sourcesQuery.data?.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [sourcesQuery.data]);

  const leads = leadsQuery.data?.data ?? [];

  return (
    <Card className="animate-fade-in-up" style={{ animationDelay: `${delay}ms` }}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-sm font-semibold text-foreground">In Progress Leads</CardTitle>
        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <Link to="/leads/in-progress">View All</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-1">
        {leadsQuery.isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : leads.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No leads in progress</p>
        ) : (
          leads.map((lead) => (
            <Link
              key={lead.id}
              to={`/leads/${lead.id}`}
              className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent"
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-gradient-to-br from-amber-500 via-amber-600 to-yellow-800 text-xs text-black">
                  {initialsOf(lead.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{lead.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {lead.source_id ? sourceMap.get(lead.source_id) ?? '—' : '—'}
                </p>
              </div>
              <Badge variant={statusBadgeVariant(lead.status)} className="shrink-0">
                {formatLabel(lead.status)}
              </Badge>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
