import { Client } from 'pg';
import 'dotenv/config';

// Fallback to hardcoded string to ensure connection if env vars are missing in shell
const connectionStr = process.env.DATABASE_URL || "postgres://Pledgeum_admin:Fa2BVCcYmysEiyx!!!@51.159.113.59:26093/rdb";

async function run() {
    console.log("Connecting to DB...");
    const client = new Client({
        connectionString: connectionStr,
        ssl: connectionStr.includes('localhost') ? false : { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Connected to DB.");

        // Select * to get all columns including 'signatures' if it exists and 'metadata'
        const res = await client.query(`
      SELECT *
      FROM conventions 
      ORDER BY updated_at DESC 
      LIMIT 1;
    `);

        if (res.rows.length === 0) {
            console.log("No conventions found.");
        } else {
            const conv = res.rows[0];
            console.log("=== LATEST CONVENTION ===");
            console.log("ID:", conv.id);

            // Determine where signatures are stored
            let signatures = conv.signatures;
            let source = "column 'signatures'";

            if (!signatures && conv.metadata && conv.metadata.signatures) {
                signatures = conv.metadata.signatures;
                source = "metadata.signatures";
            } else if (!signatures) {
                source = "Not Found";
            }

            console.log(`Source of signatures: ${source}`);

            if (signatures) {
                console.log("🔑 Keys in DB:", Object.keys(signatures));
                // Print sample of first key
                const firstKey = Object.keys(signatures)[0];
                if (firstKey) {
                    console.log(`📄 Sample Data (${firstKey}):`, signatures[firstKey]);
                }

                // Check specific keys mentioned in prompt to help with mismatch id
                const keyCheck = ['legal_rep', 'legalRepresentative', 'company', 'establishment', 'student'];
                console.log("Specific Key Check:");
                keyCheck.forEach(k => {
                    console.log(`- ${k}: ${signatures[k] ? 'PRESENT' : 'MISSING'}`);
                });

            } else {
                console.log("No signatures found in either column or metadata.");
                console.log("Full Metadata Keys:", conv.metadata ? Object.keys(conv.metadata) : 'No metadata');
            }
        }

    } catch (err) {
        console.error("Database Error:", err);
    } finally {
        await client.end();
    }
}

run();
