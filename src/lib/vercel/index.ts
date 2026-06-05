import { ProjectsApi } from '~/lib/vercel/projects';
import { FirewallApi } from '~/lib/vercel/firewall';
import { AttackModeApi } from '~/lib/vercel/attackMode';

export * from '~/lib/vercel/base';
export * from '~/lib/vercel/projects';
export * from '~/lib/vercel/firewall';
export * from '~/lib/vercel/attackMode';

export class VercelClient {
    public readonly projects: ProjectsApi;
    public readonly firewall: FirewallApi;
    public readonly attackMode: AttackModeApi;

    constructor(vercelToken: string, vercelTeamId?: string | null) {
        this.projects = new ProjectsApi(vercelToken, vercelTeamId);
        this.firewall = new FirewallApi(vercelToken, vercelTeamId);
        this.attackMode = new AttackModeApi(vercelToken, vercelTeamId);
    }
}
