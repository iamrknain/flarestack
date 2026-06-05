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

console.log('Credentials loaded:', {
    token: token ? token.substring(0, 8) + '...' : 'undefined',
    projectId,
    teamId
});

async function runTests() {
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    const teamParam = teamId ? `&teamId=${teamId}` : '';

    console.log('\n--- 1. Testing GET /v1/security/firewall/config ---');
    try {
        const url = `https://api.vercel.com/v1/security/firewall/config?projectId=${projectId}${teamParam}`;
        console.log('Fetching:', url);
        const res = await fetch(url, { headers });
        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Response body:', text);
    } catch (err) {
        console.error('GET config error:', err);
    }

    console.log('\n--- 2. Testing POST /v1/security/attack-mode (Toggle On) ---');
    try {
        const url = `https://api.vercel.com/v1/security/attack-mode?projectId=${projectId}${teamParam}`;
        console.log('Posting:', url);
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                projectId,
                attackModeEnabled: true,
                attackModeActiveUntil: Math.floor(Date.now() / 1000) + 3600 // 1 hour
            })
        });
        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Response body:', text);
    } catch (err) {
        console.error('POST attack-mode error:', err);
    }

    console.log('\n--- 3. Testing POST /v1/security/attack-mode (Toggle Off) ---');
    try {
        const url = `https://api.vercel.com/v1/security/attack-mode?projectId=${projectId}${teamParam}`;
        console.log('Posting:', url);
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
}

runTests();
