
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function repair() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    try {
        console.log("🔍 Recherche de conventions avec une signature élève mais sans audit log élève...");

        // Fetch all conventions that have a student signature
        const res = await pool.query(`
            SELECT id, metadata 
            FROM conventions 
            WHERE metadata->'signatures'->'student' IS NOT NULL
        `);

        let repairCount = 0;
        for (const row of res.rows) {
            const { id, metadata } = row;
            const signatures = metadata.signatures || {};
            const auditLogs = metadata.auditLogs || [];

            // Check if student entry exists in auditLogs
            const hasStudentLog = auditLogs.some(log =>
                log.details === 'Signature Élève/Étudiant' ||
                log.details === 'Signature Élevé/Étudiant'
            );

            if (!hasStudentLog && signatures.student) {
                console.log(`🔧 Réparation de la convention ${id}...`);

                const studentSig = signatures.student;
                const newLog = {
                    date: studentSig.signedAt,
                    action: 'SIGNED',
                    actorEmail: 'student', // Fallback as we might not know the exact email used at creation
                    details: 'Signature Élève/Étudiant',
                    ip: studentSig.ip || 'unknown'
                };

                // Prepend to auditLogs (since it's the first one)
                const updatedAuditLogs = [newLog, ...auditLogs];

                // Update DB
                await pool.query(`
                    UPDATE conventions 
                    SET metadata = jsonb_set(metadata, '{auditLogs}', $1::jsonb)
                    WHERE id = $2
                `, [JSON.stringify(updatedAuditLogs), id]);

                repairCount++;
                console.log(`✅ Convention ${id} réparée.`);
            }
        }

        console.log(`\n🎉 Travail terminé. Total réparé : ${repairCount}`);

    } catch (err) {
        console.error("❌ Erreur :", err);
    } finally {
        await pool.end();
    }
}

repair();
