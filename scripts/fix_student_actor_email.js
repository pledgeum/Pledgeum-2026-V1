
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function fixActorEmail() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    try {
        console.log("🔍 Recherche de conventions avec l'actorEmail 'student' dans l'auditLog...");

        // Fetch conventions where auditLogs might contain 'student' as actorEmail
        const res = await pool.query(`
            SELECT id, metadata 
            FROM conventions 
            WHERE metadata::text ILIKE '%"actorEmail":"student"%'
               OR metadata::text ILIKE '%"actorEmail": "student"%'
        `);

        let repairCount = 0;
        for (const row of res.rows) {
            const { id, metadata } = row;
            const auditLogs = metadata.auditLogs || [];

            // Find the student's real email from metadata
            const realStudentEmail = metadata.eleve_email || metadata.student_email;

            if (!realStudentEmail) {
                console.log(`⚠️ Convention ${id} : Impossible de trouver le vrai email de l'élève dans les métadonnées.`);
                continue;
            }

            let modified = false;

            // Check and update auditLogs
            const updatedAuditLogs = auditLogs.map(log => {
                if (log.actorEmail === 'student' &&
                    (log.details === 'Signature Élève/Étudiant' || log.details === 'Signature Élevé/Étudiant')) {
                    modified = true;
                    return { ...log, actorEmail: realStudentEmail };
                }
                return log;
            });

            if (modified) {
                console.log(`🔧 Correction de l'email pour la convention ${id} -> ${realStudentEmail}...`);

                // Update DB
                await pool.query(`
                    UPDATE conventions 
                    SET metadata = jsonb_set(metadata, '{auditLogs}', $1::jsonb)
                    WHERE id = $2
                `, [JSON.stringify(updatedAuditLogs), id]);

                repairCount++;
                console.log(`✅ Convention ${id} corrigée.`);
            }
        }

        console.log(`\n🎉 Travail terminé. Total corrigé : ${repairCount}`);

    } catch (err) {
        console.error("❌ Erreur :", err);
    } finally {
        await pool.end();
    }
}

fixActorEmail();
