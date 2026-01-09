import { NextResponse } from 'next/server';
import { checkRateLimit, validateOrigin, verifyUserSession } from '@/lib/server-security';
import { sendEmail } from '@/lib/email';

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

        const success = await sendEmail({ to, subject, text, attachments: attachments.length > 0 ? attachments : undefined });

        if (!success) {
            return NextResponse.json({ error: "Failed to send email via shared utility." }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('API Send Error:', error.message || error);
        return NextResponse.json(
            { error: 'Failed to send email: ' + (error.message || 'Unknown error') },
            { status: 500 }
        );
    }
}
