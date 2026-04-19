
import React, { useMemo, useState } from 'react';
import { Resident, ScheduleGrid, AssignmentType } from '../types';
import { ROTATION_METADATA, TOTAL_WEEKS } from '../constants';
import { Activity, ShieldAlert, CheckCircle2, AlertTriangle, Users, Info, CalendarDays } from 'lucide-react';

interface Props {
  residents: Resident[];
  schedule: ScheduleGrid;
}

interface WeeklyStress {
  week: number;
  availableInterns: number;
  requiredInterns: number;
  internBuffer: number;
  availableSeniors: number;
  requiredSeniors: number;
  seniorBuffer: number;
  activeRotations: { type: AssignmentType; interns: number; seniors: number; minInterns: number; minSeniors: number }[];
  backupInterns: Resident[];
  backupSeniors: Resident[];
}

const MONTH_NAMES = [
  "July", "August", "September", "October", "November", "December",
  "January", "February", "March", "April", "May", "June"
];

// Helper to define week ranges for each month (Starting in July)
const MONTHS_MAPPING = [
  { name: "July", weeks: [1, 2, 3, 4] },
  { name: "August", weeks: [5, 6, 7, 8] },
  { name: "September", weeks: [9, 10, 11, 12, 13] },
  { name: "October", weeks: [14, 15, 16, 17] },
  { name: "November", weeks: [18, 19, 20, 21] },
  { name: "December", weeks: [22, 23, 24, 25, 26] },
  { name: "January", weeks: [27, 28, 29, 30] },
  { name: "February", weeks: [31, 32, 33, 34] },
  { name: "March", weeks: [35, 36, 37, 38, 39] },
  { name: "April", weeks: [40, 41, 42, 43] },
  { name: "May", weeks: [44, 45, 46, 47] },
  { name: "June", weeks: [48, 49, 50, 51, 52] }
];

