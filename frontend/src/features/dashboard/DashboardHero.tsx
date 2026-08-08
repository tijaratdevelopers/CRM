import * as React from 'react';
import { cn } from '@/lib/utils';

interface DashboardHeroProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  gradient: string;
  icon: React.ReactNode;
}

export function DashboardHero({ eyebrow, title, subtitle, gradient, icon }: DashboardHeroProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl p-6 text-white shadow-lg animate-fade-in-up sm:p-8',
        gradient,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-10" />
      <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-amber-300/20 blur-2xl animate-float" />
      <div className="pointer-events-none absolute -bottom-16 left-1/3 h-56 w-56 rounded-full bg-white/10 blur-2xl animate-float animation-delay-2000" />
      <span className="sheen-overlay rounded-2xl" />

      <div className="relative z-10 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/70">{eyebrow}</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-2 max-w-xl text-sm text-white/80">{subtitle}</p>
        </div>
        <div className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm sm:flex">
          {icon}
        </div>
      </div>
    </div>
  );
}
