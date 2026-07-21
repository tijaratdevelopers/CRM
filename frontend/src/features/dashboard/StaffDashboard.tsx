import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { UserCircle2, Contact, PhoneCall, CalendarClock, BellRing, Sparkles } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/features/auth/AuthContext';
import { StatCard, type StatAccent } from '@/features/dashboard/StatCard';
import { DashboardHero } from '@/features/dashboard/DashboardHero';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StaffSummary {
  my_leads: number;
  calls_today: number;
  meetings_today: number;
  pending_follow_ups: number;
  new_leads: number;
}

async function fetchStaffSummary(): Promise<StaffSummary> {
  const { data } = await apiClient.get<StaffSummary>('/dashboard/summary');
  return data;
}

const BAR_COLORS = ['#059669', '#0d9488', '#f5c445', '#e11d48', '#10b981'];

export function StaffDashboard() {
  const { profile } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: fetchStaffSummary,
  });

  const stats: { label: string; value: number | string; icon: ReactNode; accent: StatAccent; to: string }[] = [
    { label: 'My Leads', value: data?.my_leads ?? '—', icon: <Contact className="h-5 w-5" />, accent: 'violet', to: '/leads' },
    { label: 'Calls Today', value: data?.calls_today ?? '—', icon: <PhoneCall className="h-5 w-5" />, accent: 'sky', to: '/call-logs' },
    { label: 'Meetings Today', value: data?.meetings_today ?? '—', icon: <CalendarClock className="h-5 w-5" />, accent: 'amber', to: '/meetings' },
    { label: 'Pending Follow-ups', value: data?.pending_follow_ups ?? '—', icon: <BellRing className="h-5 w-5" />, accent: 'rose', to: '/follow-ups' },
    { label: 'New Leads', value: data?.new_leads ?? '—', icon: <Sparkles className="h-5 w-5" />, accent: 'emerald', to: '/leads' },
  ];

  const chartData = data
    ? [
        { name: 'My Leads', value: data.my_leads },
        { name: 'Calls', value: data.calls_today },
        { name: 'Meetings', value: data.meetings_today },
        { name: 'Follow-ups', value: data.pending_follow_ups },
        { name: 'New', value: data.new_leads },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <DashboardHero
        eyebrow="Tijarat Developers · My Desk"
        title={`Good to see you${profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}`}
        subtitle="Your leads arrive here automatically — call, follow up, and close. Today's pipeline is ready for you."
        gradient="bg-gradient-to-br from-amber-500 via-amber-600 to-emerald-700"
        icon={<UserCircle2 className="h-8 w-8" />}
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
            <StatCard key={stat.label} label={stat.label} value={stat.value} icon={stat.icon} accent={stat.accent} index={i} to={stat.to} />
          ))}
        </div>
      )}

      <Card className="animate-fade-in-up [animation-delay:300ms]">
        <CardHeader>
          <CardTitle>Today at a glance</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || chartData.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={entry.name} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
