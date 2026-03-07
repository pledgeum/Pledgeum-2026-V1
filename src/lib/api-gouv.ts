/**
 * Utilitaire pour interroger l'API officielle recherche-entreprises.api.gouv.fr
 * Permet d'obtenir des données fiables (adresse, ville, coordonnées GPS) à partir d'un SIRET.
 */

export interface GouvCompanyInfo {
    siret: string;
    name: string;
    address: string;
    city: string;
    postalCode: string;
    lat: number | null;
    lng: number | null;
}

export async function getCompanyInfoBySiret(siret: string): Promise<GouvCompanyInfo | null> {
    try {
        const cleanSiret = siret.replace(/\s/g, '');
        if (cleanSiret.length !== 14) {
            console.error("[API_GOUV] SIRET invalide :", siret);
            return null;
        }

        const url = `https://recherche-entreprises.api.gouv.fr/search?q=${cleanSiret}&limit=1`;
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            console.error(`[API_GOUV] Erreur HTTP ${response.status} pour le SIRET ${cleanSiret}`);
            return null;
        }

        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            console.warn(`[API_GOUV] Aucun résultat pour le SIRET ${cleanSiret}`);
            return null;
        }

        const company = data.results[0];

        // Ensure we retrieve the specific establishment matched, or fallback to siege
        // API usually returns the siege if queried generically, but searching by siret usually yields the exact one
        let targetEtab = company.siege;
        if (company.matching_etablissements && company.matching_etablissements.length > 0) {
            // Find the one matching the SIRET exact
            const exact = company.matching_etablissements.find((e: any) => e.siret === cleanSiret);
            if (exact) targetEtab = exact;
        }

        const lat = targetEtab.latitude ? parseFloat(targetEtab.latitude) : null;
        const lng = targetEtab.longitude ? parseFloat(targetEtab.longitude) : null;

        const name = company.nom_complet || company.nom_raison_sociale || `Entreprise ${cleanSiret}`;
        const address = targetEtab.adresse || targetEtab.geo_adresse || '';
        const city = targetEtab.libelle_commune || '';
        const postalCode = targetEtab.code_postal || '';

        return {
            siret: cleanSiret,
            name,
            address,
            city,
            postalCode,
            lat,
            lng
        };

    } catch (error) {
        console.error("[API_GOUV] Exception réseau :", error);
        return null;
    }
}
