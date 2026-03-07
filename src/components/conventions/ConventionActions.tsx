
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSession } from "next-auth/react";
import { useUserStore } from '@/store/user';
import { Loader2, CheckCircle, Send, FileSignature, PenTool } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ConventionActionsProps {
    convention: any;
    onUpdate: () => void;
    onSign?: () => void; // Trigger external signature modal
}

export const ConventionActions = ({ convention, onUpdate, onSign }: ConventionActionsProps) => {
    const { data: session } = useSession();
    const { role } = useUserStore();
    const userRole = role; // Map usage
    const [loading, setLoading] = useState(false);

    const handleStatusChange = async (newStatus: string) => {
        if (!confirm("Êtes-vous sûr de vouloir passer à l'étape suivante ?")) return;

        setLoading(true);
        try {
            // No token needed, session cookie used
            const res = await fetch(`/api/conventions/${convention.id}/status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to update status');
            }

            toast.success("Statut mis à jour avec succès !");
            onUpdate();

        } catch (error: any) {
            console.error("Action Failed:", error);
            toast.error("Erreur: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <Button disabled><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Traitement...</Button>;
    }

    // --- DATA HELPERS ---
    const sigs = convention.signatures || {};

    /**
     * Robust Minority Detection
     * Deduce from birth date if available, otherwise trust the flag.
     */
    const getIsMinor = () => {
        const dob = convention.eleve_date_naissance || (convention as any).date_naissance || convention.metadata?.eleve_date_naissance;
        if (dob) {
            const birthDate = new Date(dob);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            return age < 18;
        }
        return convention.est_mineur || convention.metadata?.est_mineur;
    };

    const isMinor = getIsMinor();

    // --- BUTTON LOGIC ---

    // 1. Student: DRAFT -> SUBMITTED
    if (userRole === 'student' && convention.status === 'DRAFT' && !sigs.student) {
        return (
            <Button onClick={() => handleStatusChange('SUBMITTED')} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Send className="w-4 h-4 mr-2" /> Soumettre au Professeur
            </Button>
        );
    }

    // 2. Parent (if minor, student signed, parent hasn't signed)
    // The parent can sign as soon as the student has signed, regardless of teacher validation.
    if (userRole === 'parent' && isMinor && sigs.student && !sigs.parent) {
        return (
            <Button onClick={onSign} className="bg-blue-600 hover:bg-blue-700 text-white">
                <FileSignature className="w-4 h-4 mr-2" /> Vérifier et Signer (Représentant Légal)
            </Button>
        );
    }

    // 3. Teacher (student signed, teacher hasn't signed)
    // The teacher can sign as soon as the student has signed, regardless of parent signature.
    const isTeacher = userRole === 'teacher' || userRole === 'school_head';
    if (isTeacher && sigs.student && !sigs.teacher) {
        return (
            <div className="flex space-x-2">
                <Button onClick={onSign} className="bg-green-600 hover:bg-green-700 text-white gap-2">
                    <PenTool className="w-4 h-4" /> Signer la convention (Enseignant)
                </Button>
                <Button variant="destructive" onClick={() => handleStatusChange('REJECTED')}>
                    Rejeter
                </Button>
            </div>
        );
    }

    // 4. Partners (Company/Tutor): Requires Teacher AND (if minor) Parent
    // Blocked until Teacher validates AND Parent signs (if applicable)
    const isPartner = userRole === 'company_head' || userRole === 'tutor' || userRole === 'company_head_tutor';
    const canPartnerSign = sigs.teacher && (!isMinor || sigs.parent);

    if (isPartner) {
        if (!canPartnerSign) {
            return (
                <span className="text-sm text-amber-600 italic flex items-center gap-1">
                    En attente de signature {!sigs.teacher && 'Enseignant'}{!sigs.teacher && isMinor && !sigs.parent && ' et '}{isMinor && !sigs.parent && 'Parent'}...
                </span>
            );
        }

        if (userRole === 'company_head' && !sigs.company_head) {
            return (
                <Button onClick={onSign} className="bg-purple-600 hover:bg-purple-700 text-white">
                    <FileSignature className="w-4 h-4 mr-2" /> Signer pour l'Entreprise
                </Button>
            );
        }
        if (userRole === 'tutor' && !sigs.tutor) {
            return (
                <Button onClick={onSign} className="bg-orange-600 hover:bg-orange-700 text-white">
                    <FileSignature className="w-4 h-4 mr-2" /> Signer en tant que Tuteur
                </Button>
            );
        }
        if (userRole === 'company_head_tutor') {
            const needsCompany = !sigs.company_head;
            const needsTutor = !sigs.tutor;
            if (needsCompany || needsTutor) {
                return (
                    <Button onClick={onSign} className="bg-gradient-to-r from-purple-600 to-orange-600 hover:from-purple-700 hover:to-orange-700 text-white font-bold">
                        <FileSignature className="w-4 h-4 mr-2" /> Signer (Entreprise & Tuteur)
                    </Button>
                );
            }
        }
    }

    // 5. School Head: Final Seal
    // Requires ALL previous signatures
    if (userRole === 'school_head' && sigs.teacher && (!isMinor || sigs.parent) && sigs.tutor && sigs.company_head && !sigs.head) {
        return (
            <Button onClick={onSign} className="bg-purple-700 hover:bg-purple-800 text-white font-bold shadow-lg">
                <FileSignature className="w-4 h-4 mr-2" /> Finaliser et Clôturer la Convention
            </Button>
        );
    }

    // Fallback/No actions available
    return (
        <div className="flex flex-col gap-1">
            <span className="text-sm text-gray-500 italic">
                {convention.status === 'VALIDATED_HEAD' || convention.status === 'COMPLETED'
                    ? 'Convention terminée et validée.'
                    : 'Aucune action requise pour le moment.'}
            </span>
            {sigs.student && !sigs.teacher && (
                <span className="text-xs text-blue-600">En attente de validation Enseignant.</span>
            )}
            {sigs.student && isMinor && !sigs.parent && (
                <span className="text-xs text-blue-600">En attente de signature Parent.</span>
            )}
        </div>
    );
};
