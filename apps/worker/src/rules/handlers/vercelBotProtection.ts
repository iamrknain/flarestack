import { drizzle } from 'drizzle-orm/d1';
import { eq, and, gte, sql } from 'drizzle-orm';
import { vercelTrafficStats } from '@flarestack/db/src/schema/vercel';
import { log } from '../../lib/log';

async function sendEmailNotification({
    env,
    to,
    subject,
    html
}: {
    env: any;
    to: string;
    subject: string;
    html: string;
}) {
    const apiKey = (env?.RESEND_API_KEY || '').trim();
    const fromEmail = (env?.RESEND_FROM || 'FlareStack <onboarding@resend.dev>').trim();

    if (!apiKey) {
        console.warn(`[FlareStack] Resend API Key is missing. Skipping email notification.`);
        return;
    }

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: fromEmail,
                to: to.split(',').map(e => e.trim()),
                subject,
                html,
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[FlareStack] Resend API error:`, errText);
        } else {
            log(`  [FlareStack] Notification email sent successfully to ${to}`);
        }
    } catch (err) {
        console.error(`[FlareStack] Failed to dispatch notification email:`, err);
    }
}

export class VercelBotProtectionRule {
    async execute({ project, rule, actionLogger, env }: {
        project: any;
        rule: any;
        actionLogger: any;
        env: any;
    }): Promise<void> {
        const db = drizzle(env.DB);
        const {
            rateLimitThreshold,
            autoOff,
            offThreshold,
            windowSeconds: ruleWindowSeconds,
            action = 'challenge',
            sendNotification,
            notifyEmails
        } = rule;

        // 1. Resolve total requests in the project from vercelTrafficStats
        const cutoff = Math.floor(Date.now() / 1000) - ruleWindowSeconds;
        const stats = await db
            .select({ count: sql<number>`sum(${vercelTrafficStats.requestCount})` })
            .from(vercelTrafficStats)
            .where(
                and(
                    eq(vercelTrafficStats.projectId, project.vercelProjectId),
                    gte(vercelTrafficStats.minute, cutoff)
                )
            )
            .get();

        const totalRequests = Number(stats?.count || 0);
        log(`  Vercel direct traffic: ${totalRequests} request(s) in the last ${ruleWindowSeconds}s.`);

        // 2. Fetch current Firewall config from Vercel
        const headers = {
            'Authorization': `Bearer ${project.vercelToken}`,
            'Content-Type': 'application/json'
        };
        const teamParam = project.vercelTeamId ? `?teamId=${project.vercelTeamId}` : '';
        const firewallUrl = `https://api.vercel.com/v1/security/firewall/config?projectId=${project.vercelProjectId}${teamParam}`;

        let currentActiveConfig: any = null;
        let isBotProtectionActive = false;
        let currentBotAction = 'challenge';
        try {
            const res = await fetch(firewallUrl, { headers });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Failed to fetch firewall config: ${res.statusText} - ${text}`);
            }
            currentActiveConfig = await res.json();
            isBotProtectionActive = !!currentActiveConfig.managedRules?.bot_protection?.active;
            currentBotAction = currentActiveConfig.managedRules?.bot_protection?.action || 'challenge';
            log(`  Vercel Bot Protection is currently: ${isBotProtectionActive ? 'ACTIVE' : 'INACTIVE'} (action: "${currentBotAction}").`);
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error(`  Failed to query firewall config from Vercel for project ${project.name}:`, errMsg);
            await actionLogger.logActions([{
                id: crypto.randomUUID(),
                userId: project.userId,
                vercelProjectRef: project.id,
                ruleId: rule.id,
                actionTaken: 'VERCEL_BOT_PROTECTION_ERROR',
                targetType: 'API_ERROR',
                targetValue: errMsg.substring(0, 100),
                requestCount: null,
                metadata: JSON.stringify({ error: errMsg }),
                timestamp: new Date()
            }]);
            return;
        }

        // Helper to update WAF config on Vercel
        const updateFirewallConfig = async (activate: boolean) => {
            const newConfig = { ...currentActiveConfig };
            if (!newConfig.managedRules) {
                newConfig.managedRules = {};
            }
            newConfig.managedRules.bot_protection = {
                active: activate,
                action: action
            };

            // Prune read-only fields
            const cleaned = {
                crs: newConfig.crs,
                managedRules: newConfig.managedRules,
                firewallEnabled: newConfig.firewallEnabled !== false, // default true
                rules: (newConfig.rules || []).map((r: any) => {
                    const { id, createdAt, updatedAt, ...rest } = r;
                    return rest;
                })
            };

            const putRes = await fetch(firewallUrl, {
                method: 'PUT',
                headers,
                body: JSON.stringify(cleaned)
            });

            if (!putRes.ok) {
                const text = await putRes.text();
                throw new Error(`Failed to update firewall config: ${text}`);
            }
        };

        // 3. Threshold logic
        if (totalRequests > rateLimitThreshold) {
            if (!isBotProtectionActive || currentBotAction !== action) {
                log(`  Traffic ${totalRequests} exceeded threshold ${rateLimitThreshold}. Enabling Vercel Bot Protection (action: ${action})!`);
                try {
                    await updateFirewallConfig(true);

                    // Log to action logs
                    await actionLogger.logActions([{
                        id: crypto.randomUUID(),
                        userId: project.userId,
                        vercelProjectRef: project.id,
                        ruleId: rule.id,
                        actionTaken: 'VERCEL_BOT_PROTECTION_ON',
                        targetType: 'PROJECT',
                        targetValue: project.name,
                        requestCount: totalRequests,
                        metadata: JSON.stringify({
                            triggerThreshold: rateLimitThreshold,
                            totalRequests,
                            action
                        }),
                        timestamp: new Date()
                    }]);
                    log(`  Successfully enabled Vercel Bot Protection for ${project.name}.`);

                    // Send email
                    if (sendNotification && notifyEmails) {
                        const subject = `[Alert] Vercel Bot Protection ACTIVATED for ${project.domain || project.name}`;
                        const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, -apple-system, sans-serif; background-color: #f8fafc; padding: 40px 20px; margin: 0;">
  <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 32px 40px; color: #ffffff;">
      <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.025em;">Security Alert: Vercel Bot Protection Enabled</h2>
      <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.9;">Project traffic has exceeded security thresholds.</p>
    </div>
    <div style="padding: 40px;">
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase;">Project</td>
          <td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: 700; font-size: 14px;">${project.name}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase;">Domain</td>
          <td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: 600; font-size: 14px;">${project.domain || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase;">Traffic Window</td>
          <td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: 600; font-size: 14px;">${ruleWindowSeconds}s</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase;">Current Traffic</td>
          <td style="padding: 8px 0; text-align: right; color: #d97706; font-weight: 800; font-size: 15px;">${totalRequests.toLocaleString()} reqs</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase;">Mitigation Action</td>
          <td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: 600; font-size: 14px; text-transform: capitalize;">${action}</td>
        </tr>
      </table>
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin-bottom: 24px; color: #92400e; font-size: 14px; font-weight: 500; line-height: 1.5;">
        Vercel Bot Protection has been programmatically enabled with the action: <strong>${action}</strong>.
      </div>
      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-bottom: 24px;" />
      <p style="margin: 0; font-size: 11px; color: #94a3b8; text-align: center;">This notification was sent automatically by FlareStack.</p>
    </div>
  </div>
</body>
</html>
                        `.trim();
                        await sendEmailNotification({ env, to: notifyEmails, subject, html });
                    }
                } catch (err) {
                    const errMsg = err instanceof Error ? err.message : String(err);
                    console.error(`  Failed to enable Vercel Bot Protection:`, errMsg);
                    await actionLogger.logActions([{
                        id: crypto.randomUUID(),
                        userId: project.userId,
                        vercelProjectRef: project.id,
                        ruleId: rule.id,
                        actionTaken: 'VERCEL_BOT_PROTECTION_ERROR',
                        targetType: 'API_ERROR',
                        targetValue: 'Activation failed',
                        requestCount: totalRequests,
                        metadata: JSON.stringify({ error: errMsg }),
                        timestamp: new Date()
                    }]);
                }
            } else {
                log(`  Vercel Bot Protection is already active with action "${action}". No action taken.`);
            }
        } else if (autoOff && typeof offThreshold === 'number' && totalRequests < offThreshold) {
            if (isBotProtectionActive) {
                log(`  Traffic ${totalRequests} dropped below recovery threshold ${offThreshold}. Disabling Vercel Bot Protection.`);
                try {
                    await updateFirewallConfig(false);

                    // Log to action logs
                    await actionLogger.logActions([{
                        id: crypto.randomUUID(),
                        userId: project.userId,
                        vercelProjectRef: project.id,
                        ruleId: rule.id,
                        actionTaken: 'VERCEL_BOT_PROTECTION_OFF',
                        targetType: 'PROJECT',
                        targetValue: project.name,
                        requestCount: totalRequests,
                        metadata: JSON.stringify({
                            offThreshold,
                            totalRequests
                        }),
                        timestamp: new Date()
                    }]);
                    log(`  Successfully disabled Vercel Bot Protection for ${project.name}.`);

                    // Send email
                    if (sendNotification && notifyEmails) {
                        const subject = `[Resolve] Vercel Bot Protection DEACTIVATED for ${project.domain || project.name}`;
                        const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, -apple-system, sans-serif; background-color: #f8fafc; padding: 40px 20px; margin: 0;">
  <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    <div style="background: linear-gradient(135deg, #10b981, #047857); padding: 32px 40px; color: #ffffff;">
      <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.025em;">Security Resolved: Traffic Normalized</h2>
      <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.9;">Project traffic has subsided below recovery thresholds.</p>
    </div>
    <div style="padding: 40px;">
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase;">Project</td>
          <td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: 700; font-size: 14px;">${project.name}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase;">Domain</td>
          <td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: 600; font-size: 14px;">${project.domain || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase;">Traffic Window</td>
          <td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: 600; font-size: 14px;">${ruleWindowSeconds}s</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase;">Current Traffic</td>
          <td style="padding: 8px 0; text-align: right; color: #10b981; font-weight: 800; font-size: 15px;">${totalRequests.toLocaleString()} reqs</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase;">Recovery Limit</td>
          <td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: 600; font-size: 14px;">${offThreshold.toLocaleString()} reqs</td>
        </tr>
      </table>
      <div style="background: #ecfdf5; border: 1px solid #d1fae5; border-radius: 8px; padding: 16px; margin-bottom: 24px; color: #065f46; font-size: 14px; font-weight: 500; line-height: 1.5;">
        Vercel Bot Protection has been programmatically disabled and WAF restored to normal.
      </div>
      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-bottom: 24px;" />
      <p style="margin: 0; font-size: 11px; color: #94a3b8; text-align: center;">This notification was sent automatically by FlareStack.</p>
    </div>
  </div>
</body>
</html>
                        `.trim();
                        await sendEmailNotification({ env, to: notifyEmails, subject, html });
                    }
                } catch (err) {
                    const errMsg = err instanceof Error ? err.message : String(err);
                    console.error(`  Failed to disable Vercel Bot Protection:`, errMsg);
                    await actionLogger.logActions([{
                        id: crypto.randomUUID(),
                        userId: project.userId,
                        vercelProjectRef: project.id,
                        ruleId: rule.id,
                        actionTaken: 'VERCEL_BOT_PROTECTION_ERROR',
                        targetType: 'API_ERROR',
                        targetValue: 'Deactivation failed',
                        requestCount: totalRequests,
                        metadata: JSON.stringify({ error: errMsg }),
                        timestamp: new Date()
                    }]);
                }
            } else {
                log(`  Traffic is normal and Vercel Bot Protection is already inactive.`);
            }
        } else {
            log(`  Traffic (${totalRequests}) in neutral range. No action taken.`);
        }
    }
}
