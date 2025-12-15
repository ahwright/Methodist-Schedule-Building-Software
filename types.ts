export type PgyLevel = 1 | 2 | 3;

export interface Resident {
  id: string;
  name: string;
  level: PgyLevel;
  cohort: number; // 0-4 for the 4+1 cohorts
  avoidResidentIds: string[];
}

export enum AssignmentType {
  WARDS_RED = 'Wards-R',
  WARDS_BLUE = 'Wards-B',
  ICU = 'ICU',
  NIGHT_FLOAT = 'NF',
  EM = 'EM',
  CLINIC = 'CCIM',
  ELECTIVE = 'ELECTIVE',
  VACATION = 'VAC',
  MET_WARDS = 'Met Wards', // Fallback or extra ward
}

export interface ScheduleCell {
  assignment: AssignmentType;
  locked: boolean; // If manually set, don't overwrite
}

// Map: ResidentID -> Array of 52 weeks of assignments
export type ScheduleGrid = Record<string, ScheduleCell[]>;

export interface ScheduleStats {
  [residentId: string]: Record<AssignmentType, number>;
}
