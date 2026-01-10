"use client";

import { useState, useEffect, useRef } from 'react';
import { Address } from '@/store/school';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';

interface AddressAutocompleteProps {
    label: string;
    value: Address;
    onChange: (address: Address) => void;
    onValidityChange?: (isValid: boolean) => void;
    disabled?: boolean;
    error?: boolean;
}

interface BanFeature {
    properties: {
        label: string;
        name: string; // Rue
        postcode: string;
        city: string;
        context: string;
    };
    geometry: {
        coordinates: [number, number];
    };
}

export function AddressAutocomplete({ label, value, onChange, onValidityChange, disabled, error }: AddressAutocompleteProps) {
    const [query, setQuery] = useState(value.street || '');
    const [suggestions, setSuggestions] = useState<BanFeature[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isValid, setIsValid] = useState(!!value.street); // Initial validity based on presence
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Initial sync with value prop
    useEffect(() => {
        if (value.street && !query) {
            setQuery(value.street);
            setIsValid(true);
            onValidityChange?.(true);
        }
    }, [value, query, onValidityChange]);

    // Click outside to close
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSearch = async (text: string) => {
        setQuery(text);
        setIsValid(false);
        onValidityChange?.(false);

        if (text.length < 3) {
            setSuggestions([]);
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(text)}&limit=5`);
            if (res.ok) {
                const data = await res.json();
                setSuggestions(data.features || []);
                setShowSuggestions(true);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelect = (feature: BanFeature) => {
        const { name, postcode, city } = feature.properties;
        onChange({
            street: name,
            postalCode: postcode,
            city: city
        });
        setQuery(name);
        setSuggestions([]);
        setShowSuggestions(false);
        setIsValid(true);
        onValidityChange?.(true);
    };

    return (
        <div className="space-y-1 relative" ref={wrapperRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <div className="relative">
                <input
                    type="text"
                    disabled={disabled}
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Saisissez votre adresse..."
                    className={`w-full p-3 pl-10 border rounded-md shadow-sm transition-colors ${error
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
                        : !isValid && query.length > 0
                            ? 'border-amber-300 focus:border-amber-500 focus:ring-amber-200'
                            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                        }`}
                />
                <MapPin className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                {isLoading && (
                    <div className="absolute right-3 top-3.5">
                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                    </div>
                )}
            </div>

            {/* Validation Feedback */}
            {!isValid && query.length > 0 && !showSuggestions && !isLoading && (
                <p className="text-xs text-amber-600 flex items-center mt-1">
                    <AlertCircle className="w-3 h-3 mr-1" /> Veuillez sélectionner une adresse dans la liste.
                </p>
            )}

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto mt-1">
                    {suggestions.map((feature, i) => (
                        <li
                            key={i}
                            onClick={() => handleSelect(feature)}
                            className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 text-sm text-gray-700 transition-colors"
                        >
                            <div className="font-medium">{feature.properties.label}</div>
                            <div className="text-xs text-gray-500">{feature.properties.context}</div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
