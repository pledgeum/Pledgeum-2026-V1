const crypto = require('crypto');

function signData(data, secret) {
    const jsonString = JSON.stringify(data);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(jsonString);
    return hmac.digest('hex').substring(0, 12).toUpperCase();
}

const payloads = [
    {},
    null,
    "null",
    "",
    { t: 'c', id: 'conv_9cysp0s3y', s: 'undefined undefined', e: undefined, d: { s: undefined, f: undefined } },
    { t: 'c', id: undefined, s: 'undefined undefined', e: undefined, d: { s: undefined, f: undefined } }
];

const secrets = [
    'dev-secret-key-do-not-use-in-prod',
    '',
    'undefined',
    'ereq4of+UBFm5UH/M/Sthvm+jZO2Z52SUr7xU08Of/s=' // AUTH_SECRET
];

for (const secret of secrets) {
    console.log(`--- Secret: "${secret}" ---`);
    for (const p of payloads) {
        try {
            console.log(`Payload: ${JSON.stringify(p)} -> ${signData(p, secret)}`);
        } catch (e) {
            console.log(`Payload: ${JSON.stringify(p)} -> Error: ${e.message}`);
        }
    }
}
