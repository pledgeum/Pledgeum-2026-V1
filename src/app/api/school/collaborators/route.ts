import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import { z } from 'zod';
import { sendEmail } from '@/lib/email';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { auth } from '@/auth';

const CollaboratorSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    role: z.enum(['ddfpt', 'business_manager', 'assistant_manager', 'stewardship_secretary', 'at_ddfpt', 'cpe', 'school_life', 'school_head', 'ESTABLISHMENT_ADMIN']),
    uai: z.string(),
});

export async function POST(req: Request) {
    let client;
    try {
        const session = await auth();
        // Strict Authorization: Only School Heads or Admin can add collaborators
        const allowedRoles = ['school_head', 'ESTABLISHMENT_ADMIN', 'ddfpt', 'at_ddfpt', 'business_manager'];
        if (!session?.user || !allowedRoles.includes(session.user.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const { name, email, role, uai } = CollaboratorSchema.parse(body);

        // --- DEBUG LOGS (Remove in prod) ---
        console.log("👉 API HIT: Add Collaborator");
        console.log("📦 Payload:", { name, email, role, uai });
        console.log("👤 Current User UAI:", session.user.establishment_uai);

        if (!uai) {
            console.error("❌ Error: UAI is missing in payload");
            return NextResponse.json({ error: 'UAI missing' }, { status: 400 });
        }

        // Ensure session UAI matches request (unless SuperAdmin)
        if (session.user.establishment_uai && session.user.establishment_uai.toUpperCase() !== uai.toUpperCase()) {
            console.error(`❌ Context Mismatch: Session UAI (${session.user.establishment_uai}) !== Payload UAI (${uai})`);
            return NextResponse.json({ error: "Context Mismatch" }, { status: 403 });
        }

        client = await pool.connect();

        // 1. Check if user already exists
        const checkRes = await client.query('SELECT uid FROM users WHERE email = $1', [email]);
        if (checkRes.rowCount && checkRes.rowCount > 0) {
            return NextResponse.json({ error: "Collaborateur déjà existant." }, { status: 409 });
        }

        // 2. Generate Credentials
        const parts = name.split(' ');
        const firstName = parts[0];
        const lastName = parts.slice(1).join(' ');

        // Temp Password Generation
        const tempPassword = crypto.randomBytes(4).toString('hex') + 'A1!'; // e.g. "a4f2b9d0A1!"
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        const uid = `collab-${crypto.randomUUID()}`;

        // 3. Create User in PG
        await client.query(`
            INSERT INTO users (uid, email, role, first_name, last_name, password_hash, establishment_uai, created_at, is_active, must_change_password)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), TRUE, TRUE)
        `, [
            uid,
            email.toLowerCase(),
            role,
            firstName,
            lastName,
            hashedPassword,
            uai
        ]);

        // 4. Generate Activation Token
        const activationToken = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 24 * 3600 * 1000); // 24 hours

        await client.query(
            'INSERT INTO verification_tokens (identifier, token, expires) VALUES ($1, $2, $3)',
            [email.toLowerCase(), activationToken, expires]
        );

        // 5. Send Email (Anti-Cisco / Premium UX)
        const roleTranslations: Record<string, string> = {
            business_manager: "Responsable Bureau des Entreprises",
            ddfpt: "Directeur Délégué aux Formations (DDFPT)",
            teacher: "Enseignant(e)",
            school_head: "Chef d'établissement",
            establishment_admin: "Administrateur de l'établissement",
            assistant_manager: "Gestionnaire assistant",
            stewardship_secretary: "Secrétaire d'intendance",
            at_ddfpt: "Assistant(e) DDFPT",
            cpe: "CPE",
            school_life: "Vie scolaire",
            ESTABLISHMENT_ADMIN: "Administrateur de l'établissement"
        };
        const displayRole = roleTranslations[role as keyof typeof roleTranslations] || role;

        const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.pledgeum.fr';
        const normalizedBaseUrl = APP_URL.replace(/\/$/, '');
        const activationLink = `${normalizedBaseUrl}/activate?token=${activationToken}&email=${encodeURIComponent(email)}`;

        const emailSent = await sendEmail({
            to: email,
            subject: "Activation de votre accès Pledgeum",
            text: `Bonjour,

Votre accès à la plateforme Pledgeum a été préparé par votre établissement en tant que ${displayRole}.

Pour finaliser la configuration de votre compte et définir votre mot de passe, veuillez cliquer sur le lien sécurisé ci-dessous :
${activationLink}

Identifiant : ${email}

Ce lien est valable 24 heures.

Cordialement,
L'équipe Pledgeum`,
            html: `
                <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #2563eb;">Bienvenue sur Pledgeum</h2>
                    <p>Bonjour,</p>
                    <p>Votre accès à l'espace d'administration de votre établissement a été configuré en tant que <b>${displayRole}</b>.</p>
                    <p>Pour finaliser l'activation de votre compte et choisir votre mot de passe, cliquez sur le bouton ci-dessous :</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${activationLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Activer mon compte</a>
                    </div>
                    <p style="font-size: 0.9em; color: #666;"><b>Identifiant</b> : ${email}</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 0.8em; color: #999;">Ce lien sécurisé est valable 24 heures. Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer cet email.</p>
                    <p style="font-size: 0.8em; color: #999;">Cordialement,<br/>L'équipe Pledgeum</p>
                </div>
            `
        });

        return NextResponse.json({ success: true, emailSent });

    } catch (error: any) {
        console.error("Add Collaborator Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        if (client) client.release();
    }
}

export async function GET(req: Request) {
    let client;
    try {
        const { searchParams } = new URL(req.url);
        const uai = searchParams.get('uai');

        if (!uai) return NextResponse.json({ error: "UAI required" }, { status: 400 });

        client = await pool.connect();
        const res = await client.query(`
            SELECT uid as id, TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) as name, email, role
            FROM users
            WHERE establishment_uai = $1 AND role NOT IN ('student', 'teacher')
        `, [uai]);

        return NextResponse.json({ collaborators: res.rows });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        if (client) client.release();
    }
}
export async function DELETE(req: Request) {
    let client;
    try {
        const session = await auth();
        // Strict Authorization
        const allowedRoles = ['school_head', 'ESTABLISHMENT_ADMIN', 'ddfpt', 'at_ddfpt', 'business_manager'];
        if (!session?.user || !allowedRoles.includes(session.user.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const { uid, uai } = body;

        if (!uid || !uai) {
            return NextResponse.json({ error: "Missing Parameters" }, { status: 400 });
        }

        // Context Check
        if (session.user.establishment_uai && session.user.establishment_uai.toUpperCase() !== uai.toUpperCase()) {
            return NextResponse.json({ error: "Context Mismatch" }, { status: 403 });
        }

        client = await pool.connect();

        // Delete user (or just remove assignment? For collaborators, they are usually 1:1 with school, so delete user is safer for cleanup)
        // Ensure we only delete collaborators, not students/teachers accidentally
        await client.query(`
            DELETE FROM users 
            WHERE uid = $1 
              AND establishment_uai = $2 
              AND role NOT IN ('student', 'teacher')
        `, [uid, uai]);

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Delete Collaborator Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        if (client) client.release();
    }
}
