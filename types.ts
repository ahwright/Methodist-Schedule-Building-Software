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
  
  // PGY1 Required Electives
  CARDS = 'Cards',
  ID = 'ID',
  NEPH = 'Neph',
  PULM = 'Pulm',
  
  // PGY2 Required Rotations
  ONC = 'Onc',
  NEURO = 'Neuro',
  RHEUM = 'Rheum',
  
  // PGY3 Required Electives
  ADD_MED = 'Add Med',
  ENDO = 'Endo',
  GERI = 'Geri',
  HPC = 'HPC', // Hospice & Palliative Care

  // Voluntary / Other Electives (Available to all years)
  METRO = 'Metro',
  RESEARCH = 'Research',
  CCMA = 'CCMA',
  HF = 'Heart Failure',
  CC_ICU = 'Cardiac ICU',
  ENT = 'ENT',
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