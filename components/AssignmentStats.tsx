import React, { useState, useRef } from 'react';
import { Resident, ScheduleGrid, AssignmentType } from '../types';
import { TOTAL_WEEKS, ASSIGNMENT_LABELS, ROTATION_METADATA, ASSIGNMENT_HEX_COLORS } from '../constants';

interface Props {
  residents: Resident[];
  schedule: ScheduleGrid;
}

const WEEKS = Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1);

const getBaseColorStyle = (assignment: AssignmentType, count: number, max: number): React.CSSProperties => {
  if (count === 0) return { backgroundColor: '#ffffff' };
  
  const baseHex = ASSIGNMENT_HEX_COLORS[assignment] || '#ccc';
  const intensity = Math.min(1, 0.3 + (count / Math.max(1, max)) * 0.7);

  return {
    backgroundColor: baseHex,
    opacity: intensity,
    color: '#1f2937' 
  };
};

export const AssignmentStats: React.FC<Props> = ({ residents, schedule }) => {
  // Resizable Column State - Reduced default width
  const [colWidth, setColWidth] = useState(150);
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const [cellTooltip, setCellTooltip] = useState<{x: number, y: number, assignees: Resident[], type: string} | null>(null);
  const [rowTooltip, setRowTooltip] = useState<{x: number, y: number, type: AssignmentType} | null>(null);

  // Handle Resizing
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    startXRef.current = e.pageX;
    startWidthRef.current = colWidth;
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!resizingRef.current) return;
    const diff = e.pageX - startXRef.current;
    // Min Width 100
    const newWidth = Math.max(100, Math.min(600, startWidthRef.current + diff));
    setColWidth(newWidth);
  };

  const handleMouseUp = () => {
    resizingRef.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
  };

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
    
    Object.values(AssignmentType).forEach(type => {
      if (data[type][w].length > maxCounts[type]) {
        maxCounts[type] = data[type][w].length;
      }
    });
  }

  const handleCellEnter = (e: React.MouseEvent, type: AssignmentType, weekIdx: number) => {
    const assignees = data[type][weekIdx];
    if (assignees.length === 0) return;

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setCellTooltip({
      x: rect.left + window.scrollX + rect.width / 2,
      y: rect.top + window.scrollY,
      assignees,
      type: ASSIGNMENT_LABELS[type]
    });
  };

  const handleRowHeaderEnter = (e: React.MouseEvent, type: AssignmentType) => {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setRowTooltip({
          x: rect.right + window.scrollX + 10,
          y: rect.top + window.scrollY,
          type
      });
  };

  const formatMinMax = (min: number, max: number) => {
      if (max > 15) return ''; // Hide range if effectively infinite
      if (min === max) return `${min}`;
      return `${min}-${max}`;
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden relative">
       <div className="p-4 bg-gray-50 border-b">
         <h2 className="text-lg font-bold text-gray-800">Assignment Heatmap</h2>
         <p className="text-sm text-gray-500">View staffing levels vs. constraints. Hover over row headers for rule details.</p>
       </div>
       
       <div className="flex-1 overflow-auto spreadsheet-container pb-10">
         <table className="border-separate border-spacing-0 w-max">
           <thead className="sticky top-0 z-30 bg-gray-50 text-xs text-gray-500 font-semibold h-10 shadow-sm">
             <tr>
               <th 
                 className="sticky left-0 z-40 bg-white/80 backdrop-blur-md border-b border-r p-0 text-left transition-all"
                 style={{ width: colWidth, minWidth: colWidth, maxWidth: colWidth }}
               >
                 <div className="flex items-center justify-between h-full px-3 py-2 relative">
                   <span className="truncate pr-2">Assignment</span>
                   {/* Resize Handle */}
                   <div 
                     className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-600 transition-colors z-50"
                     onMouseDown={startResize}
                   />
                 </div>
               </th>
               {WEEKS.map(w => (
                 <th key={w} className="border-b border-gray-200 min-w-[30px] text-center w-8 text-[10px]">
                   {w}
                 </th>
               ))}
             </tr>
           </thead>
           <tbody className="text-xs">
             {Object.values(AssignmentType).map(type => {
               const meta = ROTATION_METADATA[type];
               const totalMin = meta.minInterns + meta.minSeniors;
               const totalMax = meta.maxInterns + meta.maxSeniors;
               const rangeLabel = formatMinMax(totalMin, totalMax);
               
               return (
               <tr key={type} className="hover:bg-gray-50">
                 <td 
                    className="sticky left-0 z-20 bg-white/80 backdrop-blur-md border-b border-r px-3 py-1 font-medium text-gray-700 whitespace-nowrap cursor-help group transition-all"
                    style={{ width: colWidth, minWidth: colWidth, maxWidth: colWidth }}
                    onMouseEnter={(e) => handleRowHeaderEnter(e, type)}
                    onMouseLeave={() => setRowTooltip(null)}
                 >
                   <div className="flex items-center justify-between overflow-hidden">
                     <span className="truncate">{ASSIGNMENT_LABELS[type]}</span>
                     {rangeLabel && (
                        <span className="text-gray-400 text-[10px] ml-1 font-mono shrink-0">
                            {rangeLabel}
                        </span>
                     )}
                   </div>
                 </td>
                 {WEEKS.map((w, i) => {
                   const assignees = data[type][i];
                   const count = assignees.length;
                   const style = getBaseColorStyle(type, count, maxCounts[type]);

                   return (
                     <td 
                        key={i} 
                        className="border-b border-gray-100 text-center cursor-default relative p-0"
                        onMouseEnter={(e) => handleCellEnter(e, type, i)}
                        onMouseLeave={() => setCellTooltip(null)}
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
             )})}
           </tbody>
         </table>
       </div>

       {/* Cell Tooltip (Assignees) */}
       {cellTooltip && (
        <div 
            className="fixed z-50 bg-gray-900 text-white text-xs rounded-lg py-3 px-4 shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full mt-[-8px] min-w-[200px]"
            style={{ left: cellTooltip.x, top: cellTooltip.y }}
        >
            <div className="font-bold text-sm mb-2 border-b border-gray-700 pb-1">{cellTooltip.type}</div>
            <div className="space-y-2">
                {[1, 2, 3].map(pgy => {
                    const pgyGroup = cellTooltip.assignees.filter(r => r.level === pgy);
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
            <div className="absolute left-1/2 -bottom-1 w-2 h-2 bg-gray-900 transform -translate-x-1/2 rotate-45"></div>
        </div>
      )}

      {/* Row Tooltip (Metadata Constraints) */}
      {rowTooltip && (
        <div 
            className="fixed z-50 bg-white text-gray-800 text-xs rounded-lg shadow-xl border border-gray-200 p-4 pointer-events-none transform -translate-y-1/2 ml-2 min-w-[240px]"
            style={{ left: rowTooltip.x, top: rowTooltip.y }}
        >
            <h4 className="font-bold text-sm text-blue-700 mb-2 border-b pb-1">
                {ASSIGNMENT_LABELS[rowTooltip.type]}
            </h4>
            
            {(() => {
                const meta = ROTATION_METADATA[rowTooltip.type];
                return (
                    <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <span className="text-gray-500">Intensity:</span>
                            <span className="font-bold">{meta.intensity}/5</span>

                            <span className="text-gray-500">Setting:</span>
                            <span className="font-medium">{meta.isOutpatient ? 'Outpatient' : 'Inpatient'}</span>

                            <span className="text-gray-500">Duration:</span>
                            <span className="font-medium">{meta.duration} Weeks</span>
                        </div>

                        <div className="bg-gray-50 p-2 rounded border border-gray-100 mt-2">
                            <div className="text-xs font-bold text-gray-500 uppercase mb-1">Weekly Staffing</div>
                            <div className="flex justify-between">
                                <span>PGY-1:</span>
                                <span className="font-mono">{meta.minInterns} - {meta.maxInterns > 15 ? '∞' : meta.maxInterns}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>PGY-2/3:</span>
                                <span className="font-mono">{meta.minSeniors} - {meta.maxSeniors > 15 ? '∞' : meta.maxSeniors}</span>
                            </div>
                        </div>

                        {(meta.targetIntern !== undefined || meta.targetSenior !== undefined || meta.targetPGY2 !== undefined || meta.targetPGY3 !== undefined) && (
                            <div className="bg-blue-50 p-2 rounded border border-blue-100">
                                <div className="text-xs font-bold text-blue-500 uppercase mb-1">Annual Targets</div>
                                {meta.targetIntern !== undefined && <div>PGY-1: {meta.targetIntern} weeks</div>}
                                {meta.targetPGY2 !== undefined ? (
                                    <div>PGY-2: {meta.targetPGY2} weeks</div>
                                ) : (
                                    meta.targetSenior !== undefined && <div>Seniors: {meta.targetSenior} weeks</div>
                                )}
                                {meta.targetPGY3 !== undefined && <div>PGY-3: {meta.targetPGY3} weeks</div>}
                            </div>
                        )}
                        
                        {meta.notes && (
                            <div className="text-xs text-gray-500 italic mt-2 border-t pt-1">
                                {meta.notes}
                            </div>
                        )}
                    </div>
                );
            })()}
        </div>
      )}
    </div>
  );
};