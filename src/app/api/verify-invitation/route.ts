import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { checkRateLimit, validateOrigin } from '@/lib/server-security';

export async function POST(request: Request) {
    try {
        // 1. Security Checks
        if (!validateOrigin(request)) {
            return NextResponse.json({ error: "Forbidden Origin" }, { status: 403 });
        }

        const isAllowed = await checkRateLimit(request, 'otp-verify'); // Use similar rate limit
        if (!isAllowed) {
            return NextResponse.json({ error: "Trop de tentatives. Veuillez patienter." }, { status: 429 });
        }

        const body = await request.json();
        const { tempId, tempCode } = body;

        if (!tempId || !tempCode) {
            return NextResponse.json({ error: "Identifiants manquants" }, { status: 400 });
        }

        // 2. Query Firestore for Invitation
        // We search in 'invitations' collection where tempId matches
        const snapshot = await adminDb.collection('invitations')
            .where('tempId', '==', tempId)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return NextResponse.json({ error: "Identifiant non reconnu" }, { status: 404 });
        }

        const doc = snapshot.docs[0];
        const data = doc.data();

        // 3. Verify Code
        if (data.tempCode !== tempCode) {
            return NextResponse.json({ error: "Code d'accès incorrect" }, { status: 401 });
        }

        // 4. Return Data for Account Creation
        return NextResponse.json({
            success: true,
            user: {
                email: data.email,
                name: data.name,
                role: data.role,
                schoolId: data.schoolId || null,
                birthDate: data.birthDate || null
            }
        });

    } catch (error: any) {
        console.error('Invitation Verify Error:', error);
        return NextResponse.json(
            { error: 'Erreur technique lors de la vérification' },
            { status: 500 }
        );
    }
}
