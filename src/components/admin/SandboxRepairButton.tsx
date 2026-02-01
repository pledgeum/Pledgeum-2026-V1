'use client';

import { useUserStore } from '@/store/user';
import { useAdminStore } from '@/store/admin';
import { forceSandboxUserRole } from '@/app/actions/schoolAdmin';

export function SandboxRepairButton() {
    const { email } = useUserStore();

    // STRICT CHECK: Only for this email
    if (email !== 'fabrice.dumasdelage@gmail.com') return null;

    const forceSandboxAccess = async () => {
        if (!confirm("⚠️ Action 'Nucléaire' : Réparer le profil et forcer les droits ?")) return;

        console.log("NUCLEAR REPAIR STARTED for Fabrice Dumasdelage");

        // 1. FORCE CLIENT STORE UPDATE
        // We use setState to bypass any logic and write directly to the store state
        useUserStore.setState((state) => {
            return {
                ...state,
                name: "Fabrice Dumasdelage",
                role: 'school_head', // FORCE ROLE
                email: 'fabrice.dumasdelage@gmail.com', // FORCE EMAIL
                schoolId: '9999999Z', // FORCE SCHOOL
                uai: '9999999Z', // FORCE UAI
                profileData: {
                    firstName: 'Fabrice',
                    lastName: 'Dumasdelage',
                    email: 'fabrice.dumasdelage@gmail.com',
                    role: 'Proviseur',
                    function: 'Proviseur',
                    ecole_nom: 'Lycée de Démonstration (Sandbox)',
                    ecole_ville: 'Elbeuf',
                    phone: '0600000000'
                },
                isLoadingProfile: false
            };
        });

        // 2. FORCE ADMIN STORE AUTHORIZATION
        useAdminStore.getState().authorizeSchool({
            id: "9999999Z",
            name: "Lycée de Démonstration (Sandbox)",
            city: "Elbeuf",
            status: 'ADHERENT',
            email: "fabrice.dumasdelage@gmail.com"
        });

        // 3. FORCE SERVER SIDE
        try {
            await forceSandboxUserRole('fabrice.dumasdelage@gmail.com');
        } catch (e) {
            console.error("Server force failed", e);
            alert("Erreur serveur (mais le local est forcé) : " + e);
        }

        // 4. PERSISTENCE CHECK (LocalStorage)
        // Zustand persist middleware should handle this automatically if 'user-storage' is set. 
        // We trigger a manual save if simpler, but setState usually triggers persist.

        alert("✅ PROFIL RÉPARÉ.\n\nVous êtes maintenant 'Proviseur' de 'Lycée de Démonstration (Sandbox)'.\nLa page va se recharger.");
        window.location.reload();
    };

    return (
        <button
            onClick={forceSandboxAccess}
            style={{
                backgroundColor: '#f59e0b',
                color: 'white',
                padding: '12px',
                width: '100%',
                fontWeight: 'bold',
                zIndex: 9999,
                position: 'fixed',
                top: 0,
                left: 0,
                textAlign: 'center',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
        >
            🛠️ RÉPARER MON PROFIL & LANCER LE LYCÉE DE DÉMONSTRATION (SANDBOX)
        </button>
    );
}
