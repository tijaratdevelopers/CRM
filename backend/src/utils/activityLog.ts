import { supabaseAdmin } from '../config/supabaseAdmin';

interface LogActivityInput {
  actorId: string;
  entityType: string;
  entityId: string;
  action: string;
  metadata?: Record<string, unknown>;
}

export async function logActivity(input: LogActivityInput) {
  const { error } = await supabaseAdmin.from('activity_logs').insert({
    actor_id: input.actorId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: input.action,
    metadata: input.metadata ?? {},
  });
  if (error) {
    console.error('Failed to write activity log', error);
  }
}
