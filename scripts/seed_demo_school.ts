import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function seedDemoSchool() {
    const client = await pool.connect();
    try {
        console.log('--- SEEDING DEMO SCHOOL & ADMIN ---');

        const schoolData = {
            uai: '9999999Z',
            name: 'Lycée de Démonstration',
            address: '1 Rue du Code',
            city: 'Paris',
            postalCode: '75000',
            adminEmail: 'contact@lycee-demo.fr'
        };

        const userData = {
            email: 'fabrice.dumasdelage@gmail.com',
            passwordRaw: 'Fabrice2026!',
            role: 'school_head', // Enum for School Admin / Principal
            uai: '9999999Z'
        };

        // 1. Upsert Establishment
        console.log(`Upserting school: ${schoolData.name} (${schoolData.uai})...`);
        await client.query(`
            INSERT INTO establishments (uai, name, address, city, postal_code, admin_email, created_at, updated_at, type)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), 'Lycée')
            ON CONFLICT (uai) DO UPDATE SET
                name = EXCLUDED.name,
                address = EXCLUDED.address,
                city = EXCLUDED.city,
                postal_code = EXCLUDED.postal_code,
                admin_email = EXCLUDED.admin_email,
                updated_at = NOW()
        `, [
            schoolData.uai,
            schoolData.name,
            schoolData.address,
            schoolData.city,
            schoolData.postalCode,
            schoolData.adminEmail
        ]);
        console.log('School upserted successfully.');

        // 2. Hash Password
        console.log('Hashing password...');
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(userData.passwordRaw, salt);

        // 3. Upsert User
        console.log(`Upserting user: ${userData.email}...`);
        // We use email as the conflict key. We also need to provide a uid if it's strictly NOT NULL.
        // Based on previous logs, uid might be required or 'super_admin_placeholder' was used.
        const uidPlaceholder = `local_${Date.now()}`;

        await client.query(`
            INSERT INTO users (
                email, role, password_hash, establishment_uai, 
                email_verified, created_at, updated_at, uid,
                is_active, has_accepted_tos
            )
            VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW(), $5, true, true)
            ON CONFLICT (email) DO UPDATE SET
                role = EXCLUDED.role,
                password_hash = EXCLUDED.password_hash,
                establishment_uai = EXCLUDED.establishment_uai,
                updated_at = NOW(),
                is_active = true,
                has_accepted_tos = true
        `, [
            userData.email,
            userData.role,
            passwordHash,
            userData.uai,
            uidPlaceholder
        ]);
        console.log('User upserted successfully.');

        console.log('--- SEEDING COMPLETED ---');
        console.log('Login: fabrice.dumasdelage@gmail.com');
        console.log('Pass:  Fabrice2026!');

    } catch (err) {
        console.error('Seeding failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

seedDemoSchool();
