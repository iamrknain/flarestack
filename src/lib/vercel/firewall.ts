import { VercelApiBase } from './base';

export class FirewallApi extends VercelApiBase {
    async getConfig(projectId: string): Promise<any> {
        return this.fetchVercel<any>(
            `/v1/security/firewall/config?projectId=${projectId}${this.teamParamAmp}`
        );
    }

    async updateConfig(projectId: string, config: any): Promise<any> {
        return this.fetchVercel<any>(
            `/v1/security/firewall/config?projectId=${projectId}${this.teamParamAmp}`,
            {
                method: "PUT",
                body: JSON.stringify(config),
            }
        );
    }
}
