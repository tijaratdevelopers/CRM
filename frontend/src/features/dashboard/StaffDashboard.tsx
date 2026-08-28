import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Contact, PhoneCall, CalendarClock, BellRing, Sparkles, Loader, CalendarDays } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/features/auth/AuthContext';
import { KpiCard } from '@/features/dashboard/KpiCard';
import { InProgressLeadsCard } from '@/features/dashboard/InProgressLeadsCard';
import { TasksOverviewCard } from '@/features/dashboard/TasksOverviewCard';
import { DashboardRobot } from '@/features/dashboard/DashboardRobot';
import { Card } from '@/components/ui/card';
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

const BAR_COLORS = ['#38bdf8', '#0ea5e9', '#8b5cf6', '#f43f5e', '#22c55e', '#6366f1'];

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
    <Card className="neon-panel animate-fade-in-up rounded-2xl p-5">
      <h3 className="mb-3 text-base font-semibold text-foreground">Today&apos;s Remarks</h3>
      <p className="text-sm text-muted-foreground">
        Optional — add a short note about today (issues, blockers, anything worth flagging). This shows up on the
        admin&apos;s Daily Sales Report.
      </p>
      <Textarea
        className="mt-3"
        placeholder="e.g. Client at Plot 12 asked for a price revision, following up tomorrow…"
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
        disabled={noteQuery.isLoading}
      />
      <div className="mt-3">
        <Button
          size="sm"
          disabled={!remarks.trim() || saveMutation.isPending || noteQuery.isLoading}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? 'Saving…' : 'Save remarks'}
        </Button>
      </div>
    </Card>
  );
}

export function StaffDashboard() {
  const { profile } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['dashboard-summary'], queryFn: fetchStaffSummary });
  const firstName = profile?.full_name ? profile.full_name.split(' ')[0] : 'there';

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
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Good to see you, {firstName} <span className="inline-block animate-float">👋</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Today&apos;s pipeline is ready for you.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4 text-primary" />
          {format(new Date(), 'MMMM d, yyyy')}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="My Leads" value={data?.my_leads ?? '—'} icon={<Contact className="h-5 w-5" />} tone="blue" to="/leads" index={0} />
        <KpiCard label="Calls Today" value={data?.calls_today ?? '—'} icon={<PhoneCall className="h-5 w-5" />} tone="gray" to="/call-logs" index={1} />
        <KpiCard label="Meetings Today" value={data?.meetings_today ?? '—'} icon={<CalendarClock className="h-5 w-5" />} tone="blue" to="/meetings" index={2} />
        <KpiCard label="Follow-ups Due" value={data?.pending_follow_ups ?? '—'} icon={<BellRing className="h-5 w-5" />} tone="red" to="/follow-ups" index={3} />
        <KpiCard label="New Leads" value={data?.new_leads ?? '—'} icon={<Sparkles className="h-5 w-5" />} tone="purple" to="/leads" index={4} />
        <KpiCard label="In Progress" value={data?.in_progress_leads ?? '—'} icon={<Loader className="h-5 w-5" />} tone="green" to="/leads/in-progress" index={5} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.2fr_1fr]">
        <div className="flex flex-col gap-5">
          <Card className="neon-panel animate-fade-in-up rounded-2xl p-5">
            <h3 className="mb-4 text-base font-semibold text-foreground">Today at a glance</h3>
            {isLoading || chartData.length === 0 ? (
              <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">Loading…</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--secondary) / 0.4)' }}
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={entry.name} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
          <InProgressLeadsCard />
        </div>
        <div className="order-first flex min-h-[460px] items-stretch justify-center xl:order-none">
          <DashboardRobot />
        </div>
        <div className="flex flex-col gap-5">
          <TasksOverviewCard />
          <TodaysRemarksCard />
        </div>
      </div>
    </div>
  );
}
