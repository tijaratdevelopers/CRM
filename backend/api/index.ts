import { app } from '../src/app';

// Vercel deploys this as a serverless function; the rewrite in vercel.json
// sends every request here, and Express handles routing internally exactly
// as it does in the local `npm run dev` server (which uses src/server.ts
// instead — that entrypoint also starts Socket.io and the reminder poller,
// neither of which can run in a serverless function).
export default app;
