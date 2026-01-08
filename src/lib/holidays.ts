export const getPublicHolidays = (year: number): Date[] => {
    const holidays: Date[] = [
        new Date(year, 0, 1),   // Jour de l'an
        new Date(year, 4, 1),   // Fête du Travail
        new Date(year, 4, 8),   // Victoire 1945
        new Date(year, 6, 14),  // Fête Nationale
        new Date(year, 7, 15),  // Assomption
        new Date(year, 10, 1),  // Toussaint
        new Date(year, 10, 11), // Armistice 1918
        new Date(year, 11, 25), // Noël
    ];

    // Calculate Easter (Meeus/Jones/Butcher algorithm)
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
    const day = ((h + l - 7 * m + 114) % 31) + 1;

    const easter = new Date(year, month, day);

    // Variable holidays based on Easter
    const easterMonday = new Date(easter);
    easterMonday.setDate(easter.getDate() + 1);
    holidays.push(easterMonday);

    const ascension = new Date(easter);
    ascension.setDate(easter.getDate() + 39);
    holidays.push(ascension);

    const pentecostMonday = new Date(easter);
    pentecostMonday.setDate(easter.getDate() + 50);
    holidays.push(pentecostMonday);

    return holidays.sort((a, b) => a.getTime() - b.getTime());
};

export const isPublicHoliday = (date: Date): boolean => {
    const year = date.getFullYear();
    const holidays = getPublicHolidays(year);
    // Compare dates ignoring time
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    return holidays.some(h => {
        const hTime = new Date(h.getFullYear(), h.getMonth(), h.getDate()).getTime();
        return hTime === target;
    });
};
