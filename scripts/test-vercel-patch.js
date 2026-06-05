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

    console.log('\n--- 1. Testing POST /v1/security/attack-mode with Milliseconds ---');
    try {
        const url = `https://api.vercel.com/v1/security/attack-mode?projectId=${projectId}${teamParam}`;
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                projectId,
                attackModeEnabled: true,
                attackModeActiveUntil: Date.now() + 3600 * 1000 // 1 hour in ms
            })
        });
        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Response body:', text);
    } catch (err) {
        console.error('POST attack-mode error:', err);
    }

    console.log('\n--- 2. Testing POST /v1/security/attack-mode (Toggle Off) ---');
    try {
        const url = `https://api.vercel.com/v1/security/attack-mode?projectId=${projectId}${teamParam}`;
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                projectId,
                attackModeEnabled: false,
                attackModeActiveUntil: 0
            })
        });
        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Response body:', text);
    } catch (err) {
        console.error('POST attack-mode error:', err);
    }

    console.log('\n--- 3. Testing PATCH /v1/security/firewall/config (Toggle Bot Protection ON) ---');
    try {
        const url = `https://api.vercel.com/v1/security/firewall/config?projectId=${projectId}${teamParam}`;
        const res = await fetch(url, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
                managedRules: {
                    bot_protection: {
                        active: true,
                        action: 'challenge'
                    }
                }
            })
        });
        console.log('PATCH Status:', res.status);
        const text = await res.text();
        console.log('PATCH Response body:', text);
    } catch (err) {
        console.error('PATCH error:', err);
    }

    console.log('\n--- 4. Verification GET ---');
    try {
        const url = `https://api.vercel.com/v1/security/firewall/config?projectId=${projectId}${teamParam}`;
        const res = await fetch(url, { headers });
        const json = await res.json();
        console.log('Current bot protection status:', JSON.stringify(json.active?.managedRules?.bot_protection));
    } catch (err) {
        console.error('GET config verification error:', err);
    }

    console.log('\n--- 5. Testing PATCH /v1/security/firewall/config (Toggle Bot Protection OFF) ---');
    try {
        const url = `https://api.vercel.com/v1/security/firewall/config?projectId=${projectId}${teamParam}`;
        const res = await fetch(url, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
                managedRules: {
                    bot_protection: {
                        active: false,
                        action: 'challenge'
                    }
                }
            })
        });
        console.log('PATCH Status:', res.status);
        const text = await res.text();
        console.log('PATCH Response body:', text);
    } catch (err) {
        console.error('PATCH error:', err);
    }

    console.log('\n--- 6. Verification GET ---');
    try {
        const url = `https://api.vercel.com/v1/security/firewall/config?projectId=${projectId}${teamParam}`;
        const res = await fetch(url, { headers });
        const json = await res.json();
        console.log('Current bot protection status:', JSON.stringify(json.active?.managedRules?.bot_protection));
    } catch (err) {
        console.error('GET config verification error:', err);
    }
}

runTests();
