
import { Check, Clock, Circle, Bell, AlertTriangle } from 'lucide-react';
import { Convention } from '@/store/convention';
import { useState, useEffect } from 'react';

interface SignatureTimelineProps {
    convention: Convention;
    onRemind?: (stepId: string) => void;
    onEditEmail?: (stepId: string) => void;
}

export function SignatureTimeline({ convention, onRemind, onEditEmail }: SignatureTimelineProps) {
    const isMinor = convention.est_mineur;
    const [elapsedTime, setElapsedTime] = useState<number>(0);

    useEffect(() => {
        const interval = setInterval(() => {
            if (!convention?.updatedAt) return;
            const lastUpdate = new Date(convention.updatedAt).getTime();
            const now = Date.now();
            const diff = now - lastUpdate;
            
            // Only update if the difference is significant (avoiding churn)
            setElapsedTime(prev => {
                if (Math.abs(prev - diff) < 500) return prev;
                return diff;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [convention?.updatedAt]);

    // Thresholds
    // const INITIAL_DELAY = 5 * 1000; // 5s wait after step starts
    // const REPEAT_COOLDOWN = 48 * 60 * 60 * 1000; // 48h wait between reminders
    const INITIAL_DELAY = 5000;
    const REPEAT_COOLDOWN = 48 * 60 * 60 * 1000; // 2 days in ms
    // const REPEAT_COOLDOWN = 10000; // 10s for fast testing if needed

    const hasInitialDelayPassed = elapsedTime > INITIAL_DELAY;

    // Check if cooldown from last reminder is active
    const now = Date.now();
    const lastReminderTime = convention.lastReminderAt ? new Date(convention.lastReminderAt).getTime() : 0;
    const isCooldownActive = (now - lastReminderTime) < REPEAT_COOLDOWN;

    const showReminder = hasInitialDelayPassed && !isCooldownActive;

    const steps = [
        {
            id: 'student',
            label: 'Élève',
            status: getStepStatus('student', convention),
            visible: true
        },
        {
            id: 'parent',
            label: 'Rep. Légal',
            status: getStepStatus('parent', convention),
            visible: true
        },
        {
            id: 'teacher',
            label: 'Enseignant',
            status: getStepStatus('teacher', convention),
            visible: true
        },
        {
            id: 'company',
            label: 'Entreprise',
            status: getStepStatus('company', convention),
            visible: true
        },
        {
            id: 'tutor',
            label: 'Tuteur',
            status: getStepStatus('tutor', convention),
            visible: true
        },
        {
            id: 'head',
            label: 'Chef Étab.',
            status: getStepStatus('head', convention),
            visible: true
        }
    ].filter(step => step.visible);

    return (
        <div className="w-full py-4">
            <div className="relative flex items-start w-full">
                {/* Connecting Line background */}
                <div className="absolute left-0 top-4 transform -translate-y-1/2 w-full h-1 bg-gray-200 -z-10" />

                {steps.map((step) => {
                    const isInvalidEmail = convention.invalidEmails?.includes(step.id);

                    return (
                        <div key={step.id} className="flex-1 flex flex-col items-center relative group-step">
                            <div className="flex flex-col items-center bg-white px-2 z-10">
                                <div className={`
                                w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all relative
                                ${isInvalidEmail ? 'bg-red-100 border-red-500 text-red-600 animate-pulse' : ''}
                                ${!isInvalidEmail && step.status === 'completed' ? 'bg-green-100 border-green-500 text-green-600' : ''}
                                ${!isInvalidEmail && step.status === 'current' ? 'bg-orange-100 border-orange-500 text-orange-600 animate-breathe' : ''}
                                ${!isInvalidEmail && step.status === 'pending' ? 'bg-gray-50 border-gray-300 text-gray-300' : ''}
                            `}>
                                    {isInvalidEmail ? (
                                        <button onClick={() => onEditEmail && onEditEmail(step.id)} title="Email invalide ! Cliquez pour corriger">
                                            <AlertTriangle className="w-5 h-5 animate-[ping_1s_ease-in-out_infinite]" />
                                        </button>
                                    ) : (
                                        <>
                                            {step.status === 'completed' && <Check className="w-5 h-5" />}
                                            {step.status === 'current' && <Clock className="w-5 h-5" />}
                                            {step.status === 'pending' && <Circle className="w-4 h-4" />}
                                        </>
                                    )}
                                </div>

                                {/* Reminder Icon - Only show if NO invalid email */}
                                {!isInvalidEmail && step.status === 'current' && onRemind && (
                                    <button
                                        onClick={() => showReminder && onRemind(step.id)}
                                        disabled={!showReminder}
                                        className={`
                                        absolute -bottom-6 transition-colors duration-300 p-1 rounded-full z-20
                                        ${showReminder
                                                ? 'text-blue-500 hover:text-blue-700 hover:bg-blue-50 cursor-pointer animate-in fade-in zoom-in'
                                                : 'text-gray-300 cursor-not-allowed'}
                                    `}
                                        title={showReminder ? "Envoyer une relance" : "Relance indisponible (attente trop courte)"}
                                    >
                                        <Bell className="w-4 h-4" />
                                    </button>
                                )}

                                {/* Invalid Email Correction Hint (Below) */}
                                {isInvalidEmail && (
                                    <button
                                        onClick={() => onEditEmail && onEditEmail(step.id)}
                                        className="absolute -bottom-6 text-red-500 hover:text-red-700 bg-red-50 rounded-full p-1 cursor-pointer z-20 animate-bounce"
                                        title="Corriger l'email"
                                    >
                                        <AlertTriangle className="w-4 h-4" />
                                    </button>
                                )}

                            </div>

                            <span className={`
                            text-xs mt-2 font-medium px-2 py-0.5 rounded text-center
                            ${isInvalidEmail ? 'text-red-700 bg-red-50 font-bold' : ''}
                            ${!isInvalidEmail && step.status === 'completed' ? 'text-green-700 bg-green-50' : ''}
                            ${!isInvalidEmail && step.status === 'current' ? 'text-orange-700 bg-orange-50' : ''}
                            ${!isInvalidEmail && step.status === 'pending' ? 'text-gray-400' : ''}
                        `}>
                                {step.label}
                            </span>
                        </div>
                    )
                })}
            </div>
        </div>
    );
}

function getStepStatus(step: string, c: Convention): 'completed' | 'current' | 'pending' {
    const s = c.status as string;
    const isMinor = c.est_mineur;
    const signatures = c.signatures as any;

    switch (step) {
        case 'student': {
            const hasStudentSigned = !!(signatures?.student?.signedAt || signatures?.studentAt);
            if (hasStudentSigned) return 'completed';
            return 'current';
        }

        case 'parent': {
            // 1. Si l'élève est majeur, l'étape est automatiquement complétée
            if (!isMinor) return 'completed';

            // 2. Vérification stricte de la donnée cryptographique
            const hasParentSigned = !!(signatures?.parent?.signedAt || signatures?.parentAt);
            if (hasParentSigned) return 'completed';

            // 3. Définir si c'est l'étape "en cours" (current) ou "en attente" (pending)
            const hasStudentSigned = !!(signatures?.student?.signedAt || signatures?.studentAt);
            if (hasStudentSigned && !hasParentSigned) return 'current';

            return 'pending';
        }

        case 'teacher': {
            const hasTeacherSigned = !!(signatures?.teacher?.signedAt || signatures?.teacherAt);
            if (hasTeacherSigned) return 'completed';

            const hasStudentSigned = !!(signatures?.student?.signedAt || signatures?.studentAt);
            if (hasStudentSigned && !hasTeacherSigned) return 'current';

            return 'pending';
        }

        case 'company': {
            const hasCompanySigned = !!(signatures?.company_head?.signedAt);
            if (hasCompanySigned) return 'completed';

            const hasTeacherSigned = !!(signatures?.teacher?.signedAt || signatures?.teacherAt);
            if (hasTeacherSigned && !hasCompanySigned) return 'current';

            return 'pending';
        }

        case 'tutor': {
            const hasTutorSigned = !!(signatures?.tutor?.signedAt);
            if (hasTutorSigned) return 'completed';

            const hasTeacherSigned = !!(signatures?.teacher?.signedAt || signatures?.teacherAt);
            if (hasTeacherSigned && !hasTutorSigned) return 'current';

            return 'pending';
        }

        case 'head': {
            const hasHeadSigned = !!(signatures?.head?.signedAt || signatures?.headAt);
            if (hasHeadSigned) return 'completed';

            const bothSigned = !!(signatures?.company_head?.signedAt && signatures?.tutor?.signedAt);
            if (bothSigned && !hasHeadSigned) return 'current';

            return 'pending';
        }

        default:
            return 'pending';
    }
}
