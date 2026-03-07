import React, { useState, useEffect } from 'react';
import { X, Calendar, MapPin, Calculator, Loader2 } from 'lucide-react';
import { useConventionStore, Convention } from '@/store/convention';
import { useSchoolStore, ClassDefinition, Teacher } from '@/store/school';
import { getCoordinates, calculateDistance } from '@/lib/geocoding';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    currentTeacherEmail?: string; // Optional if not strictly used for logic yet
    currentUserRole?: string;
    classId?: string; // Added to allow pre-selection
}

export const TrackingMatrixModal: React.FC<Props> = ({ isOpen, onClose, currentTeacherEmail, currentUserRole, classId }) => {
    const { conventions, assignTrackingTeacher } = useConventionStore();
    const { classes, schoolAddress, schoolCity, fetchClassTeachers } = useSchoolStore();

    // Permissions: Admins see all classes, Teachers only see the ones where they are the 'maniTeacher'
    const isPrivileged = ['admin', 'school_admin', 'business_manager', 'ddfpt', 'at_ddfpt'].includes(currentUserRole || '');
    const authorizedClasses = isPrivileged
        ? classes
        : classes.filter(c => c.mainTeacher?.email === currentTeacherEmail);

    const renderCount = React.useRef(0);
    const effectCount = React.useRef(0);
    renderCount.current += 1;

    const [selectedClassId, setSelectedClassId] = useState<string>(classId || '');
    const [distances, setDistances] = useState<Record<string, number>>({}); // Key: "studentId-teacherId" -> distance
    const [isLoadingDistances, setIsLoadingDistances] = useState(false);
    const [assigningState, setAssigningState] = useState<string | null>(null); // "studentId-teacherId" being assigned

    useEffect(() => {
        if (!isOpen) return;
        if (classId && authorizedClasses.some(c => c.id === classId)) {
            setSelectedClassId(classId);
        } else if (authorizedClasses.length > 0 && !authorizedClasses.some(c => c.id === selectedClassId)) {
            setSelectedClassId(authorizedClasses[0].id);
        }
    }, [authorizedClasses, selectedClassId, classId, isOpen]);

    // Fetch teachers specifically for this class if missing (Store only fetches them on demand in Admin)
    useEffect(() => {
        if (isOpen && selectedClassId) {
            fetchClassTeachers(selectedClassId);
        }
    }, [isOpen, selectedClassId, fetchClassTeachers]);

    // Debug View State
    const [debugContext, setDebugContext] = useState<any>({});

    // Filter Data
    const selectedClass = authorizedClasses.find(c => c.id === selectedClassId);
    const classStudentsConventions = conventions.filter(
        c => c.eleve_classe === selectedClass?.name && ['VALIDATED_HEAD', 'SIGNED_TUTOR', 'SIGNED_COMPANY', 'VALIDATED_TEACHER', 'SIGNED_PARENT', 'SUBMITTED'].includes(c.status)
    );

    // We map students by convention ID because we are assigning to a convention
    const uniqueConventions = classStudentsConventions; // Assumption: 1 active convention per student usually, or we list all.

    // Teachers from the class definition
    const teachers = selectedClass?.teachersList || [];

    // Calculate Distances
    const calculateAllDistances = async () => {
        effectCount.current += 1;
        if (!selectedClass || uniqueConventions.length === 0) return;
        setIsLoadingDistances(true);

        const newDistances: Record<string, number> = {};

        // Cache to avoid re-fetching same city coords
        const cityCache: Record<string, { lat: number, lon: number } | null> = {};

        const getCoordsCached = async (address: string) => {
            if (cityCache[address] !== undefined) return cityCache[address];
            const coords = await getCoordinates(address);
            cityCache[address] = coords;
            return coords;
        };

        try {
            // Helper function to figure out the best baseline address for the school.
            // If the city is known perfectly, use it. Otherwise attempt to extract from address.
            const extractCityFromAddress = (address: string): string => {
                if (!address) return '';
                const match = address.match(/\b(\d{5})\s+(.*?)(?:cedex|cs|bp|\n|$)/i);
                if (match) return `${match[1]} ${match[2].trim()}`;
                const parts = address.split(/[\n,]/);
                return parts[parts.length - 1].trim();
            };

            const cleanSchoolAddress = schoolCity || extractCityFromAddress(schoolAddress);
            console.log("[Matrice] Original School:", schoolAddress, "City:", schoolCity, "-> Cleaned School:", cleanSchoolAddress);

            // 1. Get Teacher Coords (Parallel)
            const teacherCoordsMap: Record<string, { lat: number, lon: number } | null> = {};
            const schoolCoords = await getCoordsCached(cleanSchoolAddress);
            console.log("[Matrice] School Coords resolved:", schoolCoords);

            await Promise.all(teachers.map(async (teacher) => {
                if (teacher.preferredCommune) {
                    teacherCoordsMap[teacher.id] = await getCoordsCached(teacher.preferredCommune);
                } else {
                    teacherCoordsMap[teacher.id] = schoolCoords;
                }
            }));
            console.log("[Matrice] Teachers Coords map:", teacherCoordsMap);

            // 2. Fetch Bulk Coordinates from local DB using SIRETs
            // Remove ANY whitespaces from SIRET strings explicitly
            const sirets = Array.from(new Set(uniqueConventions.map(c => c.ent_siret ? c.ent_siret.replace(/\s+/g, '') : null).filter(Boolean))) as string[];
            let dbCoordsMap: Record<string, { lat: number, lon: number }> = {};
            if (sirets.length > 0) {
                try {
                    const res = await fetch(`/api/partners/coords-by-siret?sirets=${sirets.join(',')}`);
                    if (res.ok) {
                        dbCoordsMap = await res.json();
                        console.log("[Matrice] DB Coords Map fetched:", dbCoordsMap);
                    }
                } catch (err) {
                    console.error("Erreur lors de la récupération en masse des coordonnées DB:", err);
                }
            }

            // 3. Loop Conventions (Students) - Parallel batches for speed
            await Promise.all(uniqueConventions.map(async (conv) => {
                let companyCoords: { lat: number, lon: number } | null = null;
                const cleanSiret = conv.ent_siret ? conv.ent_siret.replace(/\s+/g, '') : null;

                // Prioritize checking our local Partner DB via SIRET
                if (cleanSiret && dbCoordsMap[cleanSiret]) {
                    companyCoords = dbCoordsMap[cleanSiret];
                } else {
                    // Fallback to Government open API if missing from DB or no SIRET
                    let companyAddress = conv.ent_adresse;
                    if (companyAddress && !companyAddress.includes(conv.ent_code_postal)) {
                        companyAddress = `${companyAddress}, ${conv.ent_code_postal} ${conv.ent_ville}`;
                    }
                    companyCoords = companyAddress ? await getCoordsCached(companyAddress) : null;
                    console.log(`[Matrice] Fallback api gouv for ${conv.ent_nom} (${companyAddress}):`, companyCoords);
                }

                if (!companyCoords) {
                    console.warn(`[Matrice] Company coords NULL for ${conv.ent_nom} (SIRET: ${cleanSiret})`);
                    for (const teacher of teachers) {
                        newDistances[`${conv.id}-${teacher.email}`] = -1;
                    }
                }

                if (companyCoords) {
                    for (const teacher of teachers) {
                        const tCoords = teacherCoordsMap[teacher.id] || schoolCoords;
                        if (tCoords) {
                            const dist = calculateDistance(companyCoords.lat, companyCoords.lon, tCoords.lat, tCoords.lon);
                            newDistances[`${conv.id}-${teacher.email}`] = Math.round(dist * 10) / 10;
                        }
                    }
                }
            }));

            setDebugContext({
                _distancesComputed: Object.keys(newDistances).length,
                _dbCoordsMapFound: Object.keys(dbCoordsMap).length,
                _teachersCount: teachers.length,
                _teachersCoordsResolved: Object.keys(teacherCoordsMap).filter(k => teacherCoordsMap[k] !== null).length,
                schoolCityToGeocode: cleanSchoolAddress,
                schoolCoords,
                siretsToFetch: sirets,
                _sampleKeysDistances: Object.keys(newDistances).slice(0, 3),
                _sampleTeachersGiven: teachers.map(t => t.id).slice(0, 3)
            });

            setDistances(newDistances);
        } catch (e) {
            console.error("Erreur lors du calcul des distances pour la matrice :", e);
        } finally {
            setIsLoadingDistances(false);
        }
    };

    // Mémorise la dernière classe étudiée pour éviter toute boucle infinie asynchrone
    const calculatedClassRef = React.useRef<string | null>(null);

    // Let's do it on mount/class change for UX magic effect
    useEffect(() => {
        if (isOpen && selectedClassId && teachers.length > 0 && uniqueConventions.length > 0) {
            // Verrou strict : on ne relance le calcul que si on change de classe
            if (calculatedClassRef.current !== selectedClassId) {
                console.log("🚀 Lancement du calcul des distances...", { conventionsCount: uniqueConventions.length });
                calculatedClassRef.current = selectedClassId;
                calculateAllDistances();
            }
        }
    }, [isOpen, selectedClassId, uniqueConventions.length, teachers.length]); // Dependencies

    const handleAssign = async (convId: string, teacherId: string, teacherEmail: string, distanceKm?: number) => {
        try {
            setAssigningState(`${convId}-${teacherEmail}`);
            await assignTrackingTeacher(convId, teacherEmail, distanceKm);
        } catch (e) {
            alert("Erreur lors de l'attribution");
        } finally {
            setAssigningState(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-blue-600" />
                            Matrice des Visites de Stage
                        </h2>
                        <p className="text-sm text-gray-500">Attribuez les enseignants en fonction de la distance.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Debug Panel Removed */}

                {/* Controls */}
                <div className="px-6 py-4 border-b border-gray-100 flex gap-4 items-center">
                    <label className="text-sm font-medium text-gray-700">Classe :</label>
                    <select
                        value={selectedClassId}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                        className="w-48 px-3 py-2 border rounded-md text-sm"
                    >
                        {authorizedClasses.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>

                    {isLoadingDistances && (
                        <div className="text-xs text-blue-600 flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Calcul des distances...
                        </div>
                    )}
                </div>

                {/* Matrix Table */}
                <div className="flex-1 overflow-auto p-6">
                    {teachers.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">Aucun enseignant configuré pour cette classe.</div>
                    ) : uniqueConventions.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">Aucune convention trouvée pour cette classe.</div>
                    ) : (
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr>
                                    <th className="sticky top-0 left-0 z-20 bg-gray-100 p-3 text-left font-semibold text-gray-700 border border-gray-200 shadow-sm min-w-[200px]">
                                        Élève / Lieu
                                    </th>
                                    {teachers.map(t => (
                                        <th key={t.id} className="sticky top-0 z-10 bg-gray-50 p-3 font-semibold text-gray-700 border border-gray-200 min-w-[120px]">
                                            <div className="flex flex-col items-center">
                                                <span>{t.firstName.charAt(0)}. {t.lastName}</span>
                                                <span className="text-[10px] text-gray-400 font-normal">
                                                    {t.preferredCommune || "Lycée"}
                                                </span>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {uniqueConventions.map(conv => (
                                    <tr key={conv.id} className="hover:bg-gray-50">
                                        <td className="sticky left-0 bg-white p-3 border border-gray-200 font-medium text-gray-900 shadow-sm">
                                            <div className="flex flex-col">
                                                <span>{conv.eleve_prenom} {conv.eleve_nom}</span>
                                                <span className="text-xs text-blue-600 font-normal truncate max-w-[180px]" title={conv.ent_ville}>
                                                    {conv.ent_ville}
                                                </span>
                                            </div>
                                        </td>
                                        {teachers.map(t => {
                                            const key = `${conv.id}-${t.email}`;
                                            const dist = distances[key];
                                            const isAssigned = (conv as any).visit?.tracking_teacher_email === t.email || conv.prof_suivi_email === t.email;
                                            const isAssigning = assigningState === key;

                                            return (
                                                <td
                                                    key={t.id}
                                                    onClick={() => handleAssign(conv.id, t.id, t.email || '', dist)}
                                                    className={`
                                                relative p-0 border border-gray-200 cursor-pointer transition-all
                                                ${isAssigned ? 'bg-green-100 hover:bg-green-200 ring-2 ring-inset ring-green-500' : 'hover:bg-blue-50'}
                                            `}
                                                >
                                                    <div className="h-full w-full p-3 flex flex-col items-center justify-center min-h-[60px]">
                                                        {isAssigning ? (
                                                            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                                        ) : isAssigned ? (
                                                            <>
                                                                <span className="text-green-800 font-bold">{dist !== undefined ? (dist === -1 ? <span title="Adresse introuvable">⚠️ N/A</span> : `${dist} km`) : '?'}</span>
                                                                <span className="text-[10px] text-green-700">Assigné</span>
                                                            </>
                                                        ) : (
                                                            <span className={`text-gray-600 font-medium ${dist !== undefined && dist < 10 && dist !== -1 && !Number.isNaN(dist) ? 'text-green-600 font-bold' : ''}`}>
                                                                {dist !== undefined ? (dist === -1 ? <span title="Adresse introuvable">⚠️ N/A</span> : `${dist} km`) : (
                                                                    <span className="animate-pulse">⏳</span>
                                                                )}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};
