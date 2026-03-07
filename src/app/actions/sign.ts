'use server';

import { signData } from '@/lib/signature';
import { Convention } from '@/store/convention';

export async function generateVerificationUrl(data: Convention, type: 'convention' | 'attestation' | 'mission_order') {
    // 1. Extract Minimal Critical Data (with fallback for different naming conventions)
    const studentName = (data.eleve_nom || (data as any).lastName || '').trim() + ' ' + (data.eleve_prenom || (data as any).firstName || '').trim();
    const enterpriseName = (data.ent_nom || (data as any).companyName || '').trim();
    const dateStart = data.stage_date_debut || (data as any).date_start || (data as any).dateStart;
    const dateEnd = data.stage_date_fin || (data as any).date_end || (data as any).dateEnd;

    const payload: any = {
        t: type === 'convention' ? 'c' : 'a',
        id: data.id,
        s: studentName,
        e: enterpriseName,
        d: { s: dateStart, f: dateEnd },
        // ... signatories logic follows ...
    };

    // Validation: Check if critical data is actually present
    const isDataComplete = !!(payload.id && studentName.trim().length > 1 && enterpriseName && dateStart);

    // For convention, include signatories
    if (type === 'convention') {
        payload.sigs = [
            { n: studentName, r: 'Élève', d: data.signatures?.student?.signedAt || data.signatures?.studentAt },
            { n: data.rep_legal_nom ? data.rep_legal_nom + ' ' + (data.rep_legal_prenom || '') : 'Représentant Légal', r: 'Représentant Légal', d: data.signatures?.parent?.signedAt || data.signatures?.parentAt },
            { n: data.tuteur_nom || (data as any).tuteur_nom, r: 'Tuteur', d: data.signatures?.tutor?.signedAt || data.signatures?.tutorAt },
            { n: data.prof_nom || (data as any).prof_nom, r: 'Enseignant Référent', d: data.signatures?.teacher?.signedAt || data.signatures?.teacherAt },
            { n: data.ent_rep_nom || (data as any).ent_rep_nom, r: 'Représentant Entreprise', d: data.signatures?.company?.signedAt || data.signatures?.companyAt },
            { n: data.ecole_chef_nom || (data as any).ecole_chef_nom, r: "Chef d'Établissement", d: data.signatures?.head?.signedAt || data.signatures?.headAt },
        ].filter(s => s.d);
    }

    // For attestation, include hours
    if (type === 'attestation') {
        payload.h = data.attestation_total_jours;
        payload.sn = data.attestation_signer_name;
        payload.sf = data.attestation_signer_function;
        payload.sd = data.attestationDate;
    }

    // For Mission Order
    if (type === 'mission_order') {
        payload.mo = true;
        payload.tn = data.prof_nom || (data as any).prof_nom;
        payload.sa = data.ecole_adresse;
        payload.ca = data.ent_adresse;
    }

    // 2. Sign
    console.log("[SignAction] Payload to sign:", JSON.stringify(payload, null, 2));
    const signature = signData(payload);
    const hashDisplay = signature.substring(0, 12).toUpperCase();
    console.log("[SignAction] Generated hashDisplay:", hashDisplay);

    // 3. Encode Payload
    const jsonString = JSON.stringify(payload);
    const base64Data = Buffer.from(jsonString).toString('base64url');

    // 4. Construct URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const url = `${baseUrl}/verify?data=${base64Data}&sig=${signature}`;

    // 5. Persist to DB ONLY IF DATA IS COMPLETE and we have an ID
    if (isDataComplete && type === 'convention' && payload.id) {
        try {
            const { default: pool } = await import('@/lib/pg');
            if (pool) {
                await pool.query('UPDATE conventions SET pdf_hash = $1 WHERE id = $2', [hashDisplay, payload.id]);
                console.log(`[SignAction] Persisted valid pdf_hash ${hashDisplay} for ${payload.id}`);
            }
        } catch (e) {
            console.error("[SignAction] Failed to persist pdf_hash:", e);
        }
    } else if (!isDataComplete) {
        console.warn("[SignAction] Skipping DB persistence: Data is incomplete", { id: payload.id, studentName, enterpriseName, dateStart });
    }

    return {
        url,
        hashDisplay
    };
}
