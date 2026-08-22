import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Contact, Sparkles, Users, UsersRound, UserCog, CalendarClock, BellRing, PhoneCall, TrendingUp, TrendingDown, Megaphone, MessageCircle, Loader } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/features/auth/AuthContext';
import { useProject } from '@/features/projects/ProjectContext';
import { StatCard, type StatTone } from '@/features/dashboard/StatCard';
import { DashboardCharts } from '@/features/dashboard/DashboardCharts';
import { DashboardHero } from '@/features/dashboard/DashboardHero';
import { DashboardRobotShowcase } from '@/features/dashboard/DashboardRobotShowcase';

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

  const stats: { label: string; value: number | string; icon: ReactNode; tone: StatTone; to: string }[] = [
    { label: 'Total Leads', value: data?.total_leads ?? '—', icon: <Contact className="h-5 w-5" />, tone: 'orange', to: '/leads' },
    { label: "Today's Leads", value: data?.todays_leads ?? '—', icon: <Sparkles className="h-5 w-5" />, tone: 'gray', to: '/leads' },
    { label: 'Meta Leads', value: data?.meta_leads ?? '—', icon: <Megaphone className="h-5 w-5" />, tone: 'gray', to: '/leads' },
    { label: 'WhatsApp Leads', value: data?.whatsapp_leads ?? '—', icon: <MessageCircle className="h-5 w-5" />, tone: 'orange', to: '/whatsapp' },
    { label: 'Active Teams', value: data?.active_teams ?? '—', icon: <UsersRound className="h-5 w-5" />, tone: 'orange', to: '/teams' },
    { label: 'Active Staff', value: data?.active_staff ?? '—', icon: <Users className="h-5 w-5" />, tone: 'orange', to: '/staff' },
    { label: 'Team Leads', value: data?.team_leads ?? '—', icon: <UserCog className="h-5 w-5" />, tone: 'orange', to: '/team-leads' },
    { label: 'Meetings Today', value: data?.meetings_today ?? '—', icon: <CalendarClock className="h-5 w-5" />, tone: 'gray', to: '/meetings' },
    { label: 'Pending Follow-ups', value: data?.pending_follow_ups ?? '—', icon: <BellRing className="h-5 w-5" />, tone: 'orange', to: '/follow-ups' },
    { label: 'Total Calls', value: data?.total_calls ?? '—', icon: <PhoneCall className="h-5 w-5" />, tone: 'gray', to: '/call-logs' },
    { label: 'In Progress Leads', value: data?.in_progress_leads ?? '—', icon: <Loader className="h-5 w-5" />, tone: 'orange', to: '/leads/in-progress' },
    { label: 'Won Leads', value: data?.won_leads ?? '—', icon: <TrendingUp className="h-5 w-5" />, tone: 'orange', to: '/leads' },
    { label: 'Lost Leads', value: data?.lost_leads ?? '—', icon: <TrendingDown className="h-5 w-5" />, tone: 'red', to: '/leads' },
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

      <DashboardRobotShowcase />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 13 }).map((_, i) => (
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

      <DashboardCharts />
    </div>
  );
}
