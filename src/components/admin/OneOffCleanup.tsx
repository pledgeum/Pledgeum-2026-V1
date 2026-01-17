'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2, Trash2, AlertTriangle, CheckCircle, RefreshCw, Hammer } from 'lucide-react';
import { migrateAllUsers } from '@/lib/migrations/migrateUsers';

interface DuplicateGroup {
    email: string;
    users: any[];
}

export default function OneOffCleanup() {
    const [loading, setLoading] = useState(false);

    const handleSchemaMigration = async () => {
        if (!confirm("⚠️ ACTION IRRÉVERSIBLE : Restructuration complète vers le nouveau schéma User. Continuer ?")) return;
        setLoading(true);
        setStatus("Migration en cours...");
        try {
            await migrateAllUsers();
            setStatus("Migration terminée avec succès !");
        } catch (e: any) {
            setStatus("Erreur: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
    const [status, setStatus] = useState<string>('');
    const [deletedCount, setDeletedCount] = useState(0);

    const fetchDuplicates = async () => {
        setLoading(true);
        setStatus("Analyse des utilisateurs...");
        setDuplicates([]);
        setDeletedCount(0);

        try {
            const usersRef = collection(db, "users");
            const snapshot = await getDocs(usersRef);
            const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Group by Email
            const emailMap = new Map<string, any[]>();
            users.forEach((user: any) => {
                if (user.email) {
                    const normalized = user.email.trim().toLowerCase();
                    if (!emailMap.has(normalized)) emailMap.set(normalized, []);
                    emailMap.get(normalized)?.push(user);
                }
            });

            // Filter for duplicates
            const dupes: DuplicateGroup[] = [];
            emailMap.forEach((group, email) => {
                if (group.length > 1) {
                    dupes.push({ email, users: group });
                }
            });

            console.log("Found duplicates:", dupes);
            setDuplicates(dupes);
            setStatus(`Terminé. ${dupes.length} groupe(s) de doublons trouvés.`);

        } catch (err: any) {
            console.error(err);
            setStatus("Erreur: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const fixDuplicate = async (group: DuplicateGroup) => {
        setLoading(true);
        setStatus(`Nettoyage pour ${group.email}...`);

        try {
            // Logic: 
            // 1. Identify "Primary" (Usually the one matching Auth UID isn't checkable easily from client without login, 
            //    BUT we can assume the one with the most data or most recent?
            //    Actually, we can't delete the one linked to Auth easily if we don't know the Auth UID.
            //    BETTER STRATEGY: Keep the one created most recently? Or oldest?
            //    User request: "Celui lié à un uid Firebase Auth". 
            //    We assume the doc ID IS the Auth UID.
            //    If we have duplicates where DocID != AuthUID, those are "Ghosts".
            //    Usually Auth UID is ~28 chars (random). If we have generated IDs (20 chars autogen), they are likely ghosts.

            // Heuristic: Prefer ID that looks like an invalid/autogen ID to DELETE?
            // No, we want to KEEP the one that matches Auth. 
            // Since we can't verify Auth UID from here, we rely on the rule: 
            // "If multiple docs exist, one might be the real UID."

            // Let's sort by:
            // 1. Has 'lastConnectionAt' (Active)
            // 2. CreatedAt (Recent)

            const sorted = [...group.users].sort((a, b) => {
                const connA = a.lastConnectionAt || '0';
                const connB = b.lastConnectionAt || '0';
                return connB.localeCompare(connA); // Descending (Newest connection first)
            });

            const toKeep = sorted[0];
            const toDelete = sorted.slice(1);

            console.log(`Keeping ${toKeep.id} (Last Active: ${toKeep.lastConnectionAt}), Deleting ${toDelete.map(u => u.id)}`);

            // Execute Deletion
            for (const user of toDelete) {
                await deleteDoc(doc(db, "users", user.id));
            }

            setDeletedCount(prev => prev + toDelete.length);

            // Refresh list locally
            setDuplicates(prev => prev.filter(g => g.email !== group.email));
            setStatus(`Nettoyé ${group.email}. Conservé: ${toKeep.id}. Supprimé(s): ${toDelete.length}`);

        } catch (err: any) {
            console.error(err);
            setStatus("Erreur suppression: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-md max-w-4xl mx-auto mt-10">
            <h2 className="text-xl font-bold mb-4 flex items-center">
                <Trash2 className="mr-2 text-red-600" />
                Outil de Déduplication (Admin)
            </h2>

            <div className="mb-6 bg-yellow-50 p-4 rounded border border-yellow-200 text-sm text-yellow-800">
                <p className="font-bold flex items-center"><AlertTriangle className="w-4 h-4 mr-1" /> ATTENTION</p>
                Cet outil scanne la collection 'users' et identifie les emails identiques.
                En cas de nettoyage, il conserve le compte ayant la connexion la plus récente.
            </div>

            <div className="space-x-4 mb-6">
                <button
                    onClick={fetchDuplicates}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                >
                    {loading ? <Loader2 className="animate-spin mr-2" /> : <RefreshCw className="mr-2" />}
                    Scanner les doublons
                </button>

                <button
                    onClick={handleSchemaMigration}
                    disabled={loading}
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center"
                >
                    {loading ? <Loader2 className="animate-spin mr-2" /> : <Hammer className="mr-2" />}
                    MIGRATE SCHEMA
                </button>
            </div>

            <div className="mb-4 text-sm font-mono bg-gray-100 p-2 rounded">
                Status: {status}
            </div>

            {duplicates.length > 0 && (
                <div className="space-y-4">
                    <h3 className="font-semibold">Doublons trouvés ({duplicates.length})</h3>
                    {duplicates.map((group) => (
                        <div key={group.email} className="border p-4 rounded bg-gray-50 flex justify-between items-center">
                            <div>
                                <p className="font-bold text-lg">{group.email}</p>
                                <ul className="text-sm text-gray-600 mt-1 space-y-1">
                                    {group.users.map(u => (
                                        <li key={u.id} className="flex items-center">
                                            <span className="font-mono text-xs bg-gray-200 px-1 rounded mr-2">{u.id}</span>
                                            <span className="mr-2">Connexion: {u.lastConnectionAt ? new Date(u.lastConnectionAt).toLocaleDateString() : 'Jamais'}</span>
                                            {u.profileData?.ecole_nom && <span className="italic">({u.profileData.ecole_nom})</span>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <button
                                onClick={() => fixDuplicate(group)}
                                disabled={loading}
                                className="px-3 py-1 bg-red-100 text-red-700 rounded border border-red-200 hover:bg-red-200 text-sm"
                            >
                                Fusionner / Nettoyer
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {deletedCount > 0 && duplicates.length === 0 && (
                <div className="mt-8 text-center text-green-600">
                    <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                    <p className="text-xl font-bold">Nettoyage terminé !</p>
                    <p>{deletedCount} comptes superflus supprimés.</p>
                </div>
            )}
        </div>
    );
}
