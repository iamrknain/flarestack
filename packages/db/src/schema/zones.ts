import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { user } from './auth';

export const cloudflareAccounts = sqliteTable('cloudflare_accounts', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => user.id),
    label: text('label').notNull(),
    cfAccountId: text('cf_account_id').notNull(),
    cfApiToken: text('cf_api_token').notNull(), // TODO: encrypt at rest
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const zoneConfigs = sqliteTable('zone_configs', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => user.id),
    cfAccountRef: text('cf_account_ref').notNull().references(() => cloudflareAccounts.id),
    name: text('name').notNull(),
    cfZoneId: text('cf_zone_id').notNull(),
    domain: text('domain'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ─── Add IP to list rules ─────────────────────────────────────────────────────────
// Rule: when an IP exceeds the threshold in the window, add it to a CF IP List.
export const addIpToListRules = sqliteTable('add_ip_to_list_rules', {
    id: text('id').primaryKey(),
    name: text('name').notNull().default('IP Mitigation Rule'),
    zoneConfigId: text('zone_config_id').notNull().references(() => zoneConfigs.id),
    userId: text('user_id').notNull().references(() => user.id),
    cfListId: text('cf_list_id').notNull(),
    cfListName: text('cf_list_name'),
    rateLimitThreshold: integer('rate_limit_threshold').notNull().default(10000),
    windowSeconds: integer('window_seconds').notNull().default(300),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ─── Under attack rules ──────────────────────────────────────────────────────────
// Rule: when request count exceeds threshold, trigger CF Under Attack mode.
export const underAttackRules = sqliteTable('under_attack_rules', {
    id: text('id').primaryKey(),
    name: text('name').notNull().default('Under Attack Toggle Rule'),
    zoneConfigId: text('zone_config_id').notNull().references(() => zoneConfigs.id),
    userId: text('user_id').notNull().references(() => user.id),
    rateLimitThreshold: integer('rate_limit_threshold').notNull().default(10000), // ON Threshold
    autoOff: integer('auto_off', { mode: 'boolean' }).notNull().default(false),   // Auto-Off toggle
    offThreshold: integer('off_threshold'),                                     // OFF Threshold (nullable)
    windowSeconds: integer('window_seconds').notNull().default(300),            // Analytics window
    recoveryLevel: text('recovery_level').notNull().default('medium'),          // 'essentially_off' | 'low' | 'medium' | 'high'
    sendNotification: integer('send_notification', { mode: 'boolean' }).notNull().default(false), // Notification toggle
    notifyEmails: text('notify_emails'),                                        // Comma-separated email list
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ─── Action logs (audit trail for all rules) ───────────────────────────────────
export const actionLogs = sqliteTable('action_logs', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    zoneConfigId: text('zone_config_id').notNull().references(() => zoneConfigs.id),
    ruleId: text('rule_id').notNull(), // Polymorphic: no foreign key to a specific rule table
    actionTaken: text('action_taken').notNull(), // 'IP_ADDED_TO_LIST', 'JS_CHALLENGE', etc.
    targetType: text('target_type').default('IP').notNull(), // e.g. 'IP', 'ASN', 'COUNTRY'
    targetValue: text('target_value').notNull(), // e.g. '192.168.1.1', 'AS15169'
    requestCount: integer('request_count'),
    metadata: text('metadata'), // JSON string containing rule-specific rollback needs (e.g. cfListId, cfListItemId)
    timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});

