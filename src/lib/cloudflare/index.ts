import { ListsApi } from '~/lib/cloudflare/lists';
import { AnalyticsApi } from '~/lib/cloudflare/analytics';
import { ZonesApi } from '~/lib/cloudflare/zones';
import { RulesetsApi } from '~/lib/cloudflare/rulesets';

export * from '~/lib/cloudflare/base';
export * from '~/lib/cloudflare/lists';
export * from '~/lib/cloudflare/analytics';
export * from '~/lib/cloudflare/zones';
export * from '~/lib/cloudflare/rulesets';

export class CloudflareClient {
    public readonly lists: ListsApi;
    public readonly analytics: AnalyticsApi;
    public readonly zones: ZonesApi;
    public readonly rulesets: RulesetsApi;

    constructor(cfAccountId: string, cfApiToken: string) {
        this.lists = new ListsApi(cfAccountId, cfApiToken);
        this.analytics = new AnalyticsApi(cfAccountId, cfApiToken);
        this.zones = new ZonesApi(cfAccountId, cfApiToken);
        this.rulesets = new RulesetsApi(cfAccountId, cfApiToken);
    }
}

