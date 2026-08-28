import * as React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bot, LogOut, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { navItems, type NavItem } from './navConfig';
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

/**
 * NavLink's default matching treats `to` as a path prefix (so "/leads" would
 * stay highlighted on "/leads/in-progress" too, even though that has its own
 * nav entry). This picks the most specific match instead: a nav item is only
 * active if no OTHER nav item's path is a closer match for the current URL.
 */
function isItemActive(pathname: string, item: NavItem, allItems: NavItem[]): boolean {
  if (item.to === '/') return pathname === '/';
  if (pathname === item.to) return true;
  if (!pathname.startsWith(`${item.to}/`)) return false;
  return !allItems.some(
    (other) =>
      other.to !== item.to &&
      other.to.startsWith(`${item.to}/`) &&
      (pathname === other.to || pathname.startsWith(`${other.to}/`)),
  );
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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

  async function handleSignOut() {
    onMobileClose?.();
    await signOut();
    navigate('/login');
  }

  function renderSignOut() {
    return (
      <div className={cn('border-t border-sky-900/25', collapsed ? 'p-2' : 'p-3')}>
        <button
          type="button"
          onClick={handleSignOut}
          title={collapsed ? 'Sign out' : undefined}
          className={cn(
            'flex w-full items-center rounded-lg text-sm font-medium text-sky-50/60 transition-colors hover:bg-sky-500/10 hover:text-white',
            collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2',
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    );
  }

  function renderNav(onNavigate?: () => void) {
    return (
      <nav className={cn('space-y-1', collapsed ? 'p-2' : 'p-3')}>
        {items.map((item, i) => {
          const isActive = isItemActive(location.pathname, item, items);
          return (
            <Link
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              onClick={onNavigate}
              className={cn(
                'group relative flex items-center rounded-lg text-sm font-medium transition-all duration-200 animate-slide-in-left',
                collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2',
                isActive
                  ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/30'
                  : 'text-sky-50/60 hover:bg-sky-500/10 hover:text-white' +
                    (collapsed ? '' : ' hover:translate-x-0.5'),
              )}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {isActive && !collapsed && (
                <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-sky-300 shadow-[0_0_8px_rgba(56,189,248,0.9)]" />
              )}
              <item.icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-transform duration-200',
                  isActive
                    ? 'text-white'
                    : 'text-sky-200/50 group-hover:scale-110 group-hover:text-sky-300',
                )}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    );
  }

  function renderFooter() {
    if (collapsed) return null;
    return (
      <div className="border-t border-sky-900/25 p-3">
        <div className="relative overflow-hidden rounded-xl border border-sky-700/25 bg-sky-950/40 px-3 py-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg shadow-sky-500/30">
              <Bot className="h-4 w-4 text-white" />
            </span>
            <div className="leading-tight">
              <p className="font-bold text-white">AI Assistant</p>
              <p className="flex items-center gap-1 text-[10px] text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
                Online
              </p>
            </div>
          </div>
          <p className="mt-2 text-sky-100/60">Need help today? I&apos;m here to assist you.</p>
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
          'sticky top-0 hidden h-screen shrink-0 overflow-y-auto transition-[width] duration-300 md:flex md:flex-col bg-sidebar-brand text-neutral-100',
          collapsed ? 'w-[68px]' : 'w-64',
        )}
      >
        <div
          className={cn(
            'flex h-16 items-center gap-2.5 border-b border-sky-900/25',
            collapsed ? 'justify-center px-2' : 'px-4',
          )}
        >
          {!collapsed && (
            <>
              <BrandMark />
              <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-sm font-extrabold tracking-tight text-white">
                  Tijarat <span className="text-primary">Developers</span>
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-sky-200/60">
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
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sky-200/50 transition-colors hover:bg-sky-500/10 hover:text-sky-300"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
        {renderNav()}
        {renderSignOut()}
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
          <aside className="relative z-50 flex h-full w-64 flex-col overflow-y-auto bg-sidebar-brand text-neutral-100 shadow-xl animate-slide-in-left">
            <div className="flex h-16 items-center gap-2.5 border-b border-sky-900/25 px-4">
              <BrandMark />
              <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-sm font-extrabold tracking-tight text-white">
                  Tijarat <span className="text-primary">Developers</span>
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-sky-200/60">
                  CRM Suite
                </span>
              </div>
              <button
                type="button"
                onClick={onMobileClose}
                aria-label="Close menu"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sky-200/50 transition-colors hover:bg-sky-500/10 hover:text-sky-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {renderNav(onMobileClose)}
            {renderSignOut()}
            {renderFooter()}
          </aside>
        </div>
      )}
    </>
  );
}
