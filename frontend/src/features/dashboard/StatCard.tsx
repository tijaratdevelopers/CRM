import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type StatTone = 'orange' | 'gray' | 'red';

const TONE_STYLES: Record<StatTone, { iconBg: string; barFill: string; borderHover: string }> = {
  orange: {
    iconBg: 'bg-[#C97B06] animate-pulse-glow-orange tone-orange',
    barFill: 'from-[#C97B06] to-[#F59E0B]',
    borderHover: 'hover:border-[#DA7706]/35',
  },
  gray: {
    iconBg: 'bg-[#222018]',
    barFill: 'from-[#C97B06] to-[#F59E0B]',
    borderHover: 'hover:border-[#DA7706]/35',
  },
  red: {
    iconBg: 'bg-[#C52020] animate-pulse-glow-red tone-red',
    barFill: 'from-[#C52020] to-[#EF4444]',
    borderHover: 'hover:border-[#C52020]/40',
  },
};

const reduceMotionQuery =
  typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

/** Animates a number from 0 to its target with an ease-out curve. */
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

function AnimatedValue({ value }: { value: string | number }) {
  const isNumber = typeof value === 'number';
  const counted = useCountUp(isNumber ? value : 0);
  return <>{isNumber ? counted : value}</>;
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  tone?: StatTone;
  hint?: string;
  index?: number;
  /** Route to open when the card is clicked (e.g. '/leads'). */
  to?: string;
  /** Largest value among this dashboard's cards — sizes the bottom progress bar. */
  maxValue?: number;
}

export function StatCard({ label, value, icon, tone = 'orange', hint, index = 0, to, maxValue = 1 }: StatCardProps) {
  const styles = TONE_STYLES[tone];
  const navigate = useNavigate();
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [barPct, setBarPct] = React.useState(0);

  React.useEffect(() => {
    if (typeof value !== 'number') return;
    const pct = Math.max(0, Math.min(100, (value / Math.max(maxValue, 1)) * 100));
    const timer = setTimeout(() => setBarPct(pct), 300 + index * 50);
    return () => clearTimeout(timer);
  }, [value, maxValue, index]);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const card = cardRef.current;
    if (!card || reduceMotionQuery?.matches) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rotY = (x / rect.width - 0.5) * 12;
    const rotX = (0.5 - y / rect.height) * 12;
    card.style.transition = 'border-color .3s ease, box-shadow .3s ease';
    card.style.transform = `perspective(800px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale3d(1.02,1.02,1.02)`;
    card.style.setProperty('--mx', `${x}px`);
    card.style.setProperty('--my', `${y}px`);
  }

  function handleMouseLeave() {
    const card = cardRef.current;
    if (!card) return;
    card.style.transition = 'transform .45s cubic-bezier(.22,1,.36,1), border-color .3s ease, box-shadow .3s ease';
    card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)';
  }

  return (
    <Card
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'group stat-tilt animate-fade-in-up rounded-[15px] border-border/80 shadow-sm shadow-black/[0.03] transition-[border-color,box-shadow] duration-300 hover:shadow-[0_18px_42px_rgba(0,0,0,0.14)] dark:hover:shadow-[0_18px_42px_rgba(0,0,0,0.55)]',
        styles.borderHover,
        tone === 'red' && 'is-red',
        to && 'cursor-pointer active:scale-[0.98]',
      )}
      style={{ animationDelay: `${index * 45}ms` }}
      onClick={to ? () => navigate(to) : undefined}
      role={to ? 'link' : undefined}
    >
      <CardContent className="stat-tilt-body flex flex-col p-[18px] pb-[14px]">
        {icon && (
          <div
            className={cn(
              'stat-icon-3d mb-3.5 flex h-[42px] w-[42px] items-center justify-center rounded-[11px] text-white shadow-md',
              styles.iconBg,
            )}
          >
            {icon}
          </div>
        )}
        <p className="max-w-[100px] text-[11.5px] leading-snug text-muted-foreground">{label}</p>
        <p className="mt-[9px] text-[34px] font-bold leading-none tracking-[-1.8px] tabular-nums text-foreground">
          <AnimatedValue value={value} />
        </p>
        {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
        <div className="mt-[14px] h-[2px] overflow-hidden rounded-full bg-foreground/10">
          <div
            className={cn(
              'h-full rounded-full bg-gradient-to-r transition-[width] duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
              styles.barFill,
            )}
            style={{ width: `${barPct}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
