import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
    try {
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
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        // TEST MODE: Redirect all emails to pledgeum@gmail.com
        const testEmail = 'pledgeum@gmail.com';
        const updatedText = `[TEST MODE - Intended for: ${to}]\n\n${text}`;

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: testEmail,
            subject: `[TEST] ${subject}`,
            text: updatedText,
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
