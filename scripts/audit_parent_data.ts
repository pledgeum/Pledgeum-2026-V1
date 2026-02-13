import dotenv from 'dotenv';
import path from 'path';
import { Pool } from 'pg';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const connectionConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
};

const pool = new Pool(connectionConfig);
const TARGET_EMAIL = 'fabrice.dumasdelage@proton.me';

async function audit() {
    const client = await pool.connect();
    try {
        console.log(`Auditing data for parent email: ${TARGET_EMAIL}`);

        // 1. Search Convention Data
        // Checking metadata for legal rep email
        const convRes = await client.query(`
            SELECT id, metadata 
            FROM conventions 
            WHERE metadata->>'legalRepresentativeEmail' = $1
            LIMIT 1;
        `, [TARGET_EMAIL]);

        let parentData: any = null;

        if (convRes.rows.length > 0) {
            const conv = convRes.rows[0];
            console.log(`✅ Found Convention ID: ${conv.id}`);
            const meta = conv.metadata;

            parentData = {
                firstName: meta.legalRepresentativeFirstName,
                lastName: meta.legalRepresentativeLastName,
                phone: meta.legalRepresentativePhone,
                address: meta.studentAddress, // Assuming student address is same or similar if not explicit parent address
                // Or maybe meta.legalRepresentativeAddress if exists? Let's check keys.
            };

            console.log("Parent Data in Convention:", parentData);
            console.log("Full Metadata Keys:", Object.keys(meta));

        } else {
            console.log("❌ No convention found with this legal representative email in metadata.");

            // Fallback: Check 'students' table? But there is no students table, strictly speaking, users with role student?
            // The prompt mentioned "table students" but schema listing didn't show it.
            // Maybe it's inside `users` table for the student profile?
            // Check if there is a student user who has this parent email in their legal_representatives jsonb?

            const studentRes = await client.query(`
                SELECT uid, first_name, last_name, legal_representatives 
                FROM users 
                WHERE role = 'student' 
                AND legal_representatives::text LIKE $1
                LIMIT 1;
            `, [`%${TARGET_EMAIL}%`]);

            if (studentRes.rows.length > 0) {
                const student = studentRes.rows[0];
                console.log(`✅ Found Student User ID: ${student.uid} (${student.first_name} ${student.last_name})`);
                const reps = student.legal_representatives as any[];
                const rep = reps.find((r: any) => r.email === TARGET_EMAIL);
                if (rep) {
                    parentData = {
                        firstName: rep.firstName || rep.name?.split(' ')[0], // Approximate
                        lastName: rep.lastName || rep.name?.split(' ').slice(1).join(' '),
                        phone: rep.phone,
                        address: rep.address // if exists
                    };
                    console.log("Parent Data in Student Profile:", parentData);
                }
            } else {
                console.log("❌ No student found with this parent email in legal_representatives.");
            }
        }

        // 2. Fetch User Record
        const userRes = await client.query(`
            SELECT uid, first_name, last_name, phone, address, role
            FROM users
            WHERE email = $1
        `, [TARGET_EMAIL]);

        if (userRes.rows.length > 0) {
            const user = userRes.rows[0];
            console.log("--------------------------------------------------");
            console.log("Current User Record:");
            console.log(`UID: ${user.uid}`);
            console.log(`Role: ${user.role}`);
            console.log(`Name: ${user.first_name} ${user.last_name}`);
            console.log(`Phone: ${user.phone}`);
            console.log(`Address: ${user.address}`);
            console.log("--------------------------------------------------");

            if (parentData) {
                console.log(" comparison:");
                console.log(`Name: '${user.first_name} ${user.last_name}' vs '${parentData.firstName} ${parentData.lastName}'`);
                console.log(`Phone: '${user.phone}' vs '${parentData.phone}'`);
            }

        } else {
            console.log("⚠️ User record not found for this email.");
        }

    } catch (e) {
        console.error("Audit failed:", e);
    } finally {
        client.release();
        await pool.end();
    }
}

audit().catch(console.error);
