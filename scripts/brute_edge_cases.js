const crypto = require('crypto');

function signData(data, secret) {
    const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(jsonString);
    return hmac.digest('hex').substring(0, 12).toUpperCase();
}

const secrets = [
    'dev-secret-key-do-not-use-in-prod',
    '',
    'undefined',
    'null'
];

const edgeCases = [
    "[object Object]",
    "undefined",
    "null",
    "{}",
    "[]",
    "0",
    "false",
    "true",
    "NaN",
    "Infinity",
    "[object Error]",
    "Error: ",
    "{}",
    JSON.stringify({}),
    JSON.stringify(null),
    "{\"t\":\"c\"}"
];

console.log("Brute forcing edge cases...");
for (const secret of secrets) {
    for (const ec of edgeCases) {
        if (signData(ec, secret) === '9A01295A1C53') {
            console.log(`MATCH FOUND!`);
            console.log(`Secret: "${secret}"`);
            console.log(`Input: "${ec}"`);
            process.exit(0);
        }
    }
}
console.log("No match found in edge cases.");
