import { Resident, ScheduleGrid, AssignmentType, ScheduleCell, ScheduleStats, CohortFairnessMetrics, RequirementViolation, WeeklyViolation, ResidentFairnessMetrics } from '../types';
import { TOTAL_WEEKS, COHORT_COUNT, ROTATION_METADATA, CORE_TYPES, REQUIRED_TYPES, ELECTIVE_TYPES, VACATION_TYPE, REQUIREMENTS } from '../constants';

/**
 * Helper: Check if a block can be placed without hitting a locked cell or already assigned cell
 */
const canFitBlock = (schedule: ScheduleGrid, residentId: string, start: number, duration: number): boolean => {
  if (start < 0 || start + duration > TOTAL_WEEKS) return false;
  const row = schedule[residentId];
  if (!row) return false;
  for (let i = 0; i < duration; i++) {
    const cell = row[start + i];
    // A block fits if all cells are null (unassigned) and not locked
    if (cell && (cell.assignment !== null || cell.locked)) return false;
  }
  return true;
};

/**
 * Helper: Place an assignment block with bounds safety
 */
const placeBlock = (schedule: ScheduleGrid, residentId: string, start: number, duration: number, type: AssignmentType) => {
  if (!schedule[residentId]) {
    schedule[residentId] = Array(TOTAL_WEEKS).fill(null).map(() => ({ assignment: null, locked: false }));
  }
  for (let i = 0; i < duration; i++) {
    const weekIdx = start + i;
    if (weekIdx < TOTAL_WEEKS) {
        schedule[residentId][weekIdx] = { assignment: type, locked: false };
    }
  }
};

const shuffle = <T>(array: T[]): T[] => [...array].sort(() => Math.random() - 0.5);

/**
 * Helper: Is this type a Wards rotation? (Including overflow)
 */
const isWards = (type: AssignmentType | null) => 
    type === AssignmentType.WARDS_RED || 
    type === AssignmentType.WARDS_BLUE || 
    type === AssignmentType.MET_WARDS;

/**
 * Helper: Is this type an ICU rotation? (Including overflow)
 */
const isICU = (type: AssignmentType | null) => 
    type === AssignmentType.ICU || 
    type === AssignmentType.METRO;

/**
 * Helper: Get the current count of weeks for a specific requirement type
 */
const getRequirementCount = (row: ScheduleCell[], type: AssignmentType): number => {
    if (!row) return 0;
    if (isWards(type)) {
        return row.filter(c => c && isWards(c.assignment)).length;
    }
    if (isICU(type)) {
        return row.filter(c => c && isICU(c.assignment)).length;
    }
    return row.filter(c => c && c.assignment === type).length;
};

/**
 * Main Scheduling Engine
 */
