import { CloudflareClient } from '@flarestack/cloudflare';
import { ActionLogger } from '../lib/actions/logger';
import { CacheStore } from '@flarestack/db/src/cache';
import { addIpToListRules, underAttackRules } from '@flarestack/db/src/schema/zones';

// Typed rule rows per rule type — extend this union as new rule types are added.
export type AddIpToListRuleRow = typeof addIpToListRules.$inferSelect;
export type UnderAttackRuleRow = typeof underAttackRules.$inferSelect;
export type AnyRuleRow = AddIpToListRuleRow | UnderAttackRuleRow;

export interface ZoneConfig {
    id: string;
    userId: string;
    cfAccountRef: string;
    name: string;
    cfZoneId: string;
}

export interface RuleContext {
    zone: ZoneConfig;
    rule: AnyRuleRow; // Typed DB row. Cast to specific type inside handlers if needed.
    cf: CloudflareClient;
    actionLogger: ActionLogger;
    cacheStore: CacheStore;
    /** Pre-fetched flagged IPs from a batched GraphQL call. When present,
     *  the handler should skip its own analytics query. */
    prefetchedIps?: { ip: string; count: number }[];
    env?: any;
}

export interface RuleHandler {
    /**
     * Executes the specific logic for this rule (e.g., Check GraphQL -> Add to List).
     */
    execute: (context: RuleContext) => Promise<void>;
}
