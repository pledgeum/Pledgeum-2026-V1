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

        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.error('API Error: EMAIL_USER or EMAIL_PASS variables are missing in .env.local');
            return NextResponse.json(
                { error: 'Email configuration missing' },
                { status: 500 }
            );
        }

        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: Number(process.env.EMAIL_PORT),
            secure: true, // Use SSL
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        await transporter.sendMail({
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: to,
            subject: subject,
            text: text,
            attachments: attachments.length > 0 ? attachments : undefined,
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Nodemailer Send Error:', error.message || error);
        return NextResponse.json(
            { error: 'Failed to send email: ' + (error.message || 'Unknown error') },
            { status: 500 }
        );
    }
}
