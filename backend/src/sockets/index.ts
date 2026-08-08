import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { env } from '../config/env';
import { supabaseAdmin } from '../config/supabaseAdmin';

let io: SocketIOServer | undefined;

export function initSockets(httpServer: HttpServer) {
  io = new SocketIOServer(httpServer, {
    cors: { origin: env.frontendUrl, credentials: true },
  });

  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('Missing auth token'));

      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data.user) return next(new Error('Invalid session'));

      socket.data.userId = data.user.id;
      next();
    } catch (err) {
      next(err instanceof Error ? err : new Error('Socket auth failed'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);

    socket.on('disconnect', () => {
      socket.leave(`user:${userId}`);
    });
  });

  return io;
}

/** Emit a notification payload to a specific user's connected sockets. */
export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}
