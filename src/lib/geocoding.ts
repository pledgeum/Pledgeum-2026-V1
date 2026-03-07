
interface Coordinates {
    lat: number;
    lon: number;
}

export async function getCoordinates(address: string): Promise<Coordinates | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 seconds timeout

    try {
        const encoded = encodeURIComponent(address.substring(0, 100)); // Limit length to avoid API 504
        const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encoded}&limit=1`, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
        });

        clearTimeout(timeoutId);
        if (!res.ok) return null;

        const data = await res.json();
        if (data.features && data.features.length > 0) {
            const [lon, lat] = data.features[0].geometry.coordinates;
            return { lat, lon };
        }
        return null;
    } catch (error) {
        clearTimeout(timeoutId);
        // Silently fail on timeout to not pollute logs with AbortError
        if ((error as any).name !== 'AbortError') {
            console.error("Geocoding error for address:", address.substring(0, 30), error);
        }
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
