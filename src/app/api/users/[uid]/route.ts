import { NextResponse } from 'next/server';
import pool from '@/lib/pg';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ uid: string }> } // Fix 1: Type params as Promise
) {
    const { uid } = await params; // Fix 1: Await params

    if (!uid || uid === 'undefined') {
        return NextResponse.json({ error: 'Missing UID' }, { status: 400 });
    }

    if (!pool) {
        return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
    }

    const client = await pool.connect();
    try {
        // 1. Fetch User (Base)
        const query = `SELECT * FROM users WHERE uid = $1`;
        const res = await client.query(query, [uid]);

        if (!res.rowCount || res.rowCount === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const user = res.rows[0];
        let establishmentUai = null;
        let establishmentData = null;

        // 2. Fetch Establishment Context (For School Head)
        if (user.role === 'school_head') {
            const estQuery = `SELECT * FROM establishments WHERE admin_email = $1`;
            const estRes = await client.query(estQuery, [user.email]);
            if (estRes.rowCount && estRes.rowCount > 0) {
                establishmentUai = estRes.rows[0].uai;
                establishmentData = estRes.rows[0];
            } else if (user.email === 'pledgeum@gmail.com') {
                // DEV BACKDOOR: Ensure Pledgeum has access to Sandbox for testing
                establishmentUai = '9999999X';
                establishmentData = { name: 'Lycée Sandbox' };
            }
        }

        // 3. Construct Profile Data & Flatten Response (Fix 2: Explicit Mapping)
        // We return a flat object mixed with user metadata, as expected by frontend
        const mappedUser = {
            uid: user.uid,
            email: user.email,
            role: user.role,
            firstName: user.first_name || '',     // Map snake_case -> camelCase
            lastName: user.last_name || '',
            phone: user.phone || '',
            address: user.address || '',
            function: user.job_function || (establishmentData ? 'Proviseur' : ''),

            // Legacy / Helper fields
            uai: user.establishment_uai || establishmentUai,
            schoolId: user.establishment_uai || establishmentUai,
            ecole_nom: establishmentData ? establishmentData.name : undefined,
            id_establishment: user.establishment_uai || establishmentUai,

            hasAcceptedTos: user.has_accepted_tos || false,

            // Keep profileData for backward compatibility if needed, but ideally frontend uses top-level now
            profileData: {
                firstName: user.first_name || '',
                lastName: user.last_name || '',
                function: user.job_function || (establishmentData ? 'Proviseur' : undefined),
                phone: user.phone || undefined,
                address: user.address || undefined,
                ecole_nom: establishmentData ? establishmentData.name : undefined,
                id_establishment: user.establishment_uai || establishmentUai
            }
        };

        return NextResponse.json({
            user: mappedUser,
            source: 'postgres'
        });

    } catch (error) {
        console.error('[API_USER] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        client.release();
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ uid: string }> } // Fix 1: Type params as Promise
) {
    const { uid } = await params; // Fix 1: Await params

    if (!uid || uid === 'undefined') {
        return NextResponse.json({ error: 'Missing UID' }, { status: 400 });
    }

    if (!pool) return NextResponse.json({ error: 'DB Config Error' }, { status: 500 });

    try {
        const body = await request.json();
        console.log('[API_USER_UPDATE] Incoming Body:', JSON.stringify(body, null, 2));

        const profileData = body.profileData || body;

        // Use undefined check instead of truthy check to allow clearing if needed (though COALESCE usually protects against null)
        const firstName = profileData.firstName;
        const lastName = profileData.lastName;
        const jobFunction = profileData.function;
        const phone = profileData.phone;

        // Correctly parse UAI/ID_ESTABLISHMENT
        const targetUai = profileData.uai || body.uai || profileData.id_establishment || body.id_establishment || null;

        // Extract School Metadata for Auto-Creation (UPSERT)
        const schoolName = profileData.schoolName || body.schoolName;
        const schoolAddress = profileData.schoolAddress || body.schoolAddress;
        const schoolCity = profileData.schoolCity || body.schoolCity;
        const schoolZip = profileData.schoolZip || body.schoolZip;

        console.log('[API_USER_UPDATE] Extracted Fields:', {
            firstName: firstName,
            lastName: lastName,
            targetUai: targetUai,
            schoolName: schoolName
        });

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Fetch User First (Need email/role for Admin Association)
            const currentRes = await client.query('SELECT * FROM users WHERE uid = $1', [uid]);
            const currentUser = currentRes.rows[0];

            if (!currentUser) throw new Error("User not found during update");

            // 2. ESTABLISHMENT UPSERT (Critical for FK Constraint)
            if (targetUai) {
                // Special Case: Sandbox
                if (targetUai === '9999999X') {
                    await client.query(`
                        INSERT INTO establishments (uai, name, address, city, postal_code, type, telephone, admin_email)
                        VALUES ('9999999X', 'Mon LYCEE TOUTFAUX', '12 Rue Ampère', 'Elbeuf', '76500', 'LP', '02 35 77 77 77', 'pledgeum@gmail.com')
                        ON CONFLICT (uai) DO NOTHING;
                    `);
                } else {
                    // Start of UPSERT for real schools
                    const fallbackName = currentUser.ecole_nom || 'École inconnue';
                    const finalSchoolName = schoolName || fallbackName;

                    if (finalSchoolName) {
                        console.log(`[API_USER_UPDATE] Upserting Establishment ${targetUai} with name ${finalSchoolName}...`);

                        // Determine Admin Email (Only if School Head)
                        const adminEmailToSet = currentUser.role === 'school_head' ? currentUser.email : null;

                        // We use a smart Upsert that tries to set admin_email if it's new
                        const upsertQuery = `
                            INSERT INTO establishments (uai, name, address, city, postal_code, type, admin_email)
                            VALUES ($1, $2, $3, $4, $5, 'EPLE', $6)
                            ON CONFLICT (uai) DO UPDATE 
                            SET name = EXCLUDED.name,
                                address = EXCLUDED.address,
                                city = EXCLUDED.city,
                                postal_code = EXCLUDED.postal_code,
                                updated_at = NOW();
                        `;
                        // Note: We do NOT update admin_email on conflict to prevent overwriting existing admins

                        await client.query(upsertQuery, [
                            targetUai,
                            finalSchoolName,
                            schoolAddress || '',
                            schoolCity || '',
                            schoolZip || '',
                            adminEmailToSet
                        ]);
                    } else {
                        console.warn(`[API_USER_UPDATE] Target UAI ${targetUai} present but no School Name provided. Skipping Upsert. This might fail if UAI doesn't exist.`);
                    }
                }
            }

            // Address Handling
            let addressStr = null;
            if (profileData.address) {
                if (typeof profileData.address === 'string') {
                    addressStr = profileData.address;
                } else if (typeof profileData.address === 'object') {
                    addressStr = `${profileData.address.street || ''} ${profileData.address.postalCode || ''} ${profileData.address.city || ''}`.trim();
                }
            }

            // Fix 3: Use COALESCE in SQL to prevent overwriting existing data with NULLs from a partial update
            // We pass parameters. If a parameter is undefined in JS (which becomes null in SQL param), 
            // COALESCE($n, column) will keep the existing column value.
            const updateQuery = `
                UPDATE users 
                SET first_name = COALESCE($1, first_name), 
                    last_name = COALESCE($2, last_name), 
                    phone = COALESCE($3, phone),
                    address = COALESCE($4, address),
                    establishment_uai = COALESCE($5, establishment_uai),
                    job_function = COALESCE($6, job_function),
                    updated_at = NOW()
                WHERE uid = $7
                RETURNING *
            `;

            // Note: In Postgres node driver, 'undefined' usually throws or is not allowed. 
            // We must ensure we pass 'null' if we really mean null, or if we want COALESCE to skip it.
            // But here, we want 'undefined' in the payload to mean "do not update".
            // So we explicitly check if the var is strictly undefined.
            // However, to keep it simple with pg driver, we will pass explicit NULLs where we don't have a value,
            // and rely on COALESCE to ignore those NULLs.
            // CAUTION: If we *want* to set a field to NULL, this logic prevents it. 
            // But for profile updates, we rarely want to erase data to NULL.

            const res = await client.query(updateQuery, [
                firstName === undefined ? null : firstName,
                lastName === undefined ? null : lastName,
                phone === undefined ? null : phone,
                addressStr === undefined ? null : addressStr,
                targetUai === undefined ? null : targetUai,
                jobFunction === undefined ? null : jobFunction,
                uid
            ]);

            await client.query('COMMIT');

            return NextResponse.json({ success: true, user: res.rows[0] });

        } catch (error: any) {
            await client.query('ROLLBACK');

            const errorDetails = {
                message: error.message,
                code: error.code,
                detail: error.detail,
                constraint: error.constraint,
                table: error.table
            };

            console.error('[API_USER_UPDATE] SQL/DB Error:', JSON.stringify(errorDetails, null, 2));

            // Return meaningful error to frontend
            return NextResponse.json({
                error: 'Database Error',
                message: error.message,
                details: errorDetails
            }, { status: 500 }); // Keep 500 but with details
        } finally {
            client.release();
        }

    } catch (error: any) {
        console.error('[API_USER_UPDATE] Final Catch:', error);
        return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
    }
}
