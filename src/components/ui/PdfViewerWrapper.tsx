'use client';

import dynamic from 'next/dynamic';
import React, { ReactElement } from 'react';
import { Loader2 } from 'lucide-react';

// Dynamically import the renderer we just created
const PdfRendererDynamic = dynamic(
    () => import('./PdfRenderer').then((mod) => mod.PdfRenderer),
    {
        ssr: false,
        loading: () => (
            <div className="h-[600px] w-full bg-gray-50 animate-pulse rounded-lg flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
        ),
    }
);

interface PdfViewerWrapperProps {
    children: ReactElement; // The <ConventionPdf> document
    height?: string;
    className?: string;
}

export const PdfViewerWrapper = ({ children, height = '600px', className }: PdfViewerWrapperProps) => {
    return (
        <div className={`w-full ${className || ''}`} style={{ minHeight: height }}>
            <PdfRendererDynamic document={children} height={height} className={className} />
        </div>
    );
};
