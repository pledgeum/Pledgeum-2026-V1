'use client';

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertCircle, Calendar } from 'lucide-react';

interface ClassProgress {
    id: string;
    className: string;
    startDate: string;
    totalStudents: number;
    conventionsValidated: number;
}

interface InternshipProgressChartProps {
    uai: string;
}

export default function InternshipProgressChart({ uai }: InternshipProgressChartProps) {
    const [data, setData] = useState<ClassProgress[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!uai) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`/api/school/analytics/internship-progress?uai=${uai}`);
                if (!response.ok) throw new Error('Erreur lors de la récupération des données');
                const result = await response.json();
                setData(result.data || []);
            } catch (err: any) {
                console.error(err);
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [uai]);

    if (isLoading) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
                <div className="flex items-center gap-2 mb-6">
                    <div className="w-9 h-9 bg-gray-100 rounded-lg animate-pulse" />
                    <div>
                        <div className="h-5 w-48 bg-gray-100 rounded animate-pulse mb-1" />
                        <div className="h-3 w-32 bg-gray-50 rounded animate-pulse" />
                    </div>
                </div>
                {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-3">
                        <div className="flex justify-between items-end">
                            <div className="space-y-1">
                                <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
                                <div className="h-3 w-24 bg-gray-50 rounded animate-pulse" />
                            </div>
                            <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
                        </div>
                        <div className="h-6 w-full bg-gray-100 rounded-full animate-pulse" />
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-red-100 p-6 flex items-center text-red-600 gap-3">
                <AlertCircle className="w-5 h-5" />
                <p className="text-sm font-medium">{error}</p>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center group hover:border-blue-200 transition-colors">
                <div className="p-4 bg-gray-50 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-50 transition-colors">
                    <Calendar className="w-10 h-10 text-gray-300 group-hover:text-blue-400 transition-colors" />
                </div>
                <h4 className="text-gray-900 font-bold mb-1">Aucune période de stage configurée</h4>
                <p className="text-sm text-gray-500 max-w-xs mx-auto">
                    Définissez les périodes de stage dans le "Calendrier PFMP" pour activer ce tableau de bord de pilotage.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-hidden">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-2.5 bg-blue-50 rounded-xl shadow-sm border border-blue-100">
                    <Calendar className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                    <h3 className="text-lg font-extrabold text-gray-900 tracking-tight">Suivi de l'Avancement des Stages</h3>
                    <p className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        Pilotage en temps réel par classe
                    </p>
                </div>
            </div>

            <div className="space-y-10">
                {data.map((item) => {
                    const percentage = item.totalStudents > 0 
                        ? Math.min(Math.round((item.conventionsValidated / item.totalStudents) * 100), 100) 
                        : 0;
                    
                    const formattedDate = format(parseISO(item.startDate), 'd MMMM yyyy', { locale: fr });

                    return (
                        <div key={item.id} className="group relative">
                            <div className="flex justify-between items-end mb-3">
                                <div className="space-y-0.5">
                                    <h4 className="text-base font-black text-gray-800 group-hover:text-blue-600 transition-colors flex items-center gap-2">
                                        {item.className}
                                        {percentage === 100 && (
                                            <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-bold uppercase">Terminé</span>
                                        )}
                                    </h4>
                                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        Début : {formattedDate}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <div className="flex items-baseline justify-end gap-1">
                                        <span className="text-xl font-black text-gray-900 leading-none">
                                            {item.conventionsValidated}
                                        </span>
                                        <span className="text-sm font-bold text-gray-400 leading-none">
                                            / {item.totalStudents}
                                        </span>
                                    </div>
                                    <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mt-1">
                                        élèves placés
                                    </p>
                                </div>
                            </div>
                            
                            <div className="relative w-full h-4 bg-gray-100 rounded-full overflow-hidden shadow-inner border border-gray-100">
                                <div 
                                    className={`h-full transition-all duration-1000 ease-out rounded-full shadow-sm ${
                                        percentage === 100 ? 'bg-green-500' : 'bg-blue-600'
                                    } group-hover:brightness-110`}
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>
                            
                            {/* Decorative percentage indicator on hover */}
                            <div className="absolute -right-2 top-0 transform translate-x-full opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none pr-4 hidden lg:block">
                                <span className="text-3xl font-black text-blue-50/50 absolute -top-4 -left-8 select-none">
                                    {percentage}%
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
