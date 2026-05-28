import { addIpToListRules, underAttackRules } from "@flarestack/db/src/schema/zones";

export type RuleType = "add_ip_to_list" | "js_challenge" | "block_country" | "under_attack_mode";

export interface RuleBaseConfig {
    type: RuleType;
    name: string;
    description: string;
    /**
     * The Drizzle SQLite table for this rule type.
     *
     * Typed as `any` because Drizzle table generics are computed via complex
     * internal generic chains and cannot be structurally typed from outside the
     * drizzle-orm package without causing type incompatibility errors.
     *
     * Expected shape: a Drizzle table with at minimum these columns:
     *   - `id`            (text, primary key)
     *   - `userId`        (text, FK to user)
     *   - `zoneConfigId`  (text, FK to zone)
     *   - `isActive`      (boolean)
     *
     * Keep column names consistent across all rule tables — mismatches will
     * produce runtime errors (not compile-time) due to this `any` escape hatch.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    table?: any;
}

export const RULES_MANIFEST: Record<RuleType, RuleBaseConfig> = {
    'add_ip_to_list': {
        type: 'add_ip_to_list',
        name: "Add IP to List",
        description: "Automatically adds IPs to a Cloudflare IP List once they exceed a defined request threshold.",
        table: addIpToListRules
    },
    'js_challenge': {
        type: 'js_challenge',
        name: "Dynamic JS Challenge",
        description: "Issues a JS Challenge to requests matching specific pattern-based signatures.",
        // table: jsChallengeRules (future)
    },
    'block_country': {
        type: 'block_country',
        name: "Geographic Block",
        description: "Blocks traffic originating from specific countries.",
        // table: countryBlockRules (future)
    },
    'under_attack_mode': {
        type: 'under_attack_mode',
        name: "Auto Under Attack Mode",
        description: "Automatically enables Cloudflare Under Attack Mode when traffic spikes, and disables it when traffic normalizes.",
        table: underAttackRules
    }
};
