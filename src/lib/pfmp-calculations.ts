import { isPublicHoliday } from './holidays';

interface ScheduleSlot {
    matin_debut?: string;
    matin_fin?: string;
    apres_midi_debut?: string;
    apres_midi_fin?: string;
}

interface Absence {
    date: string;
    duration: number; // in hours, e.g. 7 for full day, 3.5 for half day
}

interface ConventionLite {
    stage_date_debut: string;
    stage_date_fin: string;
    stage_horaires?: Record<string, ScheduleSlot>;
}

export interface PfmpStats {
    daysToPay: number;
    weeksForDiploma: number;
    holidaysFound: string[];
    absencesDaysCount: number;
}

/**
 * Double engine calculation for PFMP:
 * 1. Gratification: Days worked, capped at 5 days per calendar week, excluding holidays.
 * 2. Diploma: Weeks covered, a week is valid if not 100% absent.
 */
export function calculatePfmpStats(
    convention: ConventionLite,
    absences: Absence[] = []
): PfmpStats {
    const start = new Date(convention.stage_date_debut);
    const end = new Date(convention.stage_date_fin);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
        return { daysToPay: 0, weeksForDiploma: 0, holidaysFound: [], absencesDaysCount: 0 };
    }

    const absenceMap = new Map<string, number>();
    absences.forEach(a => {
        const d = new Date(a.date).toISOString().split('T')[0];
        absenceMap.set(d, (absenceMap.get(d) || 0) + a.duration);
    });

    let totalDaysPaid = 0;
    let holidaysFound: string[] = [];
    let absencesDaysCount = 0;

    // Track presence per calendar week (ISO Week or simple Sunday-start)
    // We'll use a simple approach: if day worked, increment week counter.
    let currentWeekId = "";
    let daysWorkedInCurrentWeek = 0;
    let totalCappedDays = 0;

    // Diploma logic: Track weeks where at least one day was worked (or intended to be worked)
    const weeksWithPresence = new Set<string>();
    const weeksTotalPossible = new Set<string>();

    const dayKeys = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const dayOfWeek = dayKeys[d.getDay()];

        // Use ISO week or Year-Week number to identify calendar weeks
        // Simple week ID: Year-WeekNumber
        const weekId = getWeekId(d);
        if (weekId !== currentWeekId) {
            // New week starts: add capped days from previous week
            totalCappedDays += Math.min(5, daysWorkedInCurrentWeek);
            daysWorkedInCurrentWeek = 0;
            currentWeekId = weekId;
        }

        const dailySchedule = convention.stage_horaires?.[dayOfWeek];
        const isWorkDayScheduled = dailySchedule &&
            (dailySchedule.matin_debut !== '' || dailySchedule.apres_midi_debut !== '');

        if (isWorkDayScheduled) {
            weeksTotalPossible.add(weekId);

            if (isPublicHoliday(d)) {
                holidaysFound.push(d.toLocaleDateString('fr-FR'));
            } else {
                const absenceHours = absenceMap.get(dateStr) || 0;
                // Assuming 7h is a full day
                const dayFraction = Math.max(0, 1 - (absenceHours / 7));

                if (dayFraction > 0) {
                    daysWorkedInCurrentWeek += dayFraction;
                    weeksWithPresence.add(weekId);
                }

                if (absenceHours >= 3.5) {
                    absencesDaysCount += (absenceHours >= 7 ? 1 : 0.5);
                }
            }
        }
    }

    // Add last week's capped days
    totalCappedDays += Math.min(5, daysWorkedInCurrentWeek);

    return {
        daysToPay: Math.round(totalCappedDays * 10) / 10,
        weeksForDiploma: weeksWithPresence.size,
        holidaysFound: Array.from(new Set(holidaysFound)),
        absencesDaysCount
    };
}

/**
 * Returns a unique string for the calendar week (Monday to Sunday)
 */
function getWeekId(date: Date): string {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    // Set to nearest Thursday: current date + 4 - current day number
    // Make Sunday's day number 7
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    // Get first day of year
    const yearStart = new Date(d.getFullYear(), 0, 1);
    // Calculate full weeks to nearest Thursday
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${weekNo}`;
}
