const fs = require('fs');
const path = require('path');

// Read .env.vercel
const envContent = fs.readFileSync(path.join(__dirname, '../.env.vercel'), 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w_]+)\s*=\s*["']?([^"'\r\n]+)["']?/);
    if (match) {
        env[match[1]] = match[2];
    }
});

const token = env.VERCEL_TOKEN;
const projectId = env.VERCEL_PROJECT_ID;
const teamId = env.VERCEL_TEAM_ID;

async function runTests() {
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    const teamParam = teamId ? `&teamId=${teamId}` : '';

    console.log('\n--- 1. Fetch current config ---');
    let currentConfig = null;
    try {
        const url = `https://api.vercel.com/v1/security/firewall/config?projectId=${projectId}${teamParam}`;
        const res = await fetch(url, { headers });
        const json = await res.json();
        currentConfig = json.active;
        console.log('GET current config success. ManagedRules:', JSON.stringify(currentConfig?.managedRules));
    } catch (err) {
        console.error('GET config error:', err);
        return;
    }

    if (!currentConfig) {
        return;
    }

    function cleanConfig(config, activeBotProtection) {
        // Strip everything except the standard writable firewall configuration keys
        const cleaned = {
            firewallEnabled: config.firewallEnabled,
            crs: config.crs,
            managedRules: {
                bot_protection: {
                    active: activeBotProtection,
                    action: config.managedRules?.bot_protection?.action || 'challenge'
                }
            },
            // For custom rules, clean up each rule to only send writable properties
            rules: (config.rules || []).map(r => ({
                id: r.id,
                name: r.name,
                description: r.description,
                active: r.active,
                action: r.action,
                conditionGroup: r.conditionGroup
            })),
            ips: (config.ips || []).map(ipRule => ({
                id: ipRule.id,
                action: ipRule.action,
                ip: ipRule.ip,
                notes: ipRule.notes
            }))
        };
        return cleaned;
    }

    console.log('\n--- 2. Testing PUT /v1/security/firewall/config (Toggle Bot Protection ON) ---');
    try {
        const url = `https://api.vercel.com/v1/security/firewall/config?projectId=${projectId}${teamParam}`;
        const payload = cleanConfig(currentConfig, true);

        console.log('PUT Payload:', JSON.stringify(payload));

        const res = await fetch(url, {
            method: 'PUT',
            headers,
            body: JSON.stringify(payload)
        });
        console.log('PUT Status:', res.status);
        const text = await res.text();
        console.log('PUT Response body:', text);
    } catch (err) {
        console.error('PUT error:', err);
    }

    console.log('\n--- 3. Verification GET ---');
    try {
        const url = `https://api.vercel.com/v1/security/firewall/config?projectId=${projectId}${teamParam}`;
        const res = await fetch(url, { headers });
        const json = await res.json();
        console.log('Current bot protection status:', JSON.stringify(json.active?.managedRules?.bot_protection));
    } catch (err) {
        console.error('GET verification error:', err);
    }

    console.log('\n--- 4. Reverting Bot Protection to OFF via PUT ---');
    try {
        const url = `https://api.vercel.com/v1/security/firewall/config?projectId=${projectId}${teamParam}`;
        const payload = cleanConfig(currentConfig, false);

        const res = await fetch(url, {
            method: 'PUT',
            headers,
            body: JSON.stringify(payload)
        });
        console.log('PUT Revert Status:', res.status);
        const text = await res.text();
        console.log('PUT Revert Response body:', text);
    } catch (err) {
        console.error('PUT revert error:', err);
    }

    console.log('\n--- 5. Final Verification GET ---');
    try {
        const url = `https://api.vercel.com/v1/security/firewall/config?projectId=${projectId}${teamParam}`;
        const res = await fetch(url, { headers });
        const json = await res.json();
        console.log('Final bot protection status:', JSON.stringify(json.active?.managedRules?.bot_protection));
    } catch (err) {
        console.error('GET final verification error:', err);
    }
}

runTests();
