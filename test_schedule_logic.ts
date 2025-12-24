
const defaultDay = {
    matin_debut: '08:00', matin_fin: '12:00',
    apres_midi_debut: '14:00', apres_midi_fin: '17:00'
};
const emptyDay = {
    matin_debut: '', matin_fin: '',
    apres_midi_debut: '', apres_midi_fin: ''
};

const horaires = {
    'Lundi': defaultDay,
    'Mardi': defaultDay,
    'Mercredi': defaultDay,
    'Jeudi': defaultDay,
    'Vendredi': defaultDay,
    'Samedi': emptyDay,
};

console.log("SCHEDULE DEBUG:");
console.log(JSON.stringify(horaires, null, 2));

// Check reference equality just in case
console.log("Is Saturday same ref as Monday?", horaires['Samedi'] === horaires['Lundi']);

// Check Demo Mode Logic
const demoHoraires = {
    'Lundi': { matin_debut: '08:00', matin_fin: '12:00', apres_midi_debut: '14:00', apres_midi_fin: '17:00' },
    'Mardi': { matin_debut: '08:00', matin_fin: '12:00', apres_midi_debut: '14:00', apres_midi_fin: '17:00' },
    'Mercredi': { matin_debut: '08:00', matin_fin: '12:00', apres_midi_debut: '14:00', apres_midi_fin: '17:00' },
    'Jeudi': { matin_debut: '08:00', matin_fin: '12:00', apres_midi_debut: '14:00', apres_midi_fin: '17:00' },
    'Vendredi': { matin_debut: '08:00', matin_fin: '12:00', apres_midi_debut: '14:00', apres_midi_fin: '17:00' },
    'Samedi': { matin_debut: '', matin_fin: '', apres_midi_debut: '', apres_midi_fin: '' },
};
console.log("DEMO DEBUG:");
console.log(JSON.stringify(demoHoraires, null, 2));
