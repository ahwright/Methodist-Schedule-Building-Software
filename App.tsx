import React, { useState, useEffect, useRef } from 'react';
import ExcelJS from 'exceljs';
import { 
  Resident, 
  ScheduleGrid, 
  AssignmentType,
  ScheduleCell
} from './types';
import { GENERATE_INITIAL_RESIDENTS, ASSIGNMENT_LABELS, ASSIGNMENT_HEX_COLORS } from './constants';
import { generateSchedule, calculateStats, calculateFairnessMetrics, calculateDiversityStats } from './services/scheduler';
import { ScheduleTable } from './components/ScheduleTable';
import { Dashboard } from './components/Dashboard';
import { ResidentManager } from './components/ResidentManager';
import { RelationshipStats } from './components/RelationshipStats';
import { AssignmentStats } from './components/AssignmentStats';
import { FairnessStats } from './components/FairnessStats';
import { RequirementsStats } from './components/RequirementsStats';
import { ScheduleComparison } from './components/ScheduleComparison';
import { 
  LayoutGrid, 
  BarChart3, 
  Plus, 
  Download,
  Network,
  Settings,
  X,
  Table,
  Scale,
  GitCompare,
  Loader2,
  Database,
  Save,
  Upload,
  RefreshCw,
  ClipboardList
} from 'lucide-react';

interface ScheduleSession {
  id: string;
  name: string;
  data: ScheduleGrid;
  createdAt: Date;
}

// Helper to load from LocalStorage
const loadState = <T,>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    console.warn("Failed to load state", e);
    return fallback;
  }
};

