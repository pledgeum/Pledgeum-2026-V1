"use client";

import React from 'react';
import { useDemoStore } from '@/store/demo';
import { X, Send, Paperclip } from 'lucide-react';

export function EmailSimulatorModal() {
    const { simulatedEmail, closeEmailModal } = useDemoStore();

    if (!simulatedEmail) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">

                {/* Header - Gmail Style */}
                <div className="bg-gray-100 px-4 py-3 flex justify-between items-center border-b border-gray-200">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                        <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded text-xs font-bold border border-orange-200 uppercase tracking-wide">
                            Mode Démo
                        </span>
                        Simulation d'envoi d'email
                    </h3>
                    <button
                        onClick={closeEmailModal}
                        className="text-gray-500 hover:text-gray-700 hover:bg-gray-200 p-1 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    <div className="space-y-2">
                        <div className="flex border-b border-gray-100 py-2">
                            <span className="text-gray-500 w-16 text-sm font-medium">À</span>
                            <span className="text-gray-800 text-sm flex-1">{simulatedEmail.to}</span>
                        </div>
                        <div className="flex border-b border-gray-100 py-2">
                            <span className="text-gray-500 w-16 text-sm font-medium">De</span>
                            <span className="text-gray-800 text-sm flex-1">ne-pas-repondre@pledgeum.fr</span>
                        </div>
                        <div className="flex border-b border-gray-100 py-2">
                            <span className="text-gray-500 w-16 text-sm font-medium">Objet</span>
                            <span className="text-gray-800 text-sm font-semibold flex-1">{simulatedEmail.subject}</span>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-md border border-gray-200 min-h-[150px] text-sm text-gray-700 whitespace-pre-wrap font-mono relative">
                        {/* Fake Content Area */}
                        {simulatedEmail.text}
                        <div className="absolute bottom-2 right-2 flex gap-2 text-gray-400">
                            <Paperclip className="w-4 h-4" />
                        </div>
                    </div>

                    <div className="text-xs text-gray-400 italic text-center">
                        Cet email n'a pas été envoyé réellement. C'est une simulation pour le mode démo.
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                    <button
                        onClick={closeEmailModal}
                        className="text-gray-500 hover:text-gray-700 text-sm font-medium"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={closeEmailModal} // Just close, mimicking send
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full font-medium shadow-md flex items-center gap-2 transform active:scale-95 transition-all"
                    >
                        <Send className="w-4 h-4" />
                        Envoyer (Simulation)
                    </button>
                </div>
            </div>
        </div>
    );
}
