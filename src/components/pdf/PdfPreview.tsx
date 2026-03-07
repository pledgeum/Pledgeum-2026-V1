import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ConventionPdf } from './ConventionPdf';
import { Convention } from '@/store/convention';
import QRCode from 'qrcode';
import { generateVerificationUrl } from '@/app/actions/sign';
import { PdfViewerWrapper } from '@/components/ui/PdfViewerWrapper';

interface PdfPreviewProps {
    data: Partial<Convention>;
    onClose?: () => void;
}

// ConventionPdf is imported statically but this file is only loaded dynamically with ssr: false

const PdfPreview = ({ data, onClose }: PdfPreviewProps) => {
    const isModal = !!onClose;
    const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
    const [hashDisplay, setHashDisplay] = useState<string>('');

    useEffect(() => {
        const init = async () => {
            if (data.id && data.eleve_nom) {
                // Use Server Action to get signed URL
                const { url, hashDisplay } = await generateVerificationUrl(data as Convention, 'convention');
                // Generate QR Code from that URL
                QRCode.toDataURL(url).then(setQrCodeUrl).catch(console.error);
                setHashDisplay(hashDisplay);
            }
        };
        init();
    }, [data.id, data.eleve_nom]);

    // Data Normalization for PDF
    // The PDF component expects 'stage_date_debut' (historical) but API provides 'dateStart' (clean)
    // IMPORTANT: Top-level data.signatures MUST override data.metadata.signatures to prevent stale state issues
    const normalizedData = {
        ...(data.metadata || {}), // Flatten metadata first
        ...data,                  // Let top-level properties (like latest status/updatedAt) take precedence
        signatures: data.signatures || (data.metadata as any)?.signatures || {}, // Explicitly prioritize top-level fresh signatures
        stage_date_debut: data.dateStart || (data.metadata as any)?.stage_date_debut || (data as any).stage_date_debut,
        stage_date_fin: data.dateEnd || (data.metadata as any)?.stage_date_fin || (data as any).stage_date_fin,
    };

    const [isGenerating, setIsGenerating] = useState(false);

    const handleDownload = async () => {
        setIsGenerating(true);
        try {
            const { generateConventionBlob } = await import('./CredentialPdfGenerator');
            const blob = await generateConventionBlob(normalizedData as any, qrCodeUrl, hashDisplay);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `convention_${data.eleve_nom || 'eleve'}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Erreur lors de la génération du PDF');
        } finally {
            setIsGenerating(false);
        }
    };

    const Content = (
        <div className={`bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden ${isModal ? 'w-full max-w-5xl h-[90vh]' : 'w-full h-[600px] border border-gray-200'}`}>
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <h3 className="text-lg font-bold text-gray-900">Aperçu de la Convention</h3>
                <div className="flex items-center gap-2">
                    {data.status === 'VALIDATED_HEAD' && (
                        <button
                            onClick={handleDownload}
                            disabled={isGenerating}
                            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {isGenerating ? 'Génération...' : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    <span className="hidden sm:inline">Télécharger</span>
                                </>
                            )}
                        </button>
                    )}

                    {onClose && (
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                            <span className="sr-only">Fermer</span>
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
            <div className="flex-1 overflow-hidden relative bg-gray-100 flex items-center justify-center p-4">
                <PdfViewerWrapper height="100%" className="w-full h-full shadow-lg">
                    {/* The document prop for PdfViewerWrapper will be passed to PdfRenderer dynamically */}
                    <ConventionPdf data={normalizedData} qrCodeUrl={qrCodeUrl} hashCode={hashDisplay} />
                </PdfViewerWrapper>
            </div>
        </div>
    );

    if (isModal) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                {Content}
            </div>
        );
    }

    return Content;
};

export default React.memo(PdfPreview);
