import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { auth } from '@/auth';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(req.url);
        const uai = url.searchParams.get('uai');

        if (!uai) {
            return NextResponse.json({ error: "L'établissement (UAI) est obligatoire" }, { status: 400 });
        }

        // We need to extract unique activities and sectors for this uai.
        // activities is jsonb array 
        // sectors is jsonb array

        const activitiesQuery = `
            SELECT DISTINCT elements.value::text AS name 
            FROM partners, jsonb_array_elements_text(activities) AS elements(value) 
            WHERE school_id = $1
        `;

        const sectorsQuery = `
            SELECT DISTINCT elements.value::text AS name 
            FROM partners, jsonb_array_elements_text(sectors) AS elements(value) 
            WHERE school_id = $1
        `;

        const classesQuery = `
            SELECT DISTINCT elements.value::text AS name 
            FROM partners, jsonb_array_elements_text(classes) AS elements(value) 
            WHERE school_id = $1
        `;

        const [activitiesRes, sectorsRes, classesRes] = await Promise.all([
            pool.query(activitiesQuery, [uai]),
            pool.query(sectorsQuery, [uai]),
            pool.query(classesQuery, [uai])
        ]);

        const activities = activitiesRes.rows.map(r => r.name).sort();
        const sectors = sectorsRes.rows.map(r => r.name).sort();
        const classes = classesRes.rows.map(r => r.name).sort();

        return NextResponse.json({ activities, sectors, classes });

    } catch (error: any) {
        console.error('Filters Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
