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
import { 
  LayoutGrid, 
  Users, 
  BarChart3, 
  Play, 
  Download,
  Network
} from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'schedule' | 'residents' | 'stats' | 'relationships'>('schedule');
  const [residents, setResidents] = useState<Resident[]>(GENERATE_INITIAL_RESIDENTS());
  const [schedule, setSchedule] = useState<ScheduleGrid>({});
  
  // Stats derivation
  const stats = React.useMemo(() => calculateStats(residents, schedule), [residents, schedule]);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{resId: string, week: number} | null>(null);

  useEffect(() => {
    // Initial generation on load
    handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = () => {
    // Generate new schedule based on current residents
    // Passing {} as second arg to reset, or pass 'schedule' to keep locked items
    const newSchedule = generateSchedule(residents, schedule);
    setSchedule(newSchedule);
  };

  const handleCellClick = (resId: string, week: number) => {
    setSelectedCell({ resId, week });
    setModalOpen(true);
  };

  const handleAssignmentSave = (type: AssignmentType | null) => {
    if (selectedCell) {
      setSchedule(prev => {
        const copy = { ...prev };
        if (!copy[selectedCell.resId]) copy[selectedCell.resId] = [];
        // Ensure array exists up to this week
        
        copy[selectedCell.resId][selectedCell.week] = {
          assignment: type as any,
          locked: true // Manual edits are locked by default
        };
        return copy;
      });
    }
    setModalOpen(false);
  };

  const handleExportCSV = () => {
    let csv = "Resident,PGY,Cohort," + Array.from({length: 52}, (_, i) => `Week ${i+1}`).join(",") + "\n";
    residents.forEach(r => {
        const row = [r.name, r.level, String.fromCharCode(65 + r.cohort)];
        for(let i=0; i<52; i++) {
            const cell = schedule[r.id]?.[i];
            row.push(cell?.assignment ? ASSIGNMENT_LABELS[cell.assignment] : "");
        }
        csv += row.join(",") + "\n";
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'residency_schedule.csv';
    a.click();
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 text-gray-900 font-sans overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm z-30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-200">
            R
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">Residency Scheduler Pro</h1>
            <p className="text-xs text-gray-500">4+1 Rotation Manager</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
            <button 
                onClick={handleGenerate}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors shadow-sm"
            >
                <Play size={16} /> Auto-Generate
            </button>
            <button 
                onClick={handleExportCSV}
                className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-md font-medium transition-colors"
            >
                <Download size={16} /> Export
            </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="px-6 py-2 bg-white border-b border-gray-200 flex gap-6 z-20 shadow-sm shrink-0">
        {[
          { id: 'schedule', label: 'Master Schedule', icon: LayoutGrid },
          { id: 'residents', label: 'Residents & Cohorts', icon: Users },
          { id: 'stats', label: 'Workload Stats', icon: BarChart3 },
          { id: 'relationships', label: 'Relationship Stats', icon: Network },
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

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative bg-gray-50">
        {activeTab === 'schedule' && (
          <div className="h-full p-6 overflow-hidden flex flex-col">
            <ScheduleTable 
              residents={residents} 
              schedule={schedule} 
              onCellClick={handleCellClick}
            />
          </div>
        )}
        {activeTab === 'residents' && (
          <div className="h-full overflow-y-auto">
            <div className="min-h-full pb-20">
              <ResidentManager residents={residents} setResidents={setResidents} />
            </div>
          </div>
        )}
        {activeTab === 'stats' && (
          <div className="h-full overflow-y-auto">
             <div className="min-h-full pb-20">
               <Dashboard residents={residents} stats={stats} />
             </div>
          </div>
        )}
        {activeTab === 'relationships' && (
          <RelationshipStats residents={residents} schedule={schedule} />
        )}
      </main>

      {/* Edit Modal */}
      <AssignmentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        current={selectedCell && schedule[selectedCell.resId]?.[selectedCell.week]?.assignment || null}
        onSave={handleAssignmentSave}
      />
    </div>
  );
};

export default App;