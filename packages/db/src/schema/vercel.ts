import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { user } from './auth';

// ─── Vercel Accounts ─────────────────────────────────────────────────────────────
export const vercelAccounts = sqliteTable('vercel_accounts', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => user.id),
    label: text('label').notNull(),
    vercelToken: text('vercel_token').notNull(),
    vercelTeamId: text('vercel_team_id'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ─── Vercel Projects ──────────────────────────────────────────────────────────────
export const vercelProjects = sqliteTable('vercel_projects', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => user.id),
    vercelAccountRef: text('vercel_account_ref').notNull().references(() => vercelAccounts.id),
    name: text('name').notNull(),
    vercelProjectId: text('vercel_project_id').notNull(),
    domain: text('domain'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ─── Vercel Under Attack Rules ───────────────────────────────────────────────────
export const vercelUnderAttackRules = sqliteTable('vercel_under_attack_rules', {
    id: text('id').primaryKey(),
    name: text('name').notNull().default('Vercel Under Attack Rule'),
    vercelProjectRef: text('vercel_project_ref').notNull().references(() => vercelProjects.id),
    userId: text('user_id').notNull().references(() => user.id),
    rateLimitThreshold: integer('rate_limit_threshold').notNull().default(10000), // ON Threshold
    autoOff: integer('auto_off', { mode: 'boolean' }).notNull().default(false),   // Auto-Off toggle
    offThreshold: integer('off_threshold'),                                     // OFF Threshold (nullable)
    windowSeconds: integer('window_seconds').notNull().default(300),            // Analytics window
    sendNotification: integer('send_notification', { mode: 'boolean' }).notNull().default(false), // Notification toggle
    notifyEmails: text('notify_emails'),                                        // Comma-separated email list
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ─── Vercel Bot Protection Rules ──────────────────────────────────────────────────
export const vercelBotProtectionRules = sqliteTable('vercel_bot_protection_rules', {
    id: text('id').primaryKey(),
    name: text('name').notNull().default('Vercel Bot Protection Rule'),
    vercelProjectRef: text('vercel_project_ref').notNull().references(() => vercelProjects.id),
    userId: text('user_id').notNull().references(() => user.id),
    rateLimitThreshold: integer('rate_limit_threshold').notNull().default(10000), // ON Threshold
    autoOff: integer('auto_off', { mode: 'boolean' }).notNull().default(false),   // Auto-Off toggle
    offThreshold: integer('off_threshold'),                                     // OFF Threshold (nullable)
    windowSeconds: integer('window_seconds').notNull().default(300),            // Analytics window
    action: text('action').notNull().default('challenge'),                      // 'challenge' | 'deny' | 'log'
    sendNotification: integer('send_notification', { mode: 'boolean' }).notNull().default(false), // Notification toggle
    notifyEmails: text('notify_emails'),                                        // Comma-separated email list
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ─── Vercel Traffic Stats ─────────────────────────────────────────────────────────
export const vercelTrafficStats = sqliteTable('vercel_traffic_stats', {
    id: text('id').primaryKey(), // "projectId:minute"
    projectId: text('project_id').notNull(),
    minute: integer('minute').notNull(), // epoch seconds rounded to minute
    requestCount: integer('request_count').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
