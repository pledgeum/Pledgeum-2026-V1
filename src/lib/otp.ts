import pool from '@/lib/pg';

export async function createOTP(email: string, conventionId: string, code: string, expiresAt: string) {
    const client = await pool.connect();
    try {
        await client.query(
            `INSERT INTO otps (email, convention_id, code, expires_at, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [email, conventionId, code, expiresAt]
        );
    } finally {
        client.release();
    }
}

export async function verifyOTP(email: string, code: string): Promise<{ valid: boolean, conventionId?: string }> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT * FROM otps WHERE email = $1 AND code = $2 AND expires_at > NOW()`,
            [email, code]
        );
        if (res.rows.length > 0) {
            const otp = res.rows[0];
            // OTP is valid. Delete it to prevent reuse?
            await client.query(`DELETE FROM otps WHERE id = $1`, [otp.id]); // Assuming id exists, or delete by params
            // If table doesn't have ID, delete by email/code
            await client.query(`DELETE FROM otps WHERE email = $1 AND code = $2`, [email, code]);
            return { valid: true, conventionId: otp.convention_id };
        }
        return { valid: false };
    } finally {
        client.release();
    }
}

// Helper to init table if not exists (temporary, better in migration)
export async function ensureOtpTable() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS otps (
                id SERIAL PRIMARY KEY,
                email TEXT NOT NULL,
                convention_id TEXT NOT NULL,
                code TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
    } finally {
        client.release();
    }
}
