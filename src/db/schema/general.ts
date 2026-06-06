import { pgTable, varchar, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './user';

export const activityLogs = pgTable('activity_logs', {
    id: varchar('id', { length: 255 }).primaryKey(),
    userId: varchar('user_id', { length: 255 }).notNull().references(() => user.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 50 }).notNull(), // 'cloudflare' | 'vercel' | etc.
    resourceId: varchar('resource_id', { length: 255 }),     // zoneConfigId or vercelProjectRef
    ruleId: varchar('rule_id', { length: 255 }).notNull(),
    actionTaken: varchar('action_taken', { length: 255 }).notNull(),
    targetType: varchar('target_type', { length: 255 }).default('IP').notNull(),
    targetValue: varchar('target_value', { length: 255 }).notNull(),
    requestCount: integer('request_count'),
    metadata: text('metadata'),
    timestamp: timestamp('timestamp').notNull(),
});
