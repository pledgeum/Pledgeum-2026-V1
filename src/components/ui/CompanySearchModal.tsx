'use client';

import { createPortal } from 'react-dom';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Search, Building2, MapPin, Loader2, Navigation } from 'lucide-react';
import { Convention } from '@/store/convention';
import { useSchoolStore } from '@/store/school';
import { getCoordinates, calculateDistance } from '@/lib/geocoding';
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from '@react-google-maps/api';

interface CompanySearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    studentAddress: string;
    schoolAddress: string;
    conventions: Convention[];
}

interface CompanyResult {
    id: string; // Add ID for tracking selected marker
    name: string;
    address: string;
    distance: number;
    section: string;
    siret: string;
    contact: string;
    email: string;
    lat: number;
    lon: number;
    // New fields
    activity?: string;
    jobs?: string[];
    isPartner?: boolean;
}

interface OriginMarker {
    type: 'school' | 'home';
    lat: number;
    lon: number;
}

const mapContainerStyle = {
    width: '100%',
    height: '100%'
};

const defaultCenter = {
    lat: 48.8566,
    lng: 2.3522
};

export function CompanySearchModal({ isOpen, onClose, studentAddress, schoolAddress, conventions }: CompanySearchModalProps) {
    const { partnerCompanies, hiddenActivities, hiddenJobs, hiddenClasses } = useSchoolStore();

    // Siret -> Classes Map from Conventions (for visibility check)
    const classesBySiret = useMemo(() => {
        const map = new Map<string, Set<string>>();
        conventions.forEach(c => {
            if (c.ent_siret && c.eleve_classe) {
                if (!map.has(c.ent_siret)) map.set(c.ent_siret, new Set());
                map.get(c.ent_siret)?.add(c.eleve_classe);
            }
        });
        return map;
    }, [conventions]);

    const uniqueActivities = useMemo(() => {
        const set = new Set(partnerCompanies.map(p => p.activity).filter(Boolean));
        // Filter out hidden activities
        return Array.from(set).filter(a => !hiddenActivities.includes(a)).sort();
    }, [partnerCompanies, hiddenActivities]);

    const uniqueJobs = useMemo(() => {
        const set = new Set(partnerCompanies.flatMap(p => p.jobs || []).filter(Boolean));
        // Filter out hidden jobs
        return Array.from(set).filter(j => !hiddenJobs.includes(j)).sort();
    }, [partnerCompanies, hiddenJobs]);
    const [origins, setOrigins] = useState<{ school: boolean; home: boolean }>({ school: true, home: false });
    const [radius, setRadius] = useState<number | null>(10);
    const [sectionFilter, setSectionFilter] = useState<string>('');
    const [activityFilter, setActivityFilter] = useState<string>('');
    const [jobFilter, setJobFilter] = useState<string>('');

    const [results, setResults] = useState<CompanyResult[]>([]);
    const [originMarkers, setOriginMarkers] = useState<OriginMarker[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    // Map State
    const [mapCenter, setMapCenter] = useState(defaultCenter);
    const [selectedMarker, setSelectedMarker] = useState<CompanyResult | OriginMarker | null>(null);
    const [map, setMap] = useState<google.maps.Map | null>(null);

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
    });

    const onLoad = useCallback(function callback(map: google.maps.Map) {
        setMap(map);
    }, []);

    const onUnmount = useCallback(function callback(map: google.maps.Map) {
        setMap(null);
    }, []);

    const availableSections = useMemo(() => {
        const sections = Array.from(new Set(conventions.map(c => c.eleve_classe).filter(Boolean)));
        return sections.filter(s => !hiddenClasses.includes(s)).sort();
    }, [conventions, hiddenClasses]);

    // Auto-fit bounds when results or origins change
    useEffect(() => {
        if (map && (results.length > 0 || originMarkers.length > 0)) {
            const bounds = new google.maps.LatLngBounds();

            // Add Origins
            originMarkers.forEach(marker => {
                bounds.extend({ lat: marker.lat, lng: marker.lon });
            });

            // Add Results
            results.forEach(result => {
                bounds.extend({ lat: result.lat, lng: result.lon });
            });

            // Don't zoom in too far if only one point
            if (bounds.isEmpty()) return;

            map.fitBounds(bounds);

            // Optional: If only 1 marker (e.g. just school), fitBounds might zoom max. 
            // Google Maps usually handles single point bounds by zooming to max, which might be too close.
            // But usually with at least School + Home, it's fine.
        }
    }, [map, results, originMarkers]);



    const handleSearch = async () => {
        setLoading(true);
        setSearched(true);
        setResults([]);
        setSelectedMarker(null);

        try {
            // 1. Geocode Origins
            const originPoints = [];
            if (origins.school && schoolAddress) {
                const coords = await getCoordinates(schoolAddress);
                if (coords) originPoints.push({ type: 'school', ...coords });
            }
            if (origins.home && studentAddress) {
                const coords = await getCoordinates(studentAddress);
                if (coords) originPoints.push({ type: 'home', ...coords });
            }

            // Update Origin Markers State
            // @ts-ignore
            setOriginMarkers(originPoints.map(p => ({
                type: p.type as 'school' | 'home',
                lat: p.lat,
                lon: p.lon
            })));

            if (originPoints.length === 0) {
                alert("Veuillez sélectionner au moins un point de départ valide.");
                setLoading(false);
                return;
            }

            // Set map center to first origin
            setMapCenter({ lat: originPoints[0].lat, lng: originPoints[0].lon });

            // 2. Process Companies
            const companiesMap = new Map<string, Omit<CompanyResult, 'distance'>>();

            // A. From Conventions (History)
            conventions.forEach(c => {
                if (c.ent_siret && c.ent_adresse && !companiesMap.has(c.ent_siret)) {
                    companiesMap.set(c.ent_siret, {
                        id: c.ent_siret,
                        name: c.ent_nom,
                        address: c.ent_adresse,
                        section: c.eleve_classe,
                        siret: c.ent_siret,
                        contact: `${c.ent_rep_nom} (${c.ent_rep_fonction})`,
                        email: c.ent_rep_email,
                        lat: 0, lon: 0
                    });
                }
            });

            // B. From Partners (Store)
            partnerCompanies.forEach(p => {
                if (companiesMap.has(p.siret)) {
                    // Update existing with partner info
                    const existing = companiesMap.get(p.siret)!;
                    companiesMap.set(p.siret, {
                        ...existing,
                        activity: p.activity,
                        jobs: p.jobs,
                        isPartner: true,
                        // Use partner coordinates if available and convention ones are 0
                        lat: (existing.lat === 0 && p.coordinates) ? p.coordinates.lat : existing.lat,
                        lon: (existing.lon === 0 && p.coordinates) ? p.coordinates.lng : existing.lon,
                        // If partner has address and convention doesn't (unlikely), use partner's.
                    });
                } else {
                    // Add new partner
                    const fullAddress = p.address.includes(p.city) ? p.address : `${p.address} ${p.postalCode} ${p.city}`;
                    companiesMap.set(p.siret, {
                        id: p.siret,
                        name: p.name,
                        address: fullAddress,
                        section: '', // No section history
                        siret: p.siret,
                        contact: '',
                        email: '',
                        lat: p.coordinates?.lat || 0,
                        lon: p.coordinates?.lng || 0,
                        activity: p.activity,
                        jobs: p.jobs,
                        isPartner: true
                    });
                }
            });

            const uniqueCompanies = Array.from(companiesMap.values());
            const filteredResults: CompanyResult[] = [];

            for (const company of uniqueCompanies) {
                // VISIBILITY CHECKS (Admin Configuration)
                // 1. Activity Visibility
                if (company.activity && hiddenActivities.includes(company.activity)) continue;

                // 2. Class Visibility
                // If company is associated with classes, check if it has at least one visible class.
                // If it has NO class history (pure partner), it remains visible.
                const companyClasses = classesBySiret.get(company.siret);
                if (companyClasses && companyClasses.size > 0) {
                    const hasVisibleClass = Array.from(companyClasses).some(c => !hiddenClasses.includes(c));
                    if (!hasVisibleClass) continue;
                }

                // 3. Job Visibility (Filter displayed jobs)
                // We create a copy of the company object to avoid mutating the Map/Store source
                let displayCompany = { ...company };
                if (displayCompany.jobs && displayCompany.jobs.length > 0) {
                    displayCompany.jobs = displayCompany.jobs.filter(j => !hiddenJobs.includes(j));
                    // Optional: If we want to hide companies that have NO visible jobs left?
                    // "Par défaut tout apparait" -> If filtered list is empty but activity is valid, keep it?
                    // Let's keep it, as the company might still be relevant by name/activity.
                }

                // Filters (User Selection)
                if (sectionFilter && displayCompany.section !== sectionFilter) continue;

                if (activityFilter) {
                    const act = (displayCompany.activity || '').toLowerCase();
                    if (!act.includes(activityFilter.toLowerCase())) continue;
                }

                if (jobFilter) {
                    const jobsStr = (displayCompany.jobs || []).join(' ').toLowerCase();
                    if (!jobsStr.includes(jobFilter.toLowerCase())) continue;
                }

                // Use the modified displayCompany for the result
                // Geocode if needed
                if (displayCompany.lat === 0 || displayCompany.lon === 0) {
                    // Note: In production, batch geocoding or caching is critical. API limit is usually 50/sec or limited daily.
                    const companyCoords = await getCoordinates(displayCompany.address);
                    if (companyCoords) {
                        displayCompany.lat = companyCoords.lat;
                        displayCompany.lon = companyCoords.lon;
                    } else {
                        continue; // Cannot place on map
                    }
                }

                // Calculate min distance to any selected origin
                let minDist = Infinity;
                for (const origin of originPoints) {
                    const dist = calculateDistance(origin.lat, origin.lon, displayCompany.lat, displayCompany.lon);
                    if (dist < minDist) minDist = dist;
                }

                // Check radius
                if (radius === null || minDist <= radius) {
                    filteredResults.push({ ...displayCompany, distance: parseFloat(minDist.toFixed(1)) });
                }
            }

            setResults(filteredResults.sort((a, b) => a.distance - b.distance));
        } catch (error) {
            console.error(error);
            alert("Erreur lors de la recherche.");
        } finally {
            setLoading(false);
        }
    };

    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    // Lock body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen || !mounted) return null;

    // Use Portal with extreme Z-Index to guarantee top layer
    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-blue-50">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 flex items-center">
                            <Building2 className="w-6 h-6 mr-2 text-blue-600" />
                            Trouver une entreprise ou un organisme d'accueil
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors">
                        <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
                    </button>
                </div>

                <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
                    {/* Sidebar: Filters & Results */}
                    <div className="w-full lg:w-1/3 lg:min-w-[350px] flex flex-col border-b lg:border-b-0 lg:border-r border-gray-200 bg-gray-50 h-[45%] lg:h-full">
                        <div className="p-3 lg:p-5 space-y-3 lg:space-y-5 border-b border-gray-200 shadow-sm bg-white z-10">
                            {/* Origin Selection */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Rechercher autour de :</label>
                                <div className="flex flex-col space-y-2">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={origins.school}
                                            onChange={(e) => setOrigins(prev => ({ ...prev, school: e.target.checked }))}
                                            className="form-checkbox h-4 w-4 text-blue-600 transition duration-150 ease-in-out"
                                        />
                                        <span className="text-sm text-gray-700">Mon lycée</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={origins.home}
                                            onChange={(e) => setOrigins(prev => ({ ...prev, home: e.target.checked }))}
                                            className="form-checkbox h-4 w-4 text-blue-600"
                                            disabled={!studentAddress}
                                        />
                                        <span className={`text-sm ${!studentAddress ? 'text-gray-400' : 'text-gray-700'} `}>
                                            Mon domicile
                                            {!studentAddress && <span className="ml-1 text-xs text-orange-400">(Non renseigné)</span>}
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* Filters Row */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Rayon</label>
                                    <select
                                        value={radius === null ? 'all' : radius}
                                        onChange={(e) => setRadius(e.target.value === 'all' ? null : Number(e.target.value))}
                                        className="w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value={5}>5 km</option>
                                        <option value={10}>10 km</option>
                                        <option value={15}>15 km</option>
                                        <option value={20}>20 km</option>
                                        <option value="all">Toutes distances</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Classe</label>
                                    <select
                                        value={sectionFilter}
                                        onChange={(e) => setSectionFilter(e.target.value)}
                                        className="w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="">Toutes</option>
                                        {availableSections.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Activité</label>
                                    <select
                                        value={activityFilter}
                                        onChange={(e) => setActivityFilter(e.target.value)}
                                        className="w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="">Toutes</option>
                                        {uniqueActivities.map(act => (
                                            <option key={act} value={act}>{act}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Filière de formation</label>
                                    <select
                                        value={jobFilter}
                                        onChange={(e) => setJobFilter(e.target.value)}
                                        className="w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="">Tous</option>
                                        {uniqueJobs.map(job => (
                                            <option key={job} value={job}>{job}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={handleSearch}
                                disabled={loading || (!origins.school && !origins.home)}
                                className="w-full flex items-center justify-center py-2 lg:py-3 px-4 lg:px-6 rounded-full shadow-xl text-sm lg:text-base font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-transform hover:scale-105"
                            >
                                {loading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                                Lancer la recherche
                            </button>
                        </div>

                        {/* List Results */}
                        <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-3 bg-gray-50">
                            {!searched ? (
                                <div className="text-center text-gray-400 py-10 px-4">
                                    <MapPin className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                    <p className="text-sm">Configurez les filtres pour voir les entreprises sur la carte et dans la liste.</p>
                                </div>
                            ) : results.length === 0 ? (
                                <div className="text-center text-gray-500 py-10">
                                    Aucune entreprise trouvée.
                                </div>
                            ) : (
                                results.map((company, idx) => (
                                    <div key={idx} className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-all cursor-pointer group"
                                        onClick={() => {
                                            setMapCenter({ lat: company.lat, lng: company.lon });
                                            setSelectedMarker(company);
                                        }}
                                    >
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-bold text-gray-800 text-sm group-hover:text-blue-600 transition-colors flex items-center gap-1">
                                                {company.name}
                                                {company.isPartner && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 ml-1 border border-green-100">
                                                        Partenaire
                                                    </span>
                                                )}
                                            </h4>
                                            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded ml-2 whitespace-nowrap">
                                                {company.distance} km
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">{company.address}</p>
                                        <p className="text-[10px] text-gray-400 mt-0.5">SIRET : {company.siret}</p>
                                        {company.activity && <p className="text-[10px] text-gray-400 truncate mt-0.5">{company.activity}</p>}

                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {company.section && (
                                                <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                                                    {company.section}
                                                </span>
                                            )}
                                            {company.jobs && company.jobs.map((job, jIdx) => (
                                                <span key={jIdx} className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600">
                                                    {job}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}


                        </div>
                    </div>

                    {/* Right: Map */}
                    <div className="flex-1 relative bg-gray-200 h-[55%] lg:h-full">
                        {isLoaded ? (
                            <GoogleMap
                                mapContainerStyle={mapContainerStyle}
                                center={mapCenter}
                                zoom={12}
                                onLoad={onLoad}
                                onUnmount={onUnmount}
                                options={{
                                    streetViewControl: false,
                                    mapTypeControl: false
                                }}
                            >
                                {/* Origin Markers */}
                                {originMarkers.map((origin, idx) => (
                                    <MarkerF
                                        key={`origin-${idx}`}
                                        position={{ lat: origin.lat, lng: origin.lon }}
                                        onClick={() => setSelectedMarker(origin)}
                                        // Colors: School (Indigo/Blue: default or specific hue), Home (Orange)
                                        // Google Maps icons typically require URL. We can use default or symbol.
                                        // For simplicity using default red pin, or maybe yellow/blue.
                                        icon={origin.type === 'school'
                                            ? "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
                                            : "http://maps.google.com/mapfiles/ms/icons/orange-dot.png"
                                        }
                                    />
                                ))}

                                {/* Company Markers */}
                                {results.map((company) => (
                                    <MarkerF
                                        key={company.id}
                                        position={{ lat: company.lat, lng: company.lon }}
                                        onClick={() => setSelectedMarker(company)}
                                    // Default Red Pin
                                    />
                                ))}

                                {/* Info Window */}
                                {selectedMarker && (
                                    <InfoWindowF
                                        position={{ lat: selectedMarker.lat, lng: selectedMarker.lon }}
                                        onCloseClick={() => setSelectedMarker(null)}
                                    >
                                        <div className="p-2 min-w-[200px]">
                                            {(() => {
                                                const home = originMarkers.find(m => m.type === 'home');
                                                const originParam = home ? `&origin=${home.lat},${home.lon}` : '';
                                                const destinationParam = `destination=${selectedMarker.lat},${selectedMarker.lon}`;
                                                // If the selected marker IS home, we don't need origin param pointing to itself, but Google Maps handles it gracefully (0 min trip) or we can omit.
                                                // Actually if destination is Home, origin should probably be School or current location?
                                                // User request specific: "l'itinéraire doit partir du domicile par défaut".
                                                // So if destination is Company or School, start from Home.
                                                // If destination IS Home, maybe start from School? Or just let user decide.
                                                // Let's stick to the request: Default origin = Home.

                                                const mapsUrl = `https://www.google.com/maps/dir/?api=1&${destinationParam}${originParam}`;

                                                if ('type' in selectedMarker) {
                                                    // Origin Info
                                                    return (
                                                        <div className="text-center">
                                                            <h3 className="font-bold text-sm mb-1 text-gray-900">
                                                                {selectedMarker.type === 'school' ? 'Lycée' : 'Domicile'}
                                                            </h3>
                                                            <p className="text-xs text-gray-500 mb-2">
                                                                {selectedMarker.type === 'school' ? "Point de départ (Établissement)" : "Point de départ (Domicile)"}
                                                            </p>
                                                            <a
                                                                href={mapsUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 font-medium"
                                                            >
                                                                <Navigation className="w-3 h-3 mr-1" />
                                                                Itinéraire
                                                            </a>
                                                        </div>
                                                    );
                                                } else {
                                                    // Company Info
                                                    return (
                                                        <div>
                                                            <h3 className="font-bold text-sm text-gray-900">{selectedMarker.name}</h3>
                                                            <p className="text-xs text-gray-600 mb-1">{selectedMarker.address}</p>
                                                            <p className="text-xs text-gray-500 mb-1 font-mono">SIRET: {selectedMarker.siret}</p>
                                                            {selectedMarker.contact && <p className="text-xs text-gray-500 mb-2">Contact: {selectedMarker.contact}</p>}

                                                            <a
                                                                href={mapsUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-full hover:bg-blue-700 transition space-x-1"
                                                            >
                                                                <Navigation className="w-3 h-3" />
                                                                <span>Itinéraire</span>
                                                            </a>
                                                        </div>
                                                    );
                                                }
                                            })()}
                                        </div>
                                    </InfoWindowF>
                                )}
                            </GoogleMap>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                                <div className="text-center">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                                    <p className="text-sm text-gray-500">Chargement de Google Maps...</p>
                                </div>
                            </div>
                        )}
                        {!searched && results.length === 0 && isLoaded && (
                            <div className="absolute inset-0 bg-white/60 flex items-center justify-center pointer-events-none z-[10]">
                                <div className="text-center text-gray-500 bg-white p-4 rounded-xl shadow-lg">
                                    <p className="font-medium">La carte s'affichera ici</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
