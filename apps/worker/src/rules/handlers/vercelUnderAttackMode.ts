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

export class VercelUnderAttackModeRule {
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

        // 2. Fetch current security status from Vercel
        const headers = {
            'Authorization': `Bearer ${project.vercelToken}`,
            'Content-Type': 'application/json'
        };
        const teamParam = project.vercelTeamId ? `?teamId=${project.vercelTeamId}` : '';
        const projectUrl = `https://api.vercel.com/v9/projects/${project.vercelProjectId}${teamParam}`;

        let currentAttackModeEnabled = false;
        try {
            const res = await fetch(projectUrl, { headers });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Failed to fetch project info: ${res.statusText} - ${text}`);
            }
            const json = await res.json() as any;
            currentAttackModeEnabled = !!json.security?.attackModeEnabled;
            log(`  Vercel Attack Mode is currently: ${currentAttackModeEnabled ? 'ENABLED' : 'DISABLED'}.`);
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error(`  Failed to query project status from Vercel for project ${project.name}:`, errMsg);
            await actionLogger.logActions([{
                id: crypto.randomUUID(),
                userId: project.userId,
                vercelProjectRef: project.id,
                ruleId: rule.id,
                actionTaken: 'VERCEL_ATTACK_MODE_ERROR',
                targetType: 'API_ERROR',
                targetValue: errMsg.substring(0, 100),
                requestCount: null,
                metadata: JSON.stringify({ error: errMsg }),
                timestamp: new Date()
            }]);
            return;
        }

        // 3. Threshold logic
        if (totalRequests > rateLimitThreshold) {
            if (!currentAttackModeEnabled) {
                log(`  Traffic ${totalRequests} exceeded threshold ${rateLimitThreshold}. Enabling Vercel Attack Mode!`);
                try {
                    const attackUrl = `https://api.vercel.com/v1/security/attack-mode${teamParam}`;
                    const activeUntil = Date.now() + 3600000;
                    const res = await fetch(attackUrl, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            projectId: project.vercelProjectId,
                            attackModeEnabled: true,
                            attackModeActiveUntil: activeUntil
                        })
                    });

                    if (!res.ok) {
                        const text = await res.text();
                        throw new Error(`Vercel API error: ${text}`);
                    }

                    // Log to action logs
                    await actionLogger.logActions([{
                        id: crypto.randomUUID(),
                        userId: project.userId,
                        vercelProjectRef: project.id,
                        ruleId: rule.id,
                        actionTaken: 'VERCEL_ATTACK_MODE_ON',
                        targetType: 'PROJECT',
                        targetValue: project.name,
                        requestCount: totalRequests,
                        metadata: JSON.stringify({
                            triggerThreshold: rateLimitThreshold,
                            totalRequests
                        }),
                        timestamp: new Date()
                    }]);
                    log(`  Successfully enabled Vercel Attack Mode for ${project.name}.`);

                    // Send email
                    if (sendNotification && notifyEmails) {
                        const subject = `[Alert] Vercel Auto Attack Mode ACTIVATED for ${project.domain || project.name}`;
                        const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, -apple-system, sans-serif; background-color: #f8fafc; padding: 40px 20px; margin: 0;">
  <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    <div style="background: linear-gradient(135deg, #e11d48, #be123c); padding: 32px 40px; color: #ffffff;">
      <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.025em;">Security Alert: Vercel Attack Mode Activated</h2>
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
          <td style="padding: 8px 0; text-align: right; color: #e11d48; font-weight: 800; font-size: 15px;">${totalRequests.toLocaleString()} reqs</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase;">Trigger Limit</td>
          <td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: 600; font-size: 14px;">${rateLimitThreshold.toLocaleString()} reqs</td>
        </tr>
      </table>
      <div style="background: #fff1f2; border: 1px solid #ffe4e6; border-radius: 8px; padding: 16px; margin-bottom: 24px; color: #9f1239; font-size: 14px; font-weight: 500; line-height: 1.5;">
        Vercel Attack Mode has been programmatically enabled to protect your application.
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
                    console.error(`  Failed to enable Vercel Attack Mode:`, errMsg);
                    await actionLogger.logActions([{
                        id: crypto.randomUUID(),
                        userId: project.userId,
                        vercelProjectRef: project.id,
                        ruleId: rule.id,
                        actionTaken: 'VERCEL_ATTACK_MODE_ERROR',
                        targetType: 'API_ERROR',
                        targetValue: 'Activation failed',
                        requestCount: totalRequests,
                        metadata: JSON.stringify({ error: errMsg }),
                        timestamp: new Date()
                    }]);
                }
            } else {
                log(`  Vercel Attack Mode is already enabled. No action taken.`);
            }
        } else if (autoOff && typeof offThreshold === 'number' && totalRequests < offThreshold) {
            if (currentAttackModeEnabled) {
                log(`  Traffic ${totalRequests} dropped below recovery threshold ${offThreshold}. Disabling Vercel Attack Mode.`);
                try {
                    const attackUrl = `https://api.vercel.com/v1/security/attack-mode${teamParam}`;
                    const res = await fetch(attackUrl, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            projectId: project.vercelProjectId,
                            attackModeEnabled: false,
                            attackModeActiveUntil: 0
                        })
                    });

                    if (!res.ok) {
                        const text = await res.text();
                        throw new Error(`Vercel API error: ${text}`);
                    }

                    // Log to action logs
                    await actionLogger.logActions([{
                        id: crypto.randomUUID(),
                        userId: project.userId,
                        vercelProjectRef: project.id,
                        ruleId: rule.id,
                        actionTaken: 'VERCEL_ATTACK_MODE_OFF',
                        targetType: 'PROJECT',
                        targetValue: project.name,
                        requestCount: totalRequests,
                        metadata: JSON.stringify({
                            offThreshold,
                            totalRequests
                        }),
                        timestamp: new Date()
                    }]);
                    log(`  Successfully disabled Vercel Attack Mode for ${project.name}.`);

                    // Send email
                    if (sendNotification && notifyEmails) {
                        const subject = `[Resolve] Vercel Auto Attack Mode DEACTIVATED for ${project.domain || project.name}`;
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
        Vercel Attack Mode has been programmatically disabled and restored to normal.
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
                    console.error(`  Failed to disable Vercel Attack Mode:`, errMsg);
                    await actionLogger.logActions([{
                        id: crypto.randomUUID(),
                        userId: project.userId,
                        vercelProjectRef: project.id,
                        ruleId: rule.id,
                        actionTaken: 'VERCEL_ATTACK_MODE_ERROR',
                        targetType: 'API_ERROR',
                        targetValue: 'Deactivation failed',
                        requestCount: totalRequests,
                        metadata: JSON.stringify({ error: errMsg }),
                        timestamp: new Date()
                    }]);
                }
            } else {
                log(`  Traffic is normal and Vercel Attack Mode is already disabled.`);
            }
        } else {
            log(`  Traffic (${totalRequests}) in neutral range. No action taken.`);
        }
    }
}
