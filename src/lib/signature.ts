import crypto from 'crypto';

const SECRET_KEY = process.env.DOCUMENT_SIGNING_SECRET || 'dev-secret-key-do-not-use-in-prod';

export function signData(data: object): string {
    const jsonString = JSON.stringify(data);
    const hmac = crypto.createHmac('sha256', SECRET_KEY);
    hmac.update(jsonString);
    return hmac.digest('hex');
}

export function verifyData(data: object, signature: string): boolean {
    const calculated = signData(data);
    // Use timingSafeEqual to prevent timing attacks
    const resultBuffer = Buffer.from(calculated, 'hex');
    const signatureBuffer = Buffer.from(signature, 'hex');

    if (resultBuffer.length !== signatureBuffer.length) return false;

    return crypto.timingSafeEqual(resultBuffer, signatureBuffer);
}
