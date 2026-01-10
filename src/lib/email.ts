import nodemailer from 'nodemailer';
import { adminDb } from '@/lib/firebase-admin';

interface EmailOptions {
    to: string;
    subject: string;
    text: string;
    attachments?: any[];
}

export async function sendEmail({ to, subject, text, attachments }: EmailOptions): Promise<boolean> {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.EMAIL_HOST || !process.env.EMAIL_PORT) {
        console.error('Email Error: Missing configuration.');
        return false;
    }

    const port = Number(process.env.EMAIL_PORT);
    const isSecure = port === 465;

    if (to.includes('demo@pledgeum.fr')) {
        console.log('[DEMO] Intercepting email to demo@pledgeum.fr');
        try {
            // Import dynamically to avoid build-time issues if possible, or use the imported adminDb
            // We need to import adminDb at the top.
            await adminDb.collection('demo_inbox').add({
                to,
                subject,
                text: text || '',
                html: text || '', // Usually content is text, but let's store it
                date: new Date().toISOString(),
                read: false,
                from: process.env.EMAIL_FROM || 'Pledgeum <noreply@pledgeum.fr>'
            });
            return true;
        } catch (e) {
            console.error('[DEMO] Failed to save email to inbox', e);
            return true;
        }
    }

    try {
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: port,
            secure: isSecure,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: to,
            bcc: 'pledgeum@gmail.com', // Monitoring
            subject: subject,
            text: text,
            attachments: attachments,
        });

        console.log('Email sent successfully:', info.messageId);
        return true;
    } catch (error) {
        console.error('Nodemailer Error:', error);
        return false;
    }
}
