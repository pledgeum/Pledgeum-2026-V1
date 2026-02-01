
import React from 'react';
import { Badge } from '@/components/ui/badge';

export type WorkflowStatus =
    | 'DRAFT'
    | 'SUBMITTED'
    | 'SIGNED_PARENT'
    | 'VALIDATED_TEACHER'
    | 'SIGNED_COMPANY'
    | 'SIGNED_TUTOR'
    | 'VALIDATED_HEAD'
    | 'COMPLETED'
    | 'REJECTED'
    | 'ANNULEE'
    | 'CANCELLED';

const statusConfig: Record<WorkflowStatus, { label: string; className: string }> = {
    DRAFT: { label: 'Brouillon', className: 'bg-gray-100 text-gray-800 border-gray-200' },
    SUBMITTED: { label: 'Soumise (En attente signature parent)', className: 'bg-blue-100 text-blue-800 border-blue-200' },
    SIGNED_PARENT: { label: 'Signée par le Parent', className: 'bg-blue-200 text-blue-900 border-blue-300' },
    VALIDATED_TEACHER: { label: 'Validée par le Prof.', className: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    SIGNED_COMPANY: { label: 'Signée par l\'Entreprise', className: 'bg-purple-100 text-purple-800 border-purple-200' },
    SIGNED_TUTOR: { label: 'Signée par le Tuteur', className: 'bg-purple-100 text-purple-800 border-purple-200' },
    VALIDATED_HEAD: { label: 'Validée par le Chef d\'Établissement', className: 'bg-green-100 text-green-800 border-green-200' },
    COMPLETED: { label: 'Complétée', className: 'bg-green-500 text-white border-green-600' },
    REJECTED: { label: 'Rejetée', className: 'bg-red-100 text-red-800 border-red-200' },
    ANNULEE: { label: 'Annulée', className: 'bg-red-100 text-red-800 border-red-200' },
    CANCELLED: { label: 'Annulée', className: 'bg-red-100 text-red-800 border-red-200' },
};

export const ConventionStatusBadge = ({ status }: { status: string }) => {
    // Default to DRAFT if unknown
    const config = statusConfig[status as WorkflowStatus] || statusConfig['DRAFT'];

    return (
        <Badge variant="outline" className={`px-2 py-1 ${config.className}`}>
            {config.label}
        </Badge>
    );
};
