import { NextFunction, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabaseAdmin';
import { AuthUser } from '../types';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

  if (!token) {
    throw new HttpError(401, 'Missing bearer token');
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) {
    throw new HttpError(401, 'Invalid or expired session');
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('id, email, full_name, role, team_lead_id, is_active')
    .eq('id', authData.user.id)
    .single();

  if (profileError || !profile) {
    throw new HttpError(403, 'No CRM profile found for this account');
  }

  if (!profile.is_active) {
    throw new HttpError(403, 'This account has been deactivated');
  }

  const user: AuthUser = {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role,
    teamLeadId: profile.team_lead_id,
    isActive: profile.is_active,
  };

  req.user = user;
  next();
}

export function requireRole(...roles: AuthUser['role'][]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new HttpError(401, 'Not authenticated');
    }
    if (!roles.includes(req.user.role)) {
      throw new HttpError(403, 'Insufficient permissions for this action');
    }
    next();
  };
}
