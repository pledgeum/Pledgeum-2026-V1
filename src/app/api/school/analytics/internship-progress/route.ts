import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    let client;
    try {
        const { searchParams } = new URL(req.url);
        const uai = searchParams.get('uai');

        if (!uai) {
            return NextResponse.json({ error: "UAI required" }, { status: 400 });
        }

        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userRole = session.user.role;
        const userUai = session.user.establishment_uai || (session.user as any).uai;
        const isAdmin = userRole === 'admin' || userRole === 'SUPER_ADMIN';

        // Authorized roles for school direction + Teachers (for their own classes filtering)
        const authorizedRoles = ['school_head', 'ddfpt', 'at_ddfpt', 'business_manager', 'assistant_manager', 'stewardship_secretary', 'ESTABLISHMENT_ADMIN', 'teacher', 'teacher_tracker'];
        
        if (!isAdmin && (userUai !== uai || !authorizedRoles.includes(userRole))) {
            return NextResponse.json({ error: "Forbidden: Access restricted to authorized roles" }, { status: 403 });
        }

        client = await pool.connect();

        // 1. Fetch Classes with total student count
        const classesQuery = `
            SELECT id, name, pfmp_periods, 
              (SELECT COUNT(*) FROM users s WHERE s.class_id = c.id AND s.role = 'student') as total_students
            FROM classes c
            WHERE establishment_uai = $1 
              AND pfmp_periods IS NOT NULL 
              AND pfmp_periods::text != '[]'
        `;
        const classesRes = await client.query(classesQuery, [uai]);

        // 2. Fetch all validated conventions for the school with student association
        const conventionsQuery = `
            SELECT conv.student_uid, conv.date_start, conv.date_end, s.class_id
            FROM conventions conv
            JOIN users s ON conv.student_uid = s.uid
            WHERE s.establishment_uai = $1 
              AND conv.status IN ('VALIDATED', 'VALIDATED_HEAD', 'SIGNED', 'COMPLETED')
        `;
        const conventionsRes = await client.query(conventionsQuery, [uai]);
        const allConventions = conventionsRes.rows;

        // 3. Process data: FlatMap periods and Deduplicate students
        const result: any[] = [];

        classesRes.rows.forEach((cls: any) => {
            const periods = cls.pfmp_periods || [];
            const totalStudents = parseInt(cls.total_students, 10);
            if (totalStudents === 0) return; // Skip classes with no students

            periods.forEach((period: any, index: number) => {
                const startDate = period.startDate;
                const endDate = period.endDate;
                if (!startDate) return;

                const periodStart = new Date(startDate);
                // If no end date, treat as a single day period for overlap calculation
                const periodEnd = endDate ? new Date(endDate) : periodStart;

                // Title: className + Period Label
                const periodLabel = period.label || `Période ${index + 1}`;
                const className = `${cls.name} (${periodLabel})`;

                // Filter conventions for this class and this period (with overlap)
                const uniqueStudents = new Set();
                
                allConventions.forEach((conv: any) => {
                    // Check if student belongs to this class
                    if (conv.class_id !== cls.id) return;

                    // Check date overlap
                    const convStart = conv.date_start ? new Date(conv.date_start) : null;
                    const convEnd = conv.date_end ? new Date(conv.date_end) : convStart;

                    if (!convStart || !convEnd) return;

                    // Overlap logic: (StartA <= EndB) and (EndA >= StartB)
                    const isOverlap = (convStart <= periodEnd) && (convEnd >= periodStart);

                    if (isOverlap) {
                        uniqueStudents.add(conv.student_uid);
                    }
                });

                result.push({
                    id: `${cls.id}_${index}`,
                    className,
                    startDate,
                    totalStudents,
                    conventionsValidated: uniqueStudents.size
                });
            });
        });

        // 4. Sort results chronologically by period startDate
        result.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

        return NextResponse.json({ data: result });

    } catch (error: any) {
        console.error("[API] GET Internship Progress Analytics Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        if (client) client.release();
    }
}
