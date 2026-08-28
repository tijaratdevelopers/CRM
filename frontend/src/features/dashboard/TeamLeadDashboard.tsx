import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { UserCog, Contact, BellRing, CalendarClock, Loader, Trophy, TrendingDown, CalendarDays } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/features/auth/AuthContext';
import { KpiCard } from '@/features/dashboard/KpiCard';
import { LeadsOverviewChart } from '@/features/dashboard/LeadsOverviewChart';
import { LeadsBySourceCard } from '@/features/dashboard/LeadsBySourceCard';
import { TasksOverviewCard } from '@/features/dashboard/TasksOverviewCard';
import { RecentActivitiesCard } from '@/features/dashboard/RecentActivitiesCard';
import { InProgressLeadsCard } from '@/features/dashboard/InProgressLeadsCard';
import { DashboardRobot } from '@/features/dashboard/DashboardRobot';

interface TeamLeadSummary {
  assigned_staff: number;
  assigned_leads: number;
  pending_follow_ups: number;
  meetings_today: number;
  won_leads: number;
  lost_leads: number;
  in_progress_leads: number;
}

async function fetchTeamLeadSummary(): Promise<TeamLeadSummary> {
  const { data } = await apiClient.get<TeamLeadSummary>('/dashboard/summary');
  return data;
}

export function TeamLeadDashboard() {
  const { profile } = useAuth();
  const { data } = useQuery({ queryKey: ['dashboard-summary'], queryFn: fetchTeamLeadSummary });
  const firstName = profile?.full_name ? profile.full_name.split(' ')[0] : 'there';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Hi, {firstName} <span className="inline-block animate-float">👋</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Here&apos;s your team today.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4 text-primary" />
          {format(new Date(), 'MMMM d, yyyy')}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Assigned Leads" value={data?.assigned_leads ?? '—'} icon={<Contact className="h-5 w-5" />} tone="blue" to="/leads" index={0} />
        <KpiCard label="In Progress Leads" value={data?.in_progress_leads ?? '—'} icon={<Loader className="h-5 w-5" />} tone="purple" to="/leads/in-progress" index={1} />
        <KpiCard label="Meetings Today" value={data?.meetings_today ?? '—'} icon={<CalendarClock className="h-5 w-5" />} tone="blue" to="/meetings" index={2} />
        <KpiCard label="Follow-ups Due" value={data?.pending_follow_ups ?? '—'} icon={<BellRing className="h-5 w-5" />} tone="red" to="/follow-ups" index={3} />
        <KpiCard label="Won Leads" value={data?.won_leads ?? '—'} icon={<Trophy className="h-5 w-5" />} tone="green" to="/leads" index={4} />
      </div>

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

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Assigned Staff" value={data?.assigned_staff ?? '—'} icon={<UserCog className="h-5 w-5" />} tone="gray" to="/staff" />
        <KpiCard label="Lost Leads" value={data?.lost_leads ?? '—'} icon={<TrendingDown className="h-5 w-5" />} tone="red" to="/leads" />
      </div>

      <RecentActivitiesCard />
    </div>
  );
}
