import { HttpError } from '../middleware/auth';

interface SupabaseResult<T> {
  data: T | null;
  error: { message: string } | null;
}

/** Unwraps a supabase-js response, throwing an HttpError(400) on failure. */
export function unwrap<T>(result: SupabaseResult<T>): T {
  if (result.error) {
    throw new HttpError(400, result.error.message);
  }
  return result.data as T;
}
