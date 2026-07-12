import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type StatAccent = 'violet' | 'emerald' | 'amber' | 'sky' | 'rose' | 'indigo';

const ACCENT_STYLES: Record<StatAccent, { tile: string; ring: string }> = {
  violet: { tile: 'from-violet-500 to-indigo-500', ring: 'hover:shadow-violet-500/10' },
  emerald: { tile: 'from-emerald-500 to-teal-500', ring: 'hover:shadow-emerald-500/10' },
  amber: { tile: 'from-amber-500 to-orange-500', ring: 'hover:shadow-amber-500/10' },
  sky: { tile: 'from-sky-500 to-blue-500', ring: 'hover:shadow-sky-500/10' },
  rose: { tile: 'from-rose-500 to-pink-500', ring: 'hover:shadow-rose-500/10' },
  indigo: { tile: 'from-indigo-500 to-violet-500', ring: 'hover:shadow-indigo-500/10' },
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  accent?: StatAccent;
  hint?: string;
  index?: number;
}

export function StatCard({ label, value, icon, accent = 'violet', hint, index = 0 }: StatCardProps) {
  const styles = ACCENT_STYLES[accent];
  return (
    <Card
      className={cn(
        'animate-fade-in-up border-transparent shadow-sm shadow-black/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg',
        styles.ring,
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <CardContent className="flex items-start justify-between p-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
        {icon && (
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm',
              styles.tile,
            )}
          >
            {icon}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
