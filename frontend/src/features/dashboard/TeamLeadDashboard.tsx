import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UsersRound, UserCog, Contact, BellRing, CalendarClock, TrendingUp, TrendingDown } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/features/auth/AuthContext';
import { StatCard, type StatAccent } from '@/features/dashboard/StatCard';
import { DashboardCharts } from '@/features/dashboard/DashboardCharts';
import { DashboardHero } from '@/features/dashboard/DashboardHero';

interface TeamLeadSummary {
  assigned_staff: number;
  assigned_leads: number;
  pending_follow_ups: number;
  meetings_today: number;
  won_leads: number;
  lost_leads: number;
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

  const stats: { label: string; value: number | string; icon: ReactNode; accent: StatAccent }[] = [
    { label: 'Assigned Staff', value: data?.assigned_staff ?? '—', icon: <UserCog className="h-5 w-5" />, accent: 'emerald' },
    { label: 'Assigned Leads', value: data?.assigned_leads ?? '—', icon: <Contact className="h-5 w-5" />, accent: 'sky' },
    { label: 'Pending Follow-ups', value: data?.pending_follow_ups ?? '—', icon: <BellRing className="h-5 w-5" />, accent: 'amber' },
    { label: "Today's Meetings", value: data?.meetings_today ?? '—', icon: <CalendarClock className="h-5 w-5" />, accent: 'violet' },
    { label: 'Won Leads', value: data?.won_leads ?? '—', icon: <TrendingUp className="h-5 w-5" />, accent: 'emerald' },
    { label: 'Lost Leads', value: data?.lost_leads ?? '—', icon: <TrendingDown className="h-5 w-5" />, accent: 'rose' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <DashboardHero
        eyebrow="Team lead overview"
        title={`Hi${profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''} — here's your team today`}
        subtitle="Track your assigned staff's leads, follow-ups and meetings, and see how the team is converting."
        gradient="bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600"
        icon={<UsersRound className="h-8 w-8" />}
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border bg-muted/40" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {stats.map((stat, i) => (
            <StatCard key={stat.label} label={stat.label} value={stat.value} icon={stat.icon} accent={stat.accent} index={i} />
          ))}
        </div>
      )}

      <DashboardCharts />
    </div>
  );
}
