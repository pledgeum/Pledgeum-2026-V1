const crypto = require('crypto');

function signData(data, secret) {
    const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(jsonString);
    return hmac.digest('hex').substring(0, 12).toUpperCase();
}

const secret = 'dev-secret-key-do-not-use-in-prod';

const candidates = [
    "PLACEHOLDER",
    "9A01295A1C53",
    "TBD",
    "TBC",
    "TO_BE_SIGNED",
    "undefined",
    "null",
    "[]",
    "{}",
    "standard manual entry placeholder",
    "Certificat d'Authenticité Numérique",
    "Pledgeum",
    "PFMP",
    "Standardize manual entry placeholder to 9A01295A1C53",
    "9A01"
];

console.log("Brute forcing candidates...");
for (const c of candidates) {
    if (signData(c, secret) === '9A01295A1C53') {
        console.log(`MATCH FOUND!`);
        console.log(`Input: "${c}"`);
        process.exit(0);
    }
}
console.log("No match found in candidates.");
