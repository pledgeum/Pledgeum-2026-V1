import pool from '@/lib/pg';
import crypto from 'crypto';

interface MagicLinkPayload {
    token: string;
    conventionId: string;
    role: string;
    email: string;
    expiresAt: Date;
}

const EXPIRATION_DAYS = 7;

export async function createMagicLink(conventionId: string, role: string, email: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + EXPIRATION_DAYS);

    const client = await pool.connect();
    try {
        await client.query(
            `INSERT INTO magic_link_tokens (token, convention_id, role, email, expires_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [token, conventionId, role, email, expiresAt.toISOString()]
        );
    } finally {
        client.release();
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${baseUrl}/invite?token=${token}`;
}

export async function verifyMagicLink(token: string): Promise<MagicLinkPayload | null> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT * FROM magic_link_tokens
             WHERE token = $1
               AND used_at IS NULL
               AND expires_at > NOW()`,
            [token]
        );

        if (res.rows.length === 0) return null;

        const row = res.rows[0];
        return {
            token: row.token,
            conventionId: row.convention_id,
            role: row.role,
            email: row.email,
            expiresAt: row.expires_at // Postgres returns Date object usually
        };
    } finally {
        client.release();
    }
}

export async function markMagicLinkAsUsed(token: string): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query(
            `UPDATE magic_link_tokens SET used_at = NOW() WHERE token = $1`,
            [token]
        );
    } finally {
        client.release();
    }
}
