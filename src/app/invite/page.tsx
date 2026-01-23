import { verifyMagicLink } from '@/services/magicLinkService';
import { adminDb } from '@/lib/firebase-admin';
import { InviteForm } from '@/components/onboarding/InviteForm';
import { redirect } from 'next/navigation';

export default async function InvitePage({ searchParams }: { searchParams: { token?: string } }) {
    const token = searchParams.token;

    if (!token) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center p-8 bg-white rounded-2xl shadow-xl">
                    <h1 className="text-xl font-bold text-red-600 mb-2">Lien manquant</h1>
                    <p className="text-gray-500">L'URL d'invitation est invalide.</p>
                </div>
            </div>
        );
    }

    const payload = await verifyMagicLink(token);

    if (!payload) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center p-8 bg-white rounded-2xl shadow-xl">
                    <h1 className="text-xl font-bold text-red-600 mb-2">Lien expiré ou invalide</h1>
                    <p className="text-gray-500">Ce lien d'invitation n'est plus valide.</p>
                </div>
            </div>
        );
    }

    // Fetch Convention Data for Context (Company Name, etc.)
    const convSnap = await adminDb.collection('conventions').doc(payload.conventionId).get();
    if (!convSnap.exists) {
        return <div>Erreur système : Convention introuvable.</div>; // Should rare
    }
    const convention = convSnap.data() as any;

    // TODO: Ideally check if user already exists (Auth).
    // If they exist, redirect them to login? Or let them use the "Signin" page?
    // For now, the InviteForm handles collision error ("Account exists").
    // But better UX: Check here and redirect if exists?
    // We can't check AUTH easily without admin SDK overhead per request, keeping it simple: Form handles it.

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <InviteForm
                token={token}
                email={payload.email}
                name={`${convention.tuteur_prenom || ''} ${convention.tuteur_nom}`}
                companyName={convention.ent_nom}
                companySiret={convention.ent_siret || 'N/A'}
            />
        </div>
    );
}
