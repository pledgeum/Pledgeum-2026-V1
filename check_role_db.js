const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://Pledgeum_admin:Fa2BVCcYmysEiyx!!!@51.15.201.169:11844/rdb',
});

async function checkRole() {
    const client = await pool.connect();
    try {
        const checkRes = await client.query(`
            SELECT tc.constraint_name, tc.table_name, kcu.column_name, cc.check_clause
            FROM information_schema.table_constraints tc
            JOIN information_schema.check_constraints cc 
              ON tc.constraint_schema = cc.constraint_schema 
             AND tc.constraint_name = cc.constraint_name
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_schema = kcu.constraint_schema
             AND tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = 'users';
        `);
        console.table(checkRes.rows);

        const domainRes = await client.query(`
            SELECT * FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role';
        `);
        console.table(domainRes.rows);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        client.release();
        pool.end();
    }
}

checkRole();
