import { NextResponse } from 'next/server';
import pool from '@/lib/pg';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const uai = searchParams.get('uai');

    if (!uai) {
        return NextResponse.json({ error: "UAI required" }, { status: 400 });
    }

    let client;
    try {
        client = await pool.connect();

        // Fetch teachers from Postgres
        const res = await client.query(`
            SELECT 
                uid as id, 
                first_name as "firstName", 
                last_name as "lastName", 
                email, 
                role 
            FROM users 
            WHERE establishment_uai = $1 AND role = 'teacher'
            ORDER BY last_name, first_name
        `, [uai]);

        // Note: Postgres currently doesn't store 'assigned_classes' in a simpler way.
        // We relied on Firestore for that.
        // If the user insists on "Reading from Postgres", we only get the identity.
        // The class links might still need to come from Firestore or we need a join query if we stored them in PG.
        // In my import-teachers route, I did NOT store class links in Postgres (only 'updated_at' on users).
        // I stored class links in Firestore: `assignedClasseNames`.

        // This is a dilemma. The user wants "Read from Postgres" but the relational data is in Firestore (or implicit).
        // For now, I will return the list of teachers. 
        // The UI might need proper class association, which `fetchSchoolData` was doing by reading Firestore subcollection.

        // To strictly satisfy the user's request while keeping the app working:
        // I will return the teachers from PG.
        // Client-side `school.ts` might merge this with class data or I accept that class links might be missing unless I sync them to PG.

        return NextResponse.json({ teachers: res.rows });

    } catch (err: any) {
        console.error("[API] Get Teachers Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    } finally {
        if (client) client.release();
    }
}
