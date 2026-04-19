import React, { useState, useEffect, useMemo } from 'react';
import ExcelJS from 'exceljs';
import { 
  Resident, 
  ScheduleGrid, 
  AssignmentType,
  AdaptationParams
} from './types';
import { GENERATE_INITIAL_RESIDENTS, ASSIGNMENT_LABELS, ASSIGNMENT_HEX_COLORS } from './constants';
import { generateSchedule, calculateStats, calculateScheduleScore, getRequirementViolations, getWeeklyViolations } from './services/scheduler';
import { adaptSchedule } from './services/adapter';
import { ScheduleTable } from './components/ScheduleTable';
import { Dashboard } from './components/Dashboard';
import { ResidentManager } from './components/ResidentManager';
import { RelationshipStats } from './components/RelationshipStats';
import { AssignmentStats } from './components/AssignmentStats';
import { FairnessStats } from './components/FairnessStats';
import { RequirementsStats } from './components/RequirementsStats';
import { ScheduleComparison } from './components/ScheduleComparison';
import { ACGMEAudit } from './components/ACGMEAudit';
import { DataManagement } from './components/DataManagement';
import { StressTestReport } from './components/StressTestReport';
import { ProgramDocumentation } from './components/ProgramDocumentation';
import { 
  LayoutGrid, 
  BarChart3, 
  Plus, 
  Network,
  X,
  Table,
  Scale,
  ClipboardList,
  Pencil,
  Wand2,
  ShieldCheck,
  Users,
  Sparkles,
  Database,
  Activity,
  BookOpen
} from 'lucide-react';

export type SortKey = 'alphabetical' | 'pgy' | 'cohort';

export interface ScheduleSession {
  id: string;
  name: string;
  data: ScheduleGrid;
  createdAt: Date;
}

const loadState = <T,>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    if (!item) return fallback;
    const parsed = JSON.parse(item);
    
    if (key === 'rsp_schedules' && Array.isArray(parsed)) {
      return parsed.map((s: any) => ({
        ...s,
        createdAt: s.createdAt ? new Date(s.createdAt) : new Date()
      })) as unknown as T;
    }
    
    return parsed;
  } catch (e) {
    console.warn("Failed to load state", e);
    return fallback;
  }
};

const AssignmentModal = ({ 
  isOpen, 
  onClose, 
  current, 
  onSave 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  current: AssignmentType | null; 
  onSave: (val: AssignmentType | null) => void 
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold mb-4">Edit Assignment</h3>
        <p className="text-xs text-gray-500 mb-4">* Reselecting the current assignment will unlock it for automated changes.</p>
        <div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto pr-2">
          {Object.entries(ASSIGNMENT_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => onSave(key as AssignmentType)}
              className={`p-3 rounded border text-sm font-medium transition-colors text-left
                ${current === key ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-500' : 'hover:bg-gray-50 border-gray-200'}
              `}
            >
              {label}
            </button>
          ))}
          <button
             onClick={() => onSave(null)}
             className="p-3 rounded border border-gray-200 text-sm font-medium text-red-600 hover:bg-red-50 col-span-2"
          >
            Clear Assignment
          </button>
        </div>
        <button onClick={onClose} className="mt-4 w-full py-2 bg-gray-100 rounded hover:bg-gray-200">
          Cancel
        </button>
      </div>
    </div>
  );
};

