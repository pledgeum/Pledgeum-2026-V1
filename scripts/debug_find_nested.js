const { Client } = require('pg');

const client = new Client({
    connectionString: "postgres://Pledgeum_admin:Fa2BVCcYmysEiyx!!!@51.159.113.59:26093/rdb",
    ssl: false
});

async function run() {
    try {
        await client.connect();
        console.log("Connected to DB");

        // 1. Get Count
        const resCount = await client.query(`
      SELECT count(*) as count
      FROM conventions 
      WHERE metadata->'signatures'->'student' IS NOT NULL;
    `);
        console.log("Conventions with Nested Student Signature (Count):", resCount.rows[0].count);

        // 2. Get One Example
        if (parseInt(resCount.rows[0].count) > 0) {
            const resExample = await client.query(`
          SELECT id, metadata->'signatures' as signatures
          FROM conventions 
          WHERE metadata->'signatures'->'student' IS NOT NULL
          LIMIT 1;
        `);
            console.log("Example ID:", resExample.rows[0].id);
            console.log("Signatures:", JSON.stringify(resExample.rows[0].signatures, null, 2));
        } else {
            console.log("No conventions found with nested 'student' signature.");
        }

    } catch (err) {
        console.error("Database Error:", err);
    } finally {
        await client.end();
    }
}

run();
