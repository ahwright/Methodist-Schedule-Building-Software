import React, { useMemo, useState } from 'react';
import { Resident, ScheduleGrid, AssignmentType } from '../types';
import { ArrowUpDown } from 'lucide-react';

interface Props {
  residents: Resident[];
  schedule: ScheduleGrid;
}

type StatRow = {
  id: string;
  name: string;
  level: number;
  uniqueCount: number;
  totalPossible: number;
  percent: number;
  maxOverlapWeeks: number;
  maxOverlapName: string;
};

export const RelationshipStats: React.FC<Props> = ({ residents, schedule }) => {
  const stats = useMemo(() => {
    // 1. Build Interaction Matrix
    const interactions: Record<string, Record<string, number>> = {};
    residents.forEach(r => interactions[r.id] = {});

    // Define which assignments count as "working together"
    const relevantTypes = [
      AssignmentType.WARDS_RED,
      AssignmentType.WARDS_BLUE,
      AssignmentType.ICU,
      AssignmentType.NIGHT_FLOAT,
      AssignmentType.EM,
      AssignmentType.CLINIC,
      AssignmentType.MET_WARDS
    ];

    for (let w = 0; w < 52; w++) {
      const byAssignment: Record<string, string[]> = {};
      
      residents.forEach(r => {
        const type = schedule[r.id]?.[w]?.assignment;
        if (type && relevantTypes.includes(type)) {
          if (!byAssignment[type]) byAssignment[type] = [];
          byAssignment[type].push(r.id);
        }
      });

      Object.values(byAssignment).forEach(group => {
        if (group.length < 2) return;
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const r1 = group[i];
            const r2 = group[j];
            interactions[r1][r2] = (interactions[r1][r2] || 0) + 1;
            interactions[r2][r1] = (interactions[r2][r1] || 0) + 1;
          }
        }
      });
    }

    // 2. Aggregate per resident
    const rows: StatRow[] = residents.map(r => {
      const partners = interactions[r.id];
      const partnerIds = Object.keys(partners);
      const uniqueCount = partnerIds.length;
      const totalPossible = residents.length - 1; // Exclude self
      
      let maxWeeks = 0;
      let maxPartnerId = '';
      
      partnerIds.forEach(pid => {
        if (partners[pid] > maxWeeks) {
          maxWeeks = partners[pid];
          maxPartnerId = pid;
        }
      });
      
      const maxPartner = residents.find(res => res.id === maxPartnerId);

      return {
        id: r.id,
        name: r.name,
        level: r.level,
        uniqueCount,
        totalPossible,
        percent: totalPossible > 0 ? (uniqueCount / totalPossible) * 100 : 0,
        maxOverlapWeeks: maxWeeks,
        maxOverlapName: maxPartner ? maxPartner.name : '-'
      };
    });
    
    return rows;
  }, [residents, schedule]);

  const [sortField, setSortField] = useState<keyof StatRow>('percent');
  const [sortAsc, setSortAsc] = useState(true);

  const sortedStats = useMemo(() => {
    return [...stats].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      
      // Secondary sort by max weeks if percents are equal (to highlight problematic ones)
      if (valA === valB && sortField === 'percent') {
          return b.maxOverlapWeeks - a.maxOverlapWeeks;
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [stats, sortField, sortAsc]);

  const handleHeaderClick = (field: keyof StatRow) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      // Default desc for counts/percent to show best first, asc to show worst first?
      // Let's stick to toggle.
      setSortAsc(true);
    }
  };

  const getDiversityColor = (pct: number) => {
    if (pct < 30) return 'text-red-700 bg-red-100';
    if (pct < 50) return 'text-orange-700 bg-orange-100';
    return 'text-green-700 bg-green-100';
  };

  return (
    <div className="p-6 h-full overflow-y-auto bg-gray-50">
       <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-sm border overflow-hidden">
         <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Co-Working Diversity Report</h2>
              <p className="text-sm text-gray-500 mt-1">
                Analysis of unique residents worked with (Wards, ICU, NF, EM, Clinic). 
                <br/>
                Goal: High percentage (working with many people) and low Max Weeks (avoiding cliques).
              </p>
            </div>
         </div>
         <table className="w-full text-sm text-left">
           <thead className="text-xs text-gray-500 uppercase bg-gray-100 border-b">
             <tr>
               <th className="px-6 py-3 cursor-pointer hover:bg-gray-200" onClick={() => handleHeaderClick('name')}>
                 <div className="flex items-center gap-1">Resident <ArrowUpDown size={12}/></div>
               </th>
               <th className="px-6 py-3 cursor-pointer hover:bg-gray-200 text-center" onClick={() => handleHeaderClick('uniqueCount')}>
                 <div className="flex items-center gap-1 justify-center">Unique Co-workers <ArrowUpDown size={12}/></div>
               </th>
               <th className="px-6 py-3 cursor-pointer hover:bg-gray-200" onClick={() => handleHeaderClick('percent')}>
                 <div className="flex items-center gap-1">Diversity % <ArrowUpDown size={12}/></div>
               </th>
               <th className="px-6 py-3 cursor-pointer hover:bg-gray-200" onClick={() => handleHeaderClick('maxOverlapWeeks')}>
                 <div className="flex items-center gap-1">Most Frequent Partner <ArrowUpDown size={12}/></div>
               </th>
             </tr>
           </thead>
           <tbody className="divide-y divide-gray-100">
             {sortedStats.map(row => (
               <tr key={row.id} className="hover:bg-gray-50">
                 <td className="px-6 py-3 font-medium text-gray-900 border-r border-gray-50">
                    <div>{row.name}</div>
                    <div className="text-xs text-gray-400">PGY-{row.level}</div>
                 </td>
                 <td className="px-6 py-3 text-center border-r border-gray-50">
                    <span className="font-semibold text-base">{row.uniqueCount}</span>
                    <span className="text-gray-400 text-xs ml-1">/ {row.totalPossible}</span>
                 </td>
                 <td className="px-6 py-3 border-r border-gray-50">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${getDiversityColor(row.percent)}`}>
                      {row.percent.toFixed(1)}%
                    </span>
                 </td>
                 <td className="px-6 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-700">{row.maxOverlapName}</span>
                      <span className={`text-xs ${row.maxOverlapWeeks > 8 ? 'text-red-500 font-bold' : 'text-gray-500'}`}>
                        {row.maxOverlapWeeks} weeks together
                      </span>
                    </div>
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>
    </div>
  );
};
