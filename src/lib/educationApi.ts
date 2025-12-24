export interface SchoolResult {
    id: string;
    nom: string;
    type: string;
    adresse: string;
    ville: string;
    cp: string;
    mail?: string;
    lat?: number;
    lng?: number;
}

export async function searchSchools(query: string, city?: string, type?: string): Promise<SchoolResult[]> {
    const baseUrl = 'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-annuaire-education/records';

    // Construct filter query
    const whereParts: string[] = [];

    if (query) {
        // Search in Name OR City OR Zip
        // Note: Opendatasoft V2 search syntax: search(field, "val")
        // We can group them: (search(nom_etablissement, "val") OR search(nom_commune, "val") OR search(code_postal, "val"))
        whereParts.push(`(search(nom_etablissement, "${query}") OR search(nom_commune, "${query}") OR search(code_postal, "${query}"))`);
    }

    // Specific overrides if provided (though specific city arg seems unused in modal currently)
    if (city) whereParts.push(`search(nom_commune, "${city}")`);
    if (type) whereParts.push(`type_etablissement = "${type}"`);

    // Default to searching for generic terms if nothing specific (or rely on limit)
    // Actually the API requires some valid parameters or it returns everything.
    // If query is empty, and city is empty, we return empty to avoid load.
    if (!query && !city) return [];

    const whereClause = whereParts.join(' AND ');
    const url = new URL(baseUrl);
    url.searchParams.append('limit', '100');
    if (whereClause) url.searchParams.append('where', whereClause);

    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            console.error('API Error:', response.statusText);
            return [];
        }

        const data = await response.json();
        if (!data.results) return [];

        return data.results.map((record: any) => ({
            id: record.identifiant_de_l_etablissement,
            nom: record.nom_etablissement,
            type: record.type_etablissement,
            adresse: record.adresse_1,
            ville: record.nom_commune,
            cp: record.code_postal,
            mail: record.mail,
            lat: record.latitude,
            lng: record.longitude
        }));
    } catch (error) {
        console.error('School search failed:', error);
        return [];
    }
}
