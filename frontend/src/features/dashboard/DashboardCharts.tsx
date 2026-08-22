import type * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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

function ChartCard({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {
  return (
    <Card className="animate-fade-in-up transition-shadow hover:shadow-md" style={{ animationDelay: `${delay}ms` }}>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
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
  return (
    <ChartCard title="Leads Overview" delay={delay}>
      {isLoading ? (
        <LoadingState />
      ) : isError || !data || data.monthlyLeads.length === 0 ? (
        <EmptyState message="No leads yet" />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data.monthlyLeads}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="count"
              name="Leads"
              stroke="#f59e0b"
              strokeWidth={3}
              dot={{ r: 3, fill: '#f59e0b' }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function LeadSourcesChart({ delay = 0 }: { delay?: number }) {
  const { data, isLoading, isError } = useDashboardChartsQuery();
  return (
    <ChartCard title="Leads by Source" delay={delay}>
      {isLoading ? (
        <LoadingState />
      ) : isError || !data || data.leadSources.length === 0 ? (
        <EmptyState message="No lead sources yet" />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Pie
              data={data.leadSources}
              dataKey="count"
              nameKey="source"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={90}
              label={(entry) => `${entry.source}: ${entry.count}`}
            >
              {data.leadSources.map((entry, index) => (
                <Cell key={entry.source} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
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
