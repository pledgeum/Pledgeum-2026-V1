import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import pool from '@/lib/pg';

export async function GET(req: Request) {
    let client;
    try {
        const session = await auth();
        // Optionnel : Limitation, seul un user connecté peut taper l'API
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(req.url);
        const siretsParam = url.searchParams.get('sirets');

        if (!siretsParam) {
            return NextResponse.json({ error: 'sirets missing' }, { status: 400 });
        }

        const sirets = siretsParam.split(',').map(s => s.trim().replace(/[^0-9]/g, '')).filter(Boolean);
        if (sirets.length === 0) {
            return NextResponse.json({}, { status: 200 }); // Return empty dict
        }

        const placeholders = sirets.map((_, i) => `$${i + 1}`).join(',');

        client = await pool.connect();

        // Optimised query pulling only non-null coords
        const query = `
            SELECT DISTINCT ON (siret) siret, latitude, longitude
            FROM partners
            WHERE siret IN (${placeholders})
            AND latitude IS NOT NULL 
            AND longitude IS NOT NULL
            ORDER BY siret
        `;

        const { rows } = await client.query(query, sirets);

        // Map into dictionary Dict[siret] = { lat, lon }
        const coordsMap: Record<string, { lat: number, lon: number }> = {};
        for (const row of rows) {
            coordsMap[row.siret] = {
                lat: parseFloat(row.latitude),
                lon: parseFloat(row.longitude)
            };
        }

        return NextResponse.json(coordsMap, { status: 200 });

    } catch (error: any) {
        console.error("Erreur serveur API Bulk Coords :", error);
        return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
    } finally {
        if (client) client.release();
    }
}
