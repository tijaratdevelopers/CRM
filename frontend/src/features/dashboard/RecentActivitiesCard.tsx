import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Contact, CalendarClock, CheckCircle2, ClipboardList, Phone, User, Activity } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { Card } from '@/components/ui/card';
import type { ActivityLog, PaginatedResponse } from '@/types';

const ICONS: Record<string, typeof Activity> = {
  lead: Contact,
  meeting: CalendarClock,
  follow_up: CheckCircle2,
  followup: CheckCircle2,
  task: ClipboardList,
  call: Phone,
  call_log: Phone,
  user: User,
};

function humanize(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RecentActivitiesCard({ mock }: { mock?: ActivityLog[] }) {
  const query = useQuery({
    queryKey: ['activity-logs', 'dashboard'],
    enabled: !mock,
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<ActivityLog>>('/activity-logs', {
        params: { page: 1, pageSize: 8 },
      });
      return data;
    },
  });

  const isLoading = mock ? false : query.isLoading;
  const logs = mock ?? query.data?.data ?? [];

  return (
    <Card className="neon-panel animate-fade-in-up rounded-2xl p-5">
      <h3 className="mb-4 text-base font-semibold text-foreground">Recent Activities</h3>

      {isLoading ? (
        <div className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">Loading…</div>
      ) : logs.length === 0 ? (
        <div className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">No activity yet</div>
      ) : (
        <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {logs.map((log) => {
            const Icon = ICONS[log.entity_type] ?? Activity;
            const title =
              (typeof log.metadata?.title === 'string' && log.metadata.title) ||
              `${humanize(log.action)} · ${humanize(log.entity_type)}`;
            return (
              <li key={log.id} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 ring-1 ring-inset ring-amber-500/25">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
