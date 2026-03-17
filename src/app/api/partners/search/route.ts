import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(req.url);
        const latParam = url.searchParams.get('lat');
        const lngParam = url.searchParams.get('lng');
        const radiusParam = url.searchParams.get('radius'); // in km
        const uai = url.searchParams.get('uai');
        const activity = url.searchParams.get('activity');
        const sector = url.searchParams.get('sector');

        if (!uai) {
            return NextResponse.json({ error: "L'établissement (UAI) est obligatoire" }, { status: 400 });
        }

        // Base query components
        let selectClause = `
            SELECT 
                siret, name, address, city, postal_code AS "postalCode", 
                latitude AS lat, longitude AS lng, 
                activities, sectors, classes
        `;
        const conditions: string[] = [`school_id = $1`];
        const params: any[] = [uai];
        let paramIndex = 2; // $1 is uai

        // 1. Distance Calculation (Haversine formula)
        const hasCoords = latParam && lngParam;
        if (hasCoords) {
            const lat = parseFloat(latParam);
            const lng = parseFloat(lngParam);

            // Note: Earth radius ~6371 km
            selectClause += `, 
                ( 6371 * acos( cos( radians($${paramIndex}) ) 
                * cos( radians( latitude ) ) 
                * cos( radians( longitude ) - radians($${paramIndex + 1}) ) 
                + sin( radians($${paramIndex}) ) 
                * sin( radians( latitude ) ) ) ) AS distance
            `;
            params.push(lat, lng);
            paramIndex += 2;
        } else {
            // Fallback if no starting point provided
            selectClause += `, 0 AS distance`;
        }

        let query = `${selectClause} FROM partners`;

        // 2. Add Filters
        if (activity) {
            // JSONB text search using @> or ILIKE on cast
            // Stored as ["MECANIQUE"] or similar
            conditions.push(`activities::text ILIKE $${paramIndex}`);
            params.push(`%${activity}%`);
            paramIndex++;
        }

        if (sector) {
            conditions.push(`sectors::text ILIKE $${paramIndex}`);
            params.push(`%${sector}%`);
            paramIndex++;
        }

        if (conditions.length > 0) {
            query += ` WHERE ` + conditions.join(' AND ');
        }

        // 3. Add HAVING clause for radius if both distance exists
        // PostgreSQL can't use alias in WHERE, so we wrap or repeat logic, but for simple queries we can just filter in app or duplicate math.
        // Actually, cleaner way is subquery or CTE:
        let finalQuery = query;
        if (hasCoords && radiusParam && radiusParam !== 'all') {
            const radius = parseFloat(radiusParam);
            finalQuery = `
                 SELECT * FROM (${query}) as subq
                 WHERE distance <= $${paramIndex}
                 ORDER BY distance ASC
             `;
            params.push(radius);
        } else if (hasCoords) {
            finalQuery = `
                 SELECT * FROM (${query}) as subq
                 ORDER BY distance ASC
             `;
        } else {
            finalQuery += ` ORDER BY name ASC`;
        }

        // Limit results to prevent massive payloads
        finalQuery += ` LIMIT 500`;

        const { rows } = await pool.query(finalQuery, params);

        // Format for frontend (convert JSONB back to expected structure)
        const partners = rows.map(r => ({
            siret: r.siret,
            name: r.name,
            address: r.address,
            city: r.city,
            postalCode: r.postalCode,
            coordinates: r.lat !== null && r.lng !== null ? { lat: r.lat, lng: r.lng } : undefined,
            activity: Array.isArray(r.activities) ? r.activities[0] : (r.activities || ''),
            jobs: Array.isArray(r.sectors) ? r.sectors : [],
            classes: Array.isArray(r.classes) ? r.classes : [],
            distance: r.distance ? parseFloat(Number(r.distance).toFixed(1)) : 0
        }));

        return NextResponse.json({ partners });

    } catch (error: any) {
        console.error('Search Partners Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
