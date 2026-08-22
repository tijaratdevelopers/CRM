import * as React from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { toast } from 'sonner';
import { Contact, PhoneCall, CalendarClock, BellRing, Sparkles, Loader } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/features/auth/AuthContext';
import { StatCard, type StatTone } from '@/features/dashboard/StatCard';
import { DashboardHero } from '@/features/dashboard/DashboardHero';
import { DashboardRobotShowcase } from '@/features/dashboard/DashboardRobotShowcase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface DailyNote {
  id: string;
  staff_id: string;
  note_date: string;
  remarks: string;
}

interface StaffSummary {
  my_leads: number;
  calls_today: number;
  meetings_today: number;
  pending_follow_ups: number;
  new_leads: number;
  in_progress_leads: number;
}

async function fetchStaffSummary(): Promise<StaffSummary> {
  const { data } = await apiClient.get<StaffSummary>('/dashboard/summary');
  return data;
}

const BAR_COLORS = ['#059669', '#0d9488', '#f5c445', '#e11d48', '#10b981', '#6366f1'];

function TodaysRemarksCard() {
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = React.useState('');

  const noteQuery = useQuery({
    queryKey: ['daily-note-mine'],
    queryFn: async () => {
      const { data } = await apiClient.get<DailyNote | null>('/daily-notes/me');
      return data;
    },
  });

  React.useEffect(() => {
    setRemarks(noteQuery.data?.remarks ?? '');
  }, [noteQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<DailyNote>('/daily-notes', { remarks: remarks.trim() });
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['daily-note-mine'], data);
      toast.success('Remarks saved');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card className="animate-fade-in-up [animation-delay:400ms]">
      <CardHeader>
        <CardTitle>Today's Remarks</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Optional — add a short note about today (issues, blockers, anything worth flagging). This shows up on
          the admin's Daily Sales Report.
        </p>
        <Textarea
          placeholder="e.g. Client at Plot 12 asked for a price revision, following up tomorrow…"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          disabled={noteQuery.isLoading}
        />
        <div>
          <Button
            size="sm"
            disabled={!remarks.trim() || saveMutation.isPending || noteQuery.isLoading}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save remarks'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function StaffDashboard() {
  const { profile } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: fetchStaffSummary,
  });

  const stats: { label: string; value: number | string; icon: ReactNode; tone: StatTone; to: string }[] = [
    { label: 'My Leads', value: data?.my_leads ?? '—', icon: <Contact className="h-5 w-5" />, tone: 'orange', to: '/leads' },
    { label: 'Calls Today', value: data?.calls_today ?? '—', icon: <PhoneCall className="h-5 w-5" />, tone: 'gray', to: '/call-logs' },
    { label: 'Meetings Today', value: data?.meetings_today ?? '—', icon: <CalendarClock className="h-5 w-5" />, tone: 'gray', to: '/meetings' },
    { label: 'Pending Follow-ups', value: data?.pending_follow_ups ?? '—', icon: <BellRing className="h-5 w-5" />, tone: 'orange', to: '/follow-ups' },
    { label: 'New Leads', value: data?.new_leads ?? '—', icon: <Sparkles className="h-5 w-5" />, tone: 'orange', to: '/leads' },
    { label: 'In Progress Leads', value: data?.in_progress_leads ?? '—', icon: <Loader className="h-5 w-5" />, tone: 'orange', to: '/leads/in-progress' },
  ];

  const maxValue = Math.max(1, ...stats.map((s) => (typeof s.value === 'number' ? s.value : 0)));

  const chartData = data
    ? [
        { name: 'My Leads', value: data.my_leads },
        { name: 'Calls', value: data.calls_today },
        { name: 'Meetings', value: data.meetings_today },
        { name: 'Follow-ups', value: data.pending_follow_ups },
        { name: 'New', value: data.new_leads },
        { name: 'In Progress', value: data.in_progress_leads },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <DashboardHero
        eyebrow="Tijarat Developers · My Desk"
        title={`Good to see you${profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}`}
        subtitle="Your leads arrive here automatically — call, follow up, and close. Today's pipeline is ready for you."
        gradient="bg-gradient-to-br from-amber-600 via-amber-700 to-neutral-900"
      />

      <DashboardRobotShowcase />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 6 }).map((_, i) => (
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

      <TodaysRemarksCard />
    </div>
  );
}
