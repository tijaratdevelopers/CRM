import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/card';
import { useDashboardCharts, type DashboardChartsData } from './dashboardApi';

const NAMED_COLORS: Record<string, string> = {
  whatsapp: '#22c55e',
  facebook: '#3b82f6',
  'meta ads': '#3b82f6',
  meta: '#3b82f6',
  instagram: '#a855f7',
  website: '#8b5cf6',
  web: '#8b5cf6',
  referral: '#f59e0b',
  google: '#f43f5e',
};
const FALLBACK = ['#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#f43f5e', '#64748b'];

function colorFor(name: string, i: number): string {
  return NAMED_COLORS[name.trim().toLowerCase()] ?? FALLBACK[i % FALLBACK.length];
}

export function LeadsBySourceCard({ mock }: { mock?: DashboardChartsData }) {
  const query = useDashboardCharts();
  const data = mock ?? query.data;
  const isLoading = mock ? false : query.isLoading;
  const isError = mock ? false : query.isError;
  const sources = data?.leadSources ?? [];
  const total = sources.reduce((sum, s) => sum + s.count, 0);
  const rows = sources
    .map((s, i) => ({ ...s, color: colorFor(s.source, i), pct: total > 0 ? (s.count / total) * 100 : 0 }))
    .sort((a, b) => b.count - a.count);

  return (
    <Card className="neon-panel animate-fade-in-up rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">Leads by Source</h3>
      </div>

      {isLoading ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">Loading…</div>
      ) : isError || rows.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">No sources yet</div>
      ) : (
        <div className="flex items-center gap-4">
          <div className="relative h-[160px] w-[160px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={rows} dataKey="count" nameKey="source" cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">
                  {rows.map((r) => (
                    <Cell key={r.source} fill={r.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-foreground">{total.toLocaleString()}</span>
              <span className="text-[10px] text-muted-foreground">leads</span>
            </div>
          </div>
          <ul className="min-w-0 flex-1 space-y-2">
            {rows.map((r) => (
              <li key={r.source} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{r.source}</span>
                <span className="font-semibold text-foreground">{Math.round(r.pct)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
