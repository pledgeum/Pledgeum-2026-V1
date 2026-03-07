import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { auth } from '@/auth';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    let client;
    try {
        const session = await auth();
        // Justify can be done by anyone connected (student, parent, tutor, etc)
        if (!session || !session.user || !session.user.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const resolvedParams = await params;
        const absenceId = resolvedParams.id;
        const data = await req.json();

        // Le seul champ autorisé à la modification est "reason"
        const { reason } = data;

        if (typeof reason !== 'string') {
            return NextResponse.json({ error: 'La justification est requise.' }, { status: 400 });
        }

        client = await pool.connect();

        const updateQuery = `
            UPDATE absences
            SET reason = $1
            WHERE id = $2
            RETURNING id, convention_id, type, date, duration, reason, reported_by AS "reportedBy", reported_at AS "reportedAt"
        `;

        const updateRes = await client.query(updateQuery, [reason, absenceId]);

        if (updateRes.rows.length === 0) {
            return NextResponse.json({ error: 'Absence introuvable' }, { status: 404 });
        }

        return NextResponse.json(updateRes.rows[0], { status: 200 });

    } catch (error: any) {
        console.error("Erreur serveur lors de la justification de l'absence :", error);
        return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
    } finally {
        if (client) client.release();
    }
}
