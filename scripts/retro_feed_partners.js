require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function retroFeedPartners() {
    const client = await pool.connect();
    try {
        console.log("🚀 Lancement de l'alimentation rétroactive des partenaires depuis l'historique des conventions...");

        // 1. Récupérer toutes les conventions
        const res = await client.query('SELECT metadata, establishment_uai FROM conventions');
        const conventions = res.rows;
        console.log(`📊 ${conventions.length} conventions trouvées.`);

        const partnersMap = new Map();

        // 2. Agréger les données par SIRET
        for (const row of conventions) {
            const data = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
            const uai = row.establishment_uai || data.establishment_uai;

            if (data.ent_siret && typeof data.ent_siret === 'string' && data.ent_siret.replace(/\s/g, '').length === 14 && uai) {
                const cleanSiret = data.ent_siret.replace(/\s/g, '');
                const key = `${uai}_${cleanSiret}`;
                if (!partnersMap.has(key)) {
                    partnersMap.set(key, {
                        school_id: uai,
                        siret: cleanSiret,
                        name: data.ent_nom || 'Inconnu',
                        address: data.ent_adresse || '',
                        lat: null,
                        lng: null,
                        classes: new Set()
                    });
                }

                if (data.eleve_classe) {
                    partnersMap.get(key).classes.add(data.eleve_classe);
                }
            }
        }

        console.log(`🏭 ${partnersMap.size} entreprises distinctes à consolider.`);

        let upsertCount = 0;

        // 3. Procéder à l'UPSERT
        for (const [key, p] of partnersMap.entries()) {
            const classArray = Array.from(p.classes);

            const partnerQuery = `
            INSERT INTO partners (
                school_id, 
                siret, 
                name, 
                address, 
                classes
            ) VALUES ($1, $2, $3, $4, $5::jsonb)
            ON CONFLICT (siret) DO UPDATE SET
                name = EXCLUDED.name,
                address = EXCLUDED.address,
                classes = (
                    SELECT jsonb_agg(DISTINCT elem)
                    FROM jsonb_array_elements(partners.classes || EXCLUDED.classes) elem
                )
        `;

            await client.query(partnerQuery, [
                p.school_id,
                p.siret,
                p.name,
                p.address,
                JSON.stringify(classArray)
            ]);

            upsertCount++;
            if (upsertCount % 10 === 0) console.log(`⏳ Progression : ${upsertCount}/${partnersMap.size}...`);
        }

        console.log(`✅ Rétro-alimentation terminée ! ${upsertCount} entreprises synchronisées avec la table partners.`);

    } catch (e) {
        console.error("Erreur lors de la rétro-alimentation :", e);
    } finally {
        client.release();
        await pool.end();
    }
}

retroFeedPartners();
