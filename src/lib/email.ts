import nodemailer from 'nodemailer';

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
