import React, { useState, useEffect } from 'react';
import { 
  Resident, 
  ScheduleGrid, 
  AssignmentType 
} from './types';
import { GENERATE_INITIAL_RESIDENTS, ASSIGNMENT_LABELS } from './constants';
import { generateSchedule, calculateStats } from './services/scheduler';
import { ScheduleTable } from './components/ScheduleTable';
import { Dashboard } from './components/Dashboard';
import { ResidentManager } from './components/ResidentManager';
import { RelationshipStats } from './components/RelationshipStats';
import { AssignmentStats } from './components/AssignmentStats';
import { FairnessStats } from './components/FairnessStats';
import { 
  LayoutGrid, 
  BarChart3, 
  Plus, 
  Download,
  Network,
  Settings,
  X,
  Table,
  Scale
} from 'lucide-react';

interface ScheduleSession {
  id: string;
  name: string;
  data: ScheduleGrid;
  createdAt: Date;
}

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
  const [activeTab, setActiveTab] = useState<'schedule' | 'workload' | 'relationships' | 'assignments' | 'fairness'>('schedule');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [residents, setResidents] = useState<Resident[]>(GENERATE_INITIAL_RESIDENTS());
  
  // Multiple Schedules State
  const [schedules, setSchedules] = useState<ScheduleSession[]>([]);
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);

  // Derived state for active schedule
  const activeSchedule = schedules.find(s => s.id === activeScheduleId);
  const currentGrid = activeSchedule?.data || {};
  
  // Stats derivation
  const stats = React.useMemo(() => calculateStats(residents, currentGrid), [residents, currentGrid]);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{resId: string, week: number} | null>(null);

  useEffect(() => {
    // Initial generation on load
    const initialGrid = generateSchedule(residents, {});
    const initialSession: ScheduleSession = {
        id: 'init-1',
        name: 'Schedule 1',
        data: initialGrid,
        createdAt: new Date()
    };
    setSchedules([initialSession]);
    setActiveScheduleId(initialSession.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = () => {
    // Generate new schedule based on current residents
    // We use the *currently active* schedule as a base to respect locks, 
    // but generate a fresh entry for comparison.
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
    
    // Switch away from settings if open
    if (isSettingsOpen) setIsSettingsOpen(false);
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

  const handleExportCSV = () => {
    if (!activeSchedule) return;

    let csv = "Resident,PGY,Cohort," + Array.from({length: 52}, (_, i) => `Week ${i+1}`).join(",") + "\n";
    residents.forEach(r => {
        const row = [r.name, r.level, String.fromCharCode(65 + r.cohort)];
        for(let i=0; i<52; i++) {
            const cell = activeSchedule.data[r.id]?.[i];
            row.push(cell?.assignment ? ASSIGNMENT_LABELS[cell.assignment] : "");
        }
        csv += row.join(",") + "\n";
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeSchedule.name.replace(/\s+/g, '_').toLowerCase()}.csv`;
    a.click();
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
                <Plus size={18} /> Generate
            </button>
            <button 
                onClick={handleExportCSV}
                className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-md font-medium transition-colors"
            >
                <Download size={18} /> Export
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
                <div className="max-w-6xl mx-auto py-8">
                    <div className="mb-6 px-6">
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <Settings className="w-6 h-6" />
                            Settings: Residents & Cohorts
                        </h2>
                        <p className="text-gray-500">Manage the roster and cohort assignments. Changes here apply to new generated schedules.</p>
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
    </div>
  );
};

export default App;