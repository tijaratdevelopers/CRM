import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format, parse } from 'date-fns';
import { Card } from '@/components/ui/card';
import { useDashboardCharts, type DashboardChartsData } from './dashboardApi';

function labelForMonth(month: string): string {
  try {
    return format(parse(month, 'yyyy-MM', new Date()), 'MMM');
  } catch {
    return month;
  }
}

export function LeadsOverviewChart({ mock }: { mock?: DashboardChartsData }) {
  const query = useDashboardCharts();
  const data = mock ?? query.data;
  const isLoading = mock ? false : query.isLoading;
  const isError = mock ? false : query.isError;
  const points = (data?.monthlyLeads ?? []).map((p) => ({ ...p, label: labelForMonth(p.month) }));
  const peak = points.reduce((max, p) => (p.count > max ? p.count : max), 0);

  return (
    <Card className="neon-panel animate-fade-in-up rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">Leads Overview</h3>
        <span className="rounded-lg border border-border bg-secondary/60 px-2.5 py-1 text-xs text-muted-foreground">
          Last 6 months
        </span>
      </div>

      {isLoading ? (
        <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">Loading…</div>
      ) : isError || points.length === 0 ? (
        <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">No leads yet</div>
      ) : (
        <div className="relative">
          {peak > 0 && (
            <span className="absolute right-2 top-0 z-10 rounded-md bg-gold px-2 py-0.5 text-xs font-semibold text-black shadow">
              {peak.toLocaleString()}
            </span>
          )}
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={points} margin={{ top: 16, right: 8, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="leadsArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--gold))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--gold))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} allowDecimals={false} width={48} />
              <Tooltip
                cursor={{ stroke: 'hsl(var(--gold))', strokeWidth: 1 }}
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 12,
                  fontSize: 12,
                  color: 'hsl(var(--foreground))',
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                name="Leads"
                stroke="hsl(var(--gold))"
                strokeWidth={3}
                fill="url(#leadsArea)"
                dot={{ r: 3, fill: 'hsl(var(--gold))', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
