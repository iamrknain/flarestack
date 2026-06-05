import { RuleHandler } from './interface';
import { AddIpToListRule } from './handlers/addIpToList';
import { UnderAttackModeRule } from './handlers/underAttackMode';
import { VercelUnderAttackModeRule } from './handlers/vercelUnderAttackMode';
import { VercelBotProtectionRule } from './handlers/vercelBotProtection';

// We map the database rule "type" string to its matching RuleHandler class.
//
// IMPORTANT — STATELESSNESS REQUIREMENT:
// These handler instances are singletons shared across ALL concurrent zone
// invocations in a single cron run (via Promise.allSettled in engine.ts).
// Every handler MUST be completely stateless (no instance variables mutated
// during execute()). All per-invocation state must live in local variables
// inside execute(). Violating this will cause subtle data-race bugs.
export const RuleHandlers: Record<string, RuleHandler> = {
    'add_ip_to_list': new AddIpToListRule(),
    'under_attack_mode': new UnderAttackModeRule(),
    // Future plugins:
    // 'js_challenge': new JsChallengeRule(),
    // 'block_asn': new BlockAsnRule(),
};

export const VercelRuleHandlers: Record<string, any> = {
    'vercel_under_attack_mode': new VercelUnderAttackModeRule(),
    'vercel_bot_protection': new VercelBotProtectionRule(),
};

