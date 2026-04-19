
import { Resident, ScheduleGrid, AssignmentType, AdaptationParams, ScheduleCell } from '../types';
import { TOTAL_WEEKS, ROTATION_METADATA, REQUIREMENTS } from '../constants';

// Helper to check if a cell is modifiable based on settings
const isModifiable = (cell: ScheduleCell, params: AdaptationParams): boolean => {
    if (cell.locked) return false;
    if (cell.assignment === null) return true;
    if (cell.assignment === AssignmentType.ELECTIVE) return true;
    if (params.allowResearchOverride && cell.assignment === AssignmentType.RESEARCH) return true;
    if (params.allowVacationOverride && cell.assignment === AssignmentType.VACATION) return true;
    return false;
};

// Helper to check capacity for a specific assignment at a specific block starting at `week`
const hasCapacityForBlock = (
    schedule: ScheduleGrid, 
    residents: Resident[], 
    type: AssignmentType, 
    startWeek: number,
    duration: number,
    level: number
): boolean => {
    const meta = ROTATION_METADATA[type];
    if (!meta) return true;

    for (let w = startWeek; w < startWeek + duration; w++) {
        if (w >= TOTAL_WEEKS) return false;
        const assigned = residents.filter(r => schedule[r.id]?.[w]?.assignment === type);
        const count = assigned.filter(r => r.level === (level === 1 ? 1 : r.level)).length; 
        const limit = level === 1 ? meta.maxInterns : meta.maxSeniors;
        if (count >= limit) return false;
    }
    return true;
};

// Check if a block of weeks is modifiable
const isBlockModifiable = (row: ScheduleCell[], start: number, duration: number, params: AdaptationParams): boolean => {
    if (start + duration > TOTAL_WEEKS) return false;
    for (let i = 0; i < duration; i++) {
        if (!row[start + i] || !isModifiable(row[start + i], params)) return false;
    }
    return true;
};

