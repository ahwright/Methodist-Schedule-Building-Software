import React, { useState } from 'react';
import { Resident, ScheduleGrid, AssignmentType } from '../types';
import { TOTAL_WEEKS, ASSIGNMENT_LABELS, ASSIGNMENT_COLORS } from '../constants';

interface Props {
  residents: Resident[];
  schedule: ScheduleGrid;
}

const WEEKS = Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1);

// Helper to extract base color (bg-color-200) from Tailwind string and make it stronger
const getBaseColorStyle = (assignment: AssignmentType, count: number, max: number): React.CSSProperties => {
  if (count === 0) return { backgroundColor: '#ffffff' };
  
  // Create a heat map opacity based on count/max
  // We can't easily parse Tailwind classes in JS, so we'll use a hardcoded mapping for base hues
  // or just use opacity on a dark base.
  // For simplicity and aesthetics, let's map assignments to base hex colors matching constants.ts
  const colorMap: Record<AssignmentType, string> = {
    [AssignmentType.WARDS_RED]: '#fca5a5', // red-300
    [AssignmentType.WARDS_BLUE]: '#93c5fd', // blue-300
    [AssignmentType.ICU]: '#d8b4fe', // purple-300
    [AssignmentType.NIGHT_FLOAT]: '#a5b4fc', // indigo-300
    [AssignmentType.EM]: '#fdba74', // orange-300
    [AssignmentType.CLINIC]: '#fde047', // yellow-300
    [AssignmentType.ELECTIVE]: '#86efac', // green-300
    [AssignmentType.VACATION]: '#e5e7eb', // gray-200
    [AssignmentType.MET_WARDS]: '#5eead4', // teal-300
    [AssignmentType.CARDS]: '#fda4af',
    [AssignmentType.ID]: '#bef264',
    [AssignmentType.NEPH]: '#fcd34d',
    [AssignmentType.PULM]: '#67e8f9',
    [AssignmentType.METRO]: '#e879f9',
    [AssignmentType.ONC]: '#f9a8d4',
    [AssignmentType.NEURO]: '#a78bfa',
    [AssignmentType.RHEUM]: '#6ee7b7',
    [AssignmentType.ADD_MED]: '#d6d3d1',
    [AssignmentType.ENDO]: '#ffedd5',
    [AssignmentType.GERI]: '#cbd5e1',
    [AssignmentType.HPC]: '#bae6fd',
    [AssignmentType.RESEARCH]: '#e2e8f0',
    [AssignmentType.CCMA]: '#fce7f3',
    [AssignmentType.HF]: '#fee2e2',
    [AssignmentType.CC_ICU]: '#fecdd3',
    [AssignmentType.ENT]: '#99f6e4',
  };

  const baseHex = colorMap[assignment] || '#ccc';
  const intensity = Math.min(1, 0.3 + (count / Math.max(1, max)) * 0.7);

  return {
    backgroundColor: baseHex,
    opacity: intensity,
    color: '#1f2937' // gray-800
  };
};

export const AssignmentStats: React.FC<Props> = ({ residents, schedule }) => {
  const [tooltip, setTooltip] = useState<{x: number, y: number, assignees: Resident[], type: string} | null>(null);

  // Group data
  const data: Record<AssignmentType, Resident[][]> = {} as any;
  const maxCounts: Record<AssignmentType, number> = {} as any;

  Object.values(AssignmentType).forEach(type => {
    data[type] = Array(TOTAL_WEEKS).fill([]);
    maxCounts[type] = 0;
  });

  for (let w = 0; w < TOTAL_WEEKS; w++) {
    residents.forEach(r => {
      const type = schedule[r.id]?.[w]?.assignment;
      if (type) {
        data[type][w] = [...(data[type][w] || []), r];
      }
    });
    
    // Update max counts for heat scaling
    Object.values(AssignmentType).forEach(type => {
      if (data[type][w].length > maxCounts[type]) {
        maxCounts[type] = data[type][w].length;
      }
    });
  }

  const handleMouseEnter = (e: React.MouseEvent, type: AssignmentType, weekIdx: number) => {
    const assignees = data[type][weekIdx];
    if (assignees.length === 0) return;

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltip({
      x: rect.left + window.scrollX + rect.width / 2,
      y: rect.top + window.scrollY,
      assignees,
      type: ASSIGNMENT_LABELS[type]
    });
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden relative">
       <div className="p-4 bg-gray-50 border-b">
         <h2 className="text-lg font-bold text-gray-800">Assignment Heatmap</h2>
         <p className="text-sm text-gray-500">View staffing levels for each assignment type across the year.</p>
       </div>
       
       <div className="flex-1 overflow-auto spreadsheet-container pb-10">
         <table className="border-separate border-spacing-0 w-max">
           <thead className="sticky top-0 z-30 bg-gray-50 text-xs text-gray-500 font-semibold h-10 shadow-sm">
             <tr>
               <th className="sticky left-0 z-40 bg-white border-b border-r px-4 py-2 text-left min-w-[200px]">Assignment</th>
               {WEEKS.map(w => (
                 <th key={w} className="border-b border-gray-200 min-w-[30px] text-center w-8 text-[10px]">
                   {w}
                 </th>
               ))}
             </tr>
           </thead>
           <tbody className="text-xs">
             {Object.values(AssignmentType).map(type => (
               <tr key={type} className="hover:bg-gray-50">
                 <td className="sticky left-0 z-20 bg-white border-b border-r px-4 py-2 font-medium text-gray-700 whitespace-nowrap">
                   {ASSIGNMENT_LABELS[type]}
                 </td>
                 {WEEKS.map((w, i) => {
                   const assignees = data[type][i];
                   const count = assignees.length;
                   const style = getBaseColorStyle(type, count, maxCounts[type]);

                   return (
                     <td 
                        key={i} 
                        className="border-b border-gray-100 text-center cursor-default relative p-0"
                        onMouseEnter={(e) => handleMouseEnter(e, type, i)}
                        onMouseLeave={() => setTooltip(null)}
                     >
                       {count > 0 && (
                         <div className="w-full h-8 flex items-center justify-center font-bold" style={style}>
                           {count}
                         </div>
                       )}
                     </td>
                   );
                 })}
               </tr>
             ))}
           </tbody>
         </table>
       </div>

       {tooltip && (
        <div 
            className="fixed z-50 bg-gray-900 text-white text-xs rounded-lg py-3 px-4 shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full mt-[-8px] min-w-[200px]"
            style={{ left: tooltip.x, top: tooltip.y }}
        >
            <div className="font-bold text-sm mb-2 border-b border-gray-700 pb-1">{tooltip.type}</div>
            
            <div className="space-y-2">
                {[1, 2, 3].map(pgy => {
                    const pgyGroup = tooltip.assignees.filter(r => r.level === pgy);
                    if (pgyGroup.length === 0) return null;
                    return (
                        <div key={pgy}>
                            <div className="text-[10px] uppercase text-gray-400 font-bold mb-0.5">PGY-{pgy} ({pgyGroup.length})</div>
                            <div className="flex flex-wrap gap-1">
                                {pgyGroup.map(r => (
                                    <span key={r.id} className="bg-gray-700 px-1.5 py-0.5 rounded text-[10px]">
                                        {r.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
            
            {/* Arrow */}
            <div className="absolute left-1/2 -bottom-1 w-2 h-2 bg-gray-900 transform -translate-x-1/2 rotate-45"></div>
        </div>
      )}
    </div>
  );
};