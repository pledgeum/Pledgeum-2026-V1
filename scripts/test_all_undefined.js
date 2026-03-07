const crypto = require('crypto');

function signData(data, secret) {
    const jsonString = JSON.stringify(data);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(jsonString);
    return hmac.digest('hex').substring(0, 12).toUpperCase();
}

const secret = 'dev-secret-key-do-not-use-in-prod';

const payload = {
    t: 'c',
    id: "undefined",
    s: 'undefined undefined',
    e: "undefined",
    d: { s: "undefined", f: "undefined" },
    sigs: []
};

console.log('Payload all "undefined":', signData(payload, secret));
