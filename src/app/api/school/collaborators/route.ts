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
        if (!session?.user || (session.user.role !== 'school_head' && session.user.role !== 'ESTABLISHMENT_ADMIN')) {
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
        if (session.user.establishment_uai && session.user.establishment_uai !== uai) {
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

        // 4. Send Email
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

        const emailSent = await sendEmail({
            to: email,
            subject: "Invitation à rejoindre Pledgeum",
            text: `Bonjour,

Bienvenue sur la plateforme Pledgeum !

Vous avez été invité(e) à rejoindre l'espace d'administration de votre établissement en tant que ${displayRole}.

Voici vos identifiants temporaires :
Lien de connexion : https://www.pledgeum.fr/
Email : ${email}
Mot de passe : ${tempPassword}

Veuillez vous connecter via le lien ci-dessus et modifier ce mot de passe dès que possible pour des raisons de sécurité.

Cordialement,
L'équipe Pledgeum`
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
            SELECT uid as id, first_name || ' ' || last_name as name, email, role
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
        if (!session?.user || (session.user.role !== 'school_head' && session.user.role !== 'ESTABLISHMENT_ADMIN')) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const { uid, uai } = body;

        if (!uid || !uai) {
            return NextResponse.json({ error: "Missing Parameters" }, { status: 400 });
        }

        // Context Check
        if (session.user.establishment_uai && session.user.establishment_uai !== uai) {
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
