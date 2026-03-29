import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const session = await auth();

        // Basic ACL check: Needs to be authenticated and ideally an admin role
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Ensure user is authorized
        const allowedRoles = ['school_head', 'ddfpt', 'business_manager', 'admin'];
        if (!allowedRoles.includes(session.user.role)) {
            return NextResponse.json({ error: 'Forbidden route for your role' }, { status: 403 });
        }

        const body = await req.json();
        const { partners, schoolId } = body;

        if (!schoolId) {
            return NextResponse.json({ error: "L'identifiant de l'établissement (schoolId/UAI) est obligatoire" }, { status: 400 });
        }

        if (!Array.isArray(partners) || partners.length === 0) {
            return NextResponse.json({ error: 'Invalid or empty partners payload' }, { status: 400 });
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN'); // Start Transaction

            let importedCount = 0;
            let updatedCount = 0;

            for (const p of partners) {
                // Prepare JSONB fields
                const activitiesJson = JSON.stringify(p.activity ? [p.activity] : []);
                const sectorsJson = JSON.stringify(p.jobs || []);
                const lat = p.coordinates?.lat || null;
                const lng = p.coordinates?.lng || null;

                const query = `
                    INSERT INTO partners (
                        school_id, siret, name, address, city, postal_code, latitude, longitude, activities, sectors
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    ON CONFLICT (school_id, siret) DO UPDATE SET 
                        name = EXCLUDED.name,
                        address = EXCLUDED.address,
                        city = EXCLUDED.city,
                        postal_code = EXCLUDED.postal_code,
                        latitude = EXCLUDED.latitude,
                        longitude = EXCLUDED.longitude,
                        activities = EXCLUDED.activities,
                        sectors = EXCLUDED.sectors,
                        created_at = NOW()
                    RETURNING (xmax = 0) AS inserted;
                `;

                const values = [
                    schoolId,
                    p.siret ? p.siret.replace(/\s+/g, '') : null,
                    p.name,
                    p.address,
                    p.city || null,
                    p.postalCode || null,
                    lat,
                    lng,
                    activitiesJson,
                    sectorsJson
                ];

                const res = await client.query(query, values);

                // Track metric based on Postgres hidden system column 'xmax' evaluation wrapper
                if (res.rows[0].inserted) {
                    importedCount++;
                } else {
                    updatedCount++;
                }
            }

            await client.query('COMMIT');

            return NextResponse.json({
                success: true,
                message: `${importedCount} parteners created, ${updatedCount} updated.`,
                stats: { created: importedCount, updated: updatedCount }
            });

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

    } catch (error: any) {
        console.error('Import Partners Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
