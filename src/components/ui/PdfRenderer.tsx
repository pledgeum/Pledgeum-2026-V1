'use client';

import { usePDF } from '@react-pdf/renderer';
import React, { useEffect, useState, ReactElement } from 'react';
import { FileText, Eye, Loader2, AlertCircle } from 'lucide-react';

interface PdfRendererProps {
    document: ReactElement<any>;
    height?: string;
    className?: string; // Add className prop to match interface
}

export const PdfRenderer = ({ document, height = '600px', className }: PdfRendererProps) => {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const [instance, updateInstance] = usePDF({ document });

    if (!isClient) {
        return (
            <div className={`w-full ${className} h-[600px] bg-gray-50 animate-pulse rounded-lg flex items-center justify-center`}>
                <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
        );
    }

    if (instance.loading) {
        return (
            <div className={`w-full ${className} flex flex-col items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200`}>
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
                <span className="text-gray-500 text-sm font-medium">Génération du document...</span>
            </div>
        );
    }

    if (instance.error) {
        console.error('PDF Generation Error:', instance.error);
        return (
            <div className={`w-full ${className} flex flex-col items-center justify-center h-64 bg-red-50 text-red-600 rounded-lg border border-red-100`}>
                <AlertCircle className="w-8 h-8 mb-2" />
                <span className="font-medium">Erreur de génération du PDF: {instance.error.toString()}</span>
            </div>
        );
    }

    return (
        <div className={`w-full ${className} flex flex-col gap-4`}>
            {/* --- MOBILE VIEW (< 768px): Card with Action Button --- */}
            <div className="md:hidden flex flex-col items-center p-6 bg-white border border-gray-200 rounded-xl shadow-sm text-center">
                <div className="bg-blue-50 p-4 rounded-full mb-4">
                    <FileText className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Votre convention est prête</h3>
                <p className="text-sm text-gray-500 mb-6">
                    Pour un confort de lecture optimal sur mobile, ouvrez le document en plein écran.
                </p>
                <a
                    href={instance.url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium active:scale-95 transition-all w-full shadow-sm"
                >
                    <Eye className="w-5 h-5" />
                    Ouvrir le PDF
                </a>
            </div>

            {/* --- DESKTOP VIEW (>= 768px): Native Iframe --- */}
            <div className="hidden md:block w-full border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-gray-50" style={{ height }}>
                <iframe
                    src={instance.url || undefined}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    title="Convention PDF"
                />
            </div>

        </div>
    );
};
