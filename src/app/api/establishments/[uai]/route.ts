export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
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
                if (uai === '9999999Z') {
                    return NextResponse.json({
                        uai: '9999999Z',
                        name: 'Lycée Sandbox (Fallback)',
                        address: '12 Rue Exemple',
                        city: 'Paris',
                        postalCode: '75000',
                        type: 'LP',
                        phone: '0102030405',
                        adminEmail: 'pledgeum@gmail.com',
                        headName: 'M. Le Proviseur',
                        headEmail: 'pledgeum@gmail.com'
                    });
                }
                return NextResponse.json({ error: 'Establishment not found' }, { status: 404 });
            }

            const establishment = result.rows[0];

            // 3. Fetch Headmaster Identity from Users
            // We prioritize the user explicitly assigned as 'school_head' for this UAI
            const headQuery = `
                SELECT first_name, last_name, email 
                FROM users 
                WHERE establishment_uai = $1 AND role = 'school_head' 
                LIMIT 1
            `;
            const headRes = await client.query(headQuery, [uai]);

            if (headRes.rowCount && headRes.rowCount > 0) {
                const head = headRes.rows[0];
                establishment.headName = `${head.first_name || ''} ${head.last_name || ''}`.trim();
                establishment.headEmail = head.email; // Specific user email overrides generic admin email if needed
            }

            return NextResponse.json(establishment);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('[API] Error fetching establishment:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    props: { params: Promise<{ uai: string }> }
) {
    const params = await props.params;
    const { uai } = params;

    if (!uai) {
        return NextResponse.json({ error: 'Missing UAI' }, { status: 400 });
    }

    try {
        const body = await request.json();
        const { schoolName, schoolAddress, schoolPostalCode, schoolCity, schoolPhone, schoolHeadName, schoolHeadEmail, subscriptionStatus } = body;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Update Establishments Table
            const updates: string[] = [];
            const values: any[] = [uai];
            let paramIndex = 2; // $1 is uai

            if (schoolName !== undefined) {
                updates.push(`name = $${paramIndex++}`);
                values.push(schoolName);
            }
            if (schoolAddress !== undefined) {
                updates.push(`address = $${paramIndex++}`);
                values.push(schoolAddress);
            }
            if (schoolPostalCode !== undefined) {
                updates.push(`postal_code = $${paramIndex++}`);
                values.push(schoolPostalCode);
            }
            if (schoolCity !== undefined) {
                updates.push(`city = $${paramIndex++}`);
                values.push(schoolCity);
            }
            if (schoolPhone !== undefined) {
                updates.push(`telephone = $${paramIndex++}`);
                values.push(schoolPhone);
            }
            if (schoolHeadEmail !== undefined) {
                updates.push(`admin_email = $${paramIndex++}`);
                values.push(schoolHeadEmail);
            }
            if (subscriptionStatus !== undefined) {
                updates.push(`subscription_status = $${paramIndex++}`);
                values.push(subscriptionStatus);
            }

            if (updates.length > 0) {
                const query = `
                    UPDATE establishments 
                    SET ${updates.join(', ')} 
                    WHERE uai = $1
                `;
                await client.query(query, values);
            }

            // 2. Synchronize Headmaster Name in Users Table
            if (schoolHeadName !== undefined) {
                // Split name: First word as first_name, rest as last_name
                // If empty, both become null to trigger placeholder on next load
                const trimmed = (schoolHeadName || '').trim();
                let firstName = null;
                let lastName = null;

                if (trimmed) {
                    const parts = trimmed.split(/\s+/);
                    if (parts.length > 1) {
                        firstName = parts[0];
                        lastName = parts.slice(1).join(' ');
                    } else {
                        lastName = parts[0];
                    }
                }

                const userUpdateQuery = `
                    UPDATE users 
                    SET first_name = $1, last_name = $2 
                    WHERE establishment_uai = $3 AND role = 'school_head'
                `;
                await client.query(userUpdateQuery, [firstName, lastName, uai]);
            }

            await client.query('COMMIT');

            // Clear Next.js Cache for the entire dashboard layout
            revalidatePath('/dashboard', 'layout');

            return NextResponse.json({ message: 'Success' });

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('[API] Error updating establishment:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
