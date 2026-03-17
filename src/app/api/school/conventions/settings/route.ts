import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import { z } from 'zod';
import { auth } from '@/auth';
import { CONVENTION_TYPES } from '@/config/conventionTypes';

const SettingsSchema = z.object({
    uai: z.string().min(1),
    convention_type_id: z.string().min(1),
    class_ids: z.array(z.string()),
});

export async function GET(req: Request) {
    let client;
    try {
        const { searchParams } = new URL(req.url);
        const uai = searchParams.get('uai');

        if (!uai) {
            return NextResponse.json({ error: "UAI required" }, { status: 400 });
        }

        const session = await auth();
        // Authorization check: User must belong to the school or be an admin
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userUai = session.user.establishment_uai || (session.user as any).uai;
        const isAdmin = session.user.role === 'admin' || session.user.role === 'SUPER_ADMIN';

        if (!isAdmin && userUai !== uai) {
            return NextResponse.json({ error: "Forbidden: Context mismatch" }, { status: 403 });
        }

        client = await pool.connect();
        const res = await client.query(`
            SELECT convention_type_id, class_ids
            FROM school_convention_settings
            WHERE school_uai = $1
        `, [uai]);

        return NextResponse.json({ 
            settings: res.rows,
            available_types: CONVENTION_TYPES 
        });
    } catch (error: any) {
        console.error("[API] GET School Convention Settings Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        if (client) client.release();
    }
}

export async function POST(req: Request) {
    let client;
    try {
        const session = await auth();
        // Only School Head or Establishment Admin can modify settings
        const allowedRoles = ['school_head', 'ESTABLISHMENT_ADMIN', 'admin', 'SUPER_ADMIN'];
        if (!session?.user || !allowedRoles.includes(session.user.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const { uai, convention_type_id, class_ids } = SettingsSchema.parse(body);

        const userUai = session.user.establishment_uai || (session.user as any).uai;
        const isAdmin = session.user.role === 'admin' || session.user.role === 'SUPER_ADMIN';

        if (!isAdmin && userUai !== uai) {
            return NextResponse.json({ error: "Forbidden: Context mismatch" }, { status: 403 });
        }

        // Validate convention_type_id exists in our config
        if (!Object.values(CONVENTION_TYPES).some(type => type.id === convention_type_id)) {
            return NextResponse.json({ error: "Invalid convention type ID" }, { status: 400 });
        }

        client = await pool.connect();

        // Upsert logic: Update if exists for this school and type, otherwise insert
        await client.query(`
            INSERT INTO school_convention_settings (school_uai, convention_type_id, class_ids, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (school_uai, convention_type_id)
            DO UPDATE SET 
                class_ids = EXCLUDED.class_ids,
                updated_at = NOW()
        `, [uai, convention_type_id, JSON.stringify(class_ids)]);

        return NextResponse.json({ success: true });

    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 });
        }
        console.error("[API] POST School Convention Settings Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        if (client) client.release();
    }
}
