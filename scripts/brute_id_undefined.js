const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function signData(data, secret) {
    const jsonString = JSON.stringify(data);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(jsonString);
    return hmac.digest('hex').substring(0, 12).toUpperCase();
}

// Load env vars from .env.local
const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
        let val = match[2].trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.substring(1, val.length - 1);
        envVars[match[1]] = val;
    }
});

const secrets = [
    'dev-secret-key-do-not-use-in-prod',
    '',
    ...Object.values(envVars)
];

const payload = {
    t: 'c',
    id: undefined,
    s: 'undefined undefined',
    e: undefined,
    d: { s: undefined, f: undefined },
    sigs: []
};

console.log("Searching for 9A01295A1C53 with ID: undefined...");
for (const secret of secrets) {
    if (signData(payload, secret) === '9A01295A1C53') {
        console.log(`MATCH FOUND!`);
        process.exit(0);
    }
}
console.log("No match found.");
