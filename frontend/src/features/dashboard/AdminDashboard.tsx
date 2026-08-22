import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Contact, CalendarClock, BellRing, TrendingUp, Loader } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/features/auth/AuthContext';
import { useProject } from '@/features/projects/ProjectContext';
import { StatCard, type StatTone } from '@/features/dashboard/StatCard';
import { MonthlyLeadsChart, LeadSourcesChart, StaffPerformanceChart, ConversionRateCard } from '@/features/dashboard/DashboardCharts';
import { DashboardHero } from '@/features/dashboard/DashboardHero';
import { DashboardRobotShowcase } from '@/features/dashboard/DashboardRobotShowcase';
import { DashboardInProgressLeadsCard } from '@/features/dashboard/DashboardInProgressLeadsCard';
import { DashboardTasksOverview } from '@/features/dashboard/DashboardTasksOverview';
import { DashboardRecentActivity } from '@/features/dashboard/DashboardRecentActivity';

interface AdminSummary {
  total_leads: number;
  todays_leads: number;
  active_staff: number;
  team_leads: number;
  meetings_today: number;
  pending_follow_ups: number;
  total_calls: number;
  won_leads: number;
  lost_leads: number;
  meta_leads: number;
  whatsapp_leads: number;
  active_teams: number;
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
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-summary', selectedProjectId],
    queryFn: () => fetchAdminSummary(selectedProjectId),
  });

  // Just the 5 headline metrics, matching the reference design — the rest
  // of the operational numbers (staff, teams, calls, etc.) already live on
  // their own pages (/staff, /teams, /call-logs...), so they aren't repeated
  // here as well.
  const stats: { label: string; value: number | string; icon: ReactNode; tone: StatTone; to: string }[] = [
    { label: 'Total Leads', value: data?.total_leads ?? '—', icon: <Contact className="h-5 w-5" />, tone: 'orange', to: '/leads' },
    { label: 'In Progress Leads', value: data?.in_progress_leads ?? '—', icon: <Loader className="h-5 w-5" />, tone: 'blue', to: '/leads/in-progress' },
    { label: 'Meetings Today', value: data?.meetings_today ?? '—', icon: <CalendarClock className="h-5 w-5" />, tone: 'purple', to: '/meetings' },
    { label: 'Pending Follow-ups', value: data?.pending_follow_ups ?? '—', icon: <BellRing className="h-5 w-5" />, tone: 'red', to: '/follow-ups' },
    { label: 'Won Leads', value: data?.won_leads ?? '—', icon: <TrendingUp className="h-5 w-5" />, tone: 'green', to: '/leads' },
  ];

  const maxValue = Math.max(1, ...stats.map((s) => (typeof s.value === 'number' ? s.value : 0)));

  return (
    <div className="flex flex-col gap-6">
      <DashboardHero
        eyebrow="Tijarat Developers · Command Center"
        title={`Welcome back${profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''} — your business at a glance`}
        subtitle="Every lead from Meta Ads, WhatsApp and your campaigns — captured, auto-distributed to your teams, and tracked to the close. Nothing slips through."
        gradient="bg-gradient-to-br from-neutral-900 via-stone-800 to-amber-700"
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border bg-muted/40" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {stats.map((stat, i) => (
            <StatCard key={stat.label} label={stat.label} value={stat.value} icon={stat.icon} tone={stat.tone} index={i} to={stat.to} maxValue={maxValue} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4">
          <MonthlyLeadsChart />
          <DashboardInProgressLeadsCard delay={80} />
        </div>
        <DashboardRobotShowcase />
        <div className="flex flex-col gap-4">
          <LeadSourcesChart delay={80} />
          <DashboardTasksOverview delay={160} />
        </div>
      </div>

      <DashboardRecentActivity />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StaffPerformanceChart />
        <ConversionRateCard delay={80} />
      </div>
    </div>
  );
}
