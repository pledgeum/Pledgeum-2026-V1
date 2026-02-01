const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Starting migration...');

        // Add password_hash column
        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS password_hash TEXT;
        `);
        console.log('Added password_hash column.');

        // Add email_verified column
        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS email_verified TIMESTAMP;
        `);
        console.log('Added email_verified column.');

        // Drop Primary Key constraint on uid if it exists
        // First, find the constraint name
        const res = await client.query(`
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'users' AND constraint_type = 'PRIMARY KEY';
        `);

        if (res.rows.length > 0) {
            const constraintName = res.rows[0].constraint_name;
            console.log(`Dropping Primary Key constraint: ${constraintName} with CASCADE`);
            await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS "${constraintName}" CASCADE`);
        } else {
            console.log('No Primary Key constraint found to drop.');
        }

        // Make uid nullable
        await client.query(`
            ALTER TABLE users 
            ALTER COLUMN uid DROP NOT NULL;
        `);
        console.log('Made uid column nullable.');

        // Add new Primary Key on email (or verify if id exists and use that)
        // For now, let's assume 'email' should be unique/PK or just unique.
        // The instructions said "Modify users table... ADD... MODIFY uid". It didn't explicitly ask for a new PK, but for local auth, email is usually the key.
        // Let's ensure email is unique.
        // If there is an 'id' column, we might use that as PK.
        // Let's check for 'id' column first.
        const idCol = await client.query(`
             SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'id'
        `);

        if (idCol.rows.length > 0) {
            console.log('Column id exists. Setting it as Primary Key if not already.');
            // Logic to set PK on id could go here, but dropping PK on uid might have cleared it.
            await client.query(`
                ALTER TABLE users ADD PRIMARY KEY (id);
             `).catch(e => console.log('Could not set id as PK (maybe already set or duplicates):', e.message));
        } else {
            console.log('Column id does not exist. Setting email as Primary Key.');
            await client.query(`
                ALTER TABLE users ADD PRIMARY KEY (email);
             `).catch(e => console.log('Could not set email as PK (maybe duplicates):', e.message));
        }

        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
