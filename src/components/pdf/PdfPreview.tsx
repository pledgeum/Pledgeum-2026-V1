import React from 'react';
import { ConventionPdf } from './ConventionPdf';
import { Convention } from '@/store/convention';
import QRCode from 'qrcode';
import { useState, useEffect } from 'react';
import { generateVerificationUrl } from '@/app/actions/sign';
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';

interface PdfPreviewProps {
    data: Partial<Convention>;
    onClose?: () => void;
}

export default function PdfPreview({ data, onClose }: PdfPreviewProps) {
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

    const Content = (
        <div className={`bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden ${isModal ? 'w-full max-w-5xl h-[90vh]' : 'w-full h-[600px] border border-gray-200'}`}>
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <h3 className="text-lg font-bold text-gray-900">Aperçu de la Convention</h3>
                <div className="flex items-center gap-2">
                    {data.status === 'VALIDATED_HEAD' && (
                        <PDFDownloadLink
                            document={<ConventionPdf data={data} qrCodeUrl={qrCodeUrl} hashCode={hashDisplay} />}
                            fileName={`convention_${data.eleve_nom || 'eleve'}.pdf`}
                            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                            {/* @ts-ignore */}
                            {({ blob, url, loading, error }) => (
                                loading ? 'Chargement...' : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        <span className="hidden sm:inline">Télécharger</span>
                                    </>
                                )
                            )}
                        </PDFDownloadLink>
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
            <div className="flex-1 bg-gray-100 overflow-hidden relative">
                <PDFViewer width="100%" height="100%" style={{ width: '100%', height: '100%' }} className="w-full h-full">
                    <ConventionPdf data={data} qrCodeUrl={qrCodeUrl} hashCode={hashDisplay} />
                </PDFViewer>
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
}
