export const CONVENTION_TYPES = {
  PFMP_STANDARD: { id: 'PFMP_STANDARD', label: 'PFMP Lycée Professionnel (Standard)' },
  STAGE_SECONDE: { id: 'STAGE_SECONDE', label: 'Stage de Seconde (Séquence d\'observation)' },
  ERASMUS: { id: 'ERASMUS', label: 'Mobilité Erasmus+' },
  BTS: { id: 'BTS', label: 'Convention de stage BTS' }
} as const;

export type ConventionTypeId = keyof typeof CONVENTION_TYPES;
export type ConventionType = (typeof CONVENTION_TYPES)[ConventionTypeId];
