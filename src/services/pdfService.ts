import QRCode from 'qrcode';
import { generateVerificationUrl } from '@/app/actions/sign';
import { MissionOrder } from '@/store/missionOrder';
import { Convention } from '@/store/convention';
import React from 'react';

export const pdfService = {
    async downloadMissionOrder(odm: MissionOrder, convention: Convention) {
        try {
            // 1. Generate QR Code
            const { url } = await generateVerificationUrl(convention, 'mission_order');
            const qrCode = await QRCode.toDataURL(url);

            // 2. Generate Blob
            const { generateMissionOrderBlob } = await import('@/components/pdf/CredentialPdfGenerator');
            const blob = await generateMissionOrderBlob(odm, convention, qrCode);

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
