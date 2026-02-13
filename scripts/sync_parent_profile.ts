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

async function sync() {
    const client = await pool.connect();
    try {
        console.log(`Syncing profile for parent email: ${TARGET_EMAIL}`);

        // 1. Find Data Source (Student)
        const studentRes = await client.query(`
            SELECT uid, first_name, last_name, legal_representatives 
            FROM users 
            WHERE role = 'student' 
            AND legal_representatives::text LIKE $1
            LIMIT 1;
        `, [`%${TARGET_EMAIL}%`]);

        if (studentRes.rows.length === 0) {
            console.error("❌ No matching student found. Cannot sync.");
            return;
        }

        const student = studentRes.rows[0];
        const reps = student.legal_representatives as any[];
        const rep = reps.find((r: any) => r.email === TARGET_EMAIL);

        if (!rep) {
            console.error("❌ Parent email not found in legal representatives list.");
            return;
        }

        console.log("Found Source Data:", rep);

        // Prepare Data
        const firstName = rep.firstName || rep.name?.split(' ')[0] || '';
        const lastName = rep.lastName || rep.name?.split(' ').slice(1).join(' ') || '';
        const phone = rep.phone || '';
        const addressObj = rep.address || {};

        const street = addressObj.street || '';
        const postalCode = addressObj.postalCode || '';
        const city = addressObj.city || '';

        const fullAddress = street ? `${street}, ${postalCode} ${city}` : null;

        console.log("Preparing Update with:");
        console.log(`First Name: ${firstName}`);
        console.log(`Last Name: ${lastName}`);
        console.log(`Phone: ${phone}`);
        console.log(`Address: ${fullAddress}`);
        console.log(`Zip: ${postalCode}`);
        console.log(`City: ${city}`);

        // 2. Update Parent User
        const updateRes = await client.query(`
            UPDATE users 
            SET 
                first_name = $1,
                last_name = $2,
                phone = $3,
                address = $4,
                zip_code = $5,
                city = $6,
                updated_at = NOW()
            WHERE email = $7
            RETURNING uid, first_name, last_name, phone, address;
        `, [firstName, lastName, phone, fullAddress, postalCode, city, TARGET_EMAIL]);

        if (updateRes.rowCount === 0) {
            console.error("❌ Parent user not found in 'users' table or update failed.");
        } else {
            console.log("✅ Parent profile updated successfully!");
            console.log("New User Record:", updateRes.rows[0]);
        }

    } catch (e) {
        console.error("Sync failed:", e);
    } finally {
        client.release();
        await pool.end();
    }
}

sync().catch(console.error);
