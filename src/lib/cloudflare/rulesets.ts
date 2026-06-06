import { CloudflareApiBase } from '~/lib/cloudflare/base';

export interface CfRule {
    id: string;
    version?: string | number;
    action: string;
    expression: string;
    description?: string;
    last_updated?: string;
    ref?: string;
    enabled: boolean;
    action_parameters?: Record<string, any>;
}

export interface CfRuleset {
    id: string;
    name: string;
    description?: string;
    kind: 'zone' | 'custom' | 'root';
    phase: string;
    version?: string;
    last_updated?: string;
    rules?: CfRule[];
}

export class RulesetsApi extends CloudflareApiBase {
    /**
     * List all rulesets for a zone.
     */
    async getRulesets(zoneId: string): Promise<CfRuleset[]> {
        return this.fetchRest<CfRuleset[]>(`/zones/${zoneId}/rulesets`);
    }

    /**
     * Get a specific ruleset (including the rules).
     */
    async getRuleset(zoneId: string, rulesetId: string): Promise<CfRuleset> {
        return this.fetchRest<CfRuleset>(`/zones/${zoneId}/rulesets/${rulesetId}`);
    }

    /**
     * Update a specific rule inside a ruleset.
     * Extracts and merges the modified fields with the existing rule definition.
     */
    async updateRule(
        zoneId: string,
        rulesetId: string,
        ruleId: string,
        updates: {
            action?: string;
            expression?: string;
            description?: string;
            enabled?: boolean;
            action_parameters?: Record<string, any>;
        }
    ): Promise<CfRule> {
        // 1. Fetch current ruleset to locate the existing rule definition
        const ruleset = await this.getRuleset(zoneId, rulesetId);
        const existingRule = ruleset.rules?.find((r) => r.id === ruleId);

        if (!existingRule) {
            throw new Error(`Rule ${ruleId} not found in ruleset ${rulesetId}`);
        }

        // 2. Merge changes with existing fields
        const mergedRule = {
            action: updates.action ?? existingRule.action,
            expression: updates.expression ?? existingRule.expression,
            description: updates.description ?? existingRule.description,
            enabled: updates.enabled !== undefined ? updates.enabled : existingRule.enabled,
            ...(existingRule.action_parameters || updates.action_parameters
                ? { action_parameters: updates.action_parameters ?? existingRule.action_parameters }
                : {}),
        };

        // 3. Perform PATCH
        return this.fetchRest<CfRule>(
            `/zones/${zoneId}/rulesets/${rulesetId}/rules/${ruleId}`,
            {
                method: 'PATCH',
                body: JSON.stringify(mergedRule),
            }
        );
    }
}
