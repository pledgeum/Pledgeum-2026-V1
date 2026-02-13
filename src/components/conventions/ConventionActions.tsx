
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSession } from "next-auth/react";
import { useUserStore } from '@/store/user';
import { Loader2, CheckCircle, Send, FileSignature } from 'lucide-react';
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

    // --- BUTTON LOGIC ---

    // 1. Student: DRAFT -> SUBMITTED
    if (userRole === 'student' && convention.status === 'DRAFT') {
        return (
            <Button onClick={() => handleStatusChange('SUBMITTED')} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Send className="w-4 h-4 mr-2" /> Soumettre au Professeur
            </Button>
        );
    }

    // 1.5 Parent: SUBMITTED -> SIGNED_PARENT (Via Modal)
    if (userRole === 'parent' && convention.status === 'SUBMITTED') {
        return (
            <Button onClick={onSign} className="bg-blue-600 hover:bg-blue-700 text-white">
                <FileSignature className="w-4 h-4 mr-2" /> Vérifier et Signer
            </Button>
        );
    }

    // 2. Teacher (PP): SUBMITTED/SIGNED_PARENT -> VALIDATED_TEACHER
    // Should verify if this teacher is the main teacher of the class?
    // For now, any teacher with access (RLS handles read access).
    const isReadyForTeacher = convention.status === 'SUBMITTED' || convention.status === 'SIGNED_PARENT';

    if ((userRole === 'teacher' || userRole === 'school_head') && isReadyForTeacher) {
        return (
            <div className="flex space-x-2">
                <Button onClick={() => handleStatusChange('VALIDATED_TEACHER')} className="bg-green-600 hover:bg-green-700 text-white">
                    <CheckCircle className="w-4 h-4 mr-2" /> Valider & Envoyer à l'Entreprise
                </Button>
                <Button variant="destructive" onClick={() => handleStatusChange('REJECTED')}>
                    Rejeter
                </Button>
            </div>
        );
    }

    // 2.5 Partners (Company/Tutor): VALIDATED_TEACHER -> SIGNED_COMPANY / SIGNED_TUTOR
    // They can sign if teacher validated.
    // Order: Doesn't strict matter, but usually Company first? 
    // Let's allow parallel signing if status is VALIDATED_TEACHER or one of them signed.
    const isReadyForPartner = convention.status === 'VALIDATED_TEACHER' || convention.status === 'SIGNED_COMPANY' || convention.status === 'SIGNED_TUTOR';

    if (isReadyForPartner) {
        if (userRole === 'company_head' && !convention.signatures?.companyAt) {
            return (
                <Button onClick={onSign} className="bg-purple-600 hover:bg-purple-700 text-white">
                    <FileSignature className="w-4 h-4 mr-2" /> Signer pour l'Entreprise
                </Button>
            );
        }
        if (userRole === 'tutor' && !convention.signatures?.tutorAt) {
            return (
                <Button onClick={onSign} className="bg-orange-600 hover:bg-orange-700 text-white">
                    <FileSignature className="w-4 h-4 mr-2" /> Signer en tant que Tuteur
                </Button>
            );
        }
    }

    // 3. School Head: SIGNED_COMPANY/SIGNED_TUTOR -> VALIDATED_HEAD (Final)
    const isReadyForHead = convention.status === 'SIGNED_COMPANY' || convention.status === 'SIGNED_TUTOR';

    if ((userRole === 'school_head') && isReadyForHead) {
        return (
            <Button onClick={() => handleStatusChange('VALIDATED_HEAD')} className="bg-purple-600 hover:bg-purple-700 text-white">
                <FileSignature className="w-4 h-4 mr-2" /> Signer et Clôturer
            </Button>
        );
    }

    // Fallback info
    return (
        <span className="text-sm text-gray-500 italic">
            {convention.status === 'VALIDATED_TEACHER' && 'En attente de signature entreprise...'}
            {convention.status === 'COMPLETED' && 'Convention terminée.'}
            {convention.status === 'VALIDATED_HEAD' && 'Convention validée et terminée.'}
        </span>
    );
};
