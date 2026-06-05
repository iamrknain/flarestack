import { VercelApiBase } from './base';

export class AttackModeApi extends VercelApiBase {
    async set(projectId: string, enabled: boolean, activeUntilMs: number = 0): Promise<any> {
        return this.fetchVercel<any>(
            `/v1/security/attack-mode${this.teamParam}`,
            {
                method: "POST",
                body: JSON.stringify({
                    projectId,
                    attackModeEnabled: enabled,
                    attackModeActiveUntil: activeUntilMs,
                }),
            }
        );
    }
}
