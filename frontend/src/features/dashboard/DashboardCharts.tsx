import type * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { apiClient } from '@/lib/apiClient';
import { useProject } from '@/features/projects/ProjectContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MonthlyLeadsPoint {
  month: string;
  count: number;
}

interface LeadSourcePoint {
  source: string;
  count: number;
}

interface StaffPerformancePoint {
  staff: string;
  leadsWon: number;
}

export interface DashboardChartsData {
  monthlyLeads: MonthlyLeadsPoint[];
  leadSources: LeadSourcePoint[];
  staffPerformance: StaffPerformancePoint[];
  conversionRate: number;
}

// Fixed categorical palette, cycled by index. Chosen to stay legible on both
// light and dark chart surfaces (no pure black/white slices).
const PIE_COLORS = ['#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#6366f1'];

async function fetchDashboardCharts(projectId: string | null): Promise<DashboardChartsData> {
  const { data } = await apiClient.get<DashboardChartsData>('/dashboard/charts', {
    params: projectId ? { projectId } : undefined,
  });
  return data;
}

function ChartCard({
  title,
  children,
  delay = 0,
  badge,
}: {
  title: string;
  children: React.ReactNode;
  delay?: number;
  badge?: string;
}) {
  return (
    <Card className="animate-fade-in-up transition-shadow hover:shadow-md" style={{ animationDelay: `${delay}ms` }}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
        {badge && (
          <span className="rounded-full bg-amber-500 px-2.5 py-1 text-xs font-bold text-black">{badge}</span>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
}

function useDashboardChartsQuery() {
  const { selectedProjectId } = useProject();
  return useQuery({
    queryKey: ['dashboard-charts', selectedProjectId],
    queryFn: () => fetchDashboardCharts(selectedProjectId),
  });
}

export function MonthlyLeadsChart({ delay = 0 }: { delay?: number }) {
  const { data, isLoading, isError } = useDashboardChartsQuery();
  const points = data?.monthlyLeads ?? [];
  const last = points[points.length - 1];

  return (
    <ChartCard title="Leads Overview" delay={delay} badge={last ? last.count.toLocaleString() : undefined}>
      {isLoading ? (
        <LoadingState />
      ) : isError || !data || points.length === 0 ? (
        <EmptyState message="No leads yet" />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="leadsAreaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="count"
              name="Leads"
              stroke="#f59e0b"
              strokeWidth={3}
              fill="url(#leadsAreaFill)"
              dot={{ r: 3, fill: '#f59e0b' }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function LeadSourcesChart({ delay = 0 }: { delay?: number }) {
  const { data, isLoading, isError } = useDashboardChartsQuery();
  const sources = data?.leadSources ?? [];
  const total = sources.reduce((sum, s) => sum + s.count, 0);

  return (
    <ChartCard title="Leads by Source" delay={delay}>
      {isLoading ? (
        <LoadingState />
      ) : isError || !data || sources.length === 0 ? (
        <EmptyState message="No lead sources yet" />
      ) : (
        <div className="flex items-center gap-4">
          <ResponsiveContainer width="60%" height={220}>
            <PieChart>
              <Tooltip />
              <Pie data={sources} dataKey="count" nameKey="source" cx="50%" cy="50%" innerRadius={45} outerRadius={80}>
                {sources.map((entry, index) => (
                  <Cell key={entry.source} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-2">
            {sources.map((entry, index) => (
              <div key={entry.source} className="flex items-center gap-2 text-sm">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                />
                <span className="min-w-0 flex-1 truncate text-foreground">{entry.source}</span>
                <span className="shrink-0 font-semibold text-muted-foreground">
                  {total > 0 ? Math.round((entry.count / total) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  );
}

export function StaffPerformanceChart({ delay = 0 }: { delay?: number }) {
  const { data, isLoading, isError } = useDashboardChartsQuery();
  return (
    <ChartCard title="Staff Performance" delay={delay}>
      {isLoading ? (
        <LoadingState />
      ) : isError || !data || data.staffPerformance.length === 0 ? (
        <EmptyState message="No staff performance data yet" />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.staffPerformance}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="staff" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="leadsWon" name="Leads won" fill="#10b981" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

/** The original 4-chart grid, kept for dashboards that haven't moved to the
 * new 3-column (chart / robot / donut) layout. */
export function DashboardCharts() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <MonthlyLeadsChart />
      <LeadSourcesChart delay={80} />
      <StaffPerformanceChart delay={160} />
      <ConversionRateCard delay={240} />
    </div>
  );
}

export function ConversionRateCard({ delay = 0 }: { delay?: number }) {
  const { data, isLoading, isError } = useDashboardChartsQuery();
  return (
    <ChartCard title="Conversion Rate" delay={delay}>
      {isLoading ? (
        <LoadingState />
      ) : isError || !data ? (
        <EmptyState message="No conversion data yet" />
      ) : (
        <div className="flex h-[260px] flex-col items-center justify-center gap-4">
          <p className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 bg-clip-text text-6xl font-extrabold text-transparent">
            {data.conversionRate.toFixed(1)}%
          </p>
          <p className="text-xs text-muted-foreground">of leads converted to wins</p>
          <div className="h-2.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 bg-[length:200%_200%] animate-gradient-x"
              style={{ width: `${Math.min(100, Math.max(0, data.conversionRate))}%` }}
            />
          </div>
        </div>
      )}
    </ChartCard>
  );
}
