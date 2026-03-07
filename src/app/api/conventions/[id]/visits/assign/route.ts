import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import pool from '@/lib/pg';

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    let client;
    try {
        const session = await auth();
        // Optionnel : Vous pouvez vérifier if (session?.user?.role !== 'teacher') throw pour blindage max.
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const conventionId = params.id;

        const data = await req.json();
        const { trackingTeacherEmail, distanceKm } = data;

        if (!trackingTeacherEmail) {
            return NextResponse.json({ error: 'Missing trackingTeacherEmail' }, { status: 400 });
        }

        client = await pool.connect();

        // UPSERT the visit assignment in PostgreSQL
        const upsertQuery = `
            INSERT INTO visits (convention_id, tracking_teacher_email, distance_km)
            VALUES ($1, $2, $3)
            ON CONFLICT (convention_id) 
            DO UPDATE SET 
                tracking_teacher_email = $2, 
                distance_km = $3, 
                updated_at = NOW()
            RETURNING *;
        `;

        const res = await client.query(upsertQuery, [
            conventionId,
            trackingTeacherEmail,
            distanceKm !== undefined ? Number(distanceKm) : null
        ]);

        return NextResponse.json(res.rows[0], { status: 200 });

    } catch (error: any) {
        console.error("Erreur serveur lors de l'assignation de visite :", error);
        return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
    } finally {
        if (client) client.release();
    }
}
