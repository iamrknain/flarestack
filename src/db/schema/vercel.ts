import { pgTable, text, integer, boolean, timestamp, varchar, primaryKey } from 'drizzle-orm/pg-core';
import { user } from './user';
import { zoneConfigs } from './cloudflare';

export const vercelAccounts = pgTable('vercel_accounts', {
    id: varchar('id', { length: 255 }).primaryKey(),
    userId: varchar('user_id', { length: 255 }).notNull().references(() => user.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 255 }).notNull(),
    vercelToken: text('vercel_token').notNull(),
    vercelTeamId: varchar('vercel_team_id', { length: 255 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const vercelProjects = pgTable('vercel_projects', {
    id: varchar('id', { length: 255 }).primaryKey(),
    userId: varchar('user_id', { length: 255 }).notNull().references(() => user.id, { onDelete: 'cascade' }),
    vercelAccountRef: varchar('vercel_account_ref', { length: 255 }).notNull().references(() => vercelAccounts.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    vercelProjectId: varchar('vercel_project_id', { length: 255 }).notNull(),
    domain: varchar('domain', { length: 255 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const vercelUnderAttackRules = pgTable('vercel_under_attack_rules', {
    id: varchar('id', { length: 255 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull().default('Vercel Under Attack Rule'),
    vercelProjectRef: varchar('vercel_project_ref', { length: 255 }).notNull().references(() => vercelProjects.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 }).notNull().references(() => user.id, { onDelete: 'cascade' }),
    trafficSource: varchar('traffic_source', { length: 255 }).notNull().default('vercel_drain'),
    cfZoneConfigRef: varchar('cf_zone_config_ref', { length: 255 }).references(() => zoneConfigs.id, { onDelete: 'set null' }),
    rateLimitThreshold: integer('rate_limit_threshold').notNull().default(10000),
    autoOff: boolean('auto_off').notNull().default(false),
    offThreshold: integer('off_threshold'),
    windowSeconds: integer('window_seconds').notNull().default(300),
    sendNotification: boolean('send_notification').notNull().default(false),
    notifyEmails: text('notify_emails'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const vercelBotProtectionRules = pgTable('vercel_bot_protection_rules', {
    id: varchar('id', { length: 255 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull().default('Vercel Bot Protection Rule'),
    vercelProjectRef: varchar('vercel_project_ref', { length: 255 }).notNull().references(() => vercelProjects.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 }).notNull().references(() => user.id, { onDelete: 'cascade' }),
    trafficSource: varchar('traffic_source', { length: 255 }).notNull().default('vercel_drain'),
    cfZoneConfigRef: varchar('cf_zone_config_ref', { length: 255 }).references(() => zoneConfigs.id, { onDelete: 'set null' }),
    rateLimitThreshold: integer('rate_limit_threshold').notNull().default(10000),
    autoOff: boolean('auto_off').notNull().default(false),
    offThreshold: integer('off_threshold'),
    windowSeconds: integer('window_seconds').notNull().default(300),
    action: varchar('action', { length: 255 }).notNull().default('challenge'),
    sendNotification: boolean('send_notification').notNull().default(false),
    notifyEmails: text('notify_emails'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const vercelTrafficStats = pgTable('vercel_traffic_stats', {
    projectId: varchar('project_id', { length: 255 }).notNull(),
    minute: integer('minute').notNull(),          // Unix seconds, floor(ts / 60) * 60
    requestCount: integer('request_count').notNull().default(0),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
    primaryKey({ columns: [t.projectId, t.minute] })
]);
