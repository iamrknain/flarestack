import { activityLogs } from '~/db/schema/general';
import { debugLog } from './debug';

export interface ActivityLogParams {
    userId: string;
    provider: string; // 'cloudflare' | 'vercel'
    resourceId?: string | null;
    ruleId: string;
    actionTaken: string;
    targetType: string;
    targetValue: string;
    requestCount?: number | null;
    metadata?: string;
    timestamp?: Date;
}

export class ActivityLogger {
    constructor(private db: any) { }

    /**
     * Records a single activity log entry in the database.
     */
    async logAction(params: ActivityLogParams): Promise<void> {
        await this.logActions([params]);
    }

    /**
     * Batch-inserts multiple activity log entries in a single DB write.
     */
    async logActions(entries: ActivityLogParams[]): Promise<void> {
        if (entries.length === 0) return;

        const now = new Date();
        const rows = entries.map(p => ({
            id: crypto.randomUUID(),
            userId: p.userId,
            provider: p.provider,
            resourceId: p.resourceId || null,
            ruleId: p.ruleId,
            actionTaken: p.actionTaken,
            targetType: p.targetType,
            targetValue: p.targetValue,
            requestCount: p.requestCount ?? null,
            metadata: p.metadata || null,
            timestamp: p.timestamp ?? now,
        }));

        await this.db.insert(activityLogs).values(rows);

        const preview = entries.length > 10
            ? `${entries.slice(0, 10).map(e => e.targetValue).join(', ')} … (+${entries.length - 10} more)`
            : entries.map(e => e.targetValue).join(', ');
        debugLog(`  > Logged ${entries.length} activity record(s): ${preview}`);
    }
}
