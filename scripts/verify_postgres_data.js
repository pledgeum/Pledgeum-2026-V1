
const { Pool } = require('pg');

// Hardcoded connection string from .env.local
const connectionString = 'postgresql://Pledgeum_admin:Fa2BVCcYmysEiyx!!!@51.159.113.59:26093/rdb';

const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

async function verifyData() {
    const client = await pool.connect();
    try {
        console.log("--- CONVENTIONS COUNT ---");
        const countRes = await client.query('SELECT COUNT(*) FROM conventions');
        console.log(`Total Conventions: ${countRes.rows[0].count}`);

        console.log("\n--- CHECK USER 5CnHIaIE5XVwaPDjl4UknUx6eHi2 ---");
        const userUid = '5CnHIaIE5XVwaPDjl4UknUx6eHi2';
        const userRes = await client.query('SELECT * FROM users WHERE uid = $1', [userUid]);

        if (userRes.rowCount === 0) {
            console.log("User NOT FOUND in Postgres.");
        } else {
            console.log("User FOUND.");
            const user = userRes.rows[0];
            console.log("--- FILLED COLUMNS ---");
            // Iterate and print keys with non-null values
            for (const [key, value] of Object.entries(user)) {
                if (value !== null && value !== '') {
                    // Truncate long json for readability
                    let displayValue = value;
                    if (key === 'profile_json' && typeof value === 'object') {
                        displayValue = JSON.stringify(value).substring(0, 50) + '...';
                    }
                    console.log(`${key}: ${displayValue}`);
                }
            }
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        client.release();
        await pool.end();
    }
}

verifyData();
