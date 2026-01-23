
import React from 'react';
import { Badge } from '@/components/ui/badge';

export type WorkflowStatus =
    | 'DRAFT'
    | 'SUBMITTED'
    | 'VALIDATED_BY_PP'
    | 'SIGNED_BY_COMPANY'
    | 'SIGNED_BY_SCHOOL'
    | 'COMPLETED'
    | 'REJECTED';

const statusConfig: Record<WorkflowStatus, { label: string; className: string }> = {
    DRAFT: { label: 'Brouillon', className: 'bg-gray-100 text-gray-800 border-gray-200' },
    SUBMITTED: { label: 'Soumise', className: 'bg-blue-100 text-blue-800 border-blue-200' },
    VALIDATED_BY_PP: { label: 'Validée par le Prof.', className: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    SIGNED_BY_COMPANY: { label: 'Signée par l\'Entreprise', className: 'bg-purple-100 text-purple-800 border-purple-200' },
    SIGNED_BY_SCHOOL: { label: 'Signée par l\'Établissement', className: 'bg-green-100 text-green-800 border-green-200' },
    COMPLETED: { label: 'Complétée', className: 'bg-green-500 text-white border-green-600' },
    REJECTED: { label: 'Rejetée', className: 'bg-red-100 text-red-800 border-red-200' },
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
