import React, { useMemo } from 'react';
import { Resident, ScheduleGrid, AssignmentType, ScheduleCell } from '../types';
import { TOTAL_WEEKS, ASSIGNMENT_COLORS, ASSIGNMENT_LABELS } from '../constants';
import { User, Lock, Calendar } from 'lucide-react';

interface Props {
  residents: Resident[];
  schedule: ScheduleGrid;
  onCellClick: (residentId: string, week: number) => void;
}

const WEEKS = Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1);

// Helper to get date string for headers (approximate based on July 1 start)
const getDateForWeek = (weekNum: number) => {
  const start = new Date(new Date().getFullYear(), 6, 1); // July 1st
  start.setDate(start.getDate() + (weekNum - 1) * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${start.getMonth()+1}/${start.getDate()} - ${end.getMonth()+1}/${end.getDate()}`;
};

export const ScheduleTable: React.FC<Props> = ({ residents, schedule, onCellClick }) => {
  
  return (
    <div className="flex flex-col h-full bg-white border rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-auto spreadsheet-container relative flex-1 pb-10">
        <table className="border-collapse w-max">
          <thead className="sticky top-0 z-20 bg-gray-50 text-xs uppercase text-gray-500 font-semibold shadow-sm">
            <tr>
              <th className="sticky left-0 z-30 bg-gray-50 border-b border-r border-gray-200 p-2 min-w-[200px] text-left">
                Trainee
              </th>
              {WEEKS.map((w) => (
                <th key={w} className="border-b border-gray-200 p-1 min-w-[80px] text-center bg-gray-50">
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
            {residents.map((resident) => {
              const residentSchedule = schedule[resident.id] || [];
              
              return (
                <tr key={resident.id} className="hover:bg-gray-50 transition-colors">
                  <td className="sticky left-0 z-10 bg-white border-b border-r border-gray-200 p-2 font-medium text-gray-900 group">
                    <div className="flex flex-col">
                      <span className="flex items-center gap-2">
                        {resident.name}
                      </span>
                      <span className="text-xs text-gray-400">
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
                      >
                         <div className={`
                            w-full h-10 flex items-center justify-center rounded text-xs font-medium px-1 transition-all
                            ${colorClass}
                            ${cell?.locked ? 'ring-2 ring-gray-400' : ''}
                         `}>
                           {assign ? (
                             <>
                               {assign === AssignmentType.WARDS_RED && "W-Red"}
                               {assign === AssignmentType.WARDS_BLUE && "W-Blue"}
                               {assign === AssignmentType.ICU && "ICU"}
                               {assign === AssignmentType.NIGHT_FLOAT && "NF"}
                               {assign === AssignmentType.EM && "EM"}
                               {assign === AssignmentType.CLINIC && "CCIM"}
                               {assign === AssignmentType.ELECTIVE && "Elec"}
                               {assign === AssignmentType.VACATION && "Vac"}
                               {assign === AssignmentType.MET_WARDS && "Met"}
                               {cell?.locked && <Lock size={10} className="absolute top-1 right-1 opacity-50" />}
                             </>
                           ) : (
                             <span className="text-gray-300">-</span>
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
    </div>
  );
};