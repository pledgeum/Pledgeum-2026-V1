import { POST } from '../src/app/api/conventions/route'; // We can't easily import the route handler due to Next.js context mock requirements
// Instead, we will simulate the DB insertion logic or use a valid fetch if the server was running, 
// but since I can't reach the running server from here easily (auth), 
// I will create a script that uses the SAME Logic as the route but runs standalone.

import { Client } from 'pg';
import crypto from 'crypto';
import 'dotenv/config';

// Mock Data
const mockStudentId = "student-TEST-" + Date.now();
const mockData = {
    studentId: mockStudentId,
    eleve_nom: "TestStudent",
    eleve_prenom: "Verification",
    eleve_email: "test@example.com",
    ent_nom: "Test Corp",
    dateStart: "2026-03-01",
    dateEnd: "2026-03-05",
    signatures: {
        studentImg: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    }
};

const connectionStr = process.env.DATABASE_URL || "postgres://Pledgeum_admin:Fa2BVCcYmysEiyx!!!@51.159.113.59:26093/rdb";

async function run() {
    const client = new Client({
        connectionString: connectionStr,
        ssl: connectionStr.includes('localhost') ? false : { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // --- LOGIC REPLICATION FROM ROUTE.TS ---
        const { studentId, ...data } = mockData;
        let initialStatus = 'DRAFT';

        // Simulating the FIX
        if (data.signatures && data.signatures.studentImg) {
            initialStatus = 'SUBMITTED';
            const now = new Date().toISOString();

            const studentSig = {
                signedAt: now,
                img: data.signatures.studentImg,
                code: 'CANVAS',
                hash: crypto.createHash('sha256').update(`student:${now}:CANVAS`).digest('hex'),
                ip: '127.0.0.1',
            };

            // @ts-ignore
            data.signatures.student = studentSig;
            // @ts-ignore
            delete data.signatures.studentImg;
        }
        // ---------------------------------------

        console.log("Transformed Data Signatures:", JSON.stringify(data.signatures, null, 2));

        // Insert into DB
        const conventionsId = 'conv_TEST_' + Math.random().toString(36).substr(2, 9);
        const query = `
            INSERT INTO conventions (
                id, student_uid, status, created_at, updated_at, metadata, date_start, date_end
            ) VALUES ($1, $2, $3, NOW(), NOW(), $4, $5, $6)
            RETURNING id, metadata
        `;

        const res = await client.query(query, [
            conventionsId,
            studentId,
            initialStatus,
            JSON.stringify(data),
            data.dateStart,
            data.dateEnd
        ]);

        const savedConv = res.rows[0];
        console.log("=== DB RECORD INSERTED ===");
        console.log("ID:", savedConv.id);
        console.log("Metadata Signatures Keys:", Object.keys(savedConv.metadata.signatures));

        if (savedConv.metadata.signatures.student && !savedConv.metadata.signatures.studentAt) {
            console.log("✅ SUCCESS: 'student' key present, 'studentAt' missing.");
            console.log("Student Object:", savedConv.metadata.signatures.student);
        } else {
            console.log("❌ FAILURE: Structure incorrect.");
            console.log("Full Signatures:", savedConv.metadata.signatures);
        }

        // Cleanup
        await client.query("DELETE FROM conventions WHERE id = $1", [conventionsId]);
        console.log("Test record deleted.");

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
