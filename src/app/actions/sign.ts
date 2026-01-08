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
        // For convention, include signatories
        ...(type === 'convention' ? {
            sigs: [
                { n: data.eleve_nom + ' ' + data.eleve_prenom, r: 'Élève', d: data.signatures?.studentAt },
                { n: data.rep_legal_nom ? data.rep_legal_nom + ' ' + data.rep_legal_prenom : 'Représentant Légal', r: 'Représentant Légal', d: data.signatures?.parentAt },
                { n: data.tuteur_nom, r: 'Tuteur', d: data.signatures?.tutorAt },
                { n: data.prof_nom, r: 'Enseignant Référent', d: data.signatures?.teacherAt },
                { n: data.ent_rep_nom, r: 'Représentant Entreprise', d: data.signatures?.companyAt },
                { n: data.ecole_chef_nom, r: "Chef d'Établissement", d: data.signatures?.headAt },
            ].filter(s => s.d) // Only keep signed ones
        } : {}),
        // For attestation, include hours
        ...(type === 'attestation' ? {
            h: data.attestation_total_jours,
            sn: data.attestation_signer_name,
            sf: data.attestation_signer_function,
            sd: data.attestationDate
        } : {})
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
