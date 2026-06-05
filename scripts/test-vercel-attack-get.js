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

    console.log('\n--- 1. Testing GET /v9/projects/{projectId} ---');
    try {
        const url = `https://api.vercel.com/v9/projects/${projectId}?${teamParam}`;
        const res = await fetch(url, { headers });
        const json = await res.json();
        console.log('Project keys related to attack/security:');
        for (const [k, v] of Object.entries(json)) {
            if (k.toLowerCase().includes('attack') || k.toLowerCase().includes('security') || k.toLowerCase().includes('firewall')) {
                console.log(`- ${k}:`, v);
            }
        }
        // Let's also check if there is a protection or attackModeEnabled field
        console.log('- attackModeEnabled:', json.attackModeEnabled);
        console.log('- securitySettings:', json.securitySettings);
    } catch (err) {
        console.error('GET project error:', err);
    }
}

runTests();
