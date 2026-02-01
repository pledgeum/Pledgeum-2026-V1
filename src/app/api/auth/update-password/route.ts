import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import pool from '@/lib/pg';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const schema = z.object({
    password: z.string().min(6)
});

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const validation = schema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: "Invalid password" }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(validation.data.password, 10);

        const client = await pool.connect();
        try {
            await client.query(
                `UPDATE users SET password_hash = $1, must_change_password = FALSE, updated_at = NOW() WHERE email = $2`,
                [hashedPassword, session.user.email]
            );
        } finally {
            client.release();
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Update password error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
