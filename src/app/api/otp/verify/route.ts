import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { headers } from 'next/headers';

export async function POST(request: Request) {
    try {
        const { email, code } = await request.json();

        if (!email || !code) {
            return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
        }

        const otpsRef = collection(db, "otps");
        const q = query(
            otpsRef,
            where("email", "==", email),
            where("code", "==", code)
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return NextResponse.json({ success: false, error: "Code invalide" }, { status: 400 });
        }

        // Check expiration and clean up
        let valid = false;
        const now = new Date();

        // There might be multiple OTPs if spammed, check all matches
        const deletePromises: Promise<void>[] = [];

        let conventionId = '';

        querySnapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            const expiresAt = new Date(data.expiresAt);
            if (expiresAt > now) {
                valid = true;
                conventionId = data.conventionId;
            }
            // Delete used/expired OTPs to prevent reuse
            deletePromises.push(deleteDoc(doc(db, "otps", docSnapshot.id)));
        });

        await Promise.all(deletePromises);

        if (valid && conventionId) {
            // Audit Log
            try {
                const headersList = await headers();
                const ip = headersList.get('x-forwarded-for') || 'unknown';
                const auditLog = {
                    date: new Date().toISOString(),
                    action: 'OTP_VALIDATED',
                    actorEmail: email,
                    ip: ip,
                    details: 'Code OTP validé avec succès'
                };

                await updateDoc(doc(db, "conventions", conventionId), {
                    auditLogs: arrayUnion(auditLog)
                });

                return NextResponse.json({ success: true, auditLog });
            } catch (e) {
                console.error("Audit log error:", e);
                // Non-blocking
            }

            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ success: false, error: "Code expiré" }, { status: 400 });
        }

    } catch (error: any) {
        console.error("Error verifying OTP:", error);
        return NextResponse.json({ error: "Erreur lors de la vérification" }, { status: 500 });
    }
}
