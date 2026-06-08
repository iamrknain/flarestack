import { pgTable, text, integer, boolean, timestamp, varchar, primaryKey } from 'drizzle-orm/pg-core';
import { user } from './user';

export const cloudflareAccounts = pgTable('cloudflare_accounts', {
    id: varchar('id', { length: 255 }).primaryKey(),
    userId: varchar('user_id', { length: 255 }).notNull().references(() => user.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 255 }).notNull(),
    cfAccountId: varchar('cf_account_id', { length: 255 }).notNull(),
    cfApiToken: text('cf_api_token').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const zoneConfigs = pgTable('zone_configs', {
    id: varchar('id', { length: 255 }).primaryKey(),
    userId: varchar('user_id', { length: 255 }).notNull().references(() => user.id, { onDelete: 'cascade' }),
    cfAccountRef: varchar('cf_account_ref', { length: 255 }).notNull().references(() => cloudflareAccounts.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    cfZoneId: varchar('cf_zone_id', { length: 255 }).notNull(),
    domain: varchar('domain', { length: 255 }),
    isActive: boolean('is_active').notNull().default(true),
    isArchived: boolean('is_archived').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const addIpToListRules = pgTable('add_ip_to_list_rules', {
    id: varchar('id', { length: 255 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull().default('IP Mitigation Rule'),
    zoneConfigId: varchar('zone_config_id', { length: 255 }).notNull().references(() => zoneConfigs.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 }).notNull().references(() => user.id, { onDelete: 'cascade' }),
    cfListId: varchar('cf_list_id', { length: 255 }).notNull(),
    cfListName: varchar('cf_list_name', { length: 255 }),
    rateLimitThreshold: integer('rate_limit_threshold').notNull().default(10000),
    windowSeconds: integer('window_seconds').notNull().default(300),
    isActive: boolean('is_active').notNull().default(true),
    cfApiTokenOverride: text('cf_api_token_override'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const underAttackRules = pgTable('under_attack_rules', {
    id: varchar('id', { length: 255 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull().default('Under Attack Toggle Rule'),
    zoneConfigId: varchar('zone_config_id', { length: 255 }).notNull().references(() => zoneConfigs.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 }).notNull().references(() => user.id, { onDelete: 'cascade' }),
    rateLimitThreshold: integer('rate_limit_threshold').notNull().default(10000),
    autoOff: boolean('auto_off').notNull().default(false),
    offThreshold: integer('off_threshold'),
    windowSeconds: integer('window_seconds').notNull().default(300),
    recoveryLevel: varchar('recovery_level', { length: 255 }).notNull().default('medium'),
    sendNotification: boolean('send_notification').notNull().default(false),
    notifyEmails: text('notify_emails'),
    isActive: boolean('is_active').notNull().default(true),
    cfApiTokenOverride: text('cf_api_token_override'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const wafRules = pgTable('waf_rules', {
    id: varchar('id', { length: 255 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull().default('WAF Mitigation Rule'),
    zoneConfigId: varchar('zone_config_id', { length: 255 }).notNull().references(() => zoneConfigs.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 }).notNull().references(() => user.id, { onDelete: 'cascade' }),
    cfRulesetId: varchar('cf_ruleset_id', { length: 255 }).notNull(),
    cfRuleId: varchar('cf_rule_id', { length: 255 }).notNull(),
    cfRuleName: varchar('cf_rule_name', { length: 255 }).notNull(),
    rateLimitThreshold: integer('rate_limit_threshold').notNull().default(10000),
    windowSeconds: integer('window_seconds').notNull().default(300),
    autoOff: boolean('auto_off').notNull().default(false),
    offThreshold: integer('off_threshold'),
    sendNotification: boolean('send_notification').notNull().default(false),
    notifyEmails: text('notify_emails'),
    isActive: boolean('is_active').notNull().default(true),
    cfApiTokenOverride: text('cf_api_token_override'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const entityCache = pgTable('entity_cache', {
    namespace: varchar('namespace', { length: 255 }).notNull(),
    key: varchar('key', { length: 255 }).notNull(),
    syncedAt: timestamp('synced_at').notNull(),
}, (t) => [
    primaryKey({ columns: [t.namespace, t.key] })
]);

/**
 * Full item payload cache for Cloudflare Lists.
 *
 * Primary key is (cfListId, value) where value = ip | asn.toString() | hostname.
 * This is the natural key — known immediately on write, no CF roundtrip needed.
 *
 * `id` (CF item UUID) is nullable: populated during fullSync, not on syncAfterAdd.
 * It is only needed when deleting items from CF via the dashboard.
 */
export const cfListItemsCache = pgTable('cf_list_items_cache', {
    cfListId:   varchar('cf_list_id', { length: 255 }).notNull(),
    value:      varchar('value',      { length: 2048 }).notNull(), // natural PK: ip | asn | hostname
    id:         varchar('id',         { length: 255 }),            // CF UUID — nullable until fullSync
    ip:         varchar('ip',         { length: 2048 }),
    asn:        integer('asn'),
    hostname:   varchar('hostname',   { length: 2048 }),
    comment:    text('comment'),
    createdOn:  timestamp('created_on'),
    modifiedOn: timestamp('modified_on'),
    syncedAt:   timestamp('synced_at').notNull(),
}, (t) => [
    primaryKey({ columns: [t.cfListId, t.value] })
]);
