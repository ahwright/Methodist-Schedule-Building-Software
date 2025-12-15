import { Resident, ScheduleGrid, AssignmentType, ScheduleCell, ScheduleStats } from '../types';
import { TOTAL_WEEKS, COHORT_COUNT } from '../constants';

// Helper to count specific assignments for a resident so far to balance load
const getCount = (schedule: ScheduleGrid, residentId: string, type: AssignmentType): number => {
  return schedule[residentId].filter(cell => cell.assignment === type).length;
};

// Check if a resident is available for a contiguous block of weeks
const isAvailableForBlock = (
  schedule: ScheduleGrid, 
  residentId: string, 
  startWeek: number, 
  duration: number
): boolean => {
  if (startWeek + duration > TOTAL_WEEKS) return false;

  for (let i = 0; i < duration; i++) {
    const w = startWeek + i;
    // Must be empty and not locked (Assignment check handles Clinic which is pre-filled)
    if (schedule[residentId][w].assignment !== null) {
      return false;
    }
  }
  return true;
};

export const generateSchedule = (
  residents: Resident[], 
  existingSchedule: ScheduleGrid
): ScheduleGrid => {
  // Deep copy existing schedule
  const newSchedule: ScheduleGrid = JSON.parse(JSON.stringify(existingSchedule));

  // Initialize empty grid if needed
  residents.forEach(r => {
    if (!newSchedule[r.id] || newSchedule[r.id].length !== TOTAL_WEEKS) {
      newSchedule[r.id] = Array(TOTAL_WEEKS).fill({ assignment: null, locked: false });
    } else {
      // Clear non-locked assignments to regenerate fresh
      newSchedule[r.id] = newSchedule[r.id].map(cell => 
        cell.locked ? cell : { assignment: null, locked: false }
      );
    }
  });

  // 1. PLACE COHORT CLINICS (Fixed Constraints)
  residents.forEach(resident => {
    for (let w = 0; w < TOTAL_WEEKS; w++) {
      if (w % COHORT_COUNT === resident.cohort) {
        if (!newSchedule[resident.id][w].locked) {
          newSchedule[resident.id][w] = { assignment: AssignmentType.CLINIC, locked: false };
        }
      }
    }
  });

  // CONFIGURATION
  const nightFloatConfig = { 
      type: AssignmentType.NIGHT_FLOAT, 
      duration: 4, 
      minInterns: 1, maxInterns: 2, 
      minSeniors: 1, maxSeniors: 3,
      targetWeeks: 4 
  };

  const coreAssignments = [
    { 
      type: AssignmentType.ICU, 
      duration: 4, 
      minInterns: 2, maxInterns: 2, 
      minSeniors: 2, maxSeniors: 2 
    },
    { 
      type: AssignmentType.WARDS_RED, 
      duration: 4, 
      minInterns: 2, maxInterns: 2, 
      minSeniors: 2, maxSeniors: 2 
    },
    { 
      type: AssignmentType.WARDS_BLUE, 
      duration: 4, 
      minInterns: 2, maxInterns: 2, 
      minSeniors: 2, maxSeniors: 2 
    }
  ];

  const emConfig = {
      type: AssignmentType.EM, 
      duration: 2, 
      minInterns: 1, maxInterns: 2, 
      minSeniors: 1, maxSeniors: 2,
      internTarget: 4 // Up to 4 weeks
  };

  const internElectives = [
    { type: AssignmentType.CARDS, duration: 4, target: 4, maxPerWeek: 3 },
    { type: AssignmentType.ID, duration: 2, target: 2, maxPerWeek: 3 },
    { type: AssignmentType.NEPH, duration: 2, target: 2, maxPerWeek: 3 },
    { type: AssignmentType.PULM, duration: 2, target: 2, maxPerWeek: 3 },
  ];

  const pgy2Requirements = [
    // Metro ICU removed as per requirement (optional elective now)
    { type: AssignmentType.ONC, duration: 4, target: 4, maxPerWeek: 2 },
    { type: AssignmentType.NEURO, duration: 4, target: 4, maxPerWeek: 2 },
    { type: AssignmentType.RHEUM, duration: 4, target: 4, maxPerWeek: 2 },
  ];

  const pgy3Requirements = [
    { type: AssignmentType.ADD_MED, duration: 2, target: 2, maxPerWeek: 2 },
    { type: AssignmentType.ENDO, duration: 2, target: 2, maxPerWeek: 2 },
    { type: AssignmentType.GERI, duration: 2, target: 2, maxPerWeek: 2 },
    { type: AssignmentType.HPC, duration: 2, target: 2, maxPerWeek: 2 },
  ];

  // HELPER: Assign Block
  const assignBlock = (
    week: number, 
    type: AssignmentType, 
    duration: number, 
    levelFilter: (l: number) => boolean,
    minNeeded: number, 
    maxAllowed: number,
    targetWeeks: number | undefined,
    currentAssigned: Resident[]
  ): number => {
    let filledCount = 0;
    
    // PHASE 1: FILL MINIMUM REQUIREMENTS
    // We MUST fill these slots. We prioritize those under target.
    while (filledCount < minNeeded) {
      const candidates = residents.filter(r => 
        levelFilter(r.level) && 
        isAvailableForBlock(newSchedule, r.id, week, duration)
      );

      if (candidates.length === 0) break;

      candidates.sort((a, b) => {
        const countA = getCount(newSchedule, a.id, type);
        const countB = getCount(newSchedule, b.id, type);

        // 1. Target Completion: Strongly prefer those who haven't met target
        if (targetWeeks !== undefined) {
          const aMet = countA >= targetWeeks;
          const bMet = countB >= targetWeeks;
          if (aMet && !bMet) return 1;
          if (!aMet && bMet) return -1;
        }

        // 2. Conflict Avoidance
        const aConflicts = currentAssigned.some(existing => a.avoidResidentIds.includes(existing.id) || existing.avoidResidentIds.includes(a.id));
        const bConflicts = currentAssigned.some(existing => b.avoidResidentIds.includes(existing.id) || existing.avoidResidentIds.includes(b.id));
        if (aConflicts && !bConflicts) return 1;
        if (!aConflicts && bConflicts) return -1;

        // 3. Workload Balance
        if (countA !== countB) return countA - countB;
        
        return Math.random() - 0.5;
      });

      const selected = candidates[0];
      for (let i = 0; i < duration; i++) {
        newSchedule[selected.id][week + i] = { assignment: type, locked: false };
      }
      currentAssigned.push(selected);
      filledCount++;
    }

    // PHASE 2: FILL EXTRA CAPACITY (UP TO MAX)
    // We ONLY fill these if the candidate specifically needs hours to meet target.
    // We STRICTLY prevent going over target here.
    while (filledCount < maxAllowed) {
      const candidates = residents.filter(r => {
        if (!levelFilter(r.level)) return false;
        if (!isAvailableForBlock(newSchedule, r.id, week, duration)) return false;
        
        // STRICT CHECK: Assignment must not exceed target
        if (targetWeeks !== undefined) {
           const current = getCount(newSchedule, r.id, type);
           if (current + duration > targetWeeks) return false;
        }
        return true;
      });

      if (candidates.length === 0) break;

      // Sort just by conflicts and general balance (Target check is handled in filter)
      candidates.sort((a, b) => {
        const countA = getCount(newSchedule, a.id, type);
        const countB = getCount(newSchedule, b.id, type);
        
        const aConflicts = currentAssigned.some(existing => a.avoidResidentIds.includes(existing.id) || existing.avoidResidentIds.includes(a.id));
        const bConflicts = currentAssigned.some(existing => b.avoidResidentIds.includes(existing.id) || existing.avoidResidentIds.includes(b.id));
        if (aConflicts && !bConflicts) return 1;
        if (!aConflicts && bConflicts) return -1;
        
        if (countA !== countB) return countA - countB;
        return Math.random() - 0.5;
      });

      const selected = candidates[0];
      for (let i = 0; i < duration; i++) {
        newSchedule[selected.id][week + i] = { assignment: type, locked: false };
      }
      currentAssigned.push(selected);
      filledCount++;
    }

    return filledCount;
  };

  // 2. NIGHT FLOAT ASSIGNMENT (PRIORITY)
  // Implemented in 2 passes to ensure exact 4-week distribution.
  
  // PASS 1: Mandatory Minimum Coverage (Sequential Weeks)
  // Fills the "Must Have" slots (1 Intern, 1 Senior).
  for (let w = 0; w < TOTAL_WEEKS; w++) {
    const assignedResidents = residents.filter(r => newSchedule[r.id][w]?.assignment === nightFloatConfig.type);
    
    // Interns Min
    const currentInterns = assignedResidents.filter(r => r.level === 1);
    let filledInterns = assignBlock(
        w, nightFloatConfig.type, nightFloatConfig.duration, (l) => l === 1,
        Math.max(0, nightFloatConfig.minInterns - currentInterns.length), // Min
        Math.max(0, nightFloatConfig.minInterns - currentInterns.length), // Max (capped at Min for this pass)
        nightFloatConfig.targetWeeks, [...assignedResidents]
    );

    // Fallback Interns (Short Blocks if needed for coverage)
    if (currentInterns.length + filledInterns < nightFloatConfig.minInterns) {
       let needed = nightFloatConfig.minInterns - (currentInterns.length + filledInterns);
       for (let d = nightFloatConfig.duration - 1; d >= 1; d--) {
          if (needed <= 0) break;
          needed -= assignBlock(w, nightFloatConfig.type, d, (l) => l === 1, needed, needed, undefined, [...assignedResidents]);
       }
    }

    // Seniors Min
    const currentSeniors = assignedResidents.filter(r => r.level > 1);
    let filledSeniors = assignBlock(
        w, nightFloatConfig.type, nightFloatConfig.duration, (l) => l > 1,
        Math.max(0, nightFloatConfig.minSeniors - currentSeniors.length),
        Math.max(0, nightFloatConfig.minSeniors - currentSeniors.length),
        nightFloatConfig.targetWeeks, [...assignedResidents]
    );
    
    // Fallback Seniors
    if (currentSeniors.length + filledSeniors < nightFloatConfig.minSeniors) {
       let needed = nightFloatConfig.minSeniors - (currentSeniors.length + filledSeniors);
       for (let d = nightFloatConfig.duration - 1; d >= 1; d--) {
          if (needed <= 0) break;
          needed -= assignBlock(w, nightFloatConfig.type, d, (l) => l > 1, needed, needed, undefined, [...assignedResidents]);
       }
    }
  }

  // PASS 2: Target Filling (Randomized Weeks)
  // Fills up to Max Capacity, BUT ONLY for residents who need weeks to hit 4.
  // Randomized order prevents front-loading double-coverage.
  const shuffledWeeks = Array.from({length: TOTAL_WEEKS}, (_, i) => i).sort(() => Math.random() - 0.5);
  for (const w of shuffledWeeks) {
    const assignedResidents = residents.filter(r => newSchedule[r.id][w]?.assignment === nightFloatConfig.type);

    // Interns Extra (Min=0, Max=Max)
    const currentInterns = assignedResidents.filter(r => r.level === 1);
    // We pass 0 as minNeeded so Phase 1 is skipped. Phase 2 (Strict Target) runs.
    assignBlock(
        w, nightFloatConfig.type, nightFloatConfig.duration, (l) => l === 1,
        0, 
        Math.max(0, nightFloatConfig.maxInterns - currentInterns.length),
        nightFloatConfig.targetWeeks, [...assignedResidents]
    );

    // Seniors Extra
    const currentSeniors = assignedResidents.filter(r => r.level > 1);
    assignBlock(
        w, nightFloatConfig.type, nightFloatConfig.duration, (l) => l > 1,
        0, 
        Math.max(0, nightFloatConfig.maxSeniors - currentSeniors.length),
        nightFloatConfig.targetWeeks, [...assignedResidents]
    );
  }

  // 3. FILL CORE ROTATIONS (Wards, ICU)
  // EM is removed from here to separate its priority.
  for (let w = 0; w < TOTAL_WEEKS; w++) {
    for (const job of coreAssignments) {
      const assignedResidents = residents.filter(r => 
        newSchedule[r.id][w]?.assignment === job.type
      );

      // --- INTERNS ---
      const currentInterns = assignedResidents.filter(r => r.level === 1);
      let filledInterns = assignBlock(
          w, job.type, job.duration, 
          (l) => l === 1, 
          Math.max(0, job.minInterns - currentInterns.length),
          Math.max(0, job.maxInterns - currentInterns.length),
          undefined, // No strict target for others
          [...assignedResidents]
      );
      
      // Fallback
      const totalInternsNow = currentInterns.length + filledInterns;
      if (totalInternsNow < job.minInterns) {
           let needed = job.minInterns - totalInternsNow;
           for (let d = job.duration - 1; d >= 1; d--) {
              if (needed <= 0) break;
              needed -= assignBlock(w, job.type, d, (l) => l === 1, needed, needed, undefined, [...assignedResidents]);
           }
      }

      // --- SENIORS (PGY2/3) ---
      const currentSeniors = assignedResidents.filter(r => r.level > 1);
      let filledSeniors = assignBlock(
          w, job.type, job.duration, 
          (l) => l > 1, 
          Math.max(0, job.minSeniors - currentSeniors.length),
          Math.max(0, job.maxSeniors - currentSeniors.length),
          undefined,
          [...assignedResidents]
      );
      
      const totalSeniorsNow = currentSeniors.length + filledSeniors;
      if (totalSeniorsNow < job.minSeniors) {
           let needed = job.minSeniors - totalSeniorsNow;
           for (let d = job.duration - 1; d >= 1; d--) {
              if (needed <= 0) break;
              needed -= assignBlock(w, job.type, d, (l) => l > 1, needed, needed, undefined, [...assignedResidents]);
           }
      }
    }
  }

  // 4. FILL SPECIALTY REQUIREMENTS (Electives for Interns / Core for PGY2 / Electives PGY3)
  // Minimizing Overlap:
  // We use a multi-pass approach.
  // Pass 1: Try to fit residents into weeks where the rotation is currently EMPTY (concurrency 0 -> 1).
  // Pass 2: Allow filling up to maxPerWeek (concurrency 1 -> Max).
  const concurrencyPasses = [1, 10]; // 10 is effectively "Max"

  for (const limit of concurrencyPasses) {
      // Re-shuffle weeks for each pass to avoid bias
      const passWeeks = Array.from({length: TOTAL_WEEKS}, (_, i) => i).sort(() => Math.random() - 0.5);
      
      for (const w of passWeeks) {
        
        // 4a. Intern Required Electives
        for (const elect of internElectives) {
          const assigned = residents.filter(r => newSchedule[r.id][w]?.assignment === elect.type);
          const currentCount = assigned.length;
          const effectiveMax = Math.min(elect.maxPerWeek, limit);
          
          if (currentCount < effectiveMax) {
             assignBlock(
                w, elect.type, elect.duration, 
                (l) => l === 1,
                0, 
                effectiveMax - currentCount, 
                elect.target, 
                [...assigned]
              );
          }
        }

        // 4b. PGY2 Required Rotations (Onc, Neuro, Rheum)
        for (const elect of pgy2Requirements) {
          const assigned = residents.filter(r => newSchedule[r.id][w]?.assignment === elect.type);
          const currentCount = assigned.length;
          const effectiveMax = Math.min(elect.maxPerWeek, limit);
          
          if (currentCount < effectiveMax) {
              assignBlock(
                w, elect.type, elect.duration, 
                (l) => l === 2, 
                0, 
                effectiveMax - currentCount, 
                elect.target, 
                [...assigned]
              );
          }
        }

        // 4c. PGY3 Required Electives (Add Med, Endo, Geri, HPC)
        for (const elect of pgy3Requirements) {
          const assigned = residents.filter(r => newSchedule[r.id][w]?.assignment === elect.type);
          const currentCount = assigned.length;
          const effectiveMax = Math.min(elect.maxPerWeek, limit);
          
          if (currentCount < effectiveMax) {
              assignBlock(
                w, elect.type, elect.duration, 
                (l) => l === 3, 
                0, 
                effectiveMax - currentCount, 
                elect.target, 
                [...assigned]
              );
          }
        }
      }
  }

  // 5. FILL EM (Emergency Medicine)
  // Processed after required electives.
  // Interns have a strict "Up to 4 weeks" target.
  for (let w = 0; w < TOTAL_WEEKS; w++) {
    const assignedResidents = residents.filter(r => 
      newSchedule[r.id][w]?.assignment === emConfig.type
    );

    // --- INTERNS (Target: 4 weeks max) ---
    const currentInterns = assignedResidents.filter(r => r.level === 1);
    let filledInterns = assignBlock(
        w, emConfig.type, emConfig.duration, 
        (l) => l === 1, 
        Math.max(0, emConfig.minInterns - currentInterns.length),
        Math.max(0, emConfig.maxInterns - currentInterns.length),
        emConfig.internTarget, // <--- TARGET APPLIED: "Up to 4 weeks"
        [...assignedResidents]
    );
    
    // Fallback for coverage
    const totalInternsNow = currentInterns.length + filledInterns;
    if (totalInternsNow < emConfig.minInterns) {
         let needed = emConfig.minInterns - totalInternsNow;
         for (let d = emConfig.duration - 1; d >= 1; d--) {
            if (needed <= 0) break;
            needed -= assignBlock(w, emConfig.type, d, (l) => l === 1, needed, needed, emConfig.internTarget, [...assignedResidents]);
         }
    }

    // --- SENIORS (Standard Logic) ---
    const currentSeniors = assignedResidents.filter(r => r.level > 1);
    let filledSeniors = assignBlock(
        w, emConfig.type, emConfig.duration, 
        (l) => l > 1, 
        Math.max(0, emConfig.minSeniors - currentSeniors.length),
        Math.max(0, emConfig.maxSeniors - currentSeniors.length),
        undefined, // Seniors don't have this strict cap mentioned
        [...assignedResidents]
    );
    
    const totalSeniorsNow = currentSeniors.length + filledSeniors;
    if (totalSeniorsNow < emConfig.minSeniors) {
         let needed = emConfig.minSeniors - totalSeniorsNow;
         for (let d = emConfig.duration - 1; d >= 1; d--) {
            if (needed <= 0) break;
            needed -= assignBlock(w, emConfig.type, d, (l) => l > 1, needed, needed, undefined, [...assignedResidents]);
         }
    }
  }

  // 6. FILL GAPS WITH GENERIC ELECTIVES
  residents.forEach(r => {
    for (let w = 0; w < TOTAL_WEEKS; w++) {
        if (!newSchedule[r.id][w].assignment) {
            newSchedule[r.id][w] = { assignment: AssignmentType.ELECTIVE, locked: false };
        }
    }
  });

  return newSchedule;
};

