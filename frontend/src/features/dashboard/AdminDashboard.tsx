import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Contact, Loader, CalendarClock, BellRing, Trophy, CalendarDays } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/features/auth/AuthContext';
import { useProject } from '@/features/projects/ProjectContext';
import { KpiCard } from '@/features/dashboard/KpiCard';
import { LeadsOverviewChart } from '@/features/dashboard/LeadsOverviewChart';
import { LeadsBySourceCard } from '@/features/dashboard/LeadsBySourceCard';
import { TasksOverviewCard } from '@/features/dashboard/TasksOverviewCard';
import { RecentActivitiesCard } from '@/features/dashboard/RecentActivitiesCard';
import { InProgressLeadsCard } from '@/features/dashboard/InProgressLeadsCard';
import { DashboardRobot } from '@/features/dashboard/DashboardRobot';
import { useDashboardCharts, monthOverMonthTrend } from '@/features/dashboard/dashboardApi';

interface AdminSummary {
  total_leads: number;
  todays_leads: number;
  meetings_today: number;
  pending_follow_ups: number;
  won_leads: number;
  in_progress_leads: number;
}

async function fetchAdminSummary(projectId: string | null): Promise<AdminSummary> {
  const { data } = await apiClient.get<AdminSummary>('/dashboard/summary', {
    params: projectId ? { projectId } : undefined,
  });
  return data;
}

export function AdminDashboard() {
  const { profile } = useAuth();
  const { selectedProjectId } = useProject();
  const { data } = useQuery({
    queryKey: ['dashboard-summary', selectedProjectId],
    queryFn: () => fetchAdminSummary(selectedProjectId),
  });
  const charts = useDashboardCharts();
  const leadsTrend = monthOverMonthTrend(charts.data?.monthlyLeads);

  const firstName = profile?.full_name ? profile.full_name.split(' ')[0] : 'there';

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Welcome back, {firstName} <span className="inline-block animate-float">👋</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening with your business today.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4 text-primary" />
          {format(new Date(), 'MMMM d, yyyy')}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Total Leads" value={data?.total_leads ?? '—'} icon={<Contact className="h-5 w-5" />} tone="blue" trend={leadsTrend} to="/leads" index={0} />
        <KpiCard label="In Progress Leads" value={data?.in_progress_leads ?? '—'} icon={<Loader className="h-5 w-5" />} tone="purple" to="/leads/in-progress" index={1} />
        <KpiCard label="Meetings Today" value={data?.meetings_today ?? '—'} icon={<CalendarClock className="h-5 w-5" />} tone="blue" to="/meetings" index={2} />
        <KpiCard label="Follow-ups Due" value={data?.pending_follow_ups ?? '—'} icon={<BellRing className="h-5 w-5" />} tone="red" to="/follow-ups" index={3} />
        <KpiCard label="Won Leads" value={data?.won_leads ?? '—'} icon={<Trophy className="h-5 w-5" />} tone="green" to="/leads" index={4} />
      </div>

      {/* Middle: charts + robot */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.05fr_1fr]">
        <div className="flex flex-col gap-5">
          <LeadsOverviewChart />
          <InProgressLeadsCard />
        </div>
        <div className="order-first flex items-center justify-center xl:order-none">
          <DashboardRobot />
        </div>
        <div className="flex flex-col gap-5">
          <LeadsBySourceCard />
          <TasksOverviewCard />
        </div>
      </div>

      {/* Bottom */}
      <RecentActivitiesCard />
    </div>
  );
}
