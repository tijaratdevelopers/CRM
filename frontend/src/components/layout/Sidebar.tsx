import * as React from 'react';
import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { navItems } from './navConfig';
import { cn } from '@/lib/utils';

const COLLAPSED_KEY = 'sidebar-collapsed';

type SidebarProps = {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

function BrandMark() {
  return (
    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-lg shadow-black/50 animate-pulse-glow">
      <img src="/logo-mark.png" alt="Tijarat Developers" className="h-full w-full object-cover" />
      <span className="sheen-overlay rounded-xl" />
    </div>
  );
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const { profile } = useAuth();
  const [collapsed, setCollapsed] = React.useState(
    () => localStorage.getItem(COLLAPSED_KEY) === '1',
  );

  if (!profile) return null;

  const items = navItems.filter((item) => item.roles.includes(profile.role));

  function toggleCollapsed() {
    setCollapsed((prev) => {
      localStorage.setItem(COLLAPSED_KEY, prev ? '0' : '1');
      return !prev;
    });
  }

  function renderNav(onNavigate?: () => void) {
    return (
      <nav className={cn('flex-1 space-y-1 overflow-y-auto', collapsed ? 'p-2' : 'p-3')}>
        {items.map((item, i) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            title={collapsed ? item.label : undefined}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center rounded-lg text-sm font-medium transition-all duration-200 animate-slide-in-left',
                collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2',
                isActive
                  ? 'bg-gradient-to-r from-amber-500/90 to-yellow-600/90 text-black shadow-md shadow-black/60'
                  : 'text-amber-50/60 hover:bg-amber-500/10 hover:text-white' +
                    (collapsed ? '' : ' hover:translate-x-0.5'),
              )
            }
            style={{ animationDelay: `${i * 40}ms` }}
          >
            {({ isActive }) => (
              <>
                {isActive && !collapsed && (
                  <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-amber-400 shadow-[0_0_8px_rgba(245,196,69,0.8)]" />
                )}
                <item.icon
                  className={cn(
                    'h-4 w-4 shrink-0 transition-transform duration-200',
                    isActive
                      ? 'text-black'
                      : 'text-amber-200/50 group-hover:scale-110 group-hover:text-amber-300',
                  )}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    );
  }

  function renderFooter() {
    if (collapsed) return null;
    return (
      <div className="border-t border-amber-900/20 p-3">
        <div className="relative overflow-hidden rounded-xl border border-amber-700/20 bg-black/30 px-3 py-2.5 text-xs">
          <p className="font-bold text-white">
            Tijarat <span className="text-gold">Developers</span> CRM
          </p>
          <p className="mt-0.5 text-amber-100/50">Grow every lead into business.</p>
          <span className="sheen-overlay" />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden shrink-0 transition-[width] duration-300 md:flex md:flex-col bg-sidebar-brand text-neutral-100',
          collapsed ? 'w-[68px]' : 'w-64',
        )}
      >
        <div
          className={cn(
            'flex h-16 items-center gap-2.5 border-b border-amber-900/20',
            collapsed ? 'justify-center px-2' : 'px-4',
          )}
        >
          {!collapsed && (
            <>
              <BrandMark />
              <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-sm font-extrabold tracking-tight text-white">
                  Tijarat <span className="text-gold">Developers</span>
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-200/60">
                  CRM Suite
                </span>
              </div>
            </>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? 'Open sidebar' : 'Close sidebar'}
            aria-label={collapsed ? 'Open sidebar' : 'Close sidebar'}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-amber-200/50 transition-colors hover:bg-amber-500/10 hover:text-amber-300"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
        {renderNav()}
        {renderFooter()}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <aside className="relative z-50 flex h-full w-64 flex-col bg-sidebar-brand text-neutral-100 shadow-xl animate-slide-in-left">
            <div className="flex h-16 items-center gap-2.5 border-b border-amber-900/20 px-4">
              <BrandMark />
              <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-sm font-extrabold tracking-tight text-white">
                  Tijarat <span className="text-gold">Developers</span>
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-200/60">
                  CRM Suite
                </span>
              </div>
              <button
                type="button"
                onClick={onMobileClose}
                aria-label="Close menu"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-amber-200/50 transition-colors hover:bg-amber-500/10 hover:text-amber-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {renderNav(onMobileClose)}
            {renderFooter()}
          </aside>
        </div>
      )}
    </>
  );
}
