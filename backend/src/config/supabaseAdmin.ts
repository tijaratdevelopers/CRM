import { createClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Service-role client: bypasses RLS. Only ever used server-side, after
 * requireRole()/requireAuth() middleware has already authorized the request.
 */
export const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
