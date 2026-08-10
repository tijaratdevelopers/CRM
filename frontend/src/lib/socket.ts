import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

// The production backend runs as a Vercel serverless function, which can't
// hold a persistent Socket.io connection — any attempt there just 404s.
// Rather than firing that doomed request at all, real-time push is disabled;
// notifications fall back to the periodic polling in useNotifications.ts.
// Flip this to true only once the backend runs somewhere that keeps a
// long-lived process alive (e.g. a dedicated Node host, not Vercel).
const SOCKET_ENABLED = false;

/** Connects (once) using the current Supabase access token; safe to call repeatedly. */
export function connectSocket(token: string): Socket | null {
  if (!SOCKET_ENABLED) return null;
  if (socket?.connected) return socket;

  socket = io((import.meta.env.VITE_SOCKET_URL as string) || undefined, {
    auth: { token },
    autoConnect: true,
    reconnection: false,
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