export const adaptSchedule = (
    residents: Resident[], 
    currentSchedule: ScheduleGrid, 
    params: AdaptationParams
): { newSchedule: ScheduleGrid, changesMade: number, failureReasons: string[], plannedChanges: string[] } => {
    
    // Deep copy to modify
    const schedule: ScheduleGrid = JSON.parse(JSON.stringify(currentSchedule));
    let changes = 0;
    const failureReasons: string[] = [];
    const plannedChanges: string[] = [];

    // 1. FIX MISSING REQUIREMENTS
    if (params.fillMissingReqs) {
        residents.forEach(r => {
            const reqs = REQUIREMENTS[r.level] || [];
            reqs.forEach(req => {
                const meta = ROTATION_METADATA[req.type];
                if (!meta) return;

                const duration = meta.duration || 2;
                const currentCount = schedule[r.id]?.filter(c => c.assignment === req.type).length || 0;
                let missingBlocks = Math.ceil((req.target - currentCount) / duration);
                
                if (missingBlocks > 0) {
                    for (let w = TOTAL_WEEKS - duration; w >= 0 && missingBlocks > 0; w--) {
                        if (isBlockModifiable(schedule[r.id], w, duration, params)) {
                            if (hasCapacityForBlock(schedule, residents, req.type, w, duration, r.level)) {
                                for (let i = 0; i < duration; i++) {
                                    schedule[r.id][w + i] = { assignment: req.type, locked: false };
                                }
                                plannedChanges.push(`Filled ${duration}w of ${req.label} for ${r.name} (W${w+1})`);
                                missingBlocks--;
                                changes += duration;
                            }
                        }
                    }
                    if (missingBlocks > 0) {
                        failureReasons.push(`${r.name}: Could not find enough ${duration}w blocks for ${req.label}.`);
                    }
                }
            });
        });
    }

    // 2. FIX UNDERSTAFFING (Min Constraints)
    if (params.fixUnderstaffing) {
        for (let w = 0; w < TOTAL_WEEKS; w++) {
            const types = Object.values(AssignmentType);
            for (const type of types) {
                const meta = ROTATION_METADATA[type];
                if (!meta || type === AssignmentType.ELECTIVE) continue;

                const duration = meta.duration || 2;
                const assignedResidents = residents.filter(r => schedule[r.id]?.[w]?.assignment === type);
                
                // Check Interns
                const internCount = assignedResidents.filter(r => r.level === 1).length;
                if (internCount < meta.minInterns) {
                    let needed = meta.minInterns - internCount;
                    const candidates = residents.filter(r => 
                        r.level === 1 && 
                        isBlockModifiable(schedule[r.id], w, duration, params)
                    );
                    
                    for (const cand of candidates) {
                        if (needed <= 0) break;
                        for (let i = 0; i < duration; i++) {
                            schedule[cand.id][w + i] = { assignment: type, locked: false };
                        }
                        plannedChanges.push(`Moved ${cand.name} to ${meta.label} block starting W${w+1}`);
                        needed--;
                        changes += duration;
                    }
                }

                // Check Seniors
                const seniorCount = assignedResidents.filter(r => r.level > 1).length;
                if (seniorCount < meta.minSeniors) {
                    let needed = meta.minSeniors - seniorCount;
                    const candidates = residents.filter(r => 
                        r.level > 1 && 
                        isBlockModifiable(schedule[r.id], w, duration, params)
                    ).sort((a,b) => a.level - b.level);

                    for (const cand of candidates) {
                        if (needed <= 0) break;
                        for (let i = 0; i < duration; i++) {
                            schedule[cand.id][w + i] = { assignment: type, locked: false };
                        }
                        plannedChanges.push(`Moved ${cand.name} to ${meta.label} block starting W${w+1}`);
                        needed--;
                        changes += duration;
                    }
                }
            }
        }
    }

    // 3. FIX OVERSTAFFING (Max Constraints)
    if (params.fixOverstaffing) {
        for (let w = 0; w < TOTAL_WEEKS; w++) {
            const types = Object.values(AssignmentType);
            for (const type of types) {
                const meta = ROTATION_METADATA[type];
                if (!meta || type === AssignmentType.ELECTIVE) continue;

                const assignedResidents = residents.filter(r => schedule[r.id]?.[w]?.assignment === type);
                
                // Interns
                const interns = assignedResidents.filter(r => r.level === 1);
                if (interns.length > meta.maxInterns) {
                    let excess = interns.length - meta.maxInterns;
                    const candidates = interns.filter(r => !schedule[r.id][w].locked);
                    for (const cand of candidates) {
                        if (excess <= 0) break;
                        const duration = 1;
                        for (let i = 0; i < duration; i++) {
                            if (!schedule[cand.id][w+i].locked) {
                                schedule[cand.id][w + i] = { assignment: AssignmentType.ELECTIVE, locked: false };
                            }
                        }
                        plannedChanges.push(`Moved ${cand.name} from ${meta.label} to Elective starting W${w+1}`);
                        excess--;
                        changes += duration;
                    }
                }

                // Seniors
                const seniors = assignedResidents.filter(r => r.level > 1);
                if (seniors.length > meta.maxSeniors) {
                    let excess = seniors.length - meta.maxSeniors;
                    const candidates = seniors.filter(r => !schedule[r.id][w].locked).sort((a,b) => a.level - b.level);
                    for (const cand of candidates) {
                        if (excess <= 0) break;
                        const duration = 1;
                        for (let i = 0; i < duration; i++) {
                             if (!schedule[cand.id][w+i].locked) {
                                schedule[cand.id][w + i] = { assignment: AssignmentType.ELECTIVE, locked: false };
                             }
                        }
                        plannedChanges.push(`Moved ${cand.name} from ${meta.label} to Elective starting W${w+1}`);
                        excess--;
                        changes += duration;
                    }
                }
            }
        }
    }

    // FINAL CLEANUP: Fill any remaining nulls with Electives
    residents.forEach(r => {
        for (let w = 0; w < TOTAL_WEEKS; w++) {
            if (!schedule[r.id][w] || schedule[r.id][w].assignment === null) {
                schedule[r.id][w] = { assignment: AssignmentType.ELECTIVE, locked: false };
            }
        }
    });

    return { newSchedule: schedule, changesMade: changes, failureReasons, plannedChanges };
};
