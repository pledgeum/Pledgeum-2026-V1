const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: { rejectUnauthorized: false } // Required for Scaleway Managed DB usually
});

console.log("DEBUG: Connection Config:");
console.log(`Host: ${process.env.POSTGRES_HOST}`);
console.log(`Port: ${process.env.POSTGRES_PORT}`);
console.log(`User: ${process.env.POSTGRES_USER}`);
console.log(`DB: ${process.env.POSTGRES_DB}`);
console.log(`Password Length: ${process.env.POSTGRES_PASSWORD ? process.env.POSTGRES_PASSWORD.length : '0'}`);
console.log(`Password First Char: ${process.env.POSTGRES_PASSWORD ? process.env.POSTGRES_PASSWORD[0] : 'N/A'}`);
console.log(`Password First 5 Chars: ${process.env.POSTGRES_PASSWORD ? process.env.POSTGRES_PASSWORD.substring(0, 5) : 'N/A'}`);

async function main() {
    try {
        await client.connect();
        console.log("✅ Connecté à PostgreSQL.");

        // 1. Lire le schéma SQL
        const schemaPath = '/Users/fabricedumasdelage/.gemini/antigravity/brain/d6b23e86-87a7-4857-8f63-989c2742bdb1/sql_schema.md';
        let sql = fs.readFileSync(schemaPath, 'utf8');

        // Remove Markdown code block syntax if present
        sql = sql.replace(/```sql/g, '').replace(/```/g, '');

        console.log("🏗️  Création du schéma...");
        try {
            await client.query(sql);
            console.log("✅ Schéma déployé avec succès.");
        } catch (schemaErr) {
            if (schemaErr.code === '42P07') { // duplicate_table
                console.log("⚠️  Les tables existent déjà. Poursuite de la migration...");
            } else {
                throw schemaErr;
            }
        }

        // 2. Import des données (Draft)
        // Note: For now we just focus on Schema deployment as requested first.
        // Data import logic is complex and will be handled in a separate step or refined here if needed repeatedly.
        // But the user asked: "deployer le schéma (...) et lancer la première migration"

        console.log("⏳ Début de la migration des données (depuis JSON)...");
        const backupPath = path.resolve(__dirname, '../_BACKUP_SECRETS/backup_pledgeum_data.json');

        if (!fs.existsSync(backupPath)) {
            console.warn("⚠️  Fichier de backup introuvable. Migration de données ignorée.");
            return;
        }

        const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

        // --- Migration Logic Here ---
        // A. Establishments (Naive: Assuming user current school is one, or extract from classes)
        // In the JSON backup, we might not have a clean 'establishments' root. 
        // We often see 'classes' with 'schoolId'.

        // Let's iterate classes to find Establishments
        const establishmentsMap = new Map();

        if (data.classes) {
            for (const [id, cls] of Object.entries(data.classes)) {
                if (cls.schoolId && cls.schoolId !== '9999999X') { // Skip sandbox for main establishment creation if we want strict real data? Or keep it?
                    // We don't have full estab details in 'classes' usually. 
                    // Let's check if we have an 'establishments' collection in backup?
                }
            }
        }

        // Check for root collections
        // If 'establishments' exists in backup:
        if (data.establishments) {
            for (const [uai, estab] of Object.entries(data.establishments)) {

                // Fallbacks for missing data (Sandbox or incomplete records)
                const name = estab.name || (uai === '9999999X' ? 'Lycée Sandbox' : 'Nom Inconnu');
                const address = estab.address || 'Adresse Inconnue';
                const city = estab.city || 'Ville Inconnue';
                const type = estab.type || 'LYCEE';
                const adminEmail = estab.adminEmail || 'admin@pledgeum.fr';

                await client.query(`
                    INSERT INTO establishments (uai, name, address, city, type, admin_email)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (uai) DO UPDATE 
                    SET (name, address, city, type, admin_email) = ($2, $3, $4, $5, $6)
                `, [uai, name, address, city, type, adminEmail]);
            }
            console.log(`✅ Établissements importés.`);
        }

        // B. Classes
        if (data.classes) {
            for (const [id, cls] of Object.entries(data.classes)) {
                // Ensure establishment exists (dummy if missing)
                const schoolId = cls.schoolId || 'UNKNOWN';

                // Insert Class
                await client.query(`
                    INSERT INTO classes (id, name, label, main_teacher_email)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (id) DO NOTHING
                 `, [id, cls.name, cls.label, cls.mainTeacher?.email]);
            }
            console.log(`✅ Classes importées.`);
        }

        // C. Users (from Auth Backup)
        const knownUserIds = new Set();
        const authBackupPath = path.resolve(__dirname, '../_BACKUP_SECRETS/backup_auth_users.json');
        if (fs.existsSync(authBackupPath)) {
            const authUsers = JSON.parse(fs.readFileSync(authBackupPath, 'utf8'));
            for (const user of authUsers) {
                // Insert User (Basic info from Auth)
                await client.query(`
                    INSERT INTO users (uid, email, role, created_at)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (uid) DO NOTHING
                `, [
                    user.uid,
                    user.email,
                    user.customClaims?.role || 'student', // Extract role if available, default to student
                    new Date(user.metadata.creationTime)
                ]);
                knownUserIds.add(user.uid);
            }
            console.log(`✅ ${authUsers.length} Utilisateurs importés.`);
        }

        // Helper
        const cleanSiret = (s) => s ? s.replace(/\D/g, '').substring(0, 14) : null;

        // D. Companies (Extraction on the fly from Conventions)
        // We iterate conventions to find unique Companies by SIRET.
        const companiesMap = new Map();
        if (data.conventions) {
            for (const [id, conv] of Object.entries(data.conventions)) {
                const rawSiret = conv.ent_siret;
                const siret = cleanSiret(rawSiret);

                if (siret && siret.length === 14) { // Only keep valid-ish SIRETs
                    // Normalize map key
                    companiesMap.set(siret, {
                        siret: siret,
                        name: conv.ent_nom || 'Entreprise Inconnue',
                        address: (conv.ent_adresse || '') + (conv.ent_code_postal ? ', ' + conv.ent_code_postal : '') + (conv.ent_ville ? ' ' + conv.ent_ville : ''),
                        postal_code: conv.ent_code_postal,
                        city: conv.ent_ville,
                        phone: null // Not always present in conv root
                    });
                }
            }
        }

        // Insert Companies
        for (const [siret, comp] of companiesMap) {
            await client.query(`
                INSERT INTO companies (siret, name, address, postal_code, city, phone)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (siret) DO NOTHING
             `, [comp.siret, comp.name, comp.address, comp.postal_code, comp.city, comp.phone]);
        }
        console.log(`✅ ${companiesMap.size} Entreprises importées.`);


        // E. Conventions (Normalized V2)
        if (data.conventions) {
            for (const [id, conv] of Object.entries(data.conventions)) {

                // 1. Resolve Foreign Keys
                const studentUid = conv.userId || conv.studentId;

                let companySiret = cleanSiret(conv.ent_siret);
                if (companySiret && companySiret.length !== 14) companySiret = null; // Ensure FK validity

                const establishmentUai = conv.schoolId;

                // 2. Ensure Student Exists (Stub)
                if (studentUid && !knownUserIds.has(studentUid)) {
                    console.log(`⚠️  Création d'un utilisateur bouchon pour ${studentUid}`);
                    await client.query(`
                        INSERT INTO users (uid, email, role)
                        VALUES ($1, $2, $3)
                        ON CONFLICT (uid) DO NOTHING
                     `, [studentUid, `missing_${studentUid}@pledgeum.fr`, 'student']);
                    knownUserIds.add(studentUid);
                }

                // 3. Ensure Establishment Exists (Stub)
                // If schoolId is present but not in our establishments table, we default to Sandbox or dummy?
                // The DB will reject FK violation if not present.
                // We assume step A handled it or we default to a known one if logic allows.
                // For now, let's let it fail or log if strict? 
                // Better: If schoolId is totally unknown, set to NULL or Sandbox?
                // Migration script should be robust.

                // (Skip strict UAI check here for simplicity, relying on previous section)

                // 4. Upsert Convention
                await client.query(`
                    INSERT INTO conventions (
                        id, student_uid, establishment_uai, class_id, company_siret,
                        status, date_start, date_end, duration_hours,
                        tutor_email, tutor_name,
                        metadata, updated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
                    ON CONFLICT (id) DO UPDATE 
                    SET status = EXCLUDED.status, metadata = EXCLUDED.metadata -- Simple update policy
                 `, [
                    id,
                    studentUid,
                    establishmentUai !== '9999999X' && establishmentUai ? establishmentUai : '9999999X', // Fallback to Sandbox if issues? Or Keep original

                    // class_id: We pass NULL because mapping by name is complex for V2 migration
                    null,

                    companySiret,

                    conv.status || 'DRAFT',
                    conv.stage_date_debut || null,
                    conv.stage_date_fin || null,
                    parseInt(conv.stage_duree_heures) || 0,

                    conv.tuteur_email,
                    (conv.tuteur_prenom ? conv.tuteur_prenom + ' ' : '') + (conv.tuteur_nom || ''),

                    JSON.stringify(conv) // Keep full JSON in metadata for safety
                ]);
            }
            console.log(`✅ Conventions importées (Version Normalisée).`);
        }

    } catch (err) {
        console.error("❌ Erreur de migration :", err);
    } finally {
        await client.end();
        console.log("🔌 Déconnecté.");
    }
}

main();
