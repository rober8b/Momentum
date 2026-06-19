import 'server-only';
import { db, schema } from '@/lib/db';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'signup'
  | 'api_token_created'
  | 'api_token_revoked'
  | 'api_import_projects'
  | 'api_import_assignments'
  | 'api_import_workblocks'
  | 'api_import_community'
  | 'api_import_freelance'
  | 'api_import_build'
  | 'setup_completed'
  | 'settings_updated'
  | 'oauth_login'
  | 'oauth_signup'
  | 'oauth_account_linked'
  | 'oauth_account_unlinked'
  | 'sample_data_loaded'
  | 'sample_data_removed'
  | 'billing_checkout_created'
  | 'billing_portal_opened'
  | 'billing_subscription_activated'
  | 'billing_subscription_canceled'
  | 'billing_subscription_past_due'
  | 'billing_subscription_revoked'
  | 'admin_user_activated'
  | 'admin_user_deactivated'
  | 'admin_user_role_changed';

export interface LogAuditParams {
  userId: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Record an audit event. Never throws — failures are logged to stderr so they
 * don't block the operation that triggered the event.
 */
export function logAudit(params: LogAuditParams): void {
  db.insert(schema.auditLog)
    .values({
      user_id: params.userId ?? undefined,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      metadata: params.metadata ?? {},
    })
    .catch((err) => console.error('[audit]', err));
}
