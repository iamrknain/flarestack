import { fetchIpDetailsAction } from "~/server/cloudflare";

export interface IpDetailsData {
    ip: string;
    network?: string;
    version?: string;
    city?: string;
    region?: string;
    country_name?: string;
    country_code?: string;
    country_capital?: string;
    country_tld?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
    utc_offset?: string;
    country_calling_code?: string;
    currency_name?: string;
    languages?: string;
    asn?: string;
    org?: string;
    error?: string;
}

export function getFlagEmoji(countryCode?: string): string {
    if (!countryCode) return "";
    const codePoints = countryCode
        .toUpperCase()
        .split("")
        .map(char => 127397 + char.charCodeAt(0));
    try {
        return String.fromCodePoint(...codePoints);
    } catch {
        return "";
    }
}

export async function fetchIpDetails(ip: string): Promise<IpDetailsData> {
    try {
        const data = await fetchIpDetailsAction(ip);
        if (data && "error" in data) {
            return { ip, error: data.error as string };
        }
        return data as IpDetailsData;
    } catch (err: any) {
        return { ip, error: err.message || "Failed to retrieve IP details" };
    }
}