const RenameModal = ({
    isOpen,
    initialName,
    onSave,
    onClose
}: { isOpen: boolean, initialName: string, onSave: (n: string) => void, onClose: () => void }) => {
    const [name, setName] = useState(initialName);
    useEffect(() => { setName(initialName); }, [initialName]);
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 z-110 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-96">
                <h3 className="text-lg font-bold mb-4">Rename Schedule</h3>
                <input 
                    type="text" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    className="w-full border rounded p-2 mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
                    autoFocus
                />
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                    <button onClick={() => onSave(name)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
                </div>
            </div>
        </div>
    );
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'schedule' | 'workload' | 'assignments' | 'fairness' | 'requirements' | 'audit' | 'relationships' | 'residents' | 'data' | 'coverage-help' | 'docs'>('schedule');
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const [residents, setResidents] = useState<Resident[]>(() => 
    loadState('rsp_residents_v2', GENERATE_INITIAL_RESIDENTS())
  );
  
  const [schedules, setSchedules] = useState<ScheduleSession[]>(() => 
    loadState('rsp_schedules', [])
  );
  
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(() => 
    loadState('rsp_active_id', null)
  );

  const [sortKey, setSortKey] = useState<SortKey>('pgy');

  const [batchProgress, setBatchProgress] = useState<{current: number, total: number, bestScore: number} | null>(null);

  const [adaptParams, setAdaptParams] = useState<AdaptationParams>(() => loadState('rsp_adapt_params', {
      fillMissingReqs: true,
      fixUnderstaffing: true,
      fixOverstaffing: true,
      allowResearchOverride: true,
      allowVacationOverride: false
  }));

  const activeSchedule = schedules.find(s => s.id === activeScheduleId);
  const currentGrid = activeSchedule?.data || {};
  const stats = React.useMemo(() => calculateStats(residents, currentGrid), [residents, currentGrid]);
  
  const violations = useMemo(() => {
      if (!currentGrid || Object.keys(currentGrid).length === 0) return { reqs: [], constraints: [] };
      return {
          reqs: getRequirementViolations(residents, currentGrid),
          constraints: getWeeklyViolations(residents, currentGrid)
      };
  }, [residents, currentGrid]);

  const hasViolations = violations.reqs.length > 0 || violations.constraints.length > 0;

  const adaptationPotential = useMemo(() => {
      if (!hasViolations || !currentGrid || Object.keys(currentGrid).length === 0) return { possible: false, changes: 0, details: [], plannedChanges: [] };
      const res = adaptSchedule(residents, currentGrid, adaptParams);
      return {
          possible: res.changesMade > 0,
          changes: res.changesMade,
          details: res.failureReasons,
          plannedChanges: res.plannedChanges
      };
  }, [hasViolations, currentGrid, residents, adaptParams]);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{resId: string, week: number} | null>(null);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [scheduleToRename, setScheduleToRename] = useState<ScheduleSession | null>(null);

  // Sync/Repair schedules when residents change
  useEffect(() => {
    if (schedules.length === 0) {
        const initialGrid = generateSchedule(residents, {});
        const initialSession: ScheduleSession = { id: 'init-1', name: 'Schedule 1', data: initialGrid, createdAt: new Date() };
        setSchedules([initialSession]);
        setActiveScheduleId(initialSession.id);
    } else {
        const isValidId = activeScheduleId && schedules.some(s => s.id === activeScheduleId);
        if (!isValidId && schedules.length > 0) setActiveScheduleId(schedules[0].id);
    }
  }, [residents.length, schedules.length]); 

  useEffect(() => { localStorage.setItem('rsp_residents_v2', JSON.stringify(residents)); }, [residents]);
  useEffect(() => { localStorage.setItem('rsp_schedules', JSON.stringify(schedules)); }, [schedules]);
  useEffect(() => { if(activeScheduleId) localStorage.setItem('rsp_active_id', activeScheduleId); }, [activeScheduleId]);
  useEffect(() => { localStorage.setItem('rsp_adapt_params', JSON.stringify(adaptParams)); }, [adaptParams]);

  const handleGenerate = () => {
    const baseSchedule = activeSchedule ? activeSchedule.data : {};
    const newGrid = generateSchedule(residents, baseSchedule);
    const newId = `sched-${Date.now()}`;
    const newSession: ScheduleSession = { id: newId, name: `Schedule ${schedules.length + 1}`, data: newGrid, createdAt: new Date() };
    setSchedules(prev => [...prev, newSession]);
    setActiveScheduleId(newId);
  };

  const handleBatchGenerate = async () => {
    const TOTAL_ITERATIONS = 20;
    let bestScoreFound = -Infinity;
    const newSessions: ScheduleSession[] = [];

    setBatchProgress({ current: 0, total: TOTAL_ITERATIONS, bestScore: 0 });

    for (let i = 0; i < TOTAL_ITERATIONS; i++) {
        await new Promise(r => setTimeout(r, 10));
        const grid = generateSchedule(residents, {});
        const score = calculateScheduleScore(residents, grid);
        if (score > bestScoreFound) bestScoreFound = score;
        if (i % 4 === 0 || i === TOTAL_ITERATIONS - 1) {
            newSessions.push({
                id: `batch-${Date.now()}-${i}`,
                name: `Optimized Candidate ${newSessions.length + 1}`,
                data: grid,
                createdAt: new Date()
            });
        }
        setBatchProgress({ current: i + 1, total: TOTAL_ITERATIONS, bestScore: Math.round(bestScoreFound) });
    }
    setSchedules(prev => [...prev, ...newSessions]);
    setBatchProgress(null);
  };

  const handleAdapt = () => {
    if (!activeScheduleId || !currentGrid) return;
    const { newSchedule, changesMade } = adaptSchedule(residents, currentGrid, adaptParams);
    if (changesMade > 0) {
        setSchedules(prev => prev.map(s => s.id === activeScheduleId ? { ...s, data: newSchedule } : s));
    } else {
        alert("Adaptation attempted, but no suitable unlocked cells were found.");
    }
  };

  const handleRename = (newName: string) => {
      if (scheduleToRename && newName.trim()) {
          setSchedules(prev => prev.map(s => s.id === scheduleToRename.id ? { ...s, name: newName } : s));
      }
      setRenameModalOpen(false);
      setScheduleToRename(null);
  };

  const handleRenameResident = (id: string, newName: string) => {
    if (!newName.trim()) return;
    setResidents(prev => prev.map(r => r.id === id ? { ...r, name: newName } : r));
  };

  const handleCellClick = (resId: string, week: number) => {
    setSelectedCell({ resId, week });
    setModalOpen(true);
  };

  const handleToggleLock = (residentId: string, weekIdx: number) => {
    if (!activeScheduleId) return;
    setSchedules(prev => prev.map(s => {
      if (s.id !== activeScheduleId) return s;
      const copy = { ...s.data };
      if (!copy[residentId]) {
        copy[residentId] = Array(52).fill(null).map(() => ({ assignment: null, locked: false }));
      }
      const updatedRow = [...copy[residentId]];
      updatedRow[weekIdx] = { ...updatedRow[weekIdx], locked: !updatedRow[weekIdx]?.locked };
      copy[residentId] = updatedRow;
      return { ...s, data: copy };
    }));
  };

  const handleLockResident = (residentId: string) => {
    if (!activeScheduleId) return;
    setSchedules(prev => prev.map(s => {
      if (s.id !== activeScheduleId) return s;
      const copy = { ...s.data };
      if (!copy[residentId]) {
        copy[residentId] = Array(52).fill(null).map(() => ({ assignment: null, locked: false }));
      }
      const row = copy[residentId];
      const allLocked = row.every(c => c.locked);
      copy[residentId] = row.map(c => ({ ...c, locked: !allLocked }));
      return { ...s, data: copy };
    }));
  };

  const handleLockWeek = (weekIdx: number) => {
    if (!activeScheduleId) return;
    setSchedules(prev => prev.map(s => {
      if (s.id !== activeScheduleId) return s;
      const copy = { ...s.data };
      const resIds = residents.map(r => r.id);
      const allLocked = resIds.every(id => copy[id]?.[weekIdx]?.locked);
      resIds.forEach(id => {
        if (!copy[id]) {
          copy[id] = Array(52).fill(null).map(() => ({ assignment: null, locked: false }));
        }
        const updatedRow = [...copy[id]];
        updatedRow[weekIdx] = { ...updatedRow[weekIdx], locked: !allLocked };
        copy[id] = updatedRow;
      });
      return { ...s, data: copy };
    }));
  };

  const handleAssignmentSave = (type: AssignmentType | null) => {
    if (selectedCell && activeScheduleId) {
      setSchedules(prev => prev.map(s => {
          if (s.id !== activeScheduleId) return s;
          const copy = { ...s.data };
          if (!copy[selectedCell.resId]) {
              copy[selectedCell.resId] = Array(52).fill(null).map(() => ({ assignment: null, locked: false }));
          }
          const existing = copy[selectedCell.resId][selectedCell.week];
          const updatedRow = [...copy[selectedCell.resId]];
          
          let newLocked = true;
          if (type === null) {
            newLocked = false;
          } else if (existing?.assignment === type) {
            // Toggle lock if reselecting the exact same assignment
            newLocked = !existing.locked;
          } else {
            // New selection is always locked
            newLocked = true;
          }

          updatedRow[selectedCell.week] = { 
            assignment: type as any, 
            locked: newLocked 
          };
          copy[selectedCell.resId] = updatedRow;
          return { ...s, data: copy };
      }));
    }
    setModalOpen(false);
  };

  const handleImportJSON = (data: { residents: Resident[], schedules: ScheduleSession[] }) => {
    if (!data || !Array.isArray(data.residents) || !Array.isArray(data.schedules)) {
      alert("Import failed: Invalid data structure.");
      return;
    }
    
    const sanitizedSchedules = data.schedules.map((s: any) => ({
      ...s,
      createdAt: s.createdAt ? new Date(s.createdAt) : new Date()
    }));

    setResidents(data.residents);
    setSchedules(sanitizedSchedules);
    if (sanitizedSchedules.length > 0) {
      setActiveScheduleId(sanitizedSchedules[0].id);
    }
  };

  const handleExportXLSX = async () => {
    if (!activeSchedule) return;
    setIsExporting(true);
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Schedule');
        const headers = ['Resident', 'PGY', 'Cohort', ...Array.from({length: 52}, (_, i) => `Week ${i+1}`)];
        const headerRow = worksheet.addRow(headers);
        headerRow.font = { bold: true };
        
        // Sort residents based on the current schedule view sortKey
        const sortedForExport = [...residents].sort((a, b) => {
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

        sortedForExport.forEach(r => {
          const rowData = [r.name, r.level, String.fromCharCode(65 + r.cohort)];
          const residentCells: string[] = [];
          for(let i=0; i<52; i++) {
            const cell = activeSchedule.data[r.id]?.[i];
            residentCells.push(cell?.assignment ? ASSIGNMENT_LABELS[cell.assignment] : "");
          }
          const row = worksheet.addRow([...rowData, ...residentCells]);
          
          for(let i=0; i<52; i++) {
            const cell = activeSchedule.data[r.id]?.[i];
            if (cell?.assignment) {
              const hex = ASSIGNMENT_HEX_COLORS[cell.assignment]?.replace('#', '') || 'CCCCCC';
              row.getCell(4 + i).fill = { 
                type: 'pattern', 
                pattern: 'solid', 
                fgColor: { argb: 'FF' + hex } 
              };
            }
          }
        });
        
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activeSchedule.name.replace(/\s+/g, '_').toLowerCase()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (e) { 
        console.error("Export failed", e);
        alert("Failed to export Excel file. See console for details.");
    } finally { 
        setIsExporting(false); 
    }
  };

  const NavButton = ({ id, label, icon: Icon, badgeCount }: any) => (
      <button
        onClick={() => setActiveTab(id)}
        className={`flex items-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition-all relative whitespace-nowrap
        ${activeTab === id 
            ? 'border-blue-600 text-blue-600 bg-blue-50/50' 
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
        `}
    >
        <Icon size={16} />
        {label}
        {badgeCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full font-bold ml-1 animate-pulse">
                {badgeCount}
            </span>
        )}
    </button>
  );

  return (
    <div className="flex flex-col h-screen bg-gray-100 text-gray-900 font-sans overflow-hidden">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm z-[50] shrink-0">
        <div className="flex items-center gap-3">
          <img src="https://www.hcadam.com/api/public/content/349f5f94cafa4b168f99e74a262b8c24" alt="Residency Scheduler Pro" className="h-10 w-auto object-contain" />
          <div className="h-6 w-px bg-gray-200 mx-2"></div>
        </div>
        <div className="flex items-center gap-2">
            <button 
                onClick={handleGenerate} 
                className="flex items-center gap-2 text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-md font-medium border text-sm shadow-sm transition-all hover:shadow-md"
            >
                <Plus size={16} /> Quick Draft
            </button>

            <button 
                onClick={() => setIsCompareOpen(true)} 
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors shadow-sm text-sm"
            >
                <Sparkles size={16} /> Generate New
            </button>

            {hasViolations && (
                <button 
                  onClick={adaptationPotential.possible ? handleAdapt : undefined} 
                  className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-colors shadow-sm text-sm ${adaptationPotential.possible ? 'text-white bg-orange-500 hover:bg-orange-600 animate-pulse' : 'text-gray-400 bg-gray-100 cursor-not-allowed border'}`}
                >
                  <Wand2 size={16} /> Adapt
                </button>
            )}

            <button 
                onClick={() => setActiveTab('residents')}
                className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-colors text-sm shadow-sm ${activeTab === 'residents' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 hover:bg-gray-50 border'}`}
            >
                <Users size={16} /> Residents
            </button>

            <button 
                onClick={() => setActiveTab('data')}
                className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-colors text-sm shadow-sm ${activeTab === 'data' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 hover:bg-gray-50 border'}`}
            >
                <Database size={16} /> Data Management
            </button>

            <button 
                onClick={() => setActiveTab('docs')}
                className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-colors text-sm shadow-sm ${activeTab === 'docs' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 hover:bg-gray-50 border'}`}
            >
                <BookOpen size={16} /> Documentation
            </button>
        </div>
      </header>

      <div className="bg-gray-200 border-b border-gray-300 flex items-center px-2 pt-2 gap-1 overflow-x-auto shrink-0 z-30">
          {schedules.map(sched => {
             const isActive = activeScheduleId === sched.id;
             return (
              <div key={sched.id} onClick={() => { setActiveScheduleId(sched.id); }} className={`group flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-t-lg border-t border-x relative top-[1px] min-w-[160px] cursor-pointer transition-colors ${isActive ? 'bg-white border-gray-300 text-blue-600 z-10' : 'bg-gray-100 border-transparent text-gray-500 hover:bg-gray-50'}`}>
                  <div className="flex-1 min-w-0 font-bold text-xs truncate">{sched.name}</div>
                  <button onClick={(e) => { e.stopPropagation(); setScheduleToRename(sched); setRenameModalOpen(true); }} className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200"><Pencil size={12} /></button>
                  <button onClick={(e) => { e.stopPropagation(); setSchedules(s => s.filter(x => x.id !== sched.id)); }} className="p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-gray-200"><X size={14} /></button>
              </div>
          )})}
      </div>

      <div className="px-6 bg-white border-b border-gray-200 flex gap-1 z-20 shadow-sm shrink-0 overflow-x-auto">
          <NavButton id="schedule" label="Schedule" icon={LayoutGrid} />
          <NavButton id="workload" label="Workload" icon={BarChart3} />
          <NavButton id="assignments" label="Assignments" icon={Table} badgeCount={violations.constraints.length} />
          <NavButton id="requirements" label="Requirements" icon={ClipboardList} badgeCount={violations.reqs.length} />
          <NavButton id="audit" label="ACGME Audit" icon={ShieldCheck} />
          <NavButton id="coverage-help" label="Coverage Help" icon={Activity} />
          <NavButton id="relationships" label="Relationships" icon={Network} />
          <NavButton id="fairness" label="Fairness" icon={Scale} />
      </div>

      <main className="flex-1 overflow-hidden relative bg-gray-50 min-h-0">
        <div className="absolute inset-0 flex flex-col">
            {activeTab === 'schedule' && (
              <div className="flex-1 overflow-hidden p-6">
                <ScheduleTable 
                  residents={residents} 
                  schedule={currentGrid} 
                  sortKey={sortKey} 
                  onSortKeyChange={setSortKey} 
                  onCellClick={handleCellClick} 
                  onLockWeek={handleLockWeek} 
                  onLockResident={handleLockResident} 
                  onToggleLock={handleToggleLock} 
                  onRenameResident={handleRenameResident} 
                />
              </div>
            )}
            {activeTab === 'workload' && <div className="flex-1 overflow-y-auto"><Dashboard residents={residents} stats={stats} /></div>}
            {activeTab === 'assignments' && <div className="flex-1 overflow-hidden"><AssignmentStats residents={residents} schedule={currentGrid} /></div>}
            {activeTab === 'requirements' && <div className="flex-1 overflow-y-auto"><RequirementsStats residents={residents} schedule={currentGrid} /></div>}
            {activeTab === 'audit' && <div className="flex-1 overflow-y-auto"><ACGMEAudit residents={residents} schedule={currentGrid} /></div>}
            {activeTab === 'coverage-help' && <div className="flex-1 overflow-y-auto"><StressTestReport residents={residents} schedule={currentGrid} /></div>}
            {activeTab === 'relationships' && <div className="flex-1 overflow-y-auto"><RelationshipStats residents={residents} schedule={currentGrid} /></div>}
            {activeTab === 'fairness' && <div className="flex-1 overflow-y-auto"><FairnessStats residents={residents} schedule={currentGrid} /></div>}
            {activeTab === 'residents' && <div className="flex-1 overflow-y-auto"><ResidentManager residents={residents} setResidents={setResidents} /></div>}
            {activeTab === 'docs' && <div className="flex-1 overflow-y-auto"><ProgramDocumentation /></div>}
            {activeTab === 'data' && (
              <div className="flex-1 overflow-y-auto">
                <DataManagement 
                    residents={residents} 
                    schedules={schedules} 
                    onImportJSON={handleImportJSON} 
                    onExportXLSX={handleExportXLSX} 
                    isExportingXLSX={isExporting} 
                    activeScheduleName={activeSchedule?.name}
                />
              </div>
            )}
        </div>
      </main>

      {isCompareOpen && (
          <ScheduleComparison 
            residents={residents} 
            schedules={schedules} 
            activeScheduleId={activeScheduleId}
            onSelect={(id) => { setActiveScheduleId(id); setIsCompareOpen(false); }}
            onClose={() => setIsCompareOpen(false)}
            onBatchGenerate={handleBatchGenerate}
            progress={batchProgress}
          />
      )}

      <AssignmentModal isOpen={modalOpen} onClose={() => setModalOpen(false)} current={selectedCell && currentGrid[selectedCell.resId]?.[selectedCell.week]?.assignment || null} onSave={handleAssignmentSave} />
      <RenameModal isOpen={renameModalOpen} initialName={scheduleToRename?.name || ''} onClose={() => setRenameModalOpen(false)} onSave={handleRename} />
    </div>
  );
};

export default App;