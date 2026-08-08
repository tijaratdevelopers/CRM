import { formatDistanceToNow } from 'date-fns';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotifications } from './useNotifications';

export function NotificationBell() {
  const { data: notifications, unreadCount, markRead, markAllRead } = useNotifications();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge variant="destructive" className="absolute -right-1 -top-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <button className="text-xs text-primary hover:underline" onClick={() => markAllRead()}>
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {!notifications?.length && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">No notifications yet</div>
        )}
        <div className="max-h-96 overflow-y-auto">
          {notifications?.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="flex flex-col items-start gap-0.5 whitespace-normal"
              onClick={() => !n.is_read && markRead(n.id)}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className={n.is_read ? 'font-normal' : 'font-semibold'}>{n.title}</span>
                {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
              </div>
              {n.body && <span className="text-xs text-muted-foreground">{n.body}</span>}
              <span className="text-[11px] text-muted-foreground">
                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
              </span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
