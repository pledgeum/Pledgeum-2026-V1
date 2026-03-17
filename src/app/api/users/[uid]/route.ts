export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import { auth } from '@/auth';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ uid: string }> } // Fix 1: Type params as Promise
) {
    const { uid } = await params; // Fix 1: Await params

    const session = await auth();
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Authorization: User can only access their own profile unless they are an admin/DDFPT
    const isAdmin = session.user.role === 'admin' || session.user.role === 'SUPER_ADMIN' || session.user.role === 'ddfpt' || session.user.role === 'school_head';
    if (session.user.id !== uid && !isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!uid || uid === 'undefined') {
        return NextResponse.json({ error: 'Missing UID' }, { status: 400 });
    }

    if (!pool) {
        return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
    }

    const client = await pool.connect();
    try {
        // 1. Fetch User (Base) with Class Name (Left Join)
        const query = `
            SELECT 
                u.uid, u.email, u.role, u.first_name, u.last_name, 
                u.phone, u.address, u.job_function, u.birth_date, 
                u.zip_code, u.city, u.class_id, u.diploma_prepared, 
                u.legal_representatives, u.establishment_uai, u.has_accepted_tos,
                u.prox_commune, u.prox_commune_zip, u.prox_commune_lat, u.prox_commune_lon,
                c.name as class_name 
            FROM users u
            LEFT JOIN classes c ON u.class_id = c.id
            WHERE u.uid = $1
        `;
        const res = await client.query(query, [uid]);

        if (!res.rowCount || res.rowCount === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const user = res.rows[0];
        let establishmentUai = null;
        let establishmentData = null;

        // 2. Fetch Establishment Context (For School Head)
        // 2. Fetch Establishment Context (For School Head)
        if (user.role === 'school_head') {
            const estQuery = `SELECT uai, name, address, city, postal_code, type FROM establishments WHERE admin_email = $1`;
            const estRes = await client.query(estQuery, [user.email]);
            if (estRes.rowCount && estRes.rowCount > 0) {
                establishmentUai = estRes.rows[0].uai;
                establishmentData = estRes.rows[0];
            }
        } else if (user.establishment_uai) {
            const estQuery = `SELECT uai, name, address, city, postal_code, type FROM establishments WHERE uai = $1`;
            const estRes = await client.query(estQuery, [user.establishment_uai]);
            if (estRes.rowCount && estRes.rowCount > 0) {
                establishmentData = estRes.rows[0];
            }
        }

        // 3. Construct Profile Data & Flatten Response
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

            // Student Specific
            birthDate: user.birth_date ? new Date(user.birth_date).toISOString() : null, // Fix: Add birthDate
            zipCode: user.zip_code || null,   // Fix: Add zipCode
            city: user.city || null,          // Fix: Add city
            class: user.class_name || null, // Fix: Add Class Name
            classId: user.class_id || null, // Fix: Add Class ID
            diploma: user.diploma_prepared || null, // Fix: Add Diploma
            legalRepresentatives: user.legal_representatives || [], // Fix: Add Legal Reps
            proxCommune: user.prox_commune || null, // Add prox_commune
            proxCommuneZip: user.prox_commune_zip || null,
            proxCommuneLat: user.prox_commune_lat || null,
            proxCommuneLon: user.prox_commune_lon || null,

            // Legacy / Helper fields
            uai: user.establishment_uai || establishmentUai,
            schoolId: user.establishment_uai || establishmentUai,
            schoolName: establishmentData ? establishmentData.name : undefined, // Fix: Add schoolName
            ecole_nom: establishmentData ? establishmentData.name : undefined,
            id_establishment: user.establishment_uai || establishmentUai,

            hasAcceptedTos: user.has_accepted_tos || false,

            // Keep profileData for backward compatibility if needed, but ideally frontend uses top-level now
            profileData: {
                firstName: user.first_name || '',
                lastName: user.last_name || '',
                email: user.email || '', // Fix: Add email to profileData
                function: user.job_function || (establishmentData ? 'Proviseur' : undefined),
                phone: user.phone || undefined,
                address: user.address || undefined,
                schoolName: establishmentData ? establishmentData.name : undefined, // Fix: Add schoolName
                ecole_nom: establishmentData ? establishmentData.name : undefined,
                id_establishment: user.establishment_uai || establishmentUai,
                uai: user.establishment_uai || establishmentUai,
                zipCode: user.zip_code || undefined, // Fix: Add zipCode
                city: user.city || undefined,        // Fix: Add city
                class: user.class_name || undefined, // Fix: Add Class to profileData
                classId: user.class_id || undefined, // Fix: Add classId to profileData
                birthDate: user.birth_date ? new Date(user.birth_date).toISOString() : undefined, // Fix: Add birthDate to profileData
                diploma: user.diploma_prepared || undefined, // Fix: Add Diploma
                legalRepresentatives: user.legal_representatives || [], // Fix: Add Legal Reps
                proxCommune: user.prox_commune || undefined, // Add prox_commune to profileData
                proxCommuneZip: user.prox_commune_zip || undefined,
                proxCommuneLat: user.prox_commune_lat || undefined,
                proxCommuneLon: user.prox_commune_lon || undefined,
            }
        };

        return NextResponse.json({
            user: mappedUser,
            source: 'postgres'
        });

    } catch (error) {
        console.error('[API_USER_GET] Error:', error);
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

    const session = await auth();
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Authorization: Only the user themselves or an admin can update the profile
    const isAdmin = session.user.role === 'admin' || session.user.role === 'SUPER_ADMIN';
    if (session.user.id !== uid && !isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
        const schoolStatus = profileData.schoolStatus || body.schoolStatus || profileData.status || body.status || 'BETA';

        // Diploma & Legal Reps
        const diploma = profileData.diploma || body.diploma;
        const legalRepresentatives = profileData.legalRepresentatives || body.legalRepresentatives; // Expected to be Array

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
                if (targetUai === '9999999Z') {
                    await client.query(`
                        INSERT INTO establishments (uai, name, address, city, postal_code, type, telephone, admin_email, subscription_status)
                        VALUES ('9999999Z', 'Lycée de Démonstration (Sandbox)', '12 Rue Ampère', 'Elbeuf', '76500', 'LP', '02 35 77 77 77', 'pledgeum@gmail.com', 'ADHERENT')
                        ON CONFLICT (uai) DO UPDATE SET subscription_status = 'ADHERENT';
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
                            INSERT INTO establishments (uai, name, address, city, postal_code, type, admin_email, subscription_status)
                            VALUES ($1, $2, $3, $4, $5, 'EPLE', $6, $7)
                            ON CONFLICT (uai) DO UPDATE 
                            SET name = EXCLUDED.name,
                                address = CASE WHEN EXCLUDED.address <> '' THEN EXCLUDED.address ELSE establishments.address END,
                                city = CASE WHEN EXCLUDED.city <> '' THEN EXCLUDED.city ELSE establishments.city END,
                                postal_code = CASE WHEN EXCLUDED.postal_code <> '' THEN EXCLUDED.postal_code ELSE establishments.postal_code END,
                                subscription_status = EXCLUDED.subscription_status,
                                updated_at = NOW();
                        `;
                        // Note: We do NOT update admin_email on conflict to prevent overwriting existing admins

                        await client.query(upsertQuery, [
                            targetUai,
                            finalSchoolName,
                            schoolAddress || '',
                            schoolCity || '',
                            schoolZip || '',
                            adminEmailToSet,
                            schoolStatus
                        ]);
                    } else {
                        console.warn(`[API_USER_UPDATE] Target UAI ${targetUai} present but no School Name provided. Skipping Upsert. This might fail if UAI doesn't exist.`);
                    }
                }
            }

            // Address Handling
            // We now support zip_code and city columns.
            // Address column should primarily store the Street part now, OR the full string if legacy.
            // But to avoid duplication issues, if we have zip/city, 'address' usually acts as 'Street Address'.



            let addressStr = profileData.address;

            // Fix: Ensure addressStr is a clean string (Street only)
            if (addressStr) {
                if (typeof addressStr === 'object') {
                    // Extract street from object
                    addressStr = addressStr.street || addressStr.address || '';
                } else if (typeof addressStr === 'string' && addressStr.trim().startsWith('{')) {
                    // Start of JSON? Try to parse
                    try {
                        const parsed = JSON.parse(addressStr);
                        addressStr = parsed.street || parsed.address || addressStr; // valid fallback?
                    } catch (e) {
                        // Not valid JSON, keep origin
                    }
                }
            }

            // If still object (rare), coerce to string but warn? 
            // Should be string by now.

            let zipStr = profileData.zipCode || (typeof profileData.address === 'object' ? profileData.address.postalCode : null);
            let cityStr = profileData.city || (typeof profileData.address === 'object' ? profileData.address.city : null);

            // Fallback: If only full address string provided but no zip/city in payload (rare for new UI), try to parse? 
            // No, trust payload. If user sends empty zip, it's empty.

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
                    zip_code = COALESCE($7, zip_code),
                    city = COALESCE($8, city),
                    diploma_prepared = COALESCE($9, diploma_prepared),
                    legal_representatives = COALESCE($10, legal_representatives),
                    prox_commune = COALESCE($11, prox_commune),
                    prox_commune_zip = COALESCE($12, prox_commune_zip),
                    prox_commune_lat = COALESCE($13, prox_commune_lat),
                    prox_commune_lon = COALESCE($14, prox_commune_lon),
                    updated_at = NOW()
                WHERE uid = $15
                RETURNING uid, email, role, first_name, last_name, phone, address, 
                          establishment_uai, job_function, zip_code, city, 
                          diploma_prepared, legal_representatives, prox_commune, 
                          prox_commune_zip, updated_at
            `;

            const proxCommune = profileData.proxCommune || body.proxCommune;
            const proxCommuneZip = profileData.proxCommuneZip || body.proxCommuneZip;
            const proxCommuneLat = profileData.proxCommuneLat || body.proxCommuneLat;
            const proxCommuneLon = profileData.proxCommuneLon || body.proxCommuneLon;

            const res = await client.query(updateQuery, [
                firstName === undefined ? null : firstName,
                lastName === undefined ? null : lastName,
                phone === undefined ? null : phone,
                addressStr === undefined ? null : addressStr,
                targetUai === undefined ? null : targetUai,
                jobFunction === undefined ? null : jobFunction,
                zipStr === undefined ? null : zipStr,
                cityStr === undefined ? null : cityStr,
                diploma === undefined ? null : diploma,
                legalRepresentatives === undefined ? null : JSON.stringify(legalRepresentatives),
                proxCommune === undefined ? null : proxCommune,
                proxCommuneZip === undefined ? null : proxCommuneZip,
                proxCommuneLat === undefined ? null : proxCommuneLat,
                proxCommuneLon === undefined ? null : proxCommuneLon,
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
