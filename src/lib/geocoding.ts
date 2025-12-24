
interface Coordinates {
    lat: number;
    lon: number;
}

export async function getCoordinates(address: string): Promise<Coordinates | null> {
    try {
        const encoded = encodeURIComponent(address);
        const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encoded}&limit=1`);
        if (!res.ok) return null;
        const data = await res.json();

        if (data.features && data.features.length > 0) {
            const [lon, lat] = data.features[0].geometry.coordinates;
            return { lat, lon };
        }
        return null;
    } catch (error) {
        console.error("Geocoding error:", error);
        return null;
    }
}

// Haversine formula for distance in km
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
}
