const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function seedSuperAdmin() {
    const client = await pool.connect();
    try {
        console.log('Seeding Super Admin...');

        const email = 'Pledgeum@gmail.com';
        const passwordRaw = 'Pledgeum2026!';
        const role = 'SUPER_ADMIN';

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(passwordRaw, salt);

        // Check if user exists
        const res = await client.query('SELECT * FROM users WHERE email = $1', [email]);
        const existingUser = res.rows[0];

        if (existingUser) {
            console.log(`User ${email} exists. Updating...`);
            await client.query(`
                UPDATE users 
                SET role = $1, password_hash = $2, email_verified = NOW()
                WHERE email = $3
            `, [role, passwordHash, email]);
            console.log(`Updated ${email} to SUPER_ADMIN with local password.`);
        } else {
            console.log(`User ${email} does not exist. Creating...`);
            // Inserting with minimal info, trusting schema allows nulls or defaults for others
            // If migration failed to make uid nullable, we can generate a dummy one for now or retry migration.
            // But better to rely on migration success.
            // We will pass uuid just in case until migration passes.
            // Actually, let's just use a placeholder string or uuid if needed.
            await client.query(`
                INSERT INTO users (email, role, password_hash, email_verified, created_at, updated_at, uid)
                VALUES ($1, $2, $3, NOW(), NOW(), NOW(), $4)
            `, [email, role, passwordHash, 'super_admin_placeholder']);
            console.log(`Created ${email} as SUPER_ADMIN with local password.`);
        }

    } catch (err) {
        console.error('Seeding failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

seedSuperAdmin();