// Main Assignment Editor Modal
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold mb-4">Edit Assignment</h3>
        <div className="grid grid-cols-2 gap-2">
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

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'schedule' | 'workload' | 'relationships' | 'assignments' | 'fairness' | 'requirements'>('schedule');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // Initialize State from LocalStorage or Defaults
  const [residents, setResidents] = useState<Resident[]>(() => 
    loadState('rsp_residents', GENERATE_INITIAL_RESIDENTS())
  );
  
  const [schedules, setSchedules] = useState<ScheduleSession[]>(() => 
    loadState('rsp_schedules', [])
  );
  
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(() => 
    loadState('rsp_active_id', null)
  );

  const [batchProgress, setBatchProgress] = useState<{current: number, total: number, bestScore: number} | null>(null);

  const jsonInputRef = useRef<HTMLInputElement>(null);

  // Derived state for active schedule
  // IMPORTANT: This lookup might fail if activeScheduleId is stale/invalid
  const activeSchedule = schedules.find(s => s.id === activeScheduleId);
  const currentGrid = activeSchedule?.data || {};
  
  // Stats derivation
  const stats = React.useMemo(() => calculateStats(residents, currentGrid), [residents, currentGrid]);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{resId: string, week: number} | null>(null);

  // Initial Generation & Safety Check
  useEffect(() => {
    // 1. If no schedules exist, create one
    if (schedules.length === 0) {
        const initialGrid = generateSchedule(residents, {});
        const initialSession: ScheduleSession = {
            id: 'init-1',
            name: 'Schedule 1',
            data: initialGrid,
            createdAt: new Date()
        };
        setSchedules([initialSession]);
        setActiveScheduleId(initialSession.id);
    } else {
        // 2. If schedules exist but activeScheduleId is null or invalid (not found in list), reset it to the first one.
        // This fixes the "blank screen" issue on refresh.
        const isValidId = activeScheduleId && schedules.some(s => s.id === activeScheduleId);
        if (!isValidId) {
            setActiveScheduleId(schedules[0].id);
        }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedules.length]); // Dependency on length helps catch initial load or empty state

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('rsp_residents', JSON.stringify(residents));
  }, [residents]);

  useEffect(() => {
    localStorage.setItem('rsp_schedules', JSON.stringify(schedules));
  }, [schedules]);

  useEffect(() => {
    if(activeScheduleId) localStorage.setItem('rsp_active_id', activeScheduleId);
  }, [activeScheduleId]);

  const handleGenerate = () => {
    // Generate new schedule based on current residents
    const baseSchedule = activeSchedule ? activeSchedule.data : {};
    
    const newGrid = generateSchedule(residents, baseSchedule);
    
    const newId = `sched-${Date.now()}`;
    const newName = `Schedule ${schedules.length + 1}`;
    
    const newSession: ScheduleSession = {
        id: newId,
        name: newName,
        data: newGrid,
        createdAt: new Date()
    };

    setSchedules(prev => [...prev, newSession]);
    setActiveScheduleId(newId);
    
    if (isSettingsOpen) setIsSettingsOpen(false);
  };

  const calculateScore = (grid: ScheduleGrid) => {
    // Weights
    const W_FAIRNESS = 5;       // High priority on fairness
    const W_STREAK_SD = 20;     // Very High priority on equity (everyone suffering equally)
    const W_MAX_STREAK = 1;     // Low priority on absolute streak length
    const W_NF_COUNT = 2;       // Penalty for every Night Float shift (minimize total nights)

    // 1. Calculate Metrics
    const fairness = calculateFairnessMetrics(residents, grid);
    const avgFairness = fairness.reduce((s, g) => s + g.fairnessScore, 0) / fairness.length;
    
    // 2. Streak Metrics
    const allStreaks: number[] = [];
    fairness.forEach(g => g.residents.forEach(r => allStreaks.push(r.maxIntensityStreak)));
    
    const maxStreak = Math.max(...allStreaks);
    const streakMean = allStreaks.reduce((a,b) => a+b, 0) / allStreaks.length;
    const streakSD = Math.sqrt(allStreaks.reduce((s, n) => s + Math.pow(n - streakMean, 2), 0) / allStreaks.length);

    // 3. Workload Intensity (Night Float Minimization)
    let totalNFWeeks = 0;
    const allCells = Object.values(grid).flat();
    for(const cell of allCells) {
        if(cell.assignment === AssignmentType.NIGHT_FLOAT) totalNFWeeks++;
    }

    // 4. Score Calculation
    // Start with Base 600 to keep score positive
    return 600 
        + (avgFairness * W_FAIRNESS) 
        - (streakSD * W_STREAK_SD) 
        - (totalNFWeeks * W_NF_COUNT)
        - (maxStreak * W_MAX_STREAK);
  };

  const handleBatchGenerate = async () => {
    const baseSchedule = activeSchedule ? activeSchedule.data : {};
    
    // Configuration
    const TARGET_GENERATIONS = 3000;
    const CHUNK_SIZE = 50; 
    
    // Include existing schedules in the candidate pool
    let candidates: { session: ScheduleSession, score: number }[] = schedules.map(s => ({
        session: s,
        score: calculateScore(s.data)
    }));

    let bestScoreSoFar = candidates.length > 0 ? Math.max(...candidates.map(c => c.score)) : -Infinity;
    
    setBatchProgress({ current: 0, total: TARGET_GENERATIONS, bestScore: bestScoreSoFar });

    for(let i = 0; i < TARGET_GENERATIONS; i += CHUNK_SIZE) {
        await new Promise(resolve => setTimeout(resolve, 0));

        const currentChunkSize = Math.min(CHUNK_SIZE, TARGET_GENERATIONS - i);
        for(let j = 0; j < currentChunkSize; j++) {
            const grid = generateSchedule(residents, baseSchedule);
            const score = calculateScore(grid);

            const session = {
                 id: `batch-${Date.now()}-${i + j}`,
                 name: `Gen ${i + j}`, 
                 data: grid,
                 createdAt: new Date()
            };

            candidates.push({ session, score });

            if (score > bestScoreSoFar) {
                bestScoreSoFar = score;
            }
        }

        // Keep memory usage low by pruning the list periodically if it gets huge,
        // but 3000 isn't that huge for modern JS. 
        // We'll just sort at the end to avoid overhead in the loop.

        setBatchProgress({ 
            current: i + currentChunkSize, 
            total: TARGET_GENERATIONS,
            bestScore: Math.round(bestScoreSoFar)
        });
    }

    // Sort descending by score
    candidates.sort((a, b) => b.score - a.score);
    
    // Take top 5
    const topCandidates = candidates.slice(0, 5).map((c, idx) => ({
        ...c.session,
        // Rename if it was a generated one, preserve name if it was existing
        name: c.session.name.startsWith('Schedule') || c.session.name.startsWith('Optimized') 
            ? c.session.name // Keep existing name logic roughly
            : `Optimized ${idx + 1} (Score: ${Math.round(c.score)})`
    }));

    // If existing schedules were among the top, we want to keep their ID to prevent state loss
    // but if they are new, we give them the optimized name.
    const finalSchedules = topCandidates.map((c, idx) => {
        // Just ensure names are helpful
        if (!c.name.includes("Score:")) {
             // It's an existing one, append score if not present
             const score = Math.round(calculateScore(c.data));
             return { ...c, name: `${c.name} (Score: ${score})` };
        }
        return { ...c, name: `Optimized ${idx + 1} (Score: ${Math.round(calculateScore(c.data))})` };
    });

    setSchedules(finalSchedules);
    // Set active to the best one
    setActiveScheduleId(finalSchedules[0].id);
    setBatchProgress(null);
  };

  const deleteSchedule = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSchedules = schedules.filter(s => s.id !== id);
    setSchedules(newSchedules);
    
    // If we deleted the active one, switch to the last one available
    if (activeScheduleId === id) {
        if (newSchedules.length > 0) {
            setActiveScheduleId(newSchedules[newSchedules.length - 1].id);
        } else {
             // If all deleted, generate a fresh empty one so the UI doesn't break
             const initialGrid = generateSchedule(residents, {});
             const newId = `init-reset-${Date.now()}`;
             setSchedules([{ id: newId, name: 'Schedule 1', data: initialGrid, createdAt: new Date() }]);
             setActiveScheduleId(newId);
        }
    }
  };

  const handleCellClick = (resId: string, week: number) => {
    setSelectedCell({ resId, week });
    setModalOpen(true);
  };

  const handleAssignmentSave = (type: AssignmentType | null) => {
    if (selectedCell && activeScheduleId) {
      setSchedules(prev => prev.map(s => {
          if (s.id !== activeScheduleId) return s;
          
          const copy = { ...s.data };
          if (!copy[selectedCell.resId]) copy[selectedCell.resId] = [];
          
          copy[selectedCell.resId][selectedCell.week] = {
            assignment: type as any,
            locked: true // Manual edits are locked by default
          };
          
          return { ...s, data: copy };
      }));
    }
    setModalOpen(false);
  };

  const handleExportXLSX = async () => {
    if (!activeSchedule) return;
    setIsExporting(true);

    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Schedule');

        // Headers
        const headers = ['Resident', 'PGY', 'Cohort', ...Array.from({length: 52}, (_, i) => `Week ${i+1}`)];
        const headerRow = worksheet.addRow(headers);
        headerRow.font = { bold: true };
        
        // Data
        residents.forEach(r => {
          const rowData = [
            r.name, 
            r.level, 
            String.fromCharCode(65 + r.cohort)
          ];
          
          const residentCells: string[] = [];
          for(let i=0; i<52; i++) {
            const cell = activeSchedule.data[r.id]?.[i];
            residentCells.push(cell?.assignment ? ASSIGNMENT_LABELS[cell.assignment] : "");
          }
          
          const row = worksheet.addRow([...rowData, ...residentCells]);

          // Styling
          for(let i=0; i<52; i++) {
            const cell = activeSchedule.data[r.id]?.[i];
            if (cell?.assignment) {
              // ExcelJS columns are 1-based. 
              // Resident info is cols 1,2,3. So Week 1 is col 4.
              const colIndex = 4 + i; 
              const targetCell = row.getCell(colIndex);
              const hex = ASSIGNMENT_HEX_COLORS[cell.assignment]?.replace('#', '') || 'CCCCCC';
              
              targetCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF' + hex }
              };
              
              targetCell.border = {
                top: {style:'thin', color: {argb: 'FFCCCCCC'}},
                left: {style:'thin', color: {argb: 'FFCCCCCC'}},
                bottom: {style:'thin', color: {argb: 'FFCCCCCC'}},
                right: {style:'thin', color: {argb: 'FFCCCCCC'}},
              };
            }
          }
        });

        // Auto-width for first columns
        worksheet.getColumn(1).width = 25;
        worksheet.getColumn(2).width = 8;
        worksheet.getColumn(3).width = 8;
        // Schedule columns width
        for(let i=4; i<=56; i++) {
            worksheet.getColumn(i).width = 15;
        }

        // Generate buffer
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activeSchedule.name.replace(/\s+/g, '_').toLowerCase()}.xlsx`;
        a.click();
    } catch (e) {
        console.error("Export failed", e);
        alert("Failed to export Excel file.");
    } finally {
        setIsExporting(false);
    }
  };

  const handleJsonExport = () => {
    const data = {
        residents,
        schedules,
        activeScheduleId,
        exportedAt: new Date().toISOString(),
        version: 1
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scheduler_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleJsonImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const json = JSON.parse(event.target?.result as string);
              if (json.residents && json.schedules) {
                  if (confirm("This will overwrite your current data with the imported file. This cannot be undone. Continue?")) {
                      setResidents(json.residents);
                      setSchedules(json.schedules);
                      setActiveScheduleId(json.activeScheduleId || (json.schedules[0]?.id || null));
                      setIsSettingsOpen(false); // close settings to see result
                      alert("Data imported successfully!");
                  }
              } else {
                  alert("Invalid JSON file format. Missing residents or schedules.");
              }
          } catch(err) {
              console.error(err);
              alert("Failed to parse JSON file.");
          }
      };
      reader.readAsText(file);
      e.target.value = ''; // reset
  };

  const handleResetData = () => {
      if(confirm("Are you sure you want to reset all application data to defaults? All schedules and resident changes will be lost.")) {
          localStorage.clear();
          window.location.reload();
      }
  };

  const toggleSettings = () => {
      setIsSettingsOpen(!isSettingsOpen);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 text-gray-900 font-sans overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm z-30 shrink-0">
        <div className="flex items-center gap-3">
          <img 
            src="https://www.hcadam.com/api/public/content/349f5f94cafa4b168f99e74a262b8c24" 
            alt="Residency Scheduler" 
            className="h-10 w-auto object-contain"
          />
        </div>
        
        <div className="flex items-center gap-3">
            <button 
                onClick={() => setIsCompareOpen(true)}
                className="flex items-center gap-2 text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-md font-medium transition-colors mr-2 border border-gray-200"
            >
                <GitCompare size={18} /> Compare / Optimize
            </button>

            <button 
                onClick={toggleSettings}
                className={`p-2 rounded-md transition-colors ${isSettingsOpen ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
                title="Resident Settings"
            >
                <Settings size={20} />
            </button>
            <div className="h-6 w-px bg-gray-300"></div>
            <button 
                onClick={handleGenerate}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors shadow-sm"
            >
                <Plus size={18} /> Generate New
            </button>
            <button 
                onClick={handleExportXLSX}
                disabled={isExporting}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
            >
                {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                Export XLSX
            </button>
        </div>
      </header>

      {/* Schedule Tabs (Top Level) */}
      <div className="bg-gray-200 border-b border-gray-300 flex items-center px-2 pt-2 gap-1 overflow-x-auto shrink-0">
          {schedules.map(sched => {
             const isActive = activeScheduleId === sched.id && !isSettingsOpen;
             return (
              <div
                key={sched.id}
                onClick={() => {
                    setActiveScheduleId(sched.id);
                    setIsSettingsOpen(false);
                }}
                className={`
                    group flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-t border-x relative top-[1px] min-w-[140px] cursor-pointer transition-colors
                    ${isActive
                        ? 'bg-white border-gray-300 text-blue-600 z-10' 
                        : 'bg-gray-100 border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700'}
                `}
              >
                  <span className="flex-1 truncate">{sched.name}</span>
                  <button 
                    onClick={(e) => deleteSchedule(e, sched.id)}
                    className={`
                        p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity
                        ${isActive ? 'hover:bg-blue-100 text-blue-400 hover:text-blue-700' : 'hover:bg-gray-200 text-gray-400 hover:text-gray-700'}
                    `}
                  >
                      <X size={14} />
                  </button>
              </div>
          )})}
      </div>

      {/* Sub Tabs (Views) - Only visible if not in Settings */}
      {!isSettingsOpen && (
        <div className="px-6 py-2 bg-white border-b border-gray-200 flex gap-6 z-20 shadow-sm shrink-0">
            {[
            { id: 'schedule', label: 'Schedule', icon: LayoutGrid },
            { id: 'workload', label: 'Workload', icon: BarChart3 },
            { id: 'assignments', label: 'Assignments', icon: Table },
            { id: 'fairness', label: 'Fairness', icon: Scale },
            { id: 'requirements', label: 'Requirements', icon: ClipboardList },
            { id: 'relationships', label: 'Relationships', icon: Network },
            ].map(tab => (
            <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-2 px-1 text-sm font-medium border-b-2 transition-colors
                ${activeTab === tab.id 
                    ? 'border-blue-600 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                `}
            >
                <tab.icon size={16} />
                {tab.label}
            </button>
            ))}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative bg-gray-50">
        {isSettingsOpen ? (
            <div className="h-full overflow-y-auto">
                <div className="max-w-6xl mx-auto py-8 px-4">
                    {/* Data Management Section */}
                    <div className="mb-8 bg-white rounded-lg shadow-sm border p-6">
                         <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                                    <Database className="w-5 h-5" /> Data Management
                                </h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    Save your work, restore backups, or reset the application. 
                                    <span className="ml-1 text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600 border border-gray-200">
                                        Auto-saves to browser
                                    </span>
                                </p>
                            </div>
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             <button 
                                onClick={handleJsonExport}
                                className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors font-medium shadow-sm"
                             >
                                 <Save size={18} className="text-blue-600" />
                                 Backup to JSON
                             </button>

                             <button 
                                onClick={() => jsonInputRef.current?.click()}
                                className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors font-medium shadow-sm"
                             >
                                 <Upload size={18} className="text-green-600" />
                                 Restore from JSON
                             </button>
                             <input 
                                type="file" 
                                ref={jsonInputRef} 
                                onChange={handleJsonImport} 
                                className="hidden" 
                                accept=".json"
                             />

                             <button 
                                onClick={handleResetData}
                                className="flex items-center justify-center gap-2 px-4 py-3 border border-red-200 rounded-lg hover:bg-red-50 text-red-700 transition-colors font-medium shadow-sm"
                             >
                                 <RefreshCw size={18} />
                                 Reset Application
                             </button>
                         </div>
                    </div>

                    <div className="mb-6 px-2">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Settings className="w-5 h-5" />
                            Settings: Residents & Cohorts
                        </h2>
                        <p className="text-gray-500 text-sm mt-1">Manage the roster and cohort assignments. Changes here apply to new generated schedules.</p>
                    </div>
                    <ResidentManager residents={residents} setResidents={setResidents} />
                </div>
            </div>
        ) : (
            <>
                {activeTab === 'schedule' && (
                <div className="h-full p-6 overflow-hidden flex flex-col">
                    <ScheduleTable 
                    residents={residents} 
                    schedule={currentGrid} 
                    onCellClick={handleCellClick}
                    />
                </div>
                )}
                {activeTab === 'workload' && (
                <div className="h-full overflow-y-auto">
                    <div className="min-h-full pb-20">
                    <Dashboard residents={residents} stats={stats} />
                    </div>
                </div>
                )}
                {activeTab === 'assignments' && (
                  <AssignmentStats residents={residents} schedule={currentGrid} />
                )}
                {activeTab === 'fairness' && (
                  <FairnessStats residents={residents} schedule={currentGrid} />
                )}
                {activeTab === 'requirements' && (
                  <RequirementsStats residents={residents} schedule={currentGrid} />
                )}
                {activeTab === 'relationships' && (
                <RelationshipStats residents={residents} schedule={currentGrid} />
                )}
            </>
        )}
      </main>

      {/* Edit Modal */}
      <AssignmentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        current={selectedCell && currentGrid[selectedCell.resId]?.[selectedCell.week]?.assignment || null}
        onSave={handleAssignmentSave}
      />
      
      {/* Schedule Comparison Modal */}
      {isCompareOpen && (
        <ScheduleComparison
          residents={residents}
          schedules={schedules}
          activeScheduleId={activeScheduleId}
          onSelect={setActiveScheduleId}
          onClose={() => setIsCompareOpen(false)}
          onBatchGenerate={handleBatchGenerate}
          progress={batchProgress}
        />
      )}
    </div>
  );
};

export default App;