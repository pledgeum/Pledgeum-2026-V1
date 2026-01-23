
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { checkRateLimit, validateOrigin } from '@/lib/server-security';

export async function POST(request: Request) {
    try {
        // 1. Security Checks
        if (!validateOrigin(request)) {
            return NextResponse.json({ error: "Forbidden Origin" }, { status: 403 });
        }

        const isAllowed = await checkRateLimit(request, 'account-activate' as any);
        if (!isAllowed) {
            return NextResponse.json({ error: "Trop de tentatives. Veuillez patienter." }, { status: 429 });
        }

        const body = await request.json();
        const { tempId, tempCode, email, password } = body;

        // Validation
        if (!tempId || !tempCode || !email || !password) {
            return NextResponse.json({ error: "Données incomplètes" }, { status: 400 });
        }

        // Sanitize
        const cleanTempId = tempId.trim().toUpperCase();
        const cleanTempCode = tempCode.trim().toUpperCase(); // Assuming code is alphanumeric case-insensitive

        // 2. Verify Invitation (Admin SDK - Bypass Firestore Rules)
        // We look for the exact student/invitation
        const invitationsRef = adminDb.collection('invitations');
        const snapshot = await invitationsRef.where('tempId', '==', cleanTempId).get();

        if (snapshot.empty) {
            return NextResponse.json({ error: "Identifiant provisoire inconnu" }, { status: 404 });
        }

        // Check Code (Iterate if multiple, though tempId *should* be unique)
        let invitationDoc: any = null;
        let invitationData: any = null;

        snapshot.forEach(doc => {
            const data = doc.data();
            // Loose check? Or strict case?
            // User input for code might be mixed case. Let's compare uppercase.
            if ((data.tempCode || "").toString().toUpperCase() === cleanTempCode) {
                invitationDoc = doc;
                invitationData = data;
            }
        });

        if (!invitationDoc || !invitationData) {
            return NextResponse.json({ error: "Code d'accès incorrect" }, { status: 401 });
        }

        // 3. Check if User Exists in Auth
        let uid = null;
        let isNewUser = false;

        try {
            const userRecord = await adminAuth.getUserByEmail(email);
            // Existing user -> CONFLICT (User must login)
            return NextResponse.json({
                code: 'EMAIL_TAKEN',
                message: 'Cet email est déjà utilisé.'
            }, { status: 409 });

        } catch (e: any) {
            if (e.code === 'auth/user-not-found') {
                // New User -> Create
                try {
                    const newUser = await adminAuth.createUser({
                        email: email,
                        password: password,
                        displayName: invitationData.name || `${invitationData.firstName} ${invitationData.lastName}`
                    });
                    uid = newUser.uid;
                    isNewUser = true;
                    console.log(`[ACTIVATE] User ${email} created (${uid}).`);
                } catch (createErr: any) {
                    if (createErr.code === 'auth/email-already-exists' || createErr.code === 'auth/uid-already-exists') {
                        return NextResponse.json({
                            code: 'EMAIL_TAKEN',
                            message: 'Cet email est déjà utilisé.'
                        }, { status: 409 });
                    }
                    return NextResponse.json({ error: "Impossible de créer le compte: " + createErr.message }, { status: 500 });
                }
            } else {
                return NextResponse.json({ error: "Erreur vérification email: " + e.message }, { status: 500 });
            }
        }

        // 4. Update/Create User Document (Admin SDK - Bypass Rules)
        // This resolves the "Missing Permissions" issue because we are Server-Side.

        // Prepare Profile Data Structure
        const schoolId = invitationData.schoolId || '9999999X';
        const classId = invitationData.classId || '';

        const profileData = {
            firstName: invitationData.firstName,
            lastName: invitationData.lastName,
            email: email,
            role: 'student', // Enforced
            birthDate: invitationData.birthDate || null,
            // Context Switch
            schoolId: schoolId,
            uai: schoolId,
            class: invitationData.className || '',

            // Address placeholders if missing (optional)
            // phone: "",
            // address: {},
        };

        const userDocRef = adminDb.collection('users').doc(uid);

        // If existing user, we MERGE carefully (preserve existing non-school data?)
        // The requirement is to switch context but keeping identity.
        // Invitation data is authoritative for Name context in School.

        await userDocRef.set({
            email: email,
            role: 'student', // Force role? Or add to array? For now: Force.
            uai: schoolId,
            schoolId: schoolId,
            name: `${profileData.firstName} ${profileData.lastName}`,
            profileData: profileData,

            // Metadata
            lastConnectionAt: new Date().toISOString(),
            activatedAt: new Date().toISOString(),
            // If new, add createAt
            ...(isNewUser ? { createdAt: new Date().toISOString(), hasAcceptedTos: false } : {})
        }, { merge: true });


        // 5. Update Student Record in School (Link real email)
        // We know the student ID is the Invitation ID (from our store logic) OR we find it via Invitation.
        // Store logic: `doc(db, 'invitations', studentId)`
        const studentId = invitationDoc.id;

        // Update Student in Subcollection
        // Path: establishments/{schoolId}/years/{year}/students/{studentId}
        // Need to find the Year. Invitation usually doesn't have Year explicitly unless we stored it.
        // We know current year is "2025-2026" hardcoded in store.
        // Ideally invitation should have it.
        // Fallback: Query all years? Or assume current.
        const year = "2025-2026";

        const studentRef = adminDb.doc(`establishments/${schoolId}/years/${year}/students/${studentId}`);
        await studentRef.set({
            email: email,
            userId: uid, // Link to User Doc
            status: 'active',
            activatedAt: new Date().toISOString()
        }, { merge: true });


        // 6. Cleanup (Optional: Delete invitation to prevent reuse?)
        // Or mark as used.
        await invitationDoc.ref.update({
            usedAt: new Date().toISOString(),
            usedByUid: uid
        });
        // await invitationDoc.ref.delete(); // Un-comment if we want single-use strict


        // 7. Generate Custom Token for Immediate Login?
        // Frontend will likely sign-in with password provided.
        // But we can return a token to facilitate.
        // For now, let frontend handle login with the password they just set/verified.

        return NextResponse.json({
            success: true,
            uid: uid
        });

    } catch (error: any) {
        console.error('[ACTIVATE] Error:', error);
        return NextResponse.json({ error: "Erreur technique lors de l'activation." }, { status: 500 });
    }
}
