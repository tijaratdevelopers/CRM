import http from 'http';
import { app } from './app';
import { env } from './config/env';
import { initSockets } from './sockets';
import { startReminderChecker } from './jobs/reminderChecker';

const server = http.createServer(app);

initSockets(server);
startReminderChecker();

server.listen(env.port, () => {
  console.log(`CRM backend listening on http://localhost:${env.port}`);
});
