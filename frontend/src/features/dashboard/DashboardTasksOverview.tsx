import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import type { Task } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function isOverdue(task: Task) {
  if (!task.due_date) return false;
  if (task.status === 'approved') return false;
  return new Date(task.due_date).getTime() < Date.now();
}

/** A compact task-completion summary for the dashboard, built from the same
 * `/tasks` list every staff member and team lead already sees. */
export function DashboardTasksOverview({ delay = 0 }: { delay?: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['tasks', 'dashboard-overview'],
    queryFn: async () => {
      const { data } = await apiClient.get<Task[]>('/tasks');
      return data;
    },
  });

  const tasks = data ?? [];
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === 'approved').length;
  const overdue = tasks.filter(isOverdue).length;
  const pending = total - completed - overdue;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const dashOffset = CIRCUMFERENCE * (1 - pct / 100);

  return (
    <Card className="animate-fade-in-up" style={{ animationDelay: `${delay}ms` }}>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-foreground">Tasks Overview</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="flex items-center gap-6">
            <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
              <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90">
                <circle cx="56" cy="56" r={RADIUS} fill="none" strokeWidth="10" className="stroke-muted" />
                <circle
                  cx="56"
                  cy="56"
                  r={RADIUS}
                  fill="none"
                  strokeWidth="10"
                  strokeLinecap="round"
                  stroke="#10b981"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={dashOffset}
                  style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-2xl font-bold text-foreground">{pct}%</span>
                <span className="text-[10px] text-muted-foreground">Completed</span>
              </div>
            </div>
            <div className="flex-1 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Tasks</span>
                <span className="font-semibold text-foreground">{total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-emerald-500">Completed</span>
                <span className="font-semibold text-emerald-500">{completed}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-blue-500">Pending</span>
                <span className="font-semibold text-blue-500">{pending}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-red-500">Overdue</span>
                <span className="font-semibold text-red-500">{overdue}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
