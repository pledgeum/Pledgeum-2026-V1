import React, { useState, useEffect } from 'react';
import { X, Calendar, MapPin, Calculator, Loader2 } from 'lucide-react';
import { useConventionStore, Convention } from '@/store/convention';
import { useSchoolStore, ClassDefinition, Teacher } from '@/store/school';
import { getCoordinates, calculateDistance } from '@/lib/geocoding';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    currentTeacherEmail?: string; // Optional if not strictly used for logic yet
    classId?: string; // Added to allow pre-selection
}

export const TrackingMatrixModal: React.FC<Props> = ({ isOpen, onClose, currentTeacherEmail, classId }) => {
    const { conventions, assignTrackingTeacher } = useConventionStore();
    const { classes, schoolAddress } = useSchoolStore();

    const [selectedClassId, setSelectedClassId] = useState<string>(classId || '');
    const [distances, setDistances] = useState<Record<string, number>>({}); // Key: "studentId-teacherId" -> distance
    const [isLoadingDistances, setIsLoadingDistances] = useState(false);
    const [assigningState, setAssigningState] = useState<string | null>(null); // "studentId-teacherId" being assigned

    useEffect(() => {
        if (classId) {
            setSelectedClassId(classId);
        } else if (classes.length > 0 && !selectedClassId) {
            setSelectedClassId(classes[0].id);
        }
    }, [classes, selectedClassId, classId]);

    // Filter Data
    const selectedClass = classes.find(c => c.id === selectedClassId);
    const classStudentsConventions = conventions.filter(
        c => c.eleve_classe === selectedClass?.name && ['VALIDATED_HEAD', 'SIGNED_TUTOR', 'SIGNED_COMPANY', 'VALIDATED_TEACHER', 'SIGNED_PARENT', 'SUBMITTED'].includes(c.status)
    );

    // We map students by convention ID because we are assigning to a convention
    const uniqueConventions = classStudentsConventions; // Assumption: 1 active convention per student usually, or we list all.

    // Teachers from the class definition
    const teachers = selectedClass?.teachersList || [];

    // Calculate Distances
    const calculateAllDistances = async () => {
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

        // 1. Get Teacher Coords
        // Priority: Teacher Preferred Commune -> School Address
        const teacherCoordsMap: Record<string, { lat: number, lon: number } | null> = {};

        // Default School Coords
        const schoolCoords = await getCoordsCached(schoolAddress);

        for (const teacher of teachers) {
            if (teacher.preferredCommune) {
                teacherCoordsMap[teacher.id] = await getCoordsCached(teacher.preferredCommune);
            } else {
                teacherCoordsMap[teacher.id] = schoolCoords;
            }
        }

        // 2. Loop Conventions (Students)
        for (const conv of uniqueConventions) {
            const companyAddress = `${conv.ent_adresse}, ${conv.ent_code_postal} ${conv.ent_ville}`;
            const companyCoords = await getCoordsCached(companyAddress);

            if (companyCoords) {
                for (const teacher of teachers) {
                    const tCoords = teacherCoordsMap[teacher.id] || schoolCoords;
                    if (tCoords) {
                        const dist = calculateDistance(companyCoords.lat, companyCoords.lon, tCoords.lat, tCoords.lon);
                        newDistances[`${conv.id}-${teacher.id}`] = Math.round(dist * 10) / 10;
                    }
                }
            }
        }

        setDistances(newDistances);
        setIsLoadingDistances(false);
    };

    // Auto-calc on class change? Maybe better manual or on mount if small?
    // Let's do it on mount/class change for UX magic effect
    useEffect(() => {
        if (isOpen && selectedClassId) {
            calculateAllDistances();
        }
    }, [isOpen, selectedClassId, uniqueConventions.length]); // Dependencies

    const handleAssign = async (convId: string, teacherId: string, teacherEmail: string) => {
        try {
            setAssigningState(`${convId}-${teacherId}`);
            await assignTrackingTeacher(convId, teacherEmail);
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

                {/* Controls */}
                <div className="px-6 py-4 border-b border-gray-100 flex gap-4 items-center">
                    <label className="text-sm font-medium text-gray-700">Classe :</label>
                    <select
                        value={selectedClassId}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                        className="w-48 px-3 py-2 border rounded-md text-sm"
                    >
                        {classes.map(c => (
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
                                            const key = `${conv.id}-${t.id}`;
                                            const dist = distances[key];
                                            const isAssigned = conv.prof_suivi_email === t.email;
                                            const isAssigning = assigningState === key;

                                            return (
                                                <td
                                                    key={t.id}
                                                    onClick={() => handleAssign(conv.id, t.id, t.email || '')}
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
                                                                <span className="text-green-800 font-bold">{dist !== undefined ? `${dist} km` : '?'}</span>
                                                                <span className="text-[10px] text-green-700">Assigné</span>
                                                            </>
                                                        ) : (
                                                            <span className={`text-gray-600 font-medium ${dist !== undefined && dist < 10 ? 'text-green-600 font-bold' : ''}`}>
                                                                {dist !== undefined ? `${dist} km` : '-'}
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
