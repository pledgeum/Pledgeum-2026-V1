import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { checkRateLimit, validateOrigin, verifyUserSession } from '@/lib/server-security';

export async function POST(request: Request) {
    try {
        // 1. Security Checks
        if (!validateOrigin(request)) {
            return NextResponse.json({ error: "Forbidden Origin" }, { status: 403 });
        }

        const user = await verifyUserSession(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const isAllowed = await checkRateLimit(request, 'send-email');
        if (!isAllowed) {
            return NextResponse.json({ error: "Trop de demandes. Veuillez patienter." }, { status: 429 });
        }

        const contentType = request.headers.get('content-type') || '';

        let to, subject, text;
        let attachments = [];

        if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData();
            to = formData.get('to') as string;
            subject = formData.get('subject') as string;
            text = formData.get('text') as string;

            const pdfFile = formData.get('pdf') as File;
            if (pdfFile) {
                const buffer = Buffer.from(await pdfFile.arrayBuffer());
                attachments.push({
                    filename: 'Convention.pdf',
                    content: buffer,
                    contentType: 'application/pdf',
                });
            }
        } else {
            const body = await request.json();
            to = body.to;
            subject = body.subject;
            text = body.text;
        }

        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.EMAIL_HOST || !process.env.EMAIL_PORT) {
            const missing = [];
            if (!process.env.EMAIL_USER) missing.push('EMAIL_USER');
            if (!process.env.EMAIL_PASS) missing.push('EMAIL_PASS');
            if (!process.env.EMAIL_HOST) missing.push('EMAIL_HOST');
            if (!process.env.EMAIL_PORT) missing.push('EMAIL_PORT');

            console.error('API Error: Missing Email Config:', missing.join(', '));
            return NextResponse.json(
                { error: `Configuration email manquante: ${missing.join(', ')}` },
                { status: 500 }
            );
        }

        const port = Number(process.env.EMAIL_PORT);
        if (isNaN(port)) {
            console.error('API Error: EMAIL_PORT is not a number:', process.env.EMAIL_PORT);
            return NextResponse.json({ error: 'Configuration email invalide (PORT)' }, { status: 500 });
        }

        const isSecure = port === 465; // True for 465, false for other ports (587 usually uses STARTTLS)

        console.log('SMTP Config:', {
            host: process.env.EMAIL_HOST,
            port: port,
            secure: isSecure,
            user: process.env.EMAIL_USER?.substring(0, 3) + '***', // Masked for security
        });

        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: port,
            secure: isSecure,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
            // logger: true, // Enable for very verbose logs if needed
            // debug: true,
        });

        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: to,
            bcc: 'pledgeum@gmail.com', // Copy for testing
            subject: subject,
            text: text,
            attachments: attachments.length > 0 ? attachments : undefined,
        });

        console.log('Email sent successfully:', info.messageId);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Nodemailer Send Error:', error.message || error);
        return NextResponse.json(
            { error: 'Failed to send email: ' + (error.message || 'Unknown error') },
            { status: 500 }
        );
    }
}
