import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Resident, ScheduleGrid, AssignmentType, ScheduleCell } from '../types';
import { TOTAL_WEEKS, ASSIGNMENT_COLORS, ASSIGNMENT_LABELS, ASSIGNMENT_ABBREVIATIONS } from '../constants';
import { User, Lock, Calendar, SortAsc, Users, GraduationCap, Layers, Filter, Pencil } from 'lucide-react';
import { SortKey } from '../App';

interface Props {
  residents: Resident[];
  schedule: ScheduleGrid;
  sortKey: SortKey;
  onSortKeyChange: (key: SortKey) => void;
  onCellClick: (residentId: string, week: number) => void;
  onLockWeek: (weekIdx: number) => void;
  onLockResident: (residentId: string) => void;
  onToggleLock: (residentId: string, weekIdx: number) => void;
  onRenameResident?: (id: string, newName: string) => void;
}

const WEEKS = Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1);

const getDateForWeek = (weekNum: number) => {
  const start = new Date(new Date().getFullYear(), 6, 1);
  start.setDate(start.getDate() + (weekNum - 1) * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${start.getMonth()+1}/${start.getDate()} - ${end.getMonth()+1}/${end.getDate()}`;
};

interface TooltipData {
  x: number;
  y: number;
  assignmentName: string;
  progress: string;
  peers: Resident[];
}

export const ScheduleTable: React.FC<Props> = ({ 
  residents, 
  schedule, 
  sortKey,
  onSortKeyChange,
  onCellClick,
  onLockWeek,
  onLockResident,
  onToggleLock,
  onRenameResident
}) => {
  // Resizable Column State
  const [colWidth, setColWidth] = useState(160);
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  // Renaming State
  const [editingResidentId, setEditingResidentId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Tooltip State
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingResidentId && editInputRef.current) {
        editInputRef.current.focus();
        editInputRef.current.select();
    }
  }, [editingResidentId]);

  // Handle Resizing
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); 
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
    const newWidth = Math.max(80, Math.min(600, startWidthRef.current + diff));
    setColWidth(newWidth);
  };

  const handleMouseUp = () => {
    resizingRef.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
  };

  // Sort Logic
  const sortedResidents = useMemo(() => {
    const list = [...residents];
    return list.sort((a, b) => {
      if (sortKey === 'alphabetical') {
        return a.name.localeCompare(b.name);
      }
      if (sortKey === 'pgy') {
        if (a.level !== b.level) return a.level - b.level;
        return a.name.localeCompare(b.name);
      }
      if (sortKey === 'cohort') {
        if (a.cohort !== b.cohort) return a.cohort - b.cohort;
        if (a.level !== b.level) return a.level - b.level;
        return a.name.localeCompare(b.name);
      }
      return 0;
    });
  }, [residents, sortKey]);

  // Tooltip Logic
  const handleMouseEnter = (e: React.MouseEvent, resident: Resident, weekIdx: number, assignment: AssignmentType) => {
    if (!assignment) return;

    const residentSchedule = schedule[resident.id] || [];
    const totalWeeks = residentSchedule.filter(c => c && c.assignment === assignment).length;
    const currentWeekNum = residentSchedule.slice(0, weekIdx + 1).filter(c => c && c.assignment === assignment).length;

    const peers = residents
      .filter(r => r.id !== resident.id && schedule[r.id]?.[weekIdx]?.assignment === assignment);

    const rect = (e.target as HTMLElement).getBoundingClientRect();

    setTooltip({
      x: rect.left + window.scrollX + rect.width / 2,
      y: rect.top + window.scrollY,
      assignmentName: ASSIGNMENT_LABELS[assignment],
      progress: `Week ${currentWeekNum} of ${totalWeeks}`,
      peers
    });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  const startRenaming = (resident: Resident) => {
    setEditingResidentId(resident.id);
    setTempName(resident.name);
  };

  const saveRenaming = () => {
    if (editingResidentId && onRenameResident) {
        onRenameResident(editingResidentId, tempName);
    }
    setEditingResidentId(null);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveRenaming();
    if (e.key === 'Escape') setEditingResidentId(null);
  };

  return (
    <div className="flex flex-col h-full bg-white border rounded-lg shadow-sm overflow-hidden relative">
      {/* View Toolbar */}
      <div className="px-4 py-2 border-b bg-gray-50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
            <Filter size={14} /> View mode:
          </div>
          <div className="flex bg-white rounded-md border p-1 gap-1 shadow-sm">
            <button 
              onClick={() => onSortKeyChange('pgy')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition-all ${sortKey === 'pgy' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <GraduationCap size={14} /> PGY Year
            </button>
            <button 
              onClick={() => onSortKeyChange('cohort')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition-all ${sortKey === 'cohort' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <Layers size={14} /> Cohort
            </button>
            <button 
              onClick={() => onSortKeyChange('alphabetical')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition-all ${sortKey === 'alphabetical' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <SortAsc size={14} /> Alphabetical
            </button>
          </div>
        </div>
        <div className="text-[10px] text-gray-400 italic">
          * Double-click name to rename. Right-click name or week header to toggle locks.
        </div>
      </div>

      <div className="overflow-auto spreadsheet-container relative flex-1 pb-64">
        <table className="border-separate border-spacing-0 w-max">
          <thead className="sticky top-0 z-30 bg-gray-50 text-xs uppercase text-gray-500 font-semibold shadow-sm h-12">
            <tr>
              <th 
                className="sticky left-0 z-40 p-0 border-b border-r border-gray-200 text-left align-middle bg-white/80 backdrop-blur-md transition-all"
                style={{ width: colWidth, minWidth: colWidth, maxWidth: colWidth }}
              >
                <div className="flex items-center justify-between h-full px-2 relative">
                  <span>Trainee</span>
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-600 transition-colors z-50"
                    onMouseDown={startResize}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </th>
              {WEEKS.map((w, idx) => (
                <th 
                    key={w} 
                    className="border-b border-gray-200 p-1 min-w-[80px] text-center bg-gray-50 cursor-context-menu hover:bg-blue-50 transition-colors"
                    onContextMenu={(e) => {
                        e.preventDefault();
                        onLockWeek(idx);
                    }}
                    title="Right-click to toggle lock for this week"
                >
                  <div className="flex flex-col items-center">
                    <span>W{w}</span>
                    <span className="text-[9px] font-normal text-gray-400 normal-case">
                      {getDateForWeek(w)}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-sm">
            {sortedResidents.map((resident) => {
              const residentSchedule = schedule[resident.id] || [];
              const isEditing = editingResidentId === resident.id;

              return (
                <tr key={resident.id} className="hover:bg-gray-50 transition-colors">
                  <td 
                    className="sticky left-0 z-20 border-b border-r border-gray-200 p-2 font-medium text-gray-900 group bg-white/80 backdrop-blur-md cursor-context-menu hover:bg-blue-50 transition-colors"
                    style={{ width: colWidth, minWidth: colWidth, maxWidth: colWidth }}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        onLockResident(resident.id);
                    }}
                    onDoubleClick={() => startRenaming(resident)}
                    title={`Double-click to rename, Right-click to toggle lock`}
                  >
                    <div className="flex flex-col truncate relative pr-6">
                      {isEditing ? (
                        <input
                            ref={editInputRef}
                            type="text"
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            onBlur={saveRenaming}
                            onKeyDown={handleRenameKeyDown}
                            className="w-full border-blue-500 border-2 rounded px-1 py-0 text-sm focus:outline-none"
                        />
                      ) : (
                        <span className="flex items-center gap-2 truncate" title={resident.name}>
                            {resident.name}
                            <Pencil size={12} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={(e) => { e.stopPropagation(); startRenaming(resident); }} />
                        </span>
                      )}
                      <span className="text-xs text-gray-400 truncate">
                        PGY-{resident.level} • Cohort {String.fromCharCode(65 + resident.cohort)}
                      </span>
                    </div>
                  </td>
                  {WEEKS.map((w, idx) => {
                    const cell = residentSchedule[idx];
                    const assign = cell?.assignment;
                    const colorClass = assign 
                      ? ASSIGNMENT_COLORS[assign] 
                      : 'bg-white';

                    return (
                      <td 
                        key={`${resident.id}-${w}`} 
                        className={`border-b border-gray-100 border-r p-1 text-center cursor-pointer select-none relative ${assign ? '' : 'hover:bg-gray-100'}`}
                        onClick={() => onCellClick(resident.id, idx)}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            onToggleLock(resident.id, idx);
                        }}
                        onMouseEnter={(e) => assign && handleMouseEnter(e, resident, idx, assign)}
                        onMouseLeave={handleMouseLeave}
                        title="Left click to edit, Right click to toggle lock"
                      >
                         <div className={`
                            w-full h-10 flex items-center justify-center rounded text-xs font-medium px-1 transition-all
                            ${colorClass}
                            ${cell?.locked ? 'ring-2 ring-gray-600' : ''}
                         `}>
                           {assign ? (
                             <>
                               <span className="truncate w-full block">
                                 {ASSIGNMENT_ABBREVIATIONS[assign] || assign}
                               </span>
                               {cell?.locked && <Lock size={10} className="absolute top-1 right-1 opacity-70 text-gray-700" />}
                             </>
                           ) : (
                             <>
                                <span className="text-gray-300">-</span>
                                {cell?.locked && <Lock size={10} className="absolute top-1 right-1 opacity-40 text-gray-400" />}
                             </>
                           )}
                         </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {tooltip && (
        <div 
            className="fixed z-[150] bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full mt-[-8px] w-64"
            style={{ left: tooltip.x, top: tooltip.y }}
        >
            <div className="font-bold text-sm mb-1">{tooltip.assignmentName}</div>
            <div className="text-gray-300 mb-2">{tooltip.progress}</div>
            
            {tooltip.peers.length > 0 && (
                <div className="border-t border-gray-700 pt-2 mt-1">
                    <div className="text-gray-400 mb-1 text-[10px] uppercase font-semibold">With:</div>
                    <div className="space-y-1">
                        {[1, 2, 3].map(pgy => {
                            const pgyGroup = tooltip.peers.filter(r => r.level === pgy);
                            if (pgyGroup.length === 0) return null;
                            return (
                                <div key={pgy} className="flex gap-1 items-start">
                                    <span className="text-[10px] text-gray-500 font-bold w-10 shrink-0">PGY-{pgy}:</span>
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
                </div>
            )}
            
            <div className="absolute left-1/2 -bottom-1 w-2 h-2 bg-gray-900 transform -translate-x-1/2 rotate-45"></div>
        </div>
      )}
    </div>
  );
};