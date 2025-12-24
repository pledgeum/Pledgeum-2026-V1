'use server';

import { signData } from '@/lib/signature';
import { Convention } from '@/store/convention';

export async function generateVerificationUrl(data: Convention, type: 'convention' | 'attestation') {
    // 1. Extract Minimal Critical Data (Minified keys for shorter URL)
    const payload = {
        t: type === 'convention' ? 'c' : 'a', // Type
        id: data.id,
        s: data.eleve_nom + ' ' + data.eleve_prenom, // Student
        e: data.ent_nom, // Enterprise
        d: { s: data.stage_date_debut, f: data.stage_date_fin }, // Dates
        // Status removed to keep hash stable across workflow
        // st: data.status,
        // For attestation, include hours
        ...(type === 'attestation' ? { h: data.attestation_total_jours } : {})
    };

    // 2. Sign
    const signature = signData(payload);

    // 3. Encode Payload
    const jsonString = JSON.stringify(payload);
    const base64Data = Buffer.from(jsonString).toString('base64url');

    // 4. Construct URL (Use process.env.NEXT_PUBLIC_APP_URL or fallback)
    // In server action, we might not have window.location. We need a base URL.
    // For now, we return the relative path or absolute if env var is set.
    // Assuming client handles the domain or we use a standard env var.
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const url = `${baseUrl}/verify?data=${base64Data}&sig=${signature}`;

    return {
        url,
        hashDisplay: signature.substring(0, 12).toUpperCase()
    };
}
