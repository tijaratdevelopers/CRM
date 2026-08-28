import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '@/lib/apiClient';
import { Card } from '@/components/ui/card';
import type { Task } from '@/types';

async function fetchTasks(): Promise<Task[]> {
  const { data } = await apiClient.get<Task[]>('/tasks');
  return data;
}

export function TasksOverviewCard({ mock }: { mock?: Task[] }) {
  const query = useQuery({ queryKey: ['tasks', 'overview'], queryFn: fetchTasks, enabled: !mock });
  const data = mock ?? query.data;
  const isLoading = mock ? false : query.isLoading;

  const tasks = data ?? [];
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === 'approved').length;
  const now = Date.now();
  const isOverdue = (t: Task) => t.status !== 'approved' && !!t.due_date && new Date(t.due_date).getTime() < now;
  const overdue = tasks.filter(isOverdue).length;
  const pending = tasks.filter(
    (t) => (t.status === 'pending' || t.status === 'submitted') && !isOverdue(t),
  ).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const R = 52;
  const C = 2 * Math.PI * R;
  const dash = (pct / 100) * C;

  return (
    <Card className="neon-panel animate-fade-in-up rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">Tasks Overview</h3>
        <Link to="/tasks" className="text-xs font-medium text-primary hover:underline">
          View All
        </Link>
      </div>

      {isLoading ? (
        <div className="flex h-[160px] items-center justify-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="flex items-center gap-5">
          <div className="relative h-[132px] w-[132px] shrink-0">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <circle cx="60" cy="60" r={R} fill="none" stroke="hsl(var(--border))" strokeWidth="10" />
              <circle
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke="hsl(var(--neon-green))"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${C - dash}`}
                style={{ transition: 'stroke-dasharray 1s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-foreground">{pct}%</span>
              <span className="text-[10px] text-muted-foreground">Completed</span>
            </div>
          </div>
          <dl className="flex-1 space-y-2.5 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Total Tasks</dt>
              <dd className="font-semibold text-foreground">{total}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-primary">Completed</dt>
              <dd className="font-semibold text-primary">{completed}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-amber-400/80">Pending</dt>
              <dd className="font-semibold text-amber-400/80">{pending}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-rose-400">Overdue</dt>
              <dd className="font-semibold text-rose-400">{overdue}</dd>
            </div>
          </dl>
        </div>
      )}
    </Card>
  );
}
