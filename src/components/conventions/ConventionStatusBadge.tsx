
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';

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
    SUBMITTED: { label: 'Soumise (En attente signature parent)', className: 'bg-green-100 text-green-800 border-green-200' },
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

export const ConventionStatusBadge = ({ status, signatures, isOutOfPeriod }: { status: string, signatures?: any, isOutOfPeriod?: boolean }) => {
    // Default to DRAFT if unknown
    const config = statusConfig[status as WorkflowStatus] || statusConfig['DRAFT'];

    // Robustness: Override color/label if Student Signed but status lags
    // This ensures "Green" feedback immediately after signature
    const isStudentSigned = signatures?.student?.signedAt;
    const effectiveClass = (status === 'DRAFT' && isStudentSigned)
        ? "bg-green-100 text-green-800 border-green-200" // Explicitly Green as requested
        : config.className;

    const effectiveLabel = (status === 'DRAFT' && isStudentSigned)
        ? "Signée par l'élève (En cours de validation)" // Custom label
        : config.label;

    return (
        <div className="flex flex-col items-end gap-1">
            <Badge variant="outline" className={`px-2 py-1 ${effectiveClass}`}>
                {effectiveLabel}
            </Badge>
            {isOutOfPeriod && (
                <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200 px-2 py-0.5 text-[10px] uppercase font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Rattrapage / Dérogatoire
                </Badge>
            )}
        </div>
    );
};
