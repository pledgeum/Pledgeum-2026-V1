
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { Loader2, CheckCircle, Send, FileSignature } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ConventionActionsProps {
    convention: any;
    onUpdate: () => void;
    onSign?: () => void; // Trigger external signature modal
}

export const ConventionActions = ({ convention, onUpdate }: ConventionActionsProps) => {
    const { userRole, user } = useAuth();
    const [loading, setLoading] = useState(false);

    const handleStatusChange = async (newStatus: string) => {
        if (!confirm("Êtes-vous sûr de vouloir passer à l'étape suivante ?")) return;

        setLoading(true);
        try {
            const token = await user?.getIdToken();
            const res = await fetch(`/api/conventions/${convention.id}/status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
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

    // 2. Teacher (PP): SUBMITTED -> VALIDATED_BY_PP
    // Should verify if this teacher is the main teacher of the class?
    // For now, any teacher with access (RLS handles read access).
    if ((userRole === 'teacher' || userRole === 'school_head' || userRole === 'admin') && convention.status === 'SUBMITTED') {
        return (
            <div className="flex space-x-2">
                <Button onClick={() => handleStatusChange('VALIDATED_BY_PP')} className="bg-green-600 hover:bg-green-700 text-white">
                    <CheckCircle className="w-4 h-4 mr-2" /> Valider & Envoyer à l'Entreprise
                </Button>
                <Button variant="destructive" onClick={() => handleStatusChange('REJECTED')}>
                    Rejeter
                </Button>
            </div>
        );
    }

    // 3. School Head: SIGNED_BY_COMPANY -> SIGNED_BY_SCHOOL (Final)
    if ((userRole === 'school_head' || userRole === 'admin') && convention.status === 'SIGNED_BY_COMPANY') {
        return (
            <Button onClick={() => handleStatusChange('SIGNED_BY_SCHOOL')} className="bg-purple-600 hover:bg-purple-700 text-white">
                <FileSignature className="w-4 h-4 mr-2" /> Signer et Clôturer
            </Button>
        );
    }

    // Fallback info
    return (
        <span className="text-sm text-gray-500 italic">
            {convention.status === 'VALIDATED_BY_PP' && 'En attente de signature entreprise...'}
            {convention.status === 'COMPLETED' && 'Convention terminée.'}
            {convention.status === 'SIGNED_BY_SCHOOL' && 'Convention terminée.'}
        </span>
    );
};
