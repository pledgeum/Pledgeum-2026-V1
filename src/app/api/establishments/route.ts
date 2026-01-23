
import { NextResponse } from 'next/server';
import pool from '@/lib/pg';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const uai = searchParams.get('uai');
    const search = searchParams.get('search');

    try {
        const client = await pool.connect();
        try {
            const SELECT_FIELDS = `
                uai, 
                name, 
                address, 
                city, 
                postal_code as "postalCode", 
                type, 
                telephone as phone, 
                admin_email as "adminEmail"
            `;

            if (uai) {
                const result = await client.query(`SELECT ${SELECT_FIELDS} FROM establishments WHERE uai = $1`, [uai]);
                if (result.rowCount === 0) {
                    return NextResponse.json({ error: 'Not found' }, { status: 404 });
                }
                // Return array as discussed in comments previously, or stick to list structure
                return NextResponse.json(result.rows);
            }

            if (search) {
                const result = await client.query(
                    `SELECT ${SELECT_FIELDS} FROM establishments 
                     WHERE name ILIKE $1 OR city ILIKE $1 
                     LIMIT 20`,
                    [`%${search}%`]
                );
                return NextResponse.json(result.rows);
            }

            // Default: List
            const result = await client.query(`SELECT ${SELECT_FIELDS} FROM establishments LIMIT 50`);
            return NextResponse.json(result.rows);

        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error fetching establishments:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
