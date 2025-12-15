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
  [AssignmentType.NIGHT_FLOAT]: 'bg-indigo-600 text-white border-indigo-700',
  [AssignmentType.EM]: 'bg-orange-200 text-orange-900 border-orange-300',
  [AssignmentType.CLINIC]: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  [AssignmentType.ELECTIVE]: 'bg-green-100 text-green-800 border-green-200',
  [AssignmentType.VACATION]: 'bg-gray-100 text-gray-400 border-gray-200',
  [AssignmentType.MET_WARDS]: 'bg-teal-100 text-teal-800 border-teal-200',
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
};