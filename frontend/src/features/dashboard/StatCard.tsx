import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type StatAccent = 'violet' | 'emerald' | 'amber' | 'sky' | 'rose' | 'indigo';

const ACCENT_STYLES: Record<StatAccent, { tile: string; ring: string }> = {
  emerald: { tile: 'from-emerald-500 to-teal-700', ring: 'hover:shadow-emerald-500/20' },
  amber: { tile: 'from-amber-400 to-yellow-600', ring: 'hover:shadow-amber-500/20' },
  sky: { tile: 'from-teal-400 to-cyan-600', ring: 'hover:shadow-teal-500/20' },
  violet: { tile: 'from-emerald-600 to-green-800', ring: 'hover:shadow-emerald-600/20' },
  indigo: { tile: 'from-teal-600 to-emerald-800', ring: 'hover:shadow-teal-600/20' },
  rose: { tile: 'from-rose-500 to-red-700', ring: 'hover:shadow-rose-500/20' },
};

/** Animates a number from 0 to its target with an ease-out curve. */
function useCountUp(target: number, durationMs = 900): number {
  const [display, setDisplay] = React.useState(0);

  React.useEffect(() => {
    if (target === 0) {
      setDisplay(0);
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

function AnimatedValue({ value }: { value: string | number }) {
  const isNumber = typeof value === 'number';
  const counted = useCountUp(isNumber ? value : 0);
  return <>{isNumber ? counted : value}</>;
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  accent?: StatAccent;
  hint?: string;
  index?: number;
  /** Route to open when the card is clicked (e.g. '/leads'). */
  to?: string;
}

export function StatCard({ label, value, icon, accent = 'emerald', hint, index = 0, to }: StatCardProps) {
  const styles = ACCENT_STYLES[accent];
  const navigate = useNavigate();
  return (
    <Card
      className={cn(
        'group animate-fade-in-up border-transparent shadow-sm shadow-black/[0.03] transition-all duration-300 hover:-translate-y-1 hover:shadow-xl',
        styles.ring,
        to && 'cursor-pointer active:scale-[0.98]',
      )}
      style={{ animationDelay: `${index * 60}ms` }}
      onClick={to ? () => navigate(to) : undefined}
      role={to ? 'link' : undefined}
    >
      <CardContent className="flex items-start justify-between p-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tracking-tight text-foreground">
            <AnimatedValue value={value} />
          </p>
          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
        {icon && (
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3',
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
