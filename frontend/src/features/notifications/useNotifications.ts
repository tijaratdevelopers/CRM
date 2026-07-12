import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
    await apiClient.patch(`/notifications/${id}/read`);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }

  async function markAllRead() {
    await apiClient.patch('/notifications/read-all');
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }

  const unreadCount = (query.data ?? []).filter((n) => !n.is_read).length;

  return { ...query, unreadCount, markRead, markAllRead };
}