const generateSingleAttempt = (residents: Resident[], existingSchedule: ScheduleGrid): ScheduleGrid => {
  const newSchedule: ScheduleGrid = {};

  // Initialize all residents
  residents.forEach(r => {
    const existingRow = existingSchedule[r.id];
    if (existingRow && existingRow.length === TOTAL_WEEKS) {
        newSchedule[r.id] = existingRow.map(cell => (cell && cell.locked) ? { ...cell } : { assignment: null, locked: false });
    } else {
        newSchedule[r.id] = Array(TOTAL_WEEKS).fill(null).map(() => ({ assignment: null, locked: false }));
    }
    
    // 4+1 Clinic Logic
    for (let w = 0; w < TOTAL_WEEKS; w++) {
      const isMyClinicWeek = (w % 5 === r.cohort);
      if (isMyClinicWeek) {
        newSchedule[r.id][w] = { assignment: AssignmentType.CLINIC, locked: true };
      } else if (newSchedule[r.id][w]?.assignment === AssignmentType.CLINIC) {
        newSchedule[r.id][w] = { assignment: null, locked: false };
      }
    }
  });

  const findBestBalancedWindow = (resident: Resident, types: AssignmentType[], duration: number): { start: number, type: AssignmentType } => {
    let bestStart = -1;
    let bestType: AssignmentType = types[0];
    let minCost = Infinity;

    const candidates: number[] = [];
    for (let w = 0; w <= TOTAL_WEEKS - duration; w++) {
        if (canFitBlock(newSchedule, resident.id, w, duration)) {
            candidates.push(w);
        }
    }

    if (candidates.length === 0) return { start: -1, type: types[0] };

    shuffle(candidates).forEach(w => {
        const windowStartOffset = (resident.cohort + 1) % 5;
        const relativeStart = (w % 5 >= windowStartOffset) ? (w % 5 - windowStartOffset) : (w % 5 + 5 - windowStartOffset);
        
        let alignmentPenalty = 0;
        if (duration === 2) {
            if (relativeStart === 1) alignmentPenalty = 50; 
        }

        types.forEach(type => {
            let currentLevelLoad = 0;
            for (let i = 0; i < duration; i++) {
                currentLevelLoad += residents.filter(r => 
                    newSchedule[r.id]?.[w + i]?.assignment === type && 
                    (resident.level === 1 ? r.level === 1 : r.level > 1)
                ).length;
            }

            const totalCost = currentLevelLoad + alignmentPenalty;

            if (totalCost < minCost) {
                minCost = totalCost;
                bestStart = w;
                bestType = type;
            }
        });
    });

    return { start: bestStart, type: bestType };
  };

  // Phase 1: Core Staffing
  const coreStaffingTypes = [
      AssignmentType.ICU, 
      AssignmentType.WARDS_RED, 
      AssignmentType.WARDS_BLUE, 
      AssignmentType.NIGHT_FLOAT, 
      AssignmentType.EM
  ];
  
  for (let w = 0; w < TOTAL_WEEKS; w++) {
    shuffle(coreStaffingTypes).forEach(type => {
      const meta = ROTATION_METADATA[type];
      if (!meta) return;
      const duration = meta.duration || 4;

      let safety = 0;
      while (safety < 15) {
        const currentlyAssigned = residents.filter(r => newSchedule[r.id]?.[w]?.assignment === type);
        let interns = currentlyAssigned.filter(r => r.level === 1).length;
        let seniors = currentlyAssigned.filter(r => r.level > 1).length;

        const needsIntern = interns < meta.minInterns;
        const needsSenior = seniors < meta.minSeniors;

        if (!needsIntern && !needsSenior) break;

        const candidate = shuffle(residents).find(r => {
            if (needsIntern && r.level !== 1) return false;
            if (needsSenior && r.level === 1) return false;
            
            // Respect caps (targetIntern, targetSenior, etc.) in Phase 1
            const target = r.level === 1 
                ? meta.targetIntern 
                : (r.level === 2 ? meta.targetPGY2 : meta.targetPGY3) || meta.targetSenior;
            
            if (target !== undefined) {
                const currentCount = getRequirementCount(newSchedule[r.id], type);
                if (currentCount >= target) return false;
            }

            return canFitBlock(newSchedule, r.id, w, duration);
        });

        if (candidate) {
          placeBlock(newSchedule, candidate.id, w, duration, type);
          if (candidate.level === 1) interns++; else seniors++;
        } else break;
        safety++;
      }
    });
  }

  // Phase 2: Graduation Requirements (Priority: PGY1 first to solve intern shortage)
  [1, 2, 3].forEach(level => { // PGY-1 prioritized to claim core clinical weeks
      const pgyRequirements = REQUIREMENTS[level as 1|2|3] || [];
      
      pgyRequirements.forEach(req => {
          shuffle(residents.filter(r => r.level === level)).forEach(res => {
              let currentCount = getRequirementCount(newSchedule[res.id], req.type);
              const meta = ROTATION_METADATA[req.type];
              if (!meta) return;

              const duration = meta.duration;
              
              // Define Primary and Overflow buckets
              let typesToTry = [req.type];
              if (isWards(req.type)) {
                  typesToTry = [AssignmentType.WARDS_RED, AssignmentType.WARDS_BLUE, AssignmentType.MET_WARDS];
              } else if (isICU(req.type)) {
                  typesToTry = [AssignmentType.ICU, AssignmentType.METRO];
              }

              while (currentCount < req.target) {
                  const best = findBestBalancedWindow(res, typesToTry, duration);
                  if (best.start === -1) break;

                  const typeMeta = ROTATION_METADATA[best.type];
                  const currentLevelStaff = residents.filter(r => 
                    newSchedule[r.id]?.[best.start]?.assignment === best.type && 
                    (res.level === 1 ? r.level === 1 : r.level > 1)
                  ).length;
                  
                  const maxAllowed = res.level === 1 ? typeMeta.maxInterns : typeMeta.maxSeniors;

                  if (currentLevelStaff < maxAllowed) {
                      placeBlock(newSchedule, res.id, best.start, duration, best.type);
                      currentCount += duration;
                  } else {
                      // If primary tried and full, this while loop naturally ends or tries next in typesToTry
                      // since findBestBalancedWindow respects staffing logic
                      break;
                  }
              }
          });
      });
  });

  // Final Cleanup: Fill remaining gaps with Electives
  residents.forEach(r => {
    for (let w = 0; w < TOTAL_WEEKS; w++) {
      if (!newSchedule[r.id][w] || newSchedule[r.id][w].assignment === null) {
        newSchedule[r.id][w] = { assignment: AssignmentType.ELECTIVE, locked: false };
      }
    }
  });

  return newSchedule;
};

