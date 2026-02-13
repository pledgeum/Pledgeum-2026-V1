import { Client } from 'pg';
import 'dotenv/config';

const connectionStr = process.env.DATABASE_URL || "postgres://Pledgeum_admin:Fa2BVCcYmysEiyx!!!@51.159.113.59:26093/rdb";

async function run() {
    const client = new Client({
        connectionString: connectionStr,
        ssl: connectionStr.includes('localhost') ? false : { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const res = await client.query(`
      SELECT metadata
      FROM conventions 
      WHERE metadata->'signatures' IS NOT NULL
      ORDER BY updated_at DESC 
      LIMIT 1;
    `);

        if (res.rows.length === 0) {
            console.log("No signed conventions found.");
        } else {
            const conv = res.rows[0];
            const signatures = conv.metadata.signatures;

            console.log("=== FINAL KEY CHECK ===");
            console.log(JSON.stringify(Object.keys(signatures)));
        }

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
