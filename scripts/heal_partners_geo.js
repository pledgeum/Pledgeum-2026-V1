require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function heal() {
    const client = await pool.connect();
    try {
        console.log("🚀 Recherche des partenaires dégradés...");

        // Select partners missing crucial geolocation info
        const query = `
      SELECT siret, name 
      FROM partners 
      WHERE latitude IS NULL 
         OR longitude IS NULL 
         OR latitude = 0 
         OR longitude = 0 
         OR city IS NULL 
         OR city = ''
    `;
        const res = await client.query(query);
        const brokenPartners = res.rows;

        console.log(`🚑 ${brokenPartners.length} partenaires nécessitent une guérison.`);

        let healedCount = 0;
        let notFoundCount = 0;

        for (let i = 0; i < brokenPartners.length; i++) {
            const partner = brokenPartners[i];
            const cleanSiret = partner.siret.replace(/\s/g, '');

            if (cleanSiret.length !== 14) {
                console.warn(`⚠️ Siret invalide ignoré: ${cleanSiret}`);
                continue;
            }

            // Call API Gouv
            const url = `https://recherche-entreprises.api.gouv.fr/search?q=${cleanSiret}&limit=1`;
            try {
                const apiRes = await fetch(url, { headers: { 'Accept': 'application/json' } });

                if (!apiRes.ok) {
                    console.warn(`✖ HTTP ${apiRes.status} pour le SIRET ${cleanSiret}`);
                    notFoundCount++;
                    // Wait 200ms
                    await new Promise(r => setTimeout(r, 200));
                    continue;
                }

                const data = await apiRes.json();

                if (data.results && data.results.length > 0) {
                    const company = data.results[0];
                    let targetEtab = company.siege;

                    if (company.matching_etablissements && company.matching_etablissements.length > 0) {
                        const exact = company.matching_etablissements.find(e => e.siret === cleanSiret);
                        if (exact) targetEtab = exact;
                    }

                    const lat = targetEtab.latitude ? parseFloat(targetEtab.latitude) : null;
                    const lng = targetEtab.longitude ? parseFloat(targetEtab.longitude) : null;
                    const address = targetEtab.adresse || targetEtab.geo_adresse || '';
                    const city = targetEtab.libelle_commune || '';
                    const postalCode = targetEtab.code_postal || '';

                    if (lat !== null && lng !== null) {
                        await client.query(`
                        UPDATE partners
                        SET latitude = $1,
                            longitude = $2,
                            city = $3,
                            postal_code = $4,
                            address = $5
                        WHERE siret = $6
                    `, [lat, lng, city, postalCode, address, partner.siret]);
                        healedCount++;
                    } else {
                        console.log(`   └ Geo info missing from Insee for ${cleanSiret}`);
                    }
                } else {
                    notFoundCount++;
                }

            } catch (fetchError) {
                console.error(`Erreur réseau pour ${cleanSiret}:`, fetchError.message);
            }

            // Throttle to respect public API limits (5 requests per second approx)
            await new Promise(r => setTimeout(r, 200));

            if ((i + 1) % 10 === 0) {
                console.log(`⏳ Avancement : ${i + 1}/${brokenPartners.length}...`);
            }
        }

        console.log(`\n✅ Bilan de guérison :`);
        console.log(`- Cibles soignées : ${healedCount}`);
        console.log(`- Introuvables sur SIRENE : ${notFoundCount}`);

    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        pool.end();
    }
}

heal();
