import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type KpiTone = 'blue' | 'purple' | 'red' | 'green' | 'gray';

const TONE: Record<KpiTone, string> = {
  blue: 'bg-sky-500/15 text-sky-400 ring-1 ring-inset ring-sky-500/30',
  purple: 'bg-violet-500/15 text-violet-400 ring-1 ring-inset ring-violet-500/30',
  red: 'bg-rose-500/15 text-rose-400 ring-1 ring-inset ring-rose-500/30',
  green: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/30',
  gray: 'bg-muted text-muted-foreground ring-1 ring-inset ring-border',
};

const reduceMotionQuery =
  typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

function useCountUp(target: number, durationMs = 1100): number {
  const [display, setDisplay] = React.useState(0);
  React.useEffect(() => {
    if (target === 0 || reduceMotionQuery?.matches) {
      setDisplay(target);
      return;
    }
    let frame: number;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);
  return display;
}

interface KpiCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone?: KpiTone;
  trend?: { value: number; label?: string } | null;
  to?: string;
  index?: number;
}

export function KpiCard({ label, value, icon, tone = 'blue', trend, to, index = 0 }: KpiCardProps) {
  const navigate = useNavigate();
  const isNumber = typeof value === 'number';
  const counted = useCountUp(isNumber ? value : 0);
  const trendUp = trend ? trend.value >= 0 : true;

  return (
    <Card
      onClick={to ? () => navigate(to) : undefined}
      role={to ? 'link' : undefined}
      className={cn(
        'neon-panel animate-fade-in-up rounded-2xl p-5 transition-transform duration-300 hover:-translate-y-0.5',
        to && 'cursor-pointer active:scale-[0.99]',
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', TONE[tone])}>
          {icon}
        </span>
      </div>
      <p className="mt-3 text-[32px] font-bold leading-none tracking-tight tabular-nums text-foreground">
        {isNumber ? counted.toLocaleString() : value}
      </p>
      {trend ? (
        <p
          className={cn(
            'mt-3 flex items-center gap-1 text-xs font-medium',
            trendUp ? 'text-emerald-400' : 'text-rose-400',
          )}
        >
          {trendUp ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          {Math.abs(trend.value).toFixed(1)}% {trend.label ?? 'this month'}
        </p>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">{' '}</p>
      )}
    </Card>
  );
}
