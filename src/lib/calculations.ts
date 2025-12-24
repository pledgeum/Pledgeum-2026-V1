
interface ScheduleSlot {
    matin_debut?: string;
    matin_fin?: string;
    apres_midi_debut?: string;
    apres_midi_fin?: string;
}

interface AbsenceLike {
    duration: number;
}

export function calculateEffectiveInternshipDays(
    startDateStr: string,
    endDateStr: string,
    schedule: Record<string, ScheduleSlot> | undefined,
    absences: AbsenceLike[] = []
): number {
    if (!startDateStr || !endDateStr || !schedule) return 0;

    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    // Safety check for invalid dates
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0;

    const dayKeys = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

    let totalScheduledMinutes = 0;
    let workingDaysCount = 0;

    // Iterate through each day
    // Clone start to avoid mutating input date object if passed directly (though here we created new Date)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayIndex = d.getDay(); // 0-6
        const dayName = dayKeys[dayIndex];
        const dailySchedule = schedule[dayName];

        if (dailySchedule) {
            let dailyMinutes = 0;

            // Morning
            if (dailySchedule.matin_debut && dailySchedule.matin_fin) {
                const mStart = timeToMinutes(dailySchedule.matin_debut);
                const mEnd = timeToMinutes(dailySchedule.matin_fin);
                dailyMinutes += Math.max(0, mEnd - mStart);
            }

            // Afternoon
            if (dailySchedule.apres_midi_debut && dailySchedule.apres_midi_fin) {
                const aStart = timeToMinutes(dailySchedule.apres_midi_debut);
                const aEnd = timeToMinutes(dailySchedule.apres_midi_fin);
                dailyMinutes += Math.max(0, aEnd - aStart);
            }

            if (dailyMinutes > 0) {
                totalScheduledMinutes += dailyMinutes;
                workingDaysCount++;
            }
        }
    }

    if (workingDaysCount === 0) return 0;

    const avgMinutesPerDay = totalScheduledMinutes / workingDaysCount; // e.g. 420 mins (7h)

    // Sum absence duration (assuming stored in hours, convert to minutes)
    const totalAbsenceMinutes = absences.reduce((sum, abs) => sum + ((Number(abs.duration) || 0) * 60), 0);

    const effectiveMinutes = Math.max(0, totalScheduledMinutes - totalAbsenceMinutes);

    // Calculate effective days
    const effectiveDays = effectiveMinutes / avgMinutesPerDay;

    // Round to 1 decimal place? Or 0.5?
    // Standard is usually 0.5 or 1. Let's stick to 1 decimal for precision.
    return Math.round(effectiveDays * 10) / 10;
}

function timeToMinutes(timeStr: string): number {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}
