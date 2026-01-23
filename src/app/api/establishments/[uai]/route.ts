import { NextResponse } from 'next/server';
import pool from '@/lib/pg';

export async function GET(
    request: Request,
    props: { params: Promise<{ uai: string }> }
) {
    const params = await props.params;
    const { uai } = params;

    if (!uai) {
        return NextResponse.json({ error: 'Missing UAI' }, { status: 400 });
    }

    try {
        const client = await pool.connect();
        try {
            // 2. Query Establishment
            const query = `
                SELECT 
                    uai, 
                    name, 
                    address, 
                    city, 
                    postal_code as "postalCode", 
                    type, 
                    telephone as phone, 
                    admin_email as "adminEmail"
                FROM establishments 
                WHERE uai = $1
            `;
            const result = await client.query(query, [uai]);

            if (result.rowCount === 0) {
                // Sandbox special case if not in DB? 
                // (Ideally it should be in DB by now via migrate or fix script)
                if (uai === '9999999X') {
                    return NextResponse.json({
                        uai: '9999999X',
                        name: 'Lycée Sandbox (Fallback)',
                        address: '12 Rue Exemple',
                        city: 'Paris',
                        postalCode: '75000',
                        type: 'LP',
                        phone: '0102030405',
                        adminEmail: 'pledgeum@gmail.com'
                    });
                }
                return NextResponse.json({ error: 'Establishment not found' }, { status: 404 });
            }

            return NextResponse.json(result.rows[0]);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('[API] Error fetching establishment:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
