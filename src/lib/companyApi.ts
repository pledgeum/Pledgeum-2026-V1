export interface CompanyResult {
    siret: string;
    nom_complet: string;
    adresse: string; // Adress string constructed from parts
    code_postal?: string;
    ville?: string;
    lat?: number;
    lng?: number;
}

export async function fetchCompanyBySiret(siret: string): Promise<CompanyResult | null> {
    // Remove spaces if any
    const cleanSiret = siret.replace(/\s/g, '');

    if (cleanSiret.length !== 14 || isNaN(Number(cleanSiret))) {
        return null; // Basic validation
    }

    try {
        const response = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${cleanSiret}&limit=1`);

        if (!response.ok) {
            throw new Error('Company search failed');
        }

        const data = await response.json();

        if (data.results && data.results.length > 0) {
            const result = data.results[0];

            // Prioritize the matching establishment if available (contains specific address)
            // Fallback to siege if not found
            const etablissement = (result.matching_etablissements && result.matching_etablissements.length > 0)
                ? result.matching_etablissements[0]
                : result.siege;

            return {
                siret: etablissement.siret,
                nom_complet: result.nom_complet,
                adresse: etablissement.adresse,
                code_postal: etablissement.code_postal,
                ville: etablissement.libelle_commune,
                lat: etablissement.latitude ? parseFloat(etablissement.latitude) : undefined,
                lng: etablissement.longitude ? parseFloat(etablissement.longitude) : undefined
            };
        }

        return null;
    } catch (error) {
        console.error("Error fetching company by SIRET:", error);
        return null;
    }
}