export const calculateStats = (residents: Resident[], schedule: ScheduleGrid): ScheduleStats => {
  const stats: ScheduleStats = {};
  residents.forEach(r => {
    stats[r.id] = {} as Record<AssignmentType, number>;
    Object.values(AssignmentType).forEach(t => stats[r.id][t] = 0);
    (schedule[r.id] || []).forEach(cell => { if (cell && cell.assignment) stats[r.id][cell.assignment]++; });
  });
  return stats;
};

export const getRequirementViolations = (residents: Resident[], schedule: ScheduleGrid): RequirementViolation[] => {
  const violations: RequirementViolation[] = [];
  residents.forEach(r => {
    const reqs = REQUIREMENTS[r.level] || [];
    reqs.forEach(req => {
      const weeks = schedule[r.id] || [];
      const count = getRequirementCount(weeks, req.type);
      if (count < req.target) {
        violations.push({ residentId: r.id, type: req.type, target: req.target, actual: count });
      }
    });
  });
  return violations;
};

export const calculateRequirementsScore = (residents: Resident[], schedule: ScheduleGrid): number => {
  let totalTargetWeeks = 0;
  let totalActualWeeks = 0;

  residents.forEach(r => {
    const reqs = REQUIREMENTS[r.level] || [];
    reqs.forEach(req => {
      totalTargetWeeks += req.target;
      const weeks = schedule[r.id] || [];
      const count = getRequirementCount(weeks, req.type);
      totalActualWeeks += Math.min(count, req.target);
    });
  });

  if (totalTargetWeeks === 0) return 100;
  return (totalActualWeeks / totalTargetWeeks) * 100;
};

export const getWeeklyViolations = (residents: Resident[], schedule: ScheduleGrid): WeeklyViolation[] => {
  const violations: WeeklyViolation[] = [];
  for (let w = 0; w < TOTAL_WEEKS; w++) {
    Object.values(AssignmentType).forEach(type => {
      const meta = ROTATION_METADATA[type];
      if (!meta || type === AssignmentType.ELECTIVE || type === AssignmentType.CLINIC || type === AssignmentType.VACATION) return;
      
      const assigned = residents.filter(r => schedule[r.id]?.[w]?.assignment === type);
      const interns = assigned.filter(r => r.level === 1).length;
      const seniors = assigned.filter(r => r.level > 1).length;

      if (interns < meta.minInterns) violations.push({ week: w + 1, type, issue: `Min Interns Unmet: ${interns}/${meta.minInterns}` });
      if (seniors < meta.minSeniors) violations.push({ week: w + 1, type, issue: `Min Seniors Unmet: ${seniors}/${meta.minSeniors}` });
      
      if (interns > meta.maxInterns) violations.push({ week: w + 1, type, issue: `Max Interns Exceeded: ${interns}/${meta.maxInterns}` });
      if (seniors > meta.maxSeniors) violations.push({ week: w + 1, type, issue: `Max Seniors Exceeded: ${seniors}/${meta.maxSeniors}` });
    });
  }
  return violations;
};

const calculateSD = (values: number[], mean: number): number => {
    if (values.length === 0) return 0;
    const squareDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
};

