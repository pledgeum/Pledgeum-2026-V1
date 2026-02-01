import { pdf } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { generateVerificationUrl } from '@/app/actions/sign';
import { MissionOrder } from '@/store/missionOrder';
import { Convention } from '@/store/convention';
import { MissionOrderPdf } from '@/components/pdf/MissionOrderPdf';
import React from 'react';

export const pdfService = {
    async downloadMissionOrder(odm: MissionOrder, convention: Convention) {
        try {
            // 1. Generate QR Code
            const { url } = await generateVerificationUrl(convention, 'mission_order');
            const qrCode = await QRCode.toDataURL(url);

            // 2. Generate Blob
            // Note: We use React.createElement or JSX if supported. Since this is a .ts file, we might need .tsx extension or createElement.
            // Changing file extension to .tsx or using createElement.
            // Let's assume .tsx for the service or use createElement to avoid JSX in .ts if strict.
            // But typically services in Next.js/React projects can be .tsx if they return renderable nodes or use them.
            // Let's try to stick to standard TSX syntax and save as .tsx if needed, or .ts with React import.
            const blob = await pdf(React.createElement(MissionOrderPdf, {
                missionOrder: odm,
                convention: convention,
                qrCodeUrl: qrCode
            }) as any).toBlob();

            // 3. Trigger Download
            const pdfUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = pdfUrl;
            link.download = `ODM_${convention.eleve_nom}_${convention.eleve_prenom}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            return true;
        } catch (error) {
            console.error("PDF generation failed", error);
            throw error;
        }
    }
};
