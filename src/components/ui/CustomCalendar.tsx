import React, { useState, useMemo } from 'react';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths,
    isWithinInterval,
    parseISO
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CustomCalendarProps {
    selectedDate: string;
    onSelectDate: (date: string) => void;
    minDate?: string;
    maxDate?: string;
    schedule?: any; // The convention.stage_horaires object
}

export function CustomCalendar({ selectedDate, onSelectDate, minDate, maxDate, schedule }: CustomCalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate || new Date()));

    const days = useMemo(() => {
        const start = startOfWeek(startOfMonth(currentMonth), { locale: fr });
        const end = endOfWeek(endOfMonth(currentMonth), { locale: fr });
        return eachDayOfInterval({ start, end });
    }, [currentMonth]);

    const isValidDay = (date: Date) => {
        // 1. Check Range
        if (minDate && date < new Date(minDate)) return false;
        if (maxDate && date > new Date(maxDate)) return false;

        // 2. Check Schedule (Worked Day)
        if (schedule) {
            const dayName = format(date, 'EEEE', { locale: fr });
            // Capitalize first letter to match keys (Lundi, Mardi...)
            const key = dayName.charAt(0).toUpperCase() + dayName.slice(1);
            // Defensive check
            if (!schedule || typeof schedule !== 'object') return false;
            const daySchedule = schedule[key];

            const isWorked = daySchedule && (
                (daySchedule.matin_debut && daySchedule.matin_fin) ||
                (daySchedule.apres_midi_debut && daySchedule.apres_midi_fin)
            );
            return !!isWorked;
        }
        return true; // Default valid if no schedule
    };

    const getDayClass = (day: Date) => {
        const isSelected = isSameDay(day, new Date(selectedDate));
        const isValid = isValidDay(day);
        const isCurrentMonth = isSameMonth(day, currentMonth);

        if (isSelected) return "bg-red-500 text-white font-bold hover:bg-red-600";
        if (!isCurrentMonth) return "text-gray-300";
        if (isValid) return "bg-green-500 text-white font-bold hover:bg-green-600";

        return "text-gray-300 pointer-events-none"; // Invalid/Non-worked
    };

    const handleDayClick = (day: Date) => {
        if (isValidDay(day)) {
            // Correct for timezone offset when formatting to YYYY-MM-DD
            const offsetDate = new Date(day.getTime() - (day.getTimezoneOffset() * 60000));
            onSelectDate(offsetDate.toISOString().split('T')[0]);
        }
    };

    return (
        <div className="p-2 bg-white rounded-lg border border-gray-200">
            <div className="flex justify-between items-center mb-2">
                <button
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    className="p-1 hover:bg-gray-100 rounded-full"
                    type="button"
                >
                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <span className="font-semibold text-sm text-gray-900 capitalize">
                    {format(currentMonth, 'MMMM yyyy', { locale: fr })}
                </span>
                <button
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    className="p-1 hover:bg-gray-100 rounded-full"
                    type="button"
                >
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
                {['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'].map(d => (
                    <div key={d} className="text-[10px] font-medium text-gray-500">{d}</div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
                {days.map((day, idx) => (
                    <button
                        key={idx}
                        type="button"
                        onClick={() => handleDayClick(day)}
                        disabled={!isValidDay(day)}
                        className={`
              h-6 w-6 rounded-full text-[10px] flex items-center justify-center transition-all
              ${getDayClass(day)}
            `}
                    >
                        {format(day, 'd')}
                    </button>
                ))}
            </div>
            <div className="mt-2 flex gap-3 text-[10px] justify-center">
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-50 border border-green-200"></div>
                    <span className="text-gray-600">Travaillés</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span className="text-gray-600">Sélection</span>
                </div>
            </div>
        </div>
    );
}
