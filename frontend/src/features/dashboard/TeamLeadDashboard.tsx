import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserCog, Contact, BellRing, CalendarClock, TrendingUp, TrendingDown, Loader } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/features/auth/AuthContext';
import { StatCard, type StatTone } from '@/features/dashboard/StatCard';
import { DashboardCharts } from '@/features/dashboard/DashboardCharts';
import { DashboardHero } from '@/features/dashboard/DashboardHero';

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
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: fetchTeamLeadSummary,
  });

  const stats: { label: string; value: number | string; icon: ReactNode; tone: StatTone; to: string }[] = [
    { label: 'Assigned Staff', value: data?.assigned_staff ?? '—', icon: <UserCog className="h-5 w-5" />, tone: 'gray', to: '/staff' },
    { label: 'Assigned Leads', value: data?.assigned_leads ?? '—', icon: <Contact className="h-5 w-5" />, tone: 'orange', to: '/leads' },
    { label: 'Pending Follow-ups', value: data?.pending_follow_ups ?? '—', icon: <BellRing className="h-5 w-5" />, tone: 'orange', to: '/follow-ups' },
    { label: "Today's Meetings", value: data?.meetings_today ?? '—', icon: <CalendarClock className="h-5 w-5" />, tone: 'gray', to: '/meetings' },
    { label: 'In Progress Leads', value: data?.in_progress_leads ?? '—', icon: <Loader className="h-5 w-5" />, tone: 'orange', to: '/leads/in-progress' },
    { label: 'Won Leads', value: data?.won_leads ?? '—', icon: <TrendingUp className="h-5 w-5" />, tone: 'orange', to: '/leads' },
    { label: 'Lost Leads', value: data?.lost_leads ?? '—', icon: <TrendingDown className="h-5 w-5" />, tone: 'red', to: '/leads' },
  ];

  const maxValue = Math.max(1, ...stats.map((s) => (typeof s.value === 'number' ? s.value : 0)));

  return (
    <div className="flex flex-col gap-6">
      <DashboardHero
        eyebrow="Tijarat Developers · Team Desk"
        title={`Hi${profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''} — here's your team today`}
        subtitle="Fresh leads land on your team automatically. Watch follow-ups, meetings and conversions move in real time."
        gradient="bg-gradient-to-br from-stone-900 via-neutral-800 to-yellow-700"
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 7 }).map((_, i) => (
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
