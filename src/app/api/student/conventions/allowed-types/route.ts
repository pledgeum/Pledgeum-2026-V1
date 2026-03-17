import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import { auth } from '@/auth';
import { CONVENTION_TYPES } from '@/config/conventionTypes';

export async function GET(req: Request) {
    let client;
    try {
        const { searchParams } = new URL(req.url);
        const uai = searchParams.get('uai');
        const classId = searchParams.get('classId');

        if (!uai || !classId) {
            return NextResponse.json({ error: "UAI and classId required" }, { status: 400 });
        }

        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Basic sanity check: Student can only query their own school settings
        // Note: For simplicity and debugging, we might allow it if session exists, 
        // but strict check would be: session.user.establishment_uai === uai
        
        client = await pool.connect();
        
        // Fetch all convention settings for this school
        const res = await client.query(`
            SELECT convention_type_id, class_ids
            FROM school_convention_settings
            WHERE school_uai = $1
        `, [uai]);

        // Filter types allowed for this specific classId
        const allowedTypes = res.rows
            .filter(row => {
                const classIds = row.class_ids;
                // row.class_ids is stored as JSONB array of strings
                return Array.isArray(classIds) && classIds.includes(classId);
            })
            .map(row => {
                const typeInfo = Object.values(CONVENTION_TYPES).find(t => t.id === row.convention_type_id);
                return {
                    id: row.convention_type_id,
                    label: typeInfo?.label || row.convention_type_id
                };
            });

        // If no specifically allowed types found, we might want to default to PFMP_STANDARD 
        // or return empty if we want strict enforcement.
        // Business rule: If no settings found for the school/class, we default to PFMP_STANDARD.
        if (allowedTypes.length === 0) {
            allowedTypes.push({
                id: 'PFMP_STANDARD',
                label: CONVENTION_TYPES.PFMP_STANDARD.label
            });
        }

        return NextResponse.json({ 
            allowedTypes 
        });
    } catch (error: any) {
        console.error("[API] GET Allowed Convention Types Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        if (client) client.release();
    }
}
