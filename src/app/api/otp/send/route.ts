import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { sendNotification } from '@/lib/notification';
import { headers } from 'next/headers';

export async function POST(request: Request) {
    try {
        const { email, conventionId } = await request.json();

        if (!email || !conventionId) {
            return NextResponse.json({ error: "Email et ID Convention requis" }, { status: 400 });
        }

        // Generate 4-digit code
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

        // Store in Firestore
        await addDoc(collection(db, "otps"), {
            email,
            conventionId,
            code,
            expiresAt,
            createdAt: new Date().toISOString()
        });

        // Send Email
        await sendNotification(
            email,
            'Code de signature OTP - Convention PFMP',
            `Bonjour,\n\nVoici votre code de sécurité pour signer la convention : ${code}\n\nCe code est valable 10 minutes.\n\nCordialement.`
        );

        // Audit Log
        try {
            const headersList = await headers();
            const ip = headersList.get('x-forwarded-for') || 'unknown';

            await updateDoc(doc(db, "conventions", conventionId), {
                auditLogs: arrayUnion({
                    date: new Date().toISOString(),
                    action: 'OTP_SENT',
                    actorEmail: email,
                    ip: ip,
                    details: 'Code envoyé par email'
                })
            });
        } catch (e) {
            console.error("Audit log error:", e);
            // Non-blocking error
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error sending OTP:", error);
        return NextResponse.json({ error: "Erreur lors de l'envoi du code" }, { status: 500 });
    }
}
