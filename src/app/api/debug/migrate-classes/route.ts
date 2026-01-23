import { NextResponse } from 'next/server';
import pool from '@/lib/pg';

export async function GET() {
    try {
        const client = await pool.connect();
        try {
            // Check if column exists
            const checkQuery = `
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='classes' AND column_name='main_teacher_id';
            `;
            const checkRes = await client.query(checkQuery);

            if (checkRes.rowCount === 0) {
                // Add column
                // Assuming main_teacher_id references users.id (which is usually a string/varchar in Firebase synced systems)
                // If users table uses UUID, use UUID. If users table uses Text, use TEXT.
                // Let's check users table first? Or just assume TEXT/VARCHAR(255) to be safe for Auth IDs.

                await client.query(`
                    ALTER TABLE classes 
                    ADD COLUMN IF NOT EXISTS main_teacher_id VARCHAR(255);
                `);
                return NextResponse.json({ message: "Migration successful: main_teacher_id added." });
            } else {
                return NextResponse.json({ message: "Column main_teacher_id already exists." });
            }
        } finally {
            client.release();
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
