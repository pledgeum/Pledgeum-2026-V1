'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Mail, X, Trash2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { useDemoStore } from '@/store/demo';

interface MockEmail {
    id: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
    date: string;
    read: boolean;
    from?: string;
}

export function MockMailbox() {
    const [isOpen, setIsOpen] = useState(false);
    const [emails, setEmails] = useState<MockEmail[]>([]);
    const [selectedEmail, setSelectedEmail] = useState<MockEmail | null>(null);
    const isDemoMode = useDemoStore((state) => state.isDemoMode);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!isDemoMode) return;

        const q = query(collection(db, 'demo_inbox'), orderBy('date', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MockEmail));
            setEmails(msgs);
            setUnreadCount(msgs.filter(m => !m.read).length);
        });

        return () => unsubscribe();
    }, [isDemoMode]);

    if (!isDemoMode) return null;

    const handleOpenEmail = async (email: MockEmail) => {
        setSelectedEmail(email);
        if (!email.read) {
            // Mark as read
            try {
                const emailRef = doc(db, 'demo_inbox', email.id);
                await updateDoc(emailRef, { read: true });
            } catch (err) {
                console.error("Error marking email as read", err);
            }
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        try {
            await deleteDoc(doc(db, 'demo_inbox', id));
            if (selectedEmail?.id === id) setSelectedEmail(null);
        } catch (err) {
            console.error("Error deleting email", err);
        }
    };

    return (
        <>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="relative bg-white shadow-md text-gray-900 p-2 rounded-full transition-colors mx-2 hover:bg-gray-100"
                title="Ouvrir la boîte mail fictive"
            >
                <Mail className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* Mailbox Window */}
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
                    <div className="bg-white md:rounded-xl shadow-2xl w-full max-w-7xl h-full md:h-[85vh] flex flex-col overflow-hidden border border-gray-200">
                        {/* Header */}
                        <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-indigo-100 rounded-lg">
                                    <Mail className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-800">Boîte de Réception Fictive</h2>
                                    <p className="text-xs text-gray-500">demo@pledgeum.fr • {emails.length} messages</p>
                                </div>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-full transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex flex-1 overflow-hidden">
                            {/* Email List */}
                            <div className={`w-1/3 border-r overflow-y-auto bg-gray-50 ${selectedEmail ? 'hidden md:block' : 'block'}`}>
                                {emails.length === 0 ? (
                                    <div className="p-8 text-center text-gray-500 mt-10">
                                        <Mail className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                        <p>Aucun message reçu</p>
                                    </div>
                                ) : (
                                    <ul className="divide-y divide-gray-200">
                                        {emails.map((email) => (
                                            <li
                                                key={email.id}
                                                onClick={() => handleOpenEmail(email)}
                                                className={`p-4 cursor-pointer hover:bg-white transition-colors relative group ${selectedEmail?.id === email.id ? 'bg-indigo-50 hover:bg-indigo-50' : 'bg-gray-50'} ${!email.read ? 'border-l-4 border-indigo-500 pl-3' : 'pl-4'}`}
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className={`text-sm truncate pr-2 ${!email.read ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                                                        {email.from || 'Pledgeum'}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                                        {format(new Date(email.date), 'HH:mm')}
                                                    </span>
                                                </div>
                                                <h4 className={`text-xs truncate mb-1 ${!email.read ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>
                                                    {email.subject}
                                                </h4>
                                                <p className="text-[10px] text-gray-500 line-clamp-2">
                                                    {email.text.substring(0, 100)}...
                                                </p>
                                                <button
                                                    onClick={(e) => handleDelete(e, email.id)}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Supprimer"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            {/* Email Content */}
                            <div className={`w-full md:w-2/3 flex flex-col bg-white h-full ${!selectedEmail ? 'hidden md:flex' : 'flex'}`}>
                                {selectedEmail ? (
                                    <>
                                        {/* Mobile Back Button */}
                                        <div className="md:hidden p-2 border-b">
                                            <button onClick={() => setSelectedEmail(null)} className="text-sm text-indigo-600 font-medium flex items-center">
                                                ← Retour
                                            </button>
                                        </div>

                                        <div className="p-6 overflow-y-auto flex-1">
                                            <div className="mb-6 pb-4 border-b">
                                                <h1 className="text-xl font-bold text-gray-900 mb-2">{selectedEmail.subject}</h1>
                                                <div className="flex justify-between items-end">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                                                            {(selectedEmail.from || 'P').charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900">{selectedEmail.from || 'Pledgeum'}</p>
                                                            <p className="text-xs text-gray-500">Pour: {selectedEmail.to}</p>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs text-gray-500">
                                                        {format(new Date(selectedEmail.date), 'dd MMM yyyy à HH:mm')}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="prose prose-sm max-w-none text-gray-800">
                                                <div dangerouslySetInnerHTML={{ __html: (selectedEmail.html || selectedEmail.text) }} />
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8 text-center">
                                        <Mail className="w-16 h-16 mb-4 opacity-10" />
                                        <p className="text-lg font-medium">Sélectionnez un email pour le lire</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