export const calculateFairnessMetrics = (residents: Resident[], schedule: ScheduleGrid): CohortFairnessMetrics[] => {
  return [1, 2, 3].map(level => {
    const groupRes = residents.filter(r => r.level === level);
    const resMetrics: ResidentFairnessMetrics[] = groupRes.map(r => {
      const weeks = schedule[r.id] || [];
      let core = 0, elec = 0, req = 0, vac = 0, nf = 0, intensity = 0;
      
      let currentStreak = 0;
      let maxStreak = 0;
      let streakSummary: string[] = [];
      let currentStreakSummary: string[] = [];

      weeks.forEach((c, idx) => {
        if (!c || !c.assignment) return;
        const m = ROTATION_METADATA[c.assignment];
        if (!m) return;
        
        if (CORE_TYPES.includes(c.assignment)) core++;
        if (ELECTIVE_TYPES.includes(c.assignment)) elec++;
        if (REQUIRED_TYPES.includes(c.assignment)) req++;
        if (c.assignment === VACATION_TYPE) vac++;
        if (c.assignment === AssignmentType.NIGHT_FLOAT) nf++;
        intensity += m.intensity;

        if (m.intensity >= 3) {
            currentStreak++;
            currentStreakSummary.push(`${c.assignment} (W${idx+1})`);
            if (currentStreak > maxStreak) {
                maxStreak = currentStreak;
                streakSummary = [...currentStreakSummary];
            }
        } else if (m.intensity < 2) { 
            currentStreak = 0;
            currentStreakSummary = [];
        }
      });

      return { 
          id: r.id, 
          name: r.name, 
          level: r.level as number, 
          coreWeeks: core, 
          electiveWeeks: elec, 
          requiredWeeks: req, 
          vacationWeeks: vac, 
          nightFloatWeeks: nf, 
          totalIntensityScore: intensity, 
          maxIntensityStreak: maxStreak, 
          streakSummary 
      };
    });

    const coreVals = resMetrics.map(m => m.coreWeeks);
    const elecVals = resMetrics.map(m => m.electiveWeeks);
    const intensityVals = resMetrics.map(m => m.totalIntensityScore);

    const meanCore = coreVals.reduce((a, b) => a + b, 0) / (coreVals.length || 1);
    const meanElective = elecVals.reduce((a, b) => a + b, 0) / (elecVals.length || 1);
    const meanIntensity = intensityVals.reduce((a, b) => a + b, 0) / (intensityVals.length || 1);

    const sdCore = calculateSD(coreVals, meanCore);
    const sdElective = calculateSD(elecVals, meanElective);
    const sdIntensity = calculateSD(intensityVals, meanIntensity);

    const cvCore = sdCore / (meanCore || 1);
    const cvIntensity = sdIntensity / (meanIntensity || 1);
    const penalty = (cvCore * 50) + (cvIntensity * 50);
    const fairnessScore = Math.max(0, Math.min(100, Math.round(100 - penalty)));

    return { 
        level, 
        residents: resMetrics, 
        meanCore, 
        sdCore, 
        meanElective, 
        sdElective, 
        meanIntensity, 
        sdIntensity, 
        fairnessScore 
    };
  });
};

export const calculateDiversityStats = (residents: Resident[], schedule: ScheduleGrid): Record<string, number> => {
  const diversity: Record<string, number> = {};
  
  residents.forEach(r => {
      const partners = new Set<string>();
      const clinicalTypes: AssignmentType[] = [
          AssignmentType.WARDS_RED, AssignmentType.WARDS_BLUE, AssignmentType.ICU, 
          AssignmentType.NIGHT_FLOAT, AssignmentType.EM, AssignmentType.CLINIC, 
          AssignmentType.MET_WARDS, AssignmentType.METRO
      ];

      for (let w = 0; w < TOTAL_WEEKS; w++) {
          const myAssign = schedule[r.id]?.[w]?.assignment;
          if (myAssign && clinicalTypes.includes(myAssign)) {
              residents.forEach(peer => {
                  if (peer.id !== r.id && schedule[peer.id]?.[w]?.assignment === myAssign) {
                      partners.add(peer.id);
                  }
              });
          }
      }

      diversity[r.id] = residents.length > 1 
          ? (partners.size / (residents.length - 1)) * 100 
          : 0;
  });

  return diversity;
};

export const calculateScheduleScore = (residents: Resident[], schedule: ScheduleGrid): number => {
  const weeklyViolations = getWeeklyViolations(residents, schedule);
  const reqViolations = getRequirementViolations(residents, schedule);
  const reqScore = calculateRequirementsScore(residents, schedule);
  const fairness = calculateFairnessMetrics(residents, schedule);
  const avgFairness = fairness.reduce((sum, group) => sum + group.fairnessScore, 0) / (fairness.length || 1);

  // Scoring weights:
  // 1. Staffing (Weekly Violations) are highest priority (-50k each)
  // 2. Requirements (PGY Schema) are high priority (100k per 10% coverage)
  // 3. Fairness is a tie-breaker (1k per %)
  
  return 1000000 
    + (avgFairness * 1000)
    + (reqScore * 10000)
    - (weeklyViolations.length * 50000) 
    - (reqViolations.length * 5000); // Penalty for incomplete specific slots
};

export const generateSchedule = (residents: Resident[], existing: ScheduleGrid): ScheduleGrid => {
  return generateSingleAttempt(residents, existing);
};