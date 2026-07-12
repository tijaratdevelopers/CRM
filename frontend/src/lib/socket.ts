import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

/** Connects (once) using the current Supabase access token; safe to call repeatedly. */
export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket;

  socket = io((import.meta.env.VITE_SOCKET_URL as string) || undefined, {
    auth: { token },
    autoConnect: true,
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}
