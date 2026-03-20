import React, { useState, useEffect } from 'react';
import { X, Calendar, MapPin, Calculator, Loader2 } from 'lucide-react';
import { useConventionStore, Convention } from '@/store/convention';
import { useSchoolStore, ClassDefinition, Teacher } from '@/store/school';
import { getCoordinates, calculateDistance } from '@/lib/geocoding';
import { toast } from 'sonner';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    currentTeacherEmail?: string; // Optional if not strictly used for logic yet
    currentUserRole?: string;
    classId?: string; // Added to allow pre-selection
}

export const TrackingMatrixModal: React.FC<Props> = ({ isOpen, onClose, currentTeacherEmail, currentUserRole, classId }) => {
    const { conventions, assignTrackingTeacher, saveDraftAssignments } = useConventionStore();
    const { classes, schoolAddress, schoolCity, fetchClassTeachers } = useSchoolStore();

    // Permissions: Admins/Staff see all classes, Teachers only see their own
    const isPrivileged = !['teacher', 'teacher_tracker', 'student', 'parent', 'tutor', 'company_head', 'company_head_tutor'].includes(currentUserRole || '');
    const authorizedClasses = React.useMemo(() => isPrivileged
        ? classes
        : classes.filter(c => c.mainTeacher?.email === currentTeacherEmail), [isPrivileged, classes, currentTeacherEmail]);


    const renderCount = React.useRef(0);
    const effectCount = React.useRef(0);
    renderCount.current += 1;

    const [selectedClassId, setSelectedClassId] = useState<string>(classId || '');
    const hasInitializedRef = React.useRef(false);

    const [distances, setDistances] = useState<Record<string, number>>({}); // Key: "studentId-teacherId" -> distance
    const [isLoadingDistances, setIsLoadingDistances] = useState(false);
    const [assigningState, setAssigningState] = useState<string | null>(null); // "studentId-teacherId" being assigned
    const [draftAssignments, setDraftAssignments] = useState<Record<string, { email: string, distance: number }>>({}); // convId -> {email, dist}
    const [isSavingDraft, setIsSavingDraft] = useState(false);

    // Filter Data - Moved to TOP to avoid ReferenceErrors in hooks
    const selectedClass = authorizedClasses.find(c => c.id === selectedClassId);
    const uniqueConventions = React.useMemo(() => conventions.filter(
        c => c.eleve_classe === selectedClass?.name && ['VALIDATED_HEAD', 'SIGNED_TUTOR', 'SIGNED_COMPANY', 'VALIDATED_TEACHER', 'SIGNED_PARENT', 'SUBMITTED'].includes(c.status)
    ), [conventions, selectedClass?.name]);

    useEffect(() => {
        if (!isOpen) {
            hasInitializedRef.current = false;
            return;
        }

        // Initialize from prop only ONCE per opening
        if (!hasInitializedRef.current && authorizedClasses.length > 0) {
            const initialId = (classId && authorizedClasses.some(c => c.id === classId))
                ? classId
                : authorizedClasses[0].id;

            setSelectedClassId(initialId);
            hasInitializedRef.current = true;
        }
    }, [isOpen, authorizedClasses, classId]);

    // Fetch teachers specifically for this class if missing (Store only fetches them on demand in Admin)
    useEffect(() => {
        if (isOpen && selectedClassId) {
            fetchClassTeachers(selectedClassId);
        }
    }, [isOpen, selectedClassId, fetchClassTeachers]);

    // Hydrate draft assignments from conventions (from DB)
    useEffect(() => {
        if (!isOpen || !selectedClassId || uniqueConventions.length === 0) return;

        const newDrafts: Record<string, { email: string, distance: number }> = {};
        uniqueConventions.forEach(conv => {
            const visit = (conv as any).visit;
            if (visit?.draft_tracking_teacher_email) {
                newDrafts[conv.id] = {
                    email: visit.draft_tracking_teacher_email,
                    distance: visit.draft_distance_km || 0
                };
            }
        });

        if (Object.keys(newDrafts).length > 0) {
            setDraftAssignments(prev => {
                // Merge, but keep existing local changes if they occurred before DB hydration
                return { ...newDrafts, ...prev };
            });
        }
    }, [isOpen, selectedClassId, uniqueConventions]);

    // Teachers from the class definition
    const teachers = selectedClass?.teachersList || [];

    // Calculate Distances
    const calculateAllDistances = async () => {
        if (!selectedClass || uniqueConventions.length === 0 || teachers.length === 0) return;
        
        setIsLoadingDistances(true);
        console.log(`[Matrice] Calcul des distances pour ${uniqueConventions.length} élèves et ${teachers.length} professeurs.`);

        const newDistances: Record<string, number> = {};
        const cityCache: Record<string, { lat: number, lon: number } | null> = {};

        const getCoordsCached = async (address: string) => {
            if (!address || address.trim() === '') return null;
            if (cityCache[address] !== undefined) return cityCache[address];
            const coords = await getCoordinates(address);
            cityCache[address] = coords;
            return coords;
        };

        try {
            const extractCityFromAddress = (address: string): string => {
                if (!address) return '';
                const match = address.match(/\b(\d{5})\s+(.*?)(?:cedex|cs|bp|\n|$)/i);
                if (match) return match[0].trim();
                const parts = address.split(/[\n,]/);
                return parts[parts.length - 1].trim();
            };

            const cleanSchoolAddress = schoolCity || extractCityFromAddress(schoolAddress);
            const schoolCoords = await getCoordsCached(cleanSchoolAddress);

            // 1. Resolve Teacher Coords (Parallel)
            const teacherCoordsMap: Record<string, { lat: number, lon: number } | null> = {};
            await Promise.all(teachers.map(async (teacher) => {
                teacherCoordsMap[teacher.id] = teacher.preferredCommune 
                    ? await getCoordsCached(teacher.preferredCommune)
                    : schoolCoords;
            }));

            // 2. Resolve Company Coords (Parallel with Cache)
            // Group conventions by address to avoid redundant geocoding
            const addressToConvIds = new Map<string, string[]>();
            uniqueConventions.forEach(conv => {
                const addr = conv.ent_adresse ? `${conv.ent_adresse}, ${conv.ent_code_postal} ${conv.ent_ville}` : '';
                if (addr) {
                    if (!addressToConvIds.has(addr)) addressToConvIds.set(addr, []);
                    addressToConvIds.get(addr)?.push(conv.id);
                }
            });

            await Promise.all(Array.from(addressToConvIds.entries()).map(async ([address, convIds]) => {
                const companyCoords = await getCoordsCached(address);
                
                convIds.forEach(convId => {
                    teachers.forEach(teacher => {
                        const tCoords = teacherCoordsMap[teacher.id] || schoolCoords;
                        const key = `${convId}-${teacher.id}`; // Use teacher.id
                        
                        if (companyCoords && tCoords) {
                            const dist = calculateDistance(companyCoords.lat, companyCoords.lon, tCoords.lat, tCoords.lon);
                            newDistances[key] = Math.round(dist * 10) / 10;
                        } else {
                            newDistances[key] = -1;
                        }
                    });
                });
            }));

            setDistances(newDistances);
            console.log("[Matrice] Calcul terminé avec succès.");
        } catch (e) {
            console.error("Erreur calcul distances:", e);
        } finally {
            setIsLoadingDistances(false);
        }
    };

    // Mémorise l'état pour éviter de recalculer inutilement, mais permet le refresh si les données changent
    const lastCalculationParams = React.useRef<string>("");

    useEffect(() => {
        if (isOpen && selectedClassId && teachers.length > 0 && uniqueConventions.length > 0) {
            const currentParams = `${selectedClassId}-${teachers.length}-${uniqueConventions.length}`;
            if (lastCalculationParams.current !== currentParams) {
                lastCalculationParams.current = currentParams;
                calculateAllDistances();
            }
        }
    }, [isOpen, selectedClassId, uniqueConventions.length, teachers.length]);

    const handleAssign = (convId: string, teacherEmail: string, distanceKm?: number) => {
        // Toggle/Set draft assignment
        setDraftAssignments(prev => {
            const newDraft = { ...prev };
            const current = conventions.find(c => c.id === convId);
            const isCurrentlyAssigned = (current as any).visit?.tracking_teacher_email === teacherEmail || current?.prof_suivi_email === teacherEmail;

            // If we click on what's already assigned (and not in draft), no-op or mark for change if we implement "unassign"
            // For now, any click sets the draft for that convention.
            newDraft[convId] = { email: teacherEmail, distance: distanceKm || 0 };
            return newDraft;
        });
    };

    const handleBatchValidate = async () => {
        const count = Object.keys(draftAssignments).length;
        if (count === 0) return;

        setIsSavingDraft(true);
        try {
            for (const [convId, data] of Object.entries(draftAssignments)) {
                await assignTrackingTeacher(convId, data.email, data.distance);
            }
            setDraftAssignments({});
            toast?.success?.(`${count} assignation(s) validée(s) et ODM généré(s).`);
        } catch (e: any) {
            console.error("Batch assignment error:", e);
            alert(`Une erreur est survenue : ${e.message || "Erreur inconnue"}`);
        } finally {
            setIsSavingDraft(false);
        }
    };

    const handleClose = async () => {
        if (Object.keys(draftAssignments).length > 0) {
            await saveDraftAssignments(draftAssignments);
        }
        onClose();
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
                    <button onClick={handleClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
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

                    <div className="ml-auto flex items-center gap-3">
                        {Object.keys(draftAssignments).length > 0 && (
                            <button
                                onClick={handleBatchValidate}
                                disabled={isSavingDraft}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-2 animate-bounce"
                            >
                                {isSavingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                                Valider ces {Object.keys(draftAssignments).length} suivis et éditer les ODM
                            </button>
                        )}
                    </div>
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
                                            const isAssigned = (conv as any).visit?.tracking_teacher_email === t.email || conv.prof_suivi_email === t.email;
                                            const isDraft = draftAssignments[conv.id]?.email === t.email;
                                            const isAssigning = assigningState === key;

                                            return (
                                                <td
                                                    key={t.id}
                                                    onClick={() => !isSavingDraft && handleAssign(conv.id, t.email || '', dist)}
                                                    className={`
                                                relative p-0 border border-gray-200 cursor-pointer transition-all
                                                ${isAssigned ? 'bg-green-100 hover:bg-green-200 ring-2 ring-inset ring-green-500' : ''}
                                                ${isDraft ? 'bg-indigo-50 hover:bg-indigo-100 ring-4 ring-inset ring-indigo-400 border-indigo-500 z-10' : 'hover:bg-blue-50'}
                                                ${isSavingDraft ? 'opacity-50 cursor-not-allowed' : ''}
                                            `}
                                                >
                                                    <div className="h-full w-full p-3 flex flex-col items-center justify-center min-h-[60px]">
                                                        {isAssigning || (isSavingDraft && isDraft) ? (
                                                            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                                        ) : isDraft ? (
                                                            <>
                                                                <span className="text-indigo-800 font-bold">{dist !== undefined ? (dist === -1 ? <span title="Adresse introuvable">⚠️ N/A</span> : `${dist} km`) : '?'}</span>
                                                                <span className="text-[10px] text-indigo-700 font-bold">En attente...</span>
                                                            </>
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
