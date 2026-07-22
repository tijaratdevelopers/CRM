import { useNavigate } from 'react-router-dom';
import { LogOut, Menu, User } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { GlobalSearch } from './GlobalSearch';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  team_lead: 'Team Lead',
  staff: 'Staff',
};

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const initials = profile?.full_name
    ?.split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b bg-card/80 px-4 backdrop-blur-md">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <GlobalSearch />
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent">
            <Avatar className="h-7 w-7 ring-2 ring-emerald-500/30 transition-transform hover:scale-105">
              <AvatarFallback className="bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-800 text-amber-200">
                {initials || <User className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>
            <span className="hidden flex-col items-start text-left sm:flex">
              <span className="font-medium leading-tight">{profile?.full_name}</span>
              <Badge variant="secondary" className="px-1 py-0 text-[10px] leading-tight">
                {profile ? ROLE_LABEL[profile.role] : ''}
              </Badge>
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{profile?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
