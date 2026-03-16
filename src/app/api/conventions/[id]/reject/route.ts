
import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import { auth } from '@/auth';
import { updateConventionStatus } from '@/lib/workflow';
import { sendEmail } from '@/lib/email';
import { sendNotification, createInAppNotification } from '@/lib/notification';

const ROLE_LABELS: Record<string, string> = {
    'student': "L'élève",
    'tutor': "Le tuteur de stage",
    'company_head': "Le représentant de l'entreprise",
    'company_head_tutor': "Le représentant de l'entreprise et tuteur",
    'teacher': "L'enseignant référent",
    'school_head': "Le chef d'établissement",
    'rep_legal': "Le représentant légal",
    'parent': "Le représentant légal"
};

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: conventionId } = await params;
        const { reason, role } = await req.json();

        if (!reason || !role) {
            return NextResponse.json({ error: 'Motif et rôle requis' }, { status: 400 });
        }

        const client = await pool.connect();
        try {
            // 1. Fetch current convention to get student info and verify existence
            const convRes = await client.query(
                'SELECT metadata, student_uid, establishment_uai FROM conventions WHERE id = $1',
                [conventionId]
            );

            if (convRes.rowCount === 0) {
                return NextResponse.json({ error: 'Convention non trouvée' }, { status: 404 });
            }

            const convention = convRes.rows[0];
            const metadata = convention.metadata || {};
            const studentName = metadata.eleve_nom ? `${metadata.eleve_prenom} ${metadata.eleve_nom}` : "l'élève";
            
            // 2. Update Status to REJECTED via workflow helper
            const actorEmail = session.user.email || 'unknown';
            const roleLabel = ROLE_LABELS[role] || role;
            
            const updatedConvention = await updateConventionStatus(
                conventionId,
                'REJECTED',
                {
                    reason: reason,
                    rejectedByLabel: roleLabel,
                    rejectedByRole: role,
                    actorId: session.user.id,
                    auditLog: {
                        date: new Date().toISOString(),
                        action: 'REJECTED',
                        actorEmail: actorEmail,
                        details: `Convention refusée par ${roleLabel}. Motif : ${reason}`,
                        ip: req.headers.get('x-forwarded-for') || 'unknown'
                    }
                }
            );

            // 3. Trigger Notifications (Non-blocking)
            const notificationTasks: Promise<any>[] = [];
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.pledgeum.fr';

            // Recipients
            const studentEmail = metadata.eleve_email;
            const parentEmail = metadata.rep_legal_email;
            const teacherEmail = metadata.prof_suivi_email || metadata.teacher_email;

            const subject = `❌ Convention de stage REFUSÉE - ${studentName}`;
            const message = `Bonjour,\n\nLa convention de stage pour ${studentName} a été refusée par ${roleLabel} (${actorEmail}) pour le motif suivant :\n\n"${reason}"\n\nCette convention est désormais annulée. Veuillez en créer une nouvelle en tenant compte de ce motif.\n\nAccéder à votre tableau de bord : ${appUrl}/dashboard\n\nCordialement,\nL'équipe Pledgeum`;

            // Notify Rejector (Confirmation)
            notificationTasks.push(sendEmail({ to: actorEmail, subject, text: message }).catch(e => console.error("[Reject] Confirm email failed", e)));

            // Notify Student
            if (studentEmail) {
                notificationTasks.push(sendEmail({ to: studentEmail, subject, text: message }).catch(e => console.error("[Reject] Student email failed", e)));
                if (convention.student_uid) {
                    notificationTasks.push(createInAppNotification(convention.student_uid, subject, message).catch(e => console.error("[Reject] Student in-app failed", e)));
                }
            }

            // Notify Parent
            if (parentEmail && metadata.est_mineur) {
                notificationTasks.push(sendEmail({ to: parentEmail, subject, text: message }).catch(e => console.error("[Reject] Parent email failed", e)));
            }

            // Notify Teacher
            if (teacherEmail) {
                notificationTasks.push(sendEmail({ to: teacherEmail, subject, text: message }).catch(e => console.error("[Reject] Teacher email failed", e)));
            }

            // Notify Company Head
            const companyEmail = metadata.ent_rep_email;
            if (companyEmail && actorEmail !== companyEmail) {
                notificationTasks.push(sendEmail({ to: companyEmail, subject, text: message }).catch(e => console.error("[Reject] Company email failed", e)));
            }

            // Execute notifications
            Promise.allSettled(notificationTasks).then(results => {
                console.log(`[Rejection Engine] Notifications sent: ${results.length}`);
            });

            return NextResponse.json({ 
                success: true, 
                message: 'Convention refusée et notifications envoyées' 
            });

        } finally {
            client.release();
        }

    } catch (error: any) {
        console.error('[REJECT_API_ERROR]', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
