"use client";

import React, { useEffect, useState } from 'react';

interface City {
    name: string;
    postcode: string;
    lat: number;
    lon: number;
}

interface CitySearchResultsProps {
    query: string;
    onSelect: (city: City) => void;
}

export function CitySearchResults({ query, onSelect }: CitySearchResultsProps) {
    const [results, setResults] = useState<City[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const search = async () => {
            if (query.length < 3) {
                setResults([]);
                return;
            }

            setLoading(true);
            try {
                // Search for municipalities
                const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&type=municipality&limit=5`);
                if (res.ok) {
                    const data = await res.json();
                    const features = data.features || [];
                    const cities = features.map((f: any) => ({
                        name: f.properties.city,
                        postcode: f.properties.postcode,
                        lat: f.geometry.coordinates[1],
                        lon: f.geometry.coordinates[0]
                    }));
                    setResults(cities);
                }
            } catch (error) {
                console.error("City search error", error);
            } finally {
                setLoading(false);
            }
        };

        const timer = setTimeout(search, 400);
        return () => clearTimeout(timer);
    }, [query]);

    if (!query || (results.length === 0 && !loading)) return null;

    return (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {loading && (
                <div className="p-3 text-sm text-gray-500 text-center">Recherche en cours...</div>
            )}
            {!loading && results.length === 0 && (
                <div className="p-3 text-sm text-gray-500 text-center">Aucune commune trouvée.</div>
            )}
            {results.map((city, idx) => (
                <button
                    key={`${city.postcode}-${idx}`}
                    type="button"
                    onClick={() => onSelect(city)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-0 flex justify-between items-center"
                >
                    <span className="font-medium text-gray-900">{city.name}</span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{city.postcode}</span>
                </button>
            ))}
        </div>
    );
}
