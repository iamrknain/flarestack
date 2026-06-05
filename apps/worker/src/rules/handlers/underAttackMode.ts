import { RuleHandler, RuleContext, UnderAttackRuleRow } from '../interface';
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

export class UnderAttackModeRule implements RuleHandler {
    /**
     * Queries Cloudflare Analytics for total traffic count in the window.
     * Compares it against the ON threshold (rateLimitThreshold) and OFF threshold (offThreshold).
     * If ON is met, enables Under Attack mode.
     * If OFF is met (and autoOff is true), disables Under Attack mode.
     */
    async execute({ zone, rule: baseRule, cf, actionLogger, env }: RuleContext): Promise<void> {
        const rule = baseRule as UnderAttackRuleRow;
        log(
            `  Rule [under_attack_mode] id=${rule.id} ` +
            `threshold=${rule.rateLimitThreshold} autoOff=${rule.autoOff} offThreshold=${rule.offThreshold}`
        );

        const {
            rateLimitThreshold,
            autoOff,
            offThreshold,
            windowSeconds: ruleWindowSeconds,
            recoveryLevel,
            sendNotification,
            notifyEmails
        } = rule;

        // Guard: validate required rule fields at runtime.
        if (typeof rateLimitThreshold !== 'number' || typeof ruleWindowSeconds !== 'number') {
            console.error(
                `  Rule ${rule.id} has invalid configuration — skipping.`,
                { rateLimitThreshold, windowSeconds: ruleWindowSeconds }
            );
            return;
        }

        // ── 1. Resolve total requests in the zone ──────────────────────────────
        let totalRequests = 0;
        try {
            // Get total stats (passing empty dimensions array to get zone-wide total requests)
            const results = await cf.analytics.getTopStats({
                zoneTag: zone.cfZoneId,
                dimensions: [],
                windowSeconds: ruleWindowSeconds,
                limit: 1,
            });
            if (results.length > 0) {
                totalRequests = results[0].count;
            }
            log(`  Zone-wide traffic: ${totalRequests} request(s) in the last ${ruleWindowSeconds}s.`);
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error(
                `  Failed to query total traffic for rule ${rule.id} on zone ${zone.name}:`,
                errMsg
            );
            await actionLogger.logActions([{
                userId: zone.userId,
                zoneConfigId: zone.id,
                ruleId: rule.id,
                actionTaken: 'UNDER_ATTACK_MODE_ERROR',
                targetType: 'API_ERROR',
                targetValue: 'Traffic query failed',
                requestCount: null,
                metadata: JSON.stringify({ error: errMsg }),
                timestamp: new Date()
            }]);
            return;
        }

        // ── 2. Fetch current security level from Cloudflare ────────────────────
        let currentSecurityLevel: string;
        try {
            currentSecurityLevel = await cf.zones.getSecurityLevel(zone.cfZoneId);
            log(`  Current security level: "${currentSecurityLevel}".`);
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error(
                `  Failed to query current security level for zone ${zone.name}:`,
                errMsg
            );
            await actionLogger.logActions([{
                userId: zone.userId,
                zoneConfigId: zone.id,
                ruleId: rule.id,
                actionTaken: 'UNDER_ATTACK_MODE_ERROR',
                targetType: 'API_ERROR',
                targetValue: errMsg.substring(0, 100),
                requestCount: null,
                metadata: JSON.stringify({ error: errMsg }),
                timestamp: new Date()
            }]);
            return;
        }

        // ── 3. Apply Threshold logic ───────────────────────────────────────────
        if (totalRequests > rateLimitThreshold) {
            // Trigger Under Attack Mode ON
            if (currentSecurityLevel !== 'under_attack') {
                log(`  Traffic ${totalRequests} exceeded trigger threshold ${rateLimitThreshold}. Enabling Under Attack Mode!`);
                try {
                    await cf.zones.setSecurityLevel(zone.cfZoneId, 'under_attack');
                    
                    // Log to action logs
                    await actionLogger.logActions([{
                        userId: zone.userId,
                        zoneConfigId: zone.id,
                        ruleId: rule.id,
                        actionTaken: 'UNDER_ATTACK_MODE_ON',
                        targetType: 'ZONE',
                        targetValue: zone.name,
                        requestCount: totalRequests,
                        metadata: JSON.stringify({
                            previousLevel: currentSecurityLevel,
                            triggerThreshold: rateLimitThreshold,
                            totalRequests
                        }),
                        timestamp: new Date()
                    }]);
                    log(`  Successfully enabled Under Attack Mode for ${zone.name}.`);

                    // Dispatch notification
                    if (sendNotification && notifyEmails) {
                        const subject = `[Alert] Under Attack Mode ACTIVATED for ${zone.name}`;
                        const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, -apple-system, sans-serif; background-color: #f8fafc; padding: 40px 20px; margin: 0;">
  <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    <div style="background: linear-gradient(135deg, #e11d48, #be123c); padding: 32px 40px; color: #ffffff;">
      <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.025em;">Security Alert: Under Attack Mode Activated</h2>
      <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.9;">Zone traffic has exceeded security thresholds.</p>
    </div>
    <div style="padding: 40px;">
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase;">Zone</td>
          <td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: 700; font-size: 14px;">${zone.name}</td>
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
        Cloudflare Under Attack security level has been programmatically enabled to protect your origin from overload.
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
                    console.error(
                        `  Failed to enable Under Attack Mode for zone ${zone.name}:`,
                        errMsg
                    );
                    await actionLogger.logActions([{
                        userId: zone.userId,
                        zoneConfigId: zone.id,
                        ruleId: rule.id,
                        actionTaken: 'UNDER_ATTACK_MODE_ERROR',
                        targetType: 'API_ERROR',
                        targetValue: 'Activation failed',
                        requestCount: totalRequests,
                        metadata: JSON.stringify({ error: errMsg }),
                        timestamp: new Date()
                    }]);
                }
            } else {
                log(`  Zone is already in under_attack mode. No action needed.`);
            }
        } else if (autoOff && typeof offThreshold === 'number' && totalRequests < offThreshold) {
            // Trigger Under Attack Mode OFF (revert)
            if (currentSecurityLevel === 'under_attack') {
                const targetLevel = (recoveryLevel || 'medium') as any;
                log(`  Traffic ${totalRequests} dropped below recovery threshold ${offThreshold}. Restoring security level to "${targetLevel}".`);
                try {
                    await cf.zones.setSecurityLevel(zone.cfZoneId, targetLevel);
 
                    // Log to action logs
                    await actionLogger.logActions([{
                        userId: zone.userId,
                        zoneConfigId: zone.id,
                        ruleId: rule.id,
                        actionTaken: 'UNDER_ATTACK_MODE_OFF',
                        targetType: 'ZONE',
                        targetValue: zone.name,
                        requestCount: totalRequests,
                        metadata: JSON.stringify({
                            restoredLevel: targetLevel,
                            offThreshold,
                            totalRequests
                        }),
                        timestamp: new Date()
                    }]);
                    log(`  Successfully restored security level to "${targetLevel}" for ${zone.name}.`);

                    // Dispatch notification
                    if (sendNotification && notifyEmails) {
                        const subject = `[Resolve] Under Attack Mode DEACTIVATED for ${zone.name}`;
                        const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, -apple-system, sans-serif; background-color: #f8fafc; padding: 40px 20px; margin: 0;">
  <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    <div style="background: linear-gradient(135deg, #10b981, #047857); padding: 32px 40px; color: #ffffff;">
      <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.025em;">Security Resolved: Traffic Normalized</h2>
      <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.9;">Zone traffic has subsided below recovery thresholds.</p>
    </div>
    <div style="padding: 40px;">
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase;">Zone</td>
          <td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: 700; font-size: 14px;">${zone.name}</td>
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
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase;">Security Level</td>
          <td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: 600; font-size: 14px; text-transform: capitalize;">${targetLevel}</td>
        </tr>
      </table>
      <div style="background: #ecfdf5; border: 1px solid #d1fae5; border-radius: 8px; padding: 16px; margin-bottom: 24px; color: #065f46; font-size: 14px; font-weight: 500; line-height: 1.5;">
        Under Attack security level has been programmatically disabled and restored to <strong>${targetLevel}</strong>.
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
                    console.error(
                        `  Failed to restore security level for zone ${zone.name}:`,
                        errMsg
                    );
                    await actionLogger.logActions([{
                        userId: zone.userId,
                        zoneConfigId: zone.id,
                        ruleId: rule.id,
                        actionTaken: 'UNDER_ATTACK_MODE_ERROR',
                        targetType: 'API_ERROR',
                        targetValue: 'Deactivation failed',
                        requestCount: totalRequests,
                        metadata: JSON.stringify({ error: errMsg }),
                        timestamp: new Date()
                    }]);
                }
            } else {
                log(`  Traffic is normal and security level is already "${currentSecurityLevel}".`);
            }
        } else {
            log(`  Traffic (${totalRequests}) in neutral hysteresis zone [${autoOff && typeof offThreshold === 'number' ? offThreshold : 'N/A'}, ${rateLimitThreshold}]. No changes made.`);
        }
    }
}