export const calculateStats = (residents: Resident[], schedule: ScheduleGrid): ScheduleStats => {
  const stats: ScheduleStats = {};
  
  // Create safe default object
  const createDefaultStats = () => ({
      [AssignmentType.WARDS_RED]: 0,
      [AssignmentType.WARDS_BLUE]: 0,
      [AssignmentType.ICU]: 0,
      [AssignmentType.NIGHT_FLOAT]: 0,
      [AssignmentType.EM]: 0,
      [AssignmentType.CLINIC]: 0,
      [AssignmentType.ELECTIVE]: 0,
      [AssignmentType.VACATION]: 0,
      [AssignmentType.MET_WARDS]: 0,
      [AssignmentType.CARDS]: 0,
      [AssignmentType.ID]: 0,
      [AssignmentType.NEPH]: 0,
      [AssignmentType.PULM]: 0,
      [AssignmentType.METRO]: 0,
      [AssignmentType.ONC]: 0,
      [AssignmentType.NEURO]: 0,
      [AssignmentType.RHEUM]: 0,
      [AssignmentType.ADD_MED]: 0,
      [AssignmentType.ENDO]: 0,
      [AssignmentType.GERI]: 0,
      [AssignmentType.HPC]: 0,
      [AssignmentType.RESEARCH]: 0,
      [AssignmentType.CCMA]: 0,
      [AssignmentType.HF]: 0,
      [AssignmentType.CC_ICU]: 0,
      [AssignmentType.ENT]: 0,
  });

  residents.forEach(r => {
    stats[r.id] = createDefaultStats();

    if (schedule[r.id]) {
      schedule[r.id].forEach(cell => {
        if (cell.assignment && stats[r.id][cell.assignment] !== undefined) {
          stats[r.id][cell.assignment]++;
        }
      });
    }
  });

  return stats;
};