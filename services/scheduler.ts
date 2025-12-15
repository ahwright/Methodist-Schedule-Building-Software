import { Resident, ScheduleGrid, AssignmentType, ScheduleCell, ScheduleStats, CohortFairnessMetrics, ResidentFairnessMetrics } from '../types';
import { TOTAL_WEEKS, COHORT_COUNT, ROTATION_METADATA, CORE_TYPES, REQUIRED_TYPES, ELECTIVE_TYPES, VACATION_TYPE } from '../constants';

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

// Check intensity of adjacent weeks to prevent burnout
const checkIntensityBalance = (
    schedule: ScheduleGrid,
    residentId: string,
    startWeek: number,
    duration: number,
    currentIntensity: number
): number => {
    let penalty = 0;
    
    // Check week immediately before
    const prevWeek = startWeek - 1;
    if (prevWeek >= 0) {
        const prevAssign = schedule[residentId][prevWeek].assignment;
        if (prevAssign) {
            const prevInt = ROTATION_METADATA[prevAssign].intensity;
            if (prevInt >= 3 && currentIntensity >= 3) {
                penalty += 100 * (prevInt + currentIntensity); 
            }
        }
    }

    // Check week immediately after
    const nextWeek = startWeek + duration;
    if (nextWeek < TOTAL_WEEKS) {
        const nextAssign = schedule[residentId][nextWeek].assignment;
        if (nextAssign) {
            const nextInt = ROTATION_METADATA[nextAssign].intensity;
            if (nextInt >= 3 && currentIntensity >= 3) {
                penalty += 100 * (nextInt + currentIntensity);
            }
        }
    }
    
    return penalty;
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

  // Helper to calculate unmet requirements for a resident
  // Updated to include Short Reqs so Preservation Mode is more effective
  const getUnmetReqs = (r: Resident): number => {
      let unmet = 0;
      let reqs: AssignmentType[] = [];
      
      if (r.level === 1) {
          reqs = [
              AssignmentType.CARDS, 
              AssignmentType.ID, 
              AssignmentType.NEPH, 
              AssignmentType.PULM,
              AssignmentType.EM
          ]; 
      } else if (r.level === 2) {
          reqs = [AssignmentType.ONC, AssignmentType.NEURO, AssignmentType.RHEUM];
      } else if (r.level === 3) {
          reqs = [AssignmentType.ADD_MED, AssignmentType.ENDO, AssignmentType.GERI, AssignmentType.HPC];
      }
      
      for (const t of reqs) {
          const meta = ROTATION_METADATA[t];
          let target = undefined;
          if (r.level === 1) target = meta.targetIntern;
          else if (r.level === 2) target = meta.targetPGY2 ?? meta.targetSenior;
          else target = meta.targetPGY3 ?? meta.targetSenior;

          if (target) {
             const current = getCount(newSchedule, r.id, t);
             if (current < target) unmet += (target - current);
          }
      }
      return unmet;
  };

  // HELPER: Assign Block
  // Returns number of residents successfully assigned to this block
  const assignBlock = (
    week: number, 
    type: AssignmentType, 
    duration: number, 
    levelFilter: (l: number) => boolean,
    minNeeded: number, 
    maxAllowed: number, 
    targetWeeks: number | ((r: Resident) => number) | undefined,
    currentAssigned: Resident[],
    preservationMode: boolean = false // If true, prioritize residents who have FEWER unmet long requirements (saving those who need them)
  ): number => {
    let filledCount = 0;
    const meta = ROTATION_METADATA[type];
    
    // Safety check: Don't exceed TOTAL (Interns + Seniors) maximum for the rotation
    const totalMaxPossible = meta.maxInterns + meta.maxSeniors;
    if (currentAssigned.length >= totalMaxPossible) {
        return 0; 
    }

    // Determine Candidates
    // We do NOT loop fallback durations here. This function tries ONE duration.
    // Fallback logic is handled by the caller phases.
    
    // PHASE A: Prioritize Meeting Minimums (Target Logic)
    while (filledCount < minNeeded) {
      if (currentAssigned.length >= totalMaxPossible) break;

      const candidates = residents.filter(r => 
        levelFilter(r.level) && 
        isAvailableForBlock(newSchedule, r.id, week, duration)
      );

      if (candidates.length === 0) break;

      candidates.sort((a, b) => {
        const countA = getCount(newSchedule, a.id, type);
        const countB = getCount(newSchedule, b.id, type);
        
        // Dynamic Target Logic
        const targetA = typeof targetWeeks === 'function' ? targetWeeks(a) : targetWeeks;
        const targetB = typeof targetWeeks === 'function' ? targetWeeks(b) : targetWeeks;

        // Priority 1: Has NOT met target vs Has met target (For specific type being assigned)
        if (targetA !== undefined && targetB !== undefined) {
          const aMet = countA >= targetA;
          const bMet = countB >= targetB;
          if (!aMet && bMet) return -1; // Pick A
          if (aMet && !bMet) return 1;  // Pick B
        }

        // Priority 1.5: Preservation Mode (For Service Blocks)
        // If we are assigning a generic service block (like Wards), pick the person who DOESN'T need to save a slot for Requirements.
        if (preservationMode) {
            const unmetA = getUnmetReqs(a);
            const unmetB = getUnmetReqs(b);
            // If A has fewer unmet reqs, A is "safer" to use for Wards. B needs to be saved.
            // Sort Ascending by unmet reqs.
            if (unmetA !== unmetB) return unmetA - unmetB;
        }

        // Priority 2: Conflict Avoidance
        const aConflicts = currentAssigned.some(existing => a.avoidResidentIds.includes(existing.id) || existing.avoidResidentIds.includes(a.id));
        const bConflicts = currentAssigned.some(existing => b.avoidResidentIds.includes(existing.id) || existing.avoidResidentIds.includes(b.id));
        if (aConflicts && !bConflicts) return 1;
        if (!aConflicts && bConflicts) return -1;

        // Priority 3: Intensity Balance
        const penaltyA = checkIntensityBalance(newSchedule, a.id, week, duration, meta.intensity);
        const penaltyB = checkIntensityBalance(newSchedule, b.id, week, duration, meta.intensity);
        if (penaltyA !== penaltyB) return penaltyA - penaltyB;

        // Priority 4: Total Count (Balance)
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

    // PHASE B: Fill Extra Capacity (Up to Max)
    // Only runs if we haven't hit maxAllowed yet
    while (filledCount < maxAllowed) {
      if (currentAssigned.length >= totalMaxPossible) break;

      const candidates = residents.filter(r => {
        if (!levelFilter(r.level)) return false;
        if (!isAvailableForBlock(newSchedule, r.id, week, duration)) return false;
        
        // Strict Target Check for "Extra" filling
        // If we are filling beyond minimum needs, we should NOT pick someone who has already met their target
        // unless there is no target defined.
        const target = typeof targetWeeks === 'function' ? targetWeeks(r) : targetWeeks;
        if (target !== undefined) {
           const current = getCount(newSchedule, r.id, type);
           if (current + duration > target) return false;
        }
        return true;
      });

      if (candidates.length === 0) break;

      candidates.sort((a, b) => {
        const countA = getCount(newSchedule, a.id, type);
        const countB = getCount(newSchedule, b.id, type);
        
        // Preservation Mode (Service Blocks)
        if (preservationMode) {
            const unmetA = getUnmetReqs(a);
            const unmetB = getUnmetReqs(b);
            if (unmetA !== unmetB) return unmetA - unmetB;
        }

        // Conflicts
        const aConflicts = currentAssigned.some(existing => a.avoidResidentIds.includes(existing.id) || existing.avoidResidentIds.includes(a.id));
        const bConflicts = currentAssigned.some(existing => b.avoidResidentIds.includes(existing.id) || existing.avoidResidentIds.includes(b.id));
        if (aConflicts && !bConflicts) return 1;
        if (!aConflicts && bConflicts) return -1;

        // Intensity
        const penaltyA = checkIntensityBalance(newSchedule, a.id, week, duration, meta.intensity);
        const penaltyB = checkIntensityBalance(newSchedule, b.id, week, duration, meta.intensity);
        if (penaltyA !== penaltyB) return penaltyA - penaltyB;
        
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

  // ---------------------------------------------------------------------------
  // NEW ORDER OF OPERATIONS (REQ PRIORITY)
  // 1. Clinic
  // 2. Core Minimums (NF, ICU, Wards) - [Preservation Mode Active]
  // 3. Long Reqs (Cards, Onc) - 4 weeks
  // 4. Short Reqs (ID, Neph, Pulm) - 2 weeks [MOVED UP]
  // 5. EM Minimums (1 intern)
  // 6. EM Capacity (2 interns)
  // 7. Core Capacity (Wards/ICU)
  // ---------------------------------------------------------------------------

  const shuffledWeeks = Array.from({length: TOTAL_WEEKS}, (_, i) => i).sort(() => Math.random() - 0.5);

  // PHASE 2: CORE MINIMUMS - NIGHT FLOAT, WARDS & ICU (4 WEEKS)
  // This happens first to ensure hospital is staffed. 
  // We include NF here as a service requirement (min coverage), not a target requirement.
  const coreLongBlocks = [
    AssignmentType.NIGHT_FLOAT, // Prioritize NF staffing
    AssignmentType.ICU, 
    AssignmentType.WARDS_RED, 
    AssignmentType.WARDS_BLUE
  ];
  
  // Sequential for consistent coverage check
  for (let w = 0; w < TOTAL_WEEKS; w++) {
    for (const type of coreLongBlocks) {
      const meta = ROTATION_METADATA[type];
      
      // Need fresh assignment list for every sub-step to ensure accurate caps
      let assignedResidents = residents.filter(r => newSchedule[r.id][w]?.assignment === type);

      // Interns
      let currentInterns = assignedResidents.filter(r => r.level === 1);
      if (currentInterns.length < meta.minInterns) {
          let needed = meta.minInterns - currentInterns.length;
          
          // Try full block first (Priority)
          // We ENABLE preservationMode=true here to save interns who need Reqs from being used for Wards coverage if others are available
          let filled = assignBlock(w, type, meta.duration, (l) => l === 1, needed, needed, meta.targetIntern, [...assignedResidents], true);
          
          // Fallback: Fragment if necessary for COVERAGE
          if (filled < needed) {
              let remaining = needed - filled;
              assignedResidents = residents.filter(r => newSchedule[r.id][w]?.assignment === type); 
              
              for (let d = meta.duration - 1; d >= 1; d--) {
                  if (remaining <= 0) break;
                  // Fallback fragments also try to preserve if possible, but coverage is key
                  const newFilled = assignBlock(w, type, d, (l) => l === 1, remaining, remaining, undefined, [...assignedResidents], true);
                  remaining -= newFilled;
                  assignedResidents = residents.filter(r => newSchedule[r.id][w]?.assignment === type);
              }
          }
      }

      // Seniors
      assignedResidents = residents.filter(r => newSchedule[r.id][w]?.assignment === type);
      const currentSeniors = assignedResidents.filter(r => r.level > 1);
      
      if (currentSeniors.length < meta.minSeniors) {
          let needed = meta.minSeniors - currentSeniors.length;
          // Try full block - Seniors also have long reqs (Onc/Neuro/Rheum) so enable preservationMode
          let filled = assignBlock(w, type, meta.duration, (l) => l > 1, needed, needed, meta.targetSenior, [...assignedResidents], true);
          
          // Fallback
          if (filled < needed) {
              let remaining = needed - filled;
              assignedResidents = residents.filter(r => newSchedule[r.id][w]?.assignment === type);
              
              for (let d = meta.duration - 1; d >= 1; d--) {
                  if (remaining <= 0) break;
                  const newFilled = assignBlock(w, type, d, (l) => l > 1, remaining, remaining, undefined, [...assignedResidents], true);
                  remaining -= newFilled;
                  assignedResidents = residents.filter(r => newSchedule[r.id][w]?.assignment === type);
              }
          }
      }
    }
  }

  // PHASE 3: REQUIRED ELECTIVES - 4 WEEKS (Long Blocks)
  const longElectives = [
      { type: AssignmentType.CARDS, level: 1 },
      { type: AssignmentType.ONC, level: 2 },
      { type: AssignmentType.NEURO, level: 2 },
      { type: AssignmentType.RHEUM, level: 2 },
  ];

  const concurrencyPasses = [1, 10]; 

  for (const limit of concurrencyPasses) {
      for (const w of shuffledWeeks) {
          for (const req of longElectives) {
              const meta = ROTATION_METADATA[req.type];
              const assigned = residents.filter(r => newSchedule[r.id][w]?.assignment === req.type);
              
              const maxForLevel = req.level === 1 ? meta.maxInterns : meta.maxSeniors;
              const target = req.level === 1 ? meta.targetIntern : meta.targetSenior;
              
              const effectiveMax = Math.min(maxForLevel, limit);
              if (assigned.length < effectiveMax) {
                 assignBlock(w, req.type, meta.duration, (l) => l === req.level, 0, effectiveMax - assigned.length, target, [...assigned]);
              }
          }
      }
  }

  // PHASE 4: SHORT REQUIRED ELECTIVES (2 WEEKS) - MOVED BEFORE EM
  const shortElectives = [
      { type: AssignmentType.ID, level: 1 },
      { type: AssignmentType.NEPH, level: 1 },
      { type: AssignmentType.PULM, level: 1 },
      
      { type: AssignmentType.ADD_MED, level: 3 },
      { type: AssignmentType.ENDO, level: 3 },
      { type: AssignmentType.GERI, level: 3 },
      { type: AssignmentType.HPC, level: 3 },
  ];

  for (const limit of concurrencyPasses) {
      for (const w of shuffledWeeks) {
          for (const req of shortElectives) {
              const meta = ROTATION_METADATA[req.type];
              const assigned = residents.filter(r => newSchedule[r.id][w]?.assignment === req.type);
              
              const maxForLevel = req.level === 1 ? meta.maxInterns : meta.maxSeniors;
              const target = req.level === 1 ? meta.targetIntern : meta.targetSenior;
              
              const effectiveMax = Math.min(maxForLevel, limit);
              if (assigned.length < effectiveMax) {
                 assignBlock(w, req.type, meta.duration, (l) => l === req.level, 0, effectiveMax - assigned.length, target, [...assigned]);
              }
          }
      }
  }

  // PHASE 5: EMERGENCY MEDICINE (2 WEEKS)
  const emMeta = ROTATION_METADATA[AssignmentType.EM];
  
  // Step 5a: Minimum Coverage (Ensure 1 intern per week)
  for (let w = 0; w < TOTAL_WEEKS; w++) {
      let assigned = residents.filter(r => newSchedule[r.id][w]?.assignment === AssignmentType.EM);
      let interns = assigned.filter(r => r.level === 1);
      
      if (interns.length < emMeta.minInterns) {
          let needed = emMeta.minInterns - interns.length;
          // Try 2 weeks with TARGET CHECK
          let filled = assignBlock(w, AssignmentType.EM, emMeta.duration, (l) => l === 1, needed, needed, emMeta.targetIntern, [...assigned]);
          
          if (filled < needed) {
             // Fallback 1: Try 1 week with TARGET CHECK
             let partialFilled = assignBlock(w, AssignmentType.EM, 1, (l) => l === 1, needed - filled, needed - filled, emMeta.targetIntern, [...assigned]);
             filled += partialFilled;
          }

          if (filled < needed) {
             // Fallback 2: EMERGENCY - IGNORE TARGETS (Coverage Critical)
             let remaining = needed - filled;
             // assigned array needs refresh? No, assignBlock updates newSchedule directly, but we pass local array 'assigned' for conflict checks.
             // We should re-fetch if we are desperate, but array spread is usually okay for small nums.
             assignBlock(w, AssignmentType.EM, 1, (l) => l === 1, remaining, remaining, undefined, [...assigned]);
          }
      }
  }

  // Step 5b: Fill EM Capacity/Targets (Up to maxInterns, usually 2)
  for (const w of shuffledWeeks) {
      const assigned = residents.filter(r => newSchedule[r.id][w]?.assignment === AssignmentType.EM);
      const interns = assigned.filter(r => r.level === 1);
      
      // Only fill if we have room AND people need targets met
      if (interns.length < emMeta.maxInterns) {
          assignBlock(w, AssignmentType.EM, emMeta.duration, (l) => l === 1, 0, emMeta.maxInterns - interns.length, emMeta.targetIntern, [...assigned]);
      }
  }

  // PHASE 6: CORE MAXIMUMS (Capacity Fill) - STRICT BLOCKS ONLY
  // Wards/ICU are good "sponges" for remaining time.
  const spongeServices = [AssignmentType.ICU, AssignmentType.WARDS_RED, AssignmentType.WARDS_BLUE];

  for (const w of shuffledWeeks) { 
      for (const type of spongeServices) {
        const meta = ROTATION_METADATA[type];
        
        let assignedResidents = residents.filter(r => newSchedule[r.id][w]?.assignment === type);
        const currentInterns = assignedResidents.filter(r => r.level === 1);
        assignBlock(w, type, meta.duration, (l) => l === 1, 0, Math.max(0, meta.maxInterns - currentInterns.length), meta.targetIntern, [...assignedResidents]);
  
        assignedResidents = residents.filter(r => newSchedule[r.id][w]?.assignment === type);
        const currentSeniors = assignedResidents.filter(r => r.level > 1);
        assignBlock(w, type, meta.duration, (l) => l > 1, 0, Math.max(0, meta.maxSeniors - currentSeniors.length), meta.targetSenior, [...assignedResidents]);
      }
  }

  // 7. FILL GAPS WITH GENERIC ELECTIVES
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

  residents.forEach(r => {
    const residentStats: Record<AssignmentType, number> = {} as any;
    // Initialize all types to 0
    Object.values(AssignmentType).forEach(t => {
      residentStats[t] = 0;
    });

    const weeks = schedule[r.id];
    if (weeks) {
      weeks.forEach(cell => {
        if (cell.assignment) {
          residentStats[cell.assignment] = (residentStats[cell.assignment] || 0) + 1;
        }
      });
    }

    stats[r.id] = residentStats;
  });

  return stats;
};

export const calculateFairnessMetrics = (residents: Resident[], schedule: ScheduleGrid): CohortFairnessMetrics[] => {
  // Helper to calculate SD
  const getSD = (arr: number[], mean: number) => {
    if (arr.length === 0) return 0;
    const variance = arr.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
  };

  // Group by level
  const levels = [1, 2, 3];
  const metrics: CohortFairnessMetrics[] = levels.map(level => {
    const levelResidents = residents.filter(r => r.level === level);
    
    const residentMetrics: ResidentFairnessMetrics[] = levelResidents.map(r => {
      let core = 0;
      let elective = 0;
      let required = 0;
      let vacation = 0;
      let intensityScore = 0;
      let currentStreak = 0;
      let maxStreak = 0;

      const weeks = schedule[r.id] || [];
      weeks.forEach(cell => {
        if (!cell.assignment) return;
        
        const type = cell.assignment;
        const meta = ROTATION_METADATA[type];
        
        // Categories
        if (CORE_TYPES.includes(type)) core++;
        else if (REQUIRED_TYPES.includes(type)) required++;
        else if (ELECTIVE_TYPES.includes(type)) elective++;
        
        if (type === VACATION_TYPE) vacation++;

        // Intensity
        if (meta) {
          intensityScore += meta.intensity;
          if (meta.intensity >= 3) {
            currentStreak++;
          } else {
            maxStreak = Math.max(maxStreak, currentStreak);
            currentStreak = 0;
          }
        }
      });
      maxStreak = Math.max(maxStreak, currentStreak);

      return {
        id: r.id,
        name: r.name,
        level: r.level,
        coreWeeks: core,
        electiveWeeks: elective,
        requiredWeeks: required,
        vacationWeeks: vacation,
        totalIntensityScore: intensityScore,
        maxIntensityStreak: maxStreak
      };
    });

    // Calculate Means
    const cores = residentMetrics.map(m => m.coreWeeks);
    const electives = residentMetrics.map(m => m.electiveWeeks);
    const intensities = residentMetrics.map(m => m.totalIntensityScore);

    const meanCore = cores.length ? cores.reduce((a, b) => a + b, 0) / cores.length : 0;
    const meanElective = electives.length ? electives.reduce((a, b) => a + b, 0) / electives.length : 0;
    const meanIntensity = intensities.length ? intensities.reduce((a, b) => a + b, 0) / intensities.length : 0;

    const sdCore = getSD(cores, meanCore);
    const sdElective = getSD(electives, meanElective);
    const sdIntensity = getSD(intensities, meanIntensity);

    // Heuristic Score (100 - Penalties)
    // Penalize high SD
    let score = 100 - (sdCore * 5) - (sdElective * 2) - (sdIntensity * 0.5);
    score = Math.max(0, Math.min(100, score));

    return {
      level,
      residents: residentMetrics,
      meanCore,
      sdCore,
      meanElective,
      sdElective,
      meanIntensity,
      sdIntensity,
      fairnessScore: Math.round(score)
    };
  });

  return metrics;
};

export const calculateDiversityStats = (residents: Resident[], schedule: ScheduleGrid): Record<string, number> => {
  const scores: Record<string, number> = {};
  const matrix: Record<string, Set<string>> = {};

  residents.forEach(r => matrix[r.id] = new Set());

  // Assignments where interaction occurs
  const interactionTypes = [
    AssignmentType.WARDS_RED,
    AssignmentType.WARDS_BLUE,
    AssignmentType.ICU,
    AssignmentType.NIGHT_FLOAT,
    AssignmentType.EM,
    AssignmentType.MET_WARDS,
    AssignmentType.METRO,
    AssignmentType.CC_ICU,
    AssignmentType.CLINIC
  ];

  for (let w = 0; w < TOTAL_WEEKS; w++) {
    const teams: Record<string, string[]> = {};

    residents.forEach(r => {
      const type = schedule[r.id]?.[w]?.assignment;
      if (type && interactionTypes.includes(type)) {
        if (!teams[type]) teams[type] = [];
        teams[type].push(r.id);
      }
    });

    Object.values(teams).forEach(members => {
      if (members.length < 2) return;
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          matrix[members[i]].add(members[j]);
          matrix[members[j]].add(members[i]);
        }
      }
    });
  }

  residents.forEach(r => {
    const uniquePartners = matrix[r.id].size;
    const totalPossible = residents.length - 1;
    scores[r.id] = totalPossible > 0 ? (uniquePartners / totalPossible) * 100 : 0;
  });

  return scores;
};
