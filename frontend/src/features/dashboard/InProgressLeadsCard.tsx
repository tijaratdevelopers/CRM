import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/apiClient';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { Lead, PaginatedResponse } from '@/types';
import { IN_PROGRESS_STATUSES } from '@/types';

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function statusLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function InProgressLeadsCard({ mock }: { mock?: Lead[] }) {
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['leads', 'in-progress', 'dashboard-card'],
    enabled: !mock,
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Lead>>('/leads', {
        params: { page: 1, pageSize: 5, statuses: IN_PROGRESS_STATUSES.join(',') },
      });
      return data;
    },
  });

  const isLoading = mock ? false : query.isLoading;
  const leads = mock ?? query.data?.data ?? [];

  return (
    <Card className="neon-panel animate-fade-in-up rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">In Progress Leads</h3>
        <Link to="/leads/in-progress" className="text-xs font-medium text-primary hover:underline">
          View All
        </Link>
      </div>

      {isLoading ? (
        <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">Loading…</div>
      ) : leads.length === 0 ? (
        <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
          Nothing in progress right now
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {leads.map((lead) => (
            <li key={lead.id}>
              <button
                type="button"
                onClick={() => navigate(`/leads/${lead.id}`)}
                className="flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-secondary/40"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-secondary text-xs text-foreground">
                    {initials(lead.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{lead.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {lead.company || lead.city || lead.phone || '—'}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 capitalize">
                  {statusLabel(lead.status)}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
