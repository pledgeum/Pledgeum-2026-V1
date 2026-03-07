const http = require('http');

const data = JSON.stringify({
    eleve_email: "test@test.com",
    ent_nom: "Test Corp",
    dateStart: "2026-03-01",
    dateEnd: "2026-03-31",
    signatures: {
        studentImg: "data:image/png;base64,mock"
    }
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/conventions',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, res => {
    console.log(`statusCode: ${res.statusCode}`);
    let result = '';
    res.on('data', d => {
        result += d;
    });
    res.on('end', () => {
        console.log("Response:", result);
    });
});

req.on('error', error => {
    console.error(error);
});

req.write(data);
req.end();
