export type Role = 'admin' | 'team_lead' | 'staff';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  teamLeadId: string | null;
  isActive: boolean;
}

export type LeadStatus =
  | 'new'
  | 'assigned'
  | 'contacted'
  | 'interested'
  | 'meeting_scheduled'
  | 'follow_up'
  | 'proposal_sent'
  | 'negotiation'
  | 'won'
  | 'lost'
  | 'closed';

export type LeadPriority = 'low' | 'medium' | 'high' | 'urgent';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      /** Raw request body bytes, captured by the express.json() verify hook — needed to check Meta's X-Hub-Signature-256 against the exact bytes it signed. */
      rawBody?: Buffer;
    }
  }
}
