import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LayoutGrid, Contact, Sparkles, Users, UserCog, CalendarClock, BellRing, PhoneCall, TrendingUp, TrendingDown } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/features/auth/AuthContext';
import { StatCard, type StatAccent } from '@/features/dashboard/StatCard';
import { DashboardCharts } from '@/features/dashboard/DashboardCharts';
import { DashboardHero } from '@/features/dashboard/DashboardHero';

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
}

async function fetchAdminSummary(): Promise<AdminSummary> {
  const { data } = await apiClient.get<AdminSummary>('/dashboard/summary');
  return data;
}

export function AdminDashboard() {
  const { profile } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: fetchAdminSummary,
  });

  const stats: { label: string; value: number | string; icon: ReactNode; accent: StatAccent }[] = [
    { label: 'Total Leads', value: data?.total_leads ?? '—', icon: <Contact className="h-5 w-5" />, accent: 'indigo' },
    { label: "Today's Leads", value: data?.todays_leads ?? '—', icon: <Sparkles className="h-5 w-5" />, accent: 'sky' },
    { label: 'Active Staff', value: data?.active_staff ?? '—', icon: <Users className="h-5 w-5" />, accent: 'violet' },
    { label: 'Team Leads', value: data?.team_leads ?? '—', icon: <UserCog className="h-5 w-5" />, accent: 'violet' },
    { label: 'Meetings Today', value: data?.meetings_today ?? '—', icon: <CalendarClock className="h-5 w-5" />, accent: 'sky' },
    { label: 'Pending Follow-ups', value: data?.pending_follow_ups ?? '—', icon: <BellRing className="h-5 w-5" />, accent: 'amber' },
    { label: 'Total Calls', value: data?.total_calls ?? '—', icon: <PhoneCall className="h-5 w-5" />, accent: 'sky' },
    { label: 'Won Leads', value: data?.won_leads ?? '—', icon: <TrendingUp className="h-5 w-5" />, accent: 'emerald' },
    { label: 'Lost Leads', value: data?.lost_leads ?? '—', icon: <TrendingDown className="h-5 w-5" />, accent: 'rose' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <DashboardHero
        eyebrow="Admin overview"
        title={`Welcome back${profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}`}
        subtitle="A full picture of every lead, staff member and team lead across the organization — updated in real time."
        gradient="bg-gradient-to-br from-indigo-600 via-violet-600 to-blue-600"
        icon={<LayoutGrid className="h-8 w-8" />}
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 9 }).map((_, i) => (
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
