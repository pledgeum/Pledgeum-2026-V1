'use client';

import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Mail, X, Trash2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { useDemoStore } from '@/store/demo';
import { useUserStore } from '@/store/user';

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
    const { email: userEmail } = useUserStore();
    const [emails, setEmails] = useState<MockEmail[]>([]);
    const [selectedEmail, setSelectedEmail] = useState<MockEmail | null>(null);
    const isDemoMode = useDemoStore((state) => state.isDemoMode);
    const [unreadCount, setUnreadCount] = useState(0);

    // Sound Effect Logic
    const prevEmailCount = useRef(0);
    const isFirstLoad = useRef(true);

    useEffect(() => {
        if (!isDemoMode || !userEmail) return;

        const q = query(collection(db, 'demo_inbox'), orderBy('date', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allMsgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MockEmail));

            // Filter emails for the current user (Role-based filtering)
            // Strict filtering: Only show emails sent EXACTLY to this user
            // This ensures meaningful simulation (Student doesn't see Tutor's emails)
            const myMsgs = allMsgs.filter(msg => msg.to === userEmail);

            // Remove duplicates if broader matching catches same email twice
            const uniqueMsgs = Array.from(new Map(myMsgs.map(m => [m.id, m])).values());

            // Play sound if new email arrived (and not first load)
            if (!isFirstLoad.current && uniqueMsgs.length > prevEmailCount.current) {
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); // Simple Ping
                audio.volume = 0.5;
                audio.play().catch(e => console.error("Audio play failed", e));
            }

            setEmails(uniqueMsgs);
            setUnreadCount(uniqueMsgs.filter(m => !m.read).length);

            prevEmailCount.current = uniqueMsgs.length;
            isFirstLoad.current = false;
        });

        return () => unsubscribe();
    }, [isDemoMode, userEmail]);

    if (!isDemoMode) return null;

    const handleOpenEmail = async (email: MockEmail) => {
        setSelectedEmail(email);
        if (!email.read) {
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

    const isEmpty = emails.length === 0;

    return (
        <div className="relative">
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative bg-white shadow-md text-gray-900 p-2 rounded-full transition-all mx-2 hover:bg-gray-100 ${isOpen ? 'ring-2 ring-indigo-500' : ''}`}
                title="Boîte mail fictive"
            >
                <Mail className="w-5 h-5 text-indigo-600" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                )}
            </button>

            {/* Mailbox Window (Popover) */}
            {isOpen && (
                <div
                    onMouseDown={(e) => e.stopPropagation()} // Prevent drag start when interacting with mailbox
                    onTouchStart={(e) => e.stopPropagation()}
                    className={`
                        absolute bottom-full left-1/2 -translate-x-1/2 mb-4 
                        bg-white rounded-xl shadow-2xl border border-gray-200 
                        overflow-hidden flex flex-col transition-all duration-300 ease-in-out
                        origin-bottom
                        z-[1000]
                    `}
                    style={{
                        width: isEmpty ? '280px' : 'min(600px, 90vw)',
                        height: isEmpty ? 'auto' : '500px',
                    }}
                >
                    {/* Header */}
                    <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-800">Boîte de Réception</span>
                            {!isEmpty && <span className="bg-indigo-100 text-indigo-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{emails.length}</span>}
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-hidden flex relative">
                        {isEmpty ? (
                            <div className="p-4 text-center text-gray-500 w-full bg-white">
                                <p className="text-sm">Aucun message pour le moment.</p>
                            </div>
                        ) : (
                            <>
                                {/* Email List */}
                                <div className={`flex-1 overflow-y-auto bg-gray-50 ${selectedEmail ? 'hidden md:block w-1/3 border-r' : 'w-full'}`}>
                                    <ul className="divide-y divide-gray-200">
                                        {emails.map((email) => (
                                            <li
                                                key={email.id}
                                                onClick={() => handleOpenEmail(email)}
                                                className={`p-3 cursor-pointer hover:bg-white transition-colors relative group ${selectedEmail?.id === email.id ? 'bg-indigo-50' : 'bg-gray-50'}`}
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className={`text-xs truncate pr-2 ${!email.read ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                                                        {email.from ? email.from.split('<')[0] : 'Pledgeum'}
                                                    </span>
                                                    {!email.read && (
                                                        <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-1"></span>
                                                    )}
                                                </div>
                                                <h4 className={`text-xs truncate mb-1 ${!email.read ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>
                                                    {email.subject}
                                                </h4>
                                                <div className="flex justify-between items-center mt-1">
                                                    <span className="text-[10px] text-gray-400">
                                                        {format(new Date(email.date), 'HH:mm')}
                                                    </span>
                                                    <button
                                                        onClick={(e) => handleDelete(e, email.id)}
                                                        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="Supprimer"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Email Detail View */}
                                <div className={`
                                    bg-white flex flex-col h-full 
                                    ${selectedEmail ? 'w-full md:w-2/3 absolute inset-0 md:static z-20' : 'hidden md:flex md:w-2/3 items-center justify-center'}
                                `}>
                                    {selectedEmail ? (
                                        <>
                                            <div className="p-2 border-b flex items-center gap-2 bg-gray-50 md:hidden">
                                                <button onClick={() => setSelectedEmail(null)} className="text-indigo-600 text-xs font-bold flex items-center">
                                                    ← Retour
                                                </button>
                                            </div>
                                            <div className="p-4 overflow-y-auto flex-1">
                                                <h3 className="font-bold text-gray-900 mb-2">{selectedEmail.subject}</h3>
                                                <div className="flex items-center gap-2 mb-4 text-xs text-gray-500 pb-2 border-b">
                                                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                                                        {(selectedEmail.from || 'P').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900">{selectedEmail.from || 'Pledgeum'}</p>
                                                        <p>{format(new Date(selectedEmail.date), 'dd MMM yyyy à HH:mm')}</p>
                                                    </div>
                                                </div>
                                                <div className="prose prose-sm text-gray-800 text-xs md:text-sm">
                                                    <div dangerouslySetInnerHTML={{ __html: (selectedEmail.html || selectedEmail.text) }} />
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center text-gray-400 p-4">
                                            <Mail className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                            <p className="text-xs">Sélectionnez un email</p>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
