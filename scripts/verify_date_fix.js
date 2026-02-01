
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: "postgres://Pledgeum_admin:Fa2BVCcYmysEiyx!!!@51.159.113.59:26093/rdb",
    ssl: { rejectUnauthorized: false }
});

async function verifyFix() {
    const client = await pool.connect();
    try {
        console.log("Verifying Date Fix...");

        // 1. Simulate POST insert with new columns
        const conventionsId = 'verify_' + Math.random().toString(36).substr(2, 9);
        const data = {
            ent_nom: "Test Corp",
            dateStart: "2026-05-01",
            dateEnd: "2026-05-31"
        };

        const query = `
            INSERT INTO conventions (
                id, 
                student_uid, 
                status, 
                created_at, 
                updated_at,
                metadata,
                date_start,
                date_end
            ) VALUES ($1, $2, 'DRAFT', NOW(), NOW(), $3, $4, $5)
            RETURNING id, date_start, date_end
        `;

        const res = await client.query(query, [
            conventionsId,
            'temp_student_id',
            JSON.stringify(data),
            data.dateStart,
            data.dateEnd
        ]);

        const row = res.rows[0];
        console.log("Inserted Row:", row);

        if (row.date_start && row.date_end) {
            console.log("SUCCESS: Dates are populated in columns!");
        } else {
            console.error("FAILURE: Dates are NULL!");
        }

        // Cleanup
        await client.query('DELETE FROM conventions WHERE id = $1', [conventionsId]);

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

verifyFix();
