import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/apiClient';
import { getSocket } from '@/lib/socket';
import type { Notification } from '@/types';

export function useNotifications() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await apiClient.get<Notification[]>('/notifications')).data,
    refetchInterval: 60_000,
  });

  React.useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    function handleNew() {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }

    socket.on('notification:new', handleNew);
    return () => {
      socket.off('notification:new', handleNew);
    };
  }, [queryClient]);

  async function markRead(id: string) {
    queryClient.setQueryData<Notification[]>(['notifications'], (prev) =>
      prev?.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    try {
      await apiClient.patch(`/notifications/${id}/read`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to mark notification as read');
    } finally {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  }

  async function markAllRead() {
    queryClient.setQueryData<Notification[]>(['notifications'], (prev) =>
      prev?.map((n) => ({ ...n, is_read: true })),
    );
    try {
      await apiClient.patch('/notifications/read-all');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to mark all notifications as read');
    } finally {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  }

  const unreadCount = (query.data ?? []).filter((n) => !n.is_read).length;

  return { ...query, unreadCount, markRead, markAllRead };
}
