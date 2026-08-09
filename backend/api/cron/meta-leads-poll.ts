import type { Request, Response } from 'express';
import { pollAllFormsForNewLeads } from '../../src/services/metaIntegration.service';

// Daily safety net (Vercel's Hobby plan only runs crons once a day) — the
// primary sync path is maybePollForNewLeads(), piggybacked on ordinary
// authenticated traffic every ~5 minutes. See metaIntegration.service.ts.
export default async function handler(_req: Request, res: Response) {
  const result = await pollAllFormsForNewLeads();
  res.status(200).json({ ok: true, ...result });
}
