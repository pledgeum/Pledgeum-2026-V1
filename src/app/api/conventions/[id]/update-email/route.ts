
import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import { auth } from '@/auth';
import { sendConventionInvitation } from '@/app/actions/notifications';

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
        const { roleTarget, newEmail } = await req.json();

        if (!roleTarget || !newEmail) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        // WHITELIST CHECK: Only tutor and company representative can be updated by the student
        const allowedRoles = ['tutor', 'company_head', 'company_head_tutor'];
        if (!allowedRoles.includes(roleTarget)) {
            return NextResponse.json({ error: 'Modification interdite pour ce rôle' }, { status: 403 });
        }

        const client = await pool.connect();
        try {
            // 1. Fetch convention to verify ownership and get name for invitation
            const checkRes = await client.query(
                'SELECT student_uid, metadata FROM conventions WHERE id = $1',
                [conventionId]
            );

            if (checkRes.rowCount === 0) {
                return NextResponse.json({ error: 'Convention non trouvée' }, { status: 404 });
            }

            const convention = checkRes.rows[0];
            const metadata = convention.metadata || {};

            // Security: Only the student who created the convention can update these emails
            if (convention.student_uid !== session.user.id && session.user.email !== 'pledgeum@gmail.com') {
                return NextResponse.json({ error: 'Action non autorisée' }, { status: 403 });
            }

            // 2. Determine fields to update in metadata
            let emailField = '';
            let nameField = '';
            
            if (roleTarget === 'tutor') {
                emailField = 'tuteur_email';
                nameField = 'tuteur_nom';
            } else if (roleTarget === 'company_head' || roleTarget === 'company_head_tutor') {
                emailField = 'ent_rep_email';
                nameField = 'ent_rep_nom';
            }

            const recipientName = metadata[nameField] || 'Signataire';

            // 3. Update Metadata in DB
            const updatedMetadata = {
                ...metadata,
                [emailField]: newEmail
            };

            await client.query(
                'UPDATE conventions SET metadata = $1, updated_at = NOW() WHERE id = $2',
                [JSON.stringify(updatedMetadata), conventionId]
            );

            // 4. Trigger Invitation Resend
            // We use the server action directly
            const inviteRes = await sendConventionInvitation(conventionId, roleTarget, newEmail, recipientName);

            if (inviteRes.error) {
                console.error('[UPDATE_EMAIL] Invitation error:', inviteRes.error);
                // We return 200 because the DB was updated, but we notify about the email failure
                return NextResponse.json({ 
                    success: true, 
                    warning: "Email mis à jour mais l'invitation n'a pas pu être renvoyée immédiatement.",
                    details: inviteRes.error
                });
            }

            return NextResponse.json({ success: true, message: 'Email mis à jour et invitation renvoyée' });

        } catch (error: any) {
            console.error('[UPDATE_EMAIL_DB_ERROR]', error);
            return NextResponse.json({ error: 'Database error', details: error.message }, { status: 500 });
        } finally {
            client.release();
        }

    } catch (error: any) {
        console.error('[UPDATE_EMAIL_INTERNAL_ERROR]', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
