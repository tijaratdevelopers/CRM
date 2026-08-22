import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { UserPlus, CalendarClock, CheckCircle2, ClipboardList, Activity } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import type { ActivityLog, PaginatedResponse } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const PREVIEW_SIZE = 6;

function formatAction(action: string) {
  return action
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function iconFor(action: string) {
  if (action.includes('lead') && action.includes('creat')) return { Icon: UserPlus, tone: 'text-orange-500 bg-orange-500/10' };
  if (action.includes('meeting')) return { Icon: CalendarClock, tone: 'text-blue-500 bg-blue-500/10' };
  if (action.includes('follow')) return { Icon: CheckCircle2, tone: 'text-emerald-500 bg-emerald-500/10' };
  if (action.includes('task')) return { Icon: ClipboardList, tone: 'text-red-500 bg-red-500/10' };
  return { Icon: Activity, tone: 'text-muted-foreground bg-muted' };
}

/** A compact recent-activity feed for the dashboard — the full, filterable
 * audit trail lives on the Activity Logs page. */
export function DashboardRecentActivity({ delay = 0 }: { delay?: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['activity-logs', 'preview'],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<ActivityLog>>('/activity-logs', {
        params: { page: 1, pageSize: PREVIEW_SIZE },
      });
      return data;
    },
  });

  const logs = data?.data ?? [];

  return (
    <Card className="animate-fade-in-up" style={{ animationDelay: `${delay}ms` }}>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-foreground">Recent Activities</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : logs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No activity yet</p>
        ) : (
          <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            {logs.map((log) => {
              const { Icon, tone } = iconFor(log.action);
              return (
                <div key={log.id} className="flex items-center gap-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">
                      {formatAction(log.action)} <span className="text-muted-foreground">· {log.entity_type}</span>
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
