import React, { useMemo, useState } from 'react';
import { Resident, ScheduleGrid } from '../types';
import { calculateFairnessMetrics } from '../services/scheduler';
import { AlertCircle, CheckCircle2, Scale, Flame, Activity, HelpCircle } from 'lucide-react';

interface Props {
  residents: Resident[];
  schedule: ScheduleGrid;
}

export const FairnessStats: React.FC<Props> = ({ residents, schedule }) => {
  // Use a single tooltip state for fixed positioning
  const [tooltip, setTooltip] = useState<{x: number, y: number, text: string} | null>(null);

  const stats = useMemo(() => {
    return calculateFairnessMetrics(residents, schedule);
  }, [residents, schedule]);

  const getScoreColor = (score: number) => {
      if (score >= 90) return 'text-green-600 bg-green-50 border-green-200';
      if (score >= 75) return 'text-orange-600 bg-orange-50 border-orange-200';
      return 'text-red-600 bg-red-50 border-red-200';
  };

  const handleMouseEnter = (e: React.MouseEvent, text: string) => {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setTooltip({
          x: rect.left + (rect.width / 2),
          y: rect.top,
          text
      });
  };

  const handleMouseLeave = () => {
      setTooltip(null);
  };

  const HeaderWithTooltip = ({ label, tooltipText, icon }: { label: React.ReactNode, tooltipText: string, icon?: React.ReactNode }) => (
      <th 
        className="text-right py-3 px-2 font-medium relative whitespace-nowrap cursor-help group"
        onMouseEnter={(e) => handleMouseEnter(e, tooltipText)}
        onMouseLeave={handleMouseLeave}
      >
          <div className="flex items-center justify-end gap-1">
              {icon}
              {label}
              <HelpCircle size={12} className="text-gray-400 opacity-50 group-hover:opacity-100" />
          </div>
      </th>
  );

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-6 relative">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Scale className="w-6 h-6 text-blue-600" />
                Schedule Fairness & Balance Analysis
            </h2>
            <p className="mt-2 text-gray-600">
                This report analyzes workload distribution across three main categories: <strong>Core</strong> (High Intensity), <strong>Required</strong> (Specialty reqs), and <strong>Electives</strong> (Flexible time).
                <br/>
                It also tracks an overall <strong>Intensity Score</strong> to prevent burnout.
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
                    <div className="grid grid-cols-3 gap-6 mb-6">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Core Weeks (Avg)</div>
                            <div className="text-2xl font-bold text-gray-800">{group.meanCore.toFixed(1)} <span className="text-sm font-normal text-gray-500">± {group.sdCore.toFixed(2)}</span></div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                            <div className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Elective Weeks (Avg)</div>
                            <div className="text-2xl font-bold text-gray-800">{group.meanElective.toFixed(1)} <span className="text-sm font-normal text-gray-500">± {group.sdElective.toFixed(2)}</span></div>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                            <div className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-1">Intensity Score (Avg)</div>
                            <div className="text-2xl font-bold text-gray-800">{group.meanIntensity.toFixed(0)} <span className="text-sm font-normal text-gray-500">± {group.sdIntensity.toFixed(1)}</span></div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[800px]">
                            <thead>
                                <tr className="text-xs text-gray-500 border-b border-gray-100">
                                    <th className="text-left py-3 px-2 font-medium pl-2">Resident</th>
                                    
                                    <HeaderWithTooltip 
                                        label="Core" 
                                        tooltipText="Wards, ICU, Night Float, EM, and Clinics."
                                    />
                                    <HeaderWithTooltip 
                                        label="Required" 
                                        tooltipText="Specialty rotations required for graduation (e.g. Cards, Onc)."
                                    />
                                    <HeaderWithTooltip 
                                        label="Electives" 
                                        tooltipText="Flexible/Voluntary time (Research, Generic Electives)."
                                    />
                                    
                                    <HeaderWithTooltip 
                                        label="Intensity"
                                        icon={<Flame size={14}/>}
                                        tooltipText="Sum of (Weeks × Intensity Rating). Higher means harder year."
                                    />
                                    <HeaderWithTooltip 
                                        label="Streak"
                                        icon={<Activity size={14}/>}
                                        tooltipText="Longest run of consecutive weeks with Intensity ≥ 3."
                                    />
                                    <th className="text-right py-3 px-2 font-medium pr-2 whitespace-nowrap">Dev</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {group.residents.map(r => {
                                    // Calculate total deviation from group means
                                    const dev = Math.abs(r.coreWeeks - group.meanCore) + Math.abs(r.electiveWeeks - group.meanElective);
                                    const isOutlier = dev > 3;

                                    return (
                                        <tr key={r.id} className="hover:bg-gray-50">
                                            <td className="py-3 px-2 font-medium text-gray-900 pl-2">{r.name}</td>
                                            
                                            <td className="py-3 px-2 text-right text-gray-600">
                                                {r.coreWeeks}
                                                <span className="text-xs text-gray-400 ml-1">
                                                    ({(r.coreWeeks - group.meanCore) > 0 ? '+' : ''}{(r.coreWeeks - group.meanCore).toFixed(1)})
                                                </span>
                                            </td>

                                            <td className="py-3 px-2 text-right text-gray-600">
                                                {r.requiredWeeks}
                                            </td>

                                            <td className="py-3 px-2 text-right text-gray-600">
                                                {r.electiveWeeks}
                                                <span className="text-xs text-gray-400 ml-1">
                                                    ({(r.electiveWeeks - group.meanElective) > 0 ? '+' : ''}{(r.electiveWeeks - group.meanElective).toFixed(1)})
                                                </span>
                                            </td>

                                            <td className="py-3 px-2 text-right font-mono text-gray-700">
                                                {r.totalIntensityScore}
                                            </td>

                                            <td className="py-3 px-2 text-right">
                                                <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                                                    r.maxIntensityStreak >= 8 ? 'bg-red-100 text-red-700' :
                                                    r.maxIntensityStreak >= 5 ? 'bg-orange-100 text-orange-700' : 
                                                    'bg-gray-100 text-gray-600'
                                                }`}>
                                                    {r.maxIntensityStreak} wks
                                                </span>
                                            </td>
                                            <td className="py-3 px-2 text-right pr-2">
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
            </div>
        ))}
      </div>

      {/* Fixed Tooltip Portal */}
      {tooltip && (
          <div 
            className="fixed z-[9999] bg-gray-900 text-white text-xs rounded p-2 shadow-xl max-w-xs pointer-events-none transform -translate-x-1/2 -translate-y-full mt-[-8px]"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
              {tooltip.text}
              <div className="absolute left-1/2 top-full -mt-1 -ml-1 border-4 border-transparent border-t-gray-900"></div>
          </div>
      )}
    </div>
  );
};