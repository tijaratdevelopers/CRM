import { AuthUser } from '../types';
import { supabaseAdmin } from '../config/supabaseAdmin';

/**
 * Applies role-based row scoping to a supabase-js query builder in place.
 * Admin sees everything; Team Lead sees only rows under their team; Staff
 * sees only rows assigned directly to them.
 */
export function applyLeadScope<T extends { eq: (col: string, val: unknown) => T }>(
  query: T,
  user: AuthUser,
): T {
  if (user.role === 'team_lead') {
    return query.eq('assigned_team_lead_id', user.id);
  }
  if (user.role === 'staff') {
    return query.eq('assigned_staff_id', user.id);
  }
  return query;
}

export async function getTeamStaffIds(teamLeadId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('team_lead_id', teamLeadId);
  if (error) throw error;
  return (data ?? []).map((row) => row.id as string);
}

export interface StaffScopeFilter {
  column: string;
  ids: string[];
}

/**
 * Resolves the row-scoping filter for a table that has a `staff_id`-style
 * column (meetings, follow_ups, call_logs): staff scope to their own id,
 * team leads scope to their team's staff ids, admin gets `null` (no filter).
 *
 * IMPORTANT: this deliberately returns plain data (not a query builder).
 * Supabase's query builder is a thenable, so an `async` function that
 * returns the builder itself gets silently unwrapped by `await` (the
 * builder's own `.then()` fires and the query executes early) — the caller
 * would receive an already-resolved `{data, error}` instead of a chainable
 * builder, breaking any further `.order()`/`.eq()` calls. Returning a plain
 * `{column, ids}` (or `null`) avoids that trap: build your query, `await`
 * this function separately, then apply `.in(filter.column, filter.ids)`
 * yourself before/after any other `.order()`/`.eq()` chaining. Example:
 *
 *   const scope = await resolveStaffScope(user);
 *   let query = supabaseAdmin.from('meetings').select('*').order('meeting_date');
 *   if (scope) query = query.in(scope.column, scope.ids);
 */
export async function resolveStaffScope(
  user: AuthUser,
  staffColumn = 'staff_id',
): Promise<StaffScopeFilter | null> {
  if (user.role === 'staff') {
    return { column: staffColumn, ids: [user.id] };
  }
  if (user.role === 'team_lead') {
    const staffIds = await getTeamStaffIds(user.id);
    return { column: staffColumn, ids: [...staffIds, user.id] };
  }
  return null;
}
