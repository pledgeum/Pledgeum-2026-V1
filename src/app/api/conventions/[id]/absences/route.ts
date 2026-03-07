import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sendEmail } from '@/lib/email';
import pool from '@/lib/pg';

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    let client;
    try {
        const session = await auth();
        if (!session || !session.user || !session.user.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const resolvedParams = await params;
        const reporterEmail = session.user.email;
        const reporterName = session.user.name || reporterEmail;
        const reporterRole = (session.user as any).role;

        const roleMap: Record<string, string> = {
            'teacher': 'Professeur',
            'student': 'Élève',
            'tutor': 'Tuteur',
            'school_admin': "Chef d'établissement / DDFPT",
            'admin': 'Administrateur',
            'parent': 'Responsable Légal',
            'cpe': 'CPE'
        };
        const reporterRoleFr = reporterRole ? (roleMap[reporterRole] || reporterRole) : 'Utilisateur';

        const conventionId = resolvedParams.id;

        // --- HARD LOGGING ---
        try {
            require('fs').appendFileSync('/tmp/debug_pfmp.log', `POST RECU. ID= "${conventionId}"\n`);
        } catch (e) { }

        const data = await req.json();

        console.log(`[API_ABSENCE_DEBUG] POST URL ID: "${conventionId}"`, data); // Changed this line

        const { type, date, duration, reason } = data;

        if (!type || !date) {
            console.error("[API_ABSENCE_DEBUG] Missing type or date");
            return NextResponse.json({ error: 'Champs type et date obligatoires.' }, { status: 400 });
        }

        client = await pool.connect();

        // --- 1. Fetch convention details for the email context ---
        const convRes = await client.query(`
            SELECT 
                metadata->>'eleve_prenom' AS eleve_prenom, 
                metadata->>'eleve_nom' AS eleve_nom, 
                (metadata->>'est_mineur')::boolean AS est_mineur, 
                metadata->>'prof_email' AS prof_email, 
                metadata->>'rep_legal_email' AS rep_legal_email, 
                metadata->>'cpe_email' AS cpe_email 
            FROM conventions 
            WHERE id = $1
        `, [conventionId]);

        if (convRes.rows.length === 0) {
            return NextResponse.json({ error: `Convention introuvable en BDD. ID cherché: "${conventionId}"` }, { status: 404 });
        }

        const convention = convRes.rows[0];

        // --- 2. Persist Absence to PostgreSQL ---
        const insertQuery = `
            INSERT INTO absences (convention_id, type, date, duration, reason, reported_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, type, date, duration, reason, reported_by AS "reportedBy", reported_at AS "reportedAt"
        `;

        const insertRes = await client.query(insertQuery, [
            conventionId,
            type, // 'absence' or 'retard'
            date,
            Number(duration) || 0,
            reason || '',
            reporterEmail
        ]);

        const newAbsence = insertRes.rows[0];

        // --- 3. Fire-and-Forget Notification Email Logic ---
        // (We do this asynchronously so we don't block the API response to the client)
        const sendNotifications = async () => {
            const subject = `[PFMP] Signalement d'absence - ${convention.eleve_prenom} ${convention.eleve_nom}`;
            const actionStr = type === 'absence' ? 'Une absence a été signalée' : 'Un retard a été signalé';
            // Formatted text body
            const message = `
Bonjour,

${actionStr} pour l'élève ${convention.eleve_prenom} ${convention.eleve_nom}.

Détails :
- Type : ${type === 'absence' ? 'Absence' : 'Retard'}
- Date : ${new Date(date).toLocaleDateString('fr-FR')}
- Durée : ${duration} heures
- Justification : ${reason || 'Aucune'}

Signalé par : ${reporterName} (${reporterRoleFr} - ${reporterEmail})

Cordialement,
Le service scolarité et stages.
             `.trim();

            // Destinataires (Logic from previous Firestore auditing)
            const recipients: string[] = [];
            if (convention.prof_email) recipients.push(convention.prof_email);
            if (convention.est_mineur && convention.rep_legal_email) recipients.push(convention.rep_legal_email);
            if (convention.cpe_email) recipients.push(convention.cpe_email);

            const uniqueRecipients = Array.from(new Set(recipients));

            for (const email of uniqueRecipients) {
                try {
                    // Send explicit API backend mailer
                    await sendEmail({
                        to: email,
                        subject: subject,
                        text: message
                    });

                    // Insert In-App Notification (Cloche) for this user
                    try {
                        let notifClient = await pool.connect();
                        await notifClient.query(`
                            INSERT INTO notifications (recipient_email, title, message)
                            VALUES ($1, $2, $3)
                        `, [email, subject, message]);
                        notifClient.release();
                    } catch (dbErr) {
                        console.error(`[DB-NOTIF FAIL] for ${email}`, dbErr);
                    }

                    console.log(`[ABSENCE-MAIL] Notification send to ${email}`);
                } catch (e) {
                    console.error(`[ABSENCE-MAIL FAIL] for ${email}`, e);
                }
            }
        };

        // Do not await this purposefully
        sendNotifications();

        return NextResponse.json(newAbsence, { status: 201 });

    } catch (error: any) {
        console.error("Erreur serveur lors de la déclaration d'absence :", error);
        return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
    } finally {
        if (client) client.release();
    }
}
