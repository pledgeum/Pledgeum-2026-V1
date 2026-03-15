
import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import { auth } from '@/auth';

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: conventionId } = await params;
        const body = await req.json();

        // Remove ID from body if present to avoid updating it
        const { id, ...updates } = body;

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ success: true, message: 'No updates provided' });
        }

        // Map frontend camelCase to DB snake_case
        const fieldMap: Record<string, string> = {
            dateStart: 'date_start',
            dateEnd: 'date_end',
            studentId: 'student_uid',
            companySiret: 'company_siret',
            tutorName: 'tutor_name',
            tutorEmail: 'tutor_email',
            tutorPhone: 'tutor_phone',
            tutorFunction: 'tutor_function',
            mentorName: 'mentor_name',
            mentorEmail: 'mentor_email',
            mentorPhone: 'mentor_phone',
            mentorFunction: 'mentor_function',
            stageTitle: 'stage_title',
            missionObjectives: 'mission_objectives',
            mainActivities: 'main_activities',
            skillsDeveloped: 'skills_developed',
            weeklyHours: 'weekly_hours',
            dailySchedule: 'daily_schedule',
            workConditions: 'work_conditions',
            healthSafety: 'health_safety',
            companyName: 'ent_nom',
            companyAddress: 'ent_adresse',
            companyZip: 'ent_code_postal',
            companyCity: 'ent_ville',
            companyEmail: 'ent_email',
            companyPhone: 'ent_phone',
            representativeName: 'ent_rep_nom',
            representativeEmail: 'ent_rep_email',
            representativeFunction: 'ent_rep_fonction',
            studentPhone: 'eleve_telephone',
            studentAddress: 'eleve_adresse',
            studentZip: 'eleve_code_postal',
            studentCity: 'eleve_ville',
            studentClass: 'eleve_classe',
            studentBirthDate: 'eleve_date_naissance',
            studentSecu: 'eleve_secu',
            legalRepName: 'rep_legal_nom',
            legalRepEmail: 'rep_legal_email',
            legalRepPhone: 'rep_legal_phone',
            legalRepAddress: 'rep_legal_adresse',
            legalRepZip: 'rep_legal_code_postal',
            legalRepCity: 'rep_legal_ville',
            establishmentUai: 'establishment_uai',
            headName: 'ecole_chef_nom',
            headEmail: 'ecole_chef_email',
            teacherName: 'prof_nom',
            teacherEmail: 'prof_email',
            assuranceName: 'assurance_nom',
            assurancePolicy: 'assurance_police',
            is_out_of_period: 'is_out_of_period'
        };

        // Fields that are stored in metadata JSONB instead of columns
        // We will put UNMAPPED fields into metadata
        const dbUpdates: any = {};
        const metadataUpdates: any = {};
        let hasMetadataUpdates = false;

        // Fetch current metadata first if we need to merge
        // Optimization: build queries dynamically

        for (const [key, value] of Object.entries(updates)) {
            if (fieldMap[key]) {
                dbUpdates[fieldMap[key]] = value;
            } else if (key === 'metadata') {
                // If explicit metadata passed, merge it
                // Logic to handle metadata deep merge is complex, assume partial update for now
                // or just store what is passed if it's not a collision
            } else {
                // Unknown field -> Put in metadata
                metadataUpdates[key] = value;
                hasMetadataUpdates = true;
            }
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const setClauses: string[] = [];
            const values: any[] = [];
            let pIdx = 1;

            for (const [col, val] of Object.entries(dbUpdates)) {
                setClauses.push(`${col} = $${pIdx}`);
                values.push(val);
                pIdx++;
            }

            // Handle metadata merge
            if (hasMetadataUpdates) {
                // We use COALESCE(metadata, '{}') || $param
                setClauses.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${pIdx}::jsonb`);
                values.push(JSON.stringify(metadataUpdates));
                pIdx++;
            }

            setClauses.push(`updated_at = NOW()`);

            // If no fields to update, return early (e.g. only unknown fields that we decided not to store?) 
            // We always have metadataUpdates if unmapped fields exist.

            if (setClauses.length === 1) { // Only updated_at
                // Nothing to do really, but update timestamp
            }

            const query = `
                UPDATE conventions 
                SET ${setClauses.join(', ')}
                WHERE id = $${pIdx}
                RETURNING *
            `;
            values.push(conventionId);

            const res = await client.query(query, values);

            if (res.rowCount === 0) {
                await client.query('ROLLBACK');
                return NextResponse.json({ error: 'Convention not found' }, { status: 404 });
            }

            await client.query('COMMIT');

            return NextResponse.json({ success: true, data: res.rows[0] });

        } catch (error: any) {
            await client.query('ROLLBACK');
            console.error('[API_UPDATE_CONVENTION] Error:', error);
            return NextResponse.json({ error: 'Database error', details: error.message }, { status: 500 });
        } finally {
            client.release();
        }

    } catch (error: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
