import { NavLink } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { navItems } from './navConfig';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const { profile } = useAuth();
  if (!profile) return null;

  const items = navItems.filter((item) => item.roles.includes(profile.role));

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card md:flex md:flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 via-violet-600 to-sky-500 shadow-sm shadow-primary/30">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <span className="text-base font-extrabold tracking-tight text-foreground">Nexora CRM</span>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 text-white shadow-md shadow-primary/25'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <item.icon
                  className={cn(
                    'h-4 w-4 shrink-0 transition-transform',
                    isActive ? 'text-white' : 'text-muted-foreground group-hover:scale-110 group-hover:text-accent-foreground',
                  )}
                />
                <span className="truncate">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t p-3">
        <div className="rounded-lg bg-accent/60 px-3 py-2.5 text-xs text-accent-foreground">
          <p className="font-semibold">Nexora CRM v1.0</p>
          <p className="mt-0.5 text-muted-foreground">Built for growing sales teams</p>
        </div>
      </div>
    </aside>
  );
}
