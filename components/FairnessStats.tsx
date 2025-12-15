import React, { useMemo } from 'react';
import { Resident, ScheduleGrid, AssignmentType } from '../types';
import { ASSIGNMENT_COLORS } from '../constants';
import { AlertCircle, CheckCircle2, Scale } from 'lucide-react';

interface Props {
  residents: Resident[];
  schedule: ScheduleGrid;
}

// Assignments considered "Core Service" vs "Elective" for fairness calculation
// We exclude fixed count assignments (NF, Required Electives)
const CORE_SERVICE_TYPES = [
    AssignmentType.WARDS_RED,
    AssignmentType.WARDS_BLUE,
    AssignmentType.MET_WARDS,
    AssignmentType.ICU,
    AssignmentType.METRO,
    AssignmentType.CC_ICU,
    AssignmentType.EM // EM is somewhat flexible
];

const GENERAL_ELECTIVE_TYPE = AssignmentType.ELECTIVE;
const VACATION_TYPE = AssignmentType.VACATION;

export const FairnessStats: React.FC<Props> = ({ residents, schedule }) => {
  
  const stats = useMemo(() => {
    // 1. Calculate raw counts per resident
    const residentCounts = residents.map(r => {
        let coreWeeks = 0;
        let electiveWeeks = 0;
        let vacationWeeks = 0;

        (schedule[r.id] || []).forEach(cell => {
            if (CORE_SERVICE_TYPES.includes(cell.assignment)) {
                coreWeeks++;
            } else if (cell.assignment === GENERAL_ELECTIVE_TYPE) {
                electiveWeeks++;
            } else if (cell.assignment === VACATION_TYPE) {
                vacationWeeks++;
            }
        });

        return {
            ...r,
            coreWeeks,
            electiveWeeks,
            vacationWeeks
        };
    });

    // 2. Group by PGY and calculate stats
    const pgyGroups = [1, 2, 3].map(level => {
        const group = residentCounts.filter(r => r.level === level);
        
        // Calculate Means
        const meanCore = group.reduce((sum, r) => sum + r.coreWeeks, 0) / group.length;
        const meanElective = group.reduce((sum, r) => sum + r.electiveWeeks, 0) / group.length;

        // Calculate StDev (Population)
        const varianceCore = group.reduce((sum, r) => sum + Math.pow(r.coreWeeks - meanCore, 2), 0) / group.length;
        const sdCore = Math.sqrt(varianceCore);

        const varianceElective = group.reduce((sum, r) => sum + Math.pow(r.electiveWeeks - meanElective, 2), 0) / group.length;
        const sdElective = Math.sqrt(varianceElective);

        // Fairness Score: 100% - (CV_Core + CV_Elective)/2 * 100 roughly
        // We use a simplified metric: Score = 1 - (SD / Mean). 
        // If Mean is small, this explodes, so we dampen.
        // Actually, let's just use 100 - (SD * 2). If SD is 1 week, score drops by 2 points.
        
        // A standard deviation of 0 is perfect (100%).
        // A standard deviation of 2 weeks is concerning (80%).
        // Let's arbitrarily map: Score = Math.max(0, 100 - (sdCore * 10) - (sdElective * 5))
        const fairnessScore = Math.round(Math.max(0, 100 - (sdCore * 8) - (sdElective * 4)));

        return {
            level,
            residents: group,
            meanCore,
            sdCore,
            meanElective,
            sdElective,
            fairnessScore
        };
    });

    return pgyGroups;
  }, [residents, schedule]);

  const getScoreColor = (score: number) => {
      if (score >= 90) return 'text-green-600 bg-green-50 border-green-200';
      if (score >= 75) return 'text-orange-600 bg-orange-50 border-orange-200';
      return 'text-red-600 bg-red-50 border-red-200';
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Scale className="w-6 h-6 text-blue-600" />
                Schedule Fairness Analysis
            </h2>
            <p className="mt-2 text-gray-600">
                This report analyzes the distribution of <strong>Service Weeks</strong> (Wards, ICU, EM) and <strong>Flexible Elective Weeks</strong> within each PGY cohort.
                <br/>
                Assignments with fixed quotas (Night Float, Required Clinics, Required Specialty Rotations) are excluded to focus on variable workload inequality.
            </p>
        </div>

        {stats.map(group => (
            <div key={group.level} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-lg font-bold text-gray-800">PGY-{group.level} Cohort</h3>
                    <div className={`px-4 py-1.5 rounded-full border font-bold text-sm flex items-center gap-2 ${getScoreColor(group.fairnessScore)}`}>
                        {group.fairnessScore >= 90 ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}
                        Fairness Score: {group.fairnessScore}%
                    </div>
                </div>

                <div className="p-6">
                    <div className="grid grid-cols-2 gap-8 mb-6">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Service Weeks (Avg)</div>
                            <div className="text-2xl font-bold text-gray-800">{group.meanCore.toFixed(1)} <span className="text-sm font-normal text-gray-500">± {group.sdCore.toFixed(2)}</span></div>
                            <div className="text-xs text-gray-500 mt-1">Target is minimal deviation from mean</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                            <div className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Elective Weeks (Avg)</div>
                            <div className="text-2xl font-bold text-gray-800">{group.meanElective.toFixed(1)} <span className="text-sm font-normal text-gray-500">± {group.sdElective.toFixed(2)}</span></div>
                            <div className="text-xs text-gray-500 mt-1">Higher deviation implies unequal flexibility</div>
                        </div>
                    </div>

                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-xs text-gray-500 border-b border-gray-100">
                                <th className="text-left py-2 font-medium">Resident</th>
                                <th className="text-right py-2 font-medium">Service Weeks</th>
                                <th className="text-right py-2 font-medium">Elective Weeks</th>
                                <th className="text-right py-2 font-medium">Vacation</th>
                                <th className="text-right py-2 font-medium">Deviation</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {group.residents.map(r => {
                                // Calculate total deviation from group means
                                const dev = Math.abs(r.coreWeeks - group.meanCore) + Math.abs(r.electiveWeeks - group.meanElective);
                                const isOutlier = dev > 3; // Arbitrary threshold

                                return (
                                    <tr key={r.id} className="hover:bg-gray-50">
                                        <td className="py-3 font-medium text-gray-900">{r.name}</td>
                                        <td className="py-3 text-right text-gray-600">
                                            {r.coreWeeks}
                                            <span className="text-xs text-gray-400 ml-1">
                                                ({(r.coreWeeks - group.meanCore) > 0 ? '+' : ''}{(r.coreWeeks - group.meanCore).toFixed(1)})
                                            </span>
                                        </td>
                                        <td className="py-3 text-right text-gray-600">
                                            {r.electiveWeeks}
                                            <span className="text-xs text-gray-400 ml-1">
                                                ({(r.electiveWeeks - group.meanElective) > 0 ? '+' : ''}{(r.electiveWeeks - group.meanElective).toFixed(1)})
                                            </span>
                                        </td>
                                        <td className="py-3 text-right text-gray-400">{r.vacationWeeks}</td>
                                        <td className="py-3 text-right">
                                            {isOutlier && (
                                                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold">
                                                    High Dev
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        ))}

      </div>
    </div>
  );
};