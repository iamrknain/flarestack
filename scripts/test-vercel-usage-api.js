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

async function testEndpoint(urlPath) {
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
    const teamParam = teamId ? `teamId=${teamId}` : '';
    const delimiter = urlPath.includes('?') ? '&' : '?';
    const url = `https://api.vercel.com${urlPath}${delimiter}${teamParam}`;

    console.log(`\nTesting: GET ${url}`);
    try {
        const res = await fetch(url, { headers });
        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Response:', text.substring(0, 1000));
    } catch (err) {
        console.error('Error:', err.message);
    }
}

async function run() {
    // Let's test different usage/metrics/analytics endpoints
    await testEndpoint(`/v6/projects/${projectId}/usage`);
    await testEndpoint(`/v4/projects/${projectId}/usage`);
    await testEndpoint(`/v1/projects/${projectId}/usage`);
    await testEndpoint(`/v1/projects/${projectId}/analytics`);
    await testEndpoint(`/v1/observability/queries`);
    await testEndpoint(`/v1/observability/metrics`);
}

run();
