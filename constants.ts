import { AssignmentType, Resident } from './types';

export const TOTAL_WEEKS = 52;
export const COHORT_COUNT = 5;

// Initial Data Generation Helpers
export const GENERATE_INITIAL_RESIDENTS = (): Resident[] => {
  const residents: Resident[] = [];
  
  // 15 PGY1 (Numbers 1-15)
  for (let i = 1; i <= 15; i++) {
    residents.push({
      id: `pgy1-${i}`,
      name: `${i}. Intern (PGY1)`,
      level: 1,
      cohort: (i - 1) % COHORT_COUNT,
      avoidResidentIds: [],
    });
  }

  // 14 PGY2 (Numbers 16-29)
  for (let i = 16; i <= 29; i++) {
    residents.push({
      id: `pgy2-${i}`,
      name: `${i}. Resident (PGY2)`,
      level: 2,
      cohort: (i - 1) % COHORT_COUNT, 
      avoidResidentIds: [],
    });
  }

  // 9 PGY3 (Numbers 30-38)
  for (let i = 30; i <= 38; i++) {
    residents.push({
      id: `pgy3-${i}`,
      name: `${i}. Senior (PGY3)`,
      level: 3,
      cohort: (i - 1) % COHORT_COUNT,
      avoidResidentIds: [],
    });
  }

  return residents;
};

export const ASSIGNMENT_COLORS: Record<AssignmentType, string> = {
  [AssignmentType.WARDS_RED]: 'bg-red-200 text-red-900 border-red-300',
  [AssignmentType.WARDS_BLUE]: 'bg-blue-200 text-blue-900 border-blue-300',
  [AssignmentType.ICU]: 'bg-purple-200 text-purple-900 border-purple-300',
  [AssignmentType.NIGHT_FLOAT]: 'bg-indigo-200 text-indigo-900 border-indigo-300', 
  [AssignmentType.EM]: 'bg-orange-200 text-orange-900 border-orange-300',
  [AssignmentType.CLINIC]: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  [AssignmentType.ELECTIVE]: 'bg-green-100 text-green-800 border-green-200',
  [AssignmentType.VACATION]: 'bg-gray-100 text-gray-400 border-gray-200',
  [AssignmentType.MET_WARDS]: 'bg-teal-100 text-teal-800 border-teal-200',
  
  // PGY1 Electives
  [AssignmentType.CARDS]: 'bg-rose-300 text-rose-900 border-rose-400',
  [AssignmentType.ID]: 'bg-lime-200 text-lime-900 border-lime-300',
  [AssignmentType.NEPH]: 'bg-amber-200 text-amber-900 border-amber-300',
  [AssignmentType.PULM]: 'bg-cyan-200 text-cyan-900 border-cyan-300',

  // PGY2 Required Rotations
  [AssignmentType.ONC]: 'bg-pink-300 text-pink-900 border-pink-400',
  [AssignmentType.NEURO]: 'bg-violet-300 text-violet-900 border-violet-400',
  [AssignmentType.RHEUM]: 'bg-emerald-200 text-emerald-900 border-emerald-300',

  // PGY3 Required Electives
  [AssignmentType.ADD_MED]: 'bg-stone-300 text-stone-900 border-stone-400',
  [AssignmentType.ENDO]: 'bg-orange-100 text-orange-800 border-orange-200',
  [AssignmentType.GERI]: 'bg-slate-300 text-slate-900 border-slate-400',
  [AssignmentType.HPC]: 'bg-sky-200 text-sky-900 border-sky-300',

  // Voluntary / Other
  [AssignmentType.METRO]: 'bg-fuchsia-200 text-fuchsia-900 border-fuchsia-300',
  [AssignmentType.RESEARCH]: 'bg-zinc-200 text-zinc-900 border-zinc-300',
  [AssignmentType.CCMA]: 'bg-purple-100 text-purple-800 border-purple-200',
  [AssignmentType.HF]: 'bg-red-100 text-red-800 border-red-200',
  [AssignmentType.CC_ICU]: 'bg-rose-200 text-rose-900 border-rose-300',
  [AssignmentType.ENT]: 'bg-teal-200 text-teal-900 border-teal-300',
};

export const ASSIGNMENT_LABELS: Record<AssignmentType, string> = {
  [AssignmentType.WARDS_RED]: 'Wards Red',
  [AssignmentType.WARDS_BLUE]: 'Wards Blue',
  [AssignmentType.ICU]: 'ICU',
  [AssignmentType.NIGHT_FLOAT]: 'Night Float',
  [AssignmentType.EM]: 'Emergency',
  [AssignmentType.CLINIC]: 'Clinic (CCIM)',
  [AssignmentType.ELECTIVE]: 'Elective',
  [AssignmentType.VACATION]: 'Vacation',
  [AssignmentType.MET_WARDS]: 'Met Wards',
  [AssignmentType.CARDS]: 'Cardiology',
  [AssignmentType.ID]: 'Infectious Disease',
  [AssignmentType.NEPH]: 'Nephrology',
  [AssignmentType.PULM]: 'Pulmonology',
  [AssignmentType.METRO]: 'Metro ICU',
  [AssignmentType.ONC]: 'Heme/Onc',
  [AssignmentType.NEURO]: 'Neurology',
  [AssignmentType.RHEUM]: 'Rheumatology',
  [AssignmentType.ADD_MED]: 'Addiction Med',
  [AssignmentType.ENDO]: 'Endocrinology',
  [AssignmentType.GERI]: 'Geriatrics',
  [AssignmentType.HPC]: 'Palliative (HPC)',
  [AssignmentType.RESEARCH]: 'Research',
  [AssignmentType.CCMA]: 'CCMA',
  [AssignmentType.HF]: 'Heart Failure',
  [AssignmentType.CC_ICU]: 'Cardiac ICU',
  [AssignmentType.ENT]: 'Otolaryngology',
};

export const ASSIGNMENT_ABBREVIATIONS: Record<AssignmentType, string> = {
  [AssignmentType.WARDS_RED]: 'W-RED',
  [AssignmentType.WARDS_BLUE]: 'W-BLUE',
  [AssignmentType.ICU]: 'ICU',
  [AssignmentType.NIGHT_FLOAT]: 'NF',
  [AssignmentType.EM]: 'EM',
  [AssignmentType.CLINIC]: 'CCIM',
  [AssignmentType.ELECTIVE]: 'ELEC',
  [AssignmentType.VACATION]: 'VAC',
  [AssignmentType.MET_WARDS]: 'MET',
  [AssignmentType.CARDS]: 'CARDS',
  [AssignmentType.ID]: 'ID',
  [AssignmentType.NEPH]: 'NEPH',
  [AssignmentType.PULM]: 'PULM',
  [AssignmentType.METRO]: 'METRO',
  [AssignmentType.ONC]: 'ONC',
  [AssignmentType.NEURO]: 'NEURO',
  [AssignmentType.RHEUM]: 'RHEUM',
  [AssignmentType.ADD_MED]: 'ADDM',
  [AssignmentType.ENDO]: 'ENDO',
  [AssignmentType.GERI]: 'GERI',
  [AssignmentType.HPC]: 'HPC',
  [AssignmentType.RESEARCH]: 'RSCH',
  [AssignmentType.CCMA]: 'CCMA',
  [AssignmentType.HF]: 'HF',
  [AssignmentType.CC_ICU]: 'CC-ICU',
  [AssignmentType.ENT]: 'ENT',
};