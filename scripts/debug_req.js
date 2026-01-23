
const http = require('http');

const data = JSON.stringify({
    profileData: {
        firstName: "fabrice",
        lastName: "test",
        id_establishment: null
    }
});

const options = {
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/users/lAmUIDeewqOAmgbIRnoxxnbOvff2',
    method: 'PUT',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

console.log("Sending request...");
const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log('BODY: ' + body);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