export const StressTestReport: React.FC<Props> = ({ residents, schedule }) => {
  const [selectedWeek, setSelectedWeek] = useState<number | null>(1);

  const stressData: WeeklyStress[] = useMemo(() => {
    const data: WeeklyStress[] = [];

    for (let w = 0; w < TOTAL_WEEKS; w++) {
      const activeRotations: WeeklyStress['activeRotations'] = [];
      const clinicalTypes = Object.values(AssignmentType).filter(t => 
        ![AssignmentType.CLINIC, AssignmentType.ELECTIVE, AssignmentType.VACATION, AssignmentType.RESEARCH].includes(t)
      );

      let requiredInterns = 0;
      let requiredSeniors = 0;

      clinicalTypes.forEach(type => {
        const meta = ROTATION_METADATA[type];
        if (!meta) return;

        const assigned = residents.filter(r => schedule[r.id]?.[w]?.assignment === type);
        if (assigned.length > 0) {
            const interns = assigned.filter(r => r.level === 1).length;
            const seniors = assigned.filter(r => r.level > 1).length;
            activeRotations.push({
                type,
                interns,
                seniors,
                minInterns: meta.minInterns,
                minSeniors: meta.minSeniors
            });
            requiredInterns += meta.minInterns;
            requiredSeniors += meta.minSeniors;
        }
      });

      const availableInterns = residents.filter(r => 
        r.level === 1 && schedule[r.id]?.[w]?.assignment !== AssignmentType.CLINIC
      ).length;

      const availableSeniors = residents.filter(r => 
        r.level > 1 && schedule[r.id]?.[w]?.assignment !== AssignmentType.CLINIC
      ).length;

      const backupInterns = residents.filter(r => 
        r.level === 1 && [AssignmentType.ELECTIVE, AssignmentType.RESEARCH, AssignmentType.VACATION].includes(schedule[r.id]?.[w]?.assignment)
      );

      const backupSeniors = residents.filter(r => 
        r.level > 1 && [AssignmentType.ELECTIVE, AssignmentType.RESEARCH, AssignmentType.VACATION].includes(schedule[r.id]?.[w]?.assignment)
      );

      data.push({
        week: w + 1,
        availableInterns,
        requiredInterns,
        internBuffer: availableInterns - requiredInterns,
        availableSeniors,
        requiredSeniors,
        seniorBuffer: availableSeniors - requiredSeniors,
        activeRotations,
        backupInterns,
        backupSeniors
      });
    }

    return data;
  }, [residents, schedule]);

  const stats = useMemo(() => {
    const criticalWeeks = stressData.filter(d => d.internBuffer <= 1 || d.seniorBuffer <= 1).length;
    const avgInternBuffer = stressData.reduce((acc, d) => acc + d.internBuffer, 0) / TOTAL_WEEKS;
    const avgSeniorBuffer = stressData.reduce((acc, d) => acc + d.seniorBuffer, 0) / TOTAL_WEEKS;
    const worstWeek = [...stressData].sort((a,b) => a.internBuffer - b.internBuffer)[0];

    return { criticalWeeks, avgInternBuffer, avgSeniorBuffer, worstWeek };
  }, [stressData]);

  const getStatusIcon = (buffer: number) => {
    if (buffer <= 0) return <ShieldAlert size={16} className="text-red-600" />;
    if (buffer <= 1) return <AlertTriangle size={16} className="text-orange-500" />;
    return <CheckCircle2 size={16} className="text-green-500" />;
  };

  const selectedData = stressData.find(d => d.week === selectedWeek);

  return (
    <div className="p-6 h-full overflow-y-auto bg-gray-50 pb-64">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Activity className="w-6 h-6 text-indigo-600" />
                Coverage Help & Program Resilience Audit
            </h2>
            <p className="mt-2 text-gray-600 text-sm">
                This report calculates the "Safety Buffer" for each week. Buffer is the number of residents available (excluding Clinic) minus the minimum interns/seniors required to run core services. 
                <strong> A buffer of 0 means the program is at risk if a single resident calls out.</strong>
            </p>
        </div>

        {/* Executive Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border shadow-sm">
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Critical Weeks</div>
                <div className="text-2xl font-black text-red-600">{stats.criticalWeeks} / 52</div>
                <div className="text-[10px] text-gray-400 mt-1">Buffer of 1 or less</div>
            </div>
            <div className="bg-white p-4 rounded-xl border shadow-sm">
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Avg Intern Buffer</div>
                <div className="text-2xl font-black text-blue-600">+{stats.avgInternBuffer.toFixed(1)}</div>
                <div className="text-[10px] text-gray-400 mt-1">Available vs. Required</div>
            </div>
            <div className="bg-white p-4 rounded-xl border shadow-sm">
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Avg Senior Buffer</div>
                <div className="text-2xl font-black text-purple-600">+{stats.avgSeniorBuffer.toFixed(1)}</div>
                <div className="text-[10px] text-gray-400 mt-1">Available vs. Required</div>
            </div>
            <div className="bg-white p-4 rounded-xl border shadow-sm">
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Worst Staffing Week</div>
                <div className="text-2xl font-black text-orange-600">Week {stats.worstWeek.week}</div>
                <div className="text-[10px] text-gray-400 mt-1">Buffer: {stats.worstWeek.internBuffer} interns</div>
            </div>
        </div>

        {/* Monthly Calendar View */}
        <div className="bg-white p-6 rounded-xl border shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <CalendarDays size={20} className="text-indigo-500" />
                  Annual Coverage Heatmap (Monthly View)
                </h3>
                <div className="flex gap-3 text-[10px] font-bold uppercase tracking-tight text-gray-400">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> Danger</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-orange-400 rounded-sm"></div> Tight</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-400 rounded-sm"></div> Low</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-50 rounded-sm border"></div> Safe</div>
                </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {MONTHS_MAPPING.map(month => (
                <div key={month.name} className="space-y-2">
                  <div className="text-xs font-black uppercase text-gray-400 border-b pb-1 mb-2 tracking-widest">{month.name}</div>
                  <div className="grid grid-cols-3 gap-1">
                    {month.weeks.map(wNum => {
                      const d = stressData[wNum - 1];
                      return (
                        <button 
                          key={wNum} 
                          onClick={() => setSelectedWeek(wNum)}
                          className={`
                              w-8 h-8 rounded border transition-all relative group flex items-center justify-center
                              ${selectedWeek === wNum ? 'ring-2 ring-indigo-500 ring-offset-2 z-10' : 'hover:scale-105'}
                              ${d.internBuffer <= 0 ? 'bg-red-500 border-red-600' : d.internBuffer === 1 ? 'bg-orange-400 border-orange-500' : d.internBuffer === 2 ? 'bg-yellow-400 border-yellow-500' : 'bg-green-50 border-gray-100'}
                          `}
                        >
                          <span className={`text-[9px] font-bold ${d.internBuffer >= 3 ? 'text-gray-400' : 'text-white'}`}>{wNum}</span>
                          {d.internBuffer <= 1 && <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-red-600 rounded-full"></div>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
        </div>

        {/* Drill Down */}
        {selectedData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 duration-300">
                <div className="bg-white p-6 rounded-xl border shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            Week {selectedData.week} Detailed Audit
                        </h3>
                        {getStatusIcon(selectedData.internBuffer)}
                    </div>

                    <div className="space-y-6">
                        {/* Intern Buffer Bar */}
                        <div>
                            <div className="flex justify-between text-xs font-bold mb-2 uppercase">
                                <span className="text-gray-500">Intern Staffing</span>
                                <span className={selectedData.internBuffer <= 1 ? 'text-red-600' : 'text-green-600'}>
                                    Margin: {selectedData.internBuffer} available
                                </span>
                            </div>
                            <div className="flex h-3 w-full rounded-full overflow-hidden bg-gray-100 border">
                                <div className="bg-indigo-600 h-full" style={{ width: `${(selectedData.requiredInterns / (selectedData.availableInterns || 1)) * 100}%` }}></div>
                                <div className="bg-green-200 h-full flex-1"></div>
                            </div>
                            <div className="flex justify-between mt-1 text-[10px] text-gray-400 font-mono">
                                <span>Needed: {selectedData.requiredInterns}</span>
                                <span>In House: {selectedData.availableInterns}</span>
                            </div>
                        </div>

                        {/* Core Rotations Summary */}
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-gray-50 text-gray-400 font-bold uppercase text-[10px]">
                                    <tr>
                                        <th className="p-3">Core Rotation</th>
                                        <th className="p-3 text-center">Interns</th>
                                        <th className="p-3 text-center">Seniors</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {selectedData.activeRotations.map(rot => (
                                        <tr key={rot.type}>
                                            <td className="p-3 font-medium">{rot.type}</td>
                                            <td className="p-3 text-center">
                                                <span className={rot.interns < rot.minInterns ? 'text-red-600 font-bold' : ''}>
                                                    {rot.interns}
                                                </span>
                                                <span className="text-gray-300 ml-1">min {rot.minInterns}</span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={rot.seniors < rot.minSeniors ? 'text-red-600 font-bold' : ''}>
                                                    {rot.seniors}
                                                </span>
                                                <span className="text-gray-300 ml-1">min {rot.minSeniors}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Backup / Call-Out Resilience */}
                <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-2">
                        <Users size={20} className="text-indigo-600" />
                        Coverage Help (Reserve Pool)
                    </h3>
                    <p className="text-xs text-gray-500 mb-6 italic">In case of illness, these residents are currently on flexible rotations and could be reassigned.</p>
                    
                    <div className="space-y-4 flex-1">
                        <div>
                            <div className="text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">Intern Reserve ({selectedData.backupInterns.length})</div>
                            <div className="flex flex-wrap gap-1.5">
                                {selectedData.backupInterns.length > 0 ? selectedData.backupInterns.map(r => (
                                    <div key={r.id} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-[10px] font-medium border border-blue-100 flex items-center gap-1">
                                        {r.name}
                                    </div>
                                )) : <div className="text-red-500 text-[10px] font-bold">ZERO INTERN RESERVE</div>}
                            </div>
                        </div>

                        <div>
                            <div className="text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">Senior Reserve ({selectedData.backupSeniors.length})</div>
                            <div className="flex flex-wrap gap-1.5">
                                {selectedData.backupSeniors.length > 0 ? selectedData.backupSeniors.map(r => (
                                    <div key={r.id} className="bg-purple-50 text-purple-700 px-2 py-1 rounded text-[10px] font-medium border border-purple-100 flex items-center gap-1">
                                        {r.name}
                                    </div>
                                )) : <div className="text-red-500 text-[10px] font-bold">ZERO SENIOR RESERVE</div>}
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 p-3 bg-indigo-900 text-white rounded-lg flex gap-3 items-start shadow-inner">
                        <Info size={16} className="shrink-0 mt-0.5 text-indigo-300" />
                        <div className="text-[10px] leading-relaxed">
                            <strong>Note:</strong> Residents in Clinic (Cohort {(selectedData.week - 1) % 5}) are excluded from reserve lists as clinic cannot be easily cancelled.
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
