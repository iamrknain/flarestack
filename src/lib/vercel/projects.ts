import { VercelApiBase } from './base';

export interface VercelProjectResponse {
    id: string;
    name: string;
    targets?: {
        production?: {
            domain: string;
        };
    };
    alias?: string[];
    security?: {
        attackModeEnabled?: boolean;
    };
}

export class ProjectsApi extends VercelApiBase {
    async list(): Promise<VercelProjectResponse[]> {
        const res = await this.fetchVercel<{ projects: VercelProjectResponse[] }>(
            `/v9/projects${this.teamParam}`
        );
        return res.projects || [];
    }

    async get(projectId: string): Promise<VercelProjectResponse> {
        return this.fetchVercel<VercelProjectResponse>(
            `/v9/projects/${projectId}${this.teamParam}`
        );
    }
}
