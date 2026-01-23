
const { Pool } = require('pg');

// Hardcoded from .env.local because script environment might not load it automatically
const connectionString = 'postgresql://Pledgeum_admin:Fa2BVCcYmysEiyx!!!@51.159.113.59:26093/rdb';

const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false } // Required for some remote connections
});

async function checkSandbox() {
    const client = await pool.connect();
    try {
        console.log("Checking establishment 9999999X...");

        // Always upsert to guarantee data correctness
        console.log("Forcing UPSERT of Sandbox establishment...");
        await client.query(`
            INSERT INTO establishments (uai, name, address, city, postal_code, type, telephone, admin_email)
            VALUES ('9999999X', 'Mon LYCEE TOUTFAUX', '12 Rue Ampère', 'Elbeuf', '76500', 'LP', '02 35 77 77 77', 'pledgeum@gmail.com')
            ON CONFLICT (uai) DO UPDATE SET
                name = EXCLUDED.name,
                address = EXCLUDED.address,
                city = EXCLUDED.city,
                postal_code = EXCLUDED.postal_code,
                telephone = EXCLUDED.telephone,
                admin_email = EXCLUDED.admin_email;
        `);
        console.log("Sandbox establishment UPSERTED successfully.");

    } catch (e) {
        console.error("Error:", e);
    } finally {
        client.release();
        await pool.end();
    }
}

checkSandbox();
