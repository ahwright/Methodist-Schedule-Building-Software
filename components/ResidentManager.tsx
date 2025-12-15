import React, { useState, useRef } from 'react';
import { Resident, PgyLevel } from '../types';
import { Trash2, Plus, UserPlus, Upload, Pencil, Check, X } from 'lucide-react';
import { COHORT_COUNT } from '../constants';

interface Props {
  residents: Resident[];
  setResidents: React.Dispatch<React.SetStateAction<Resident[]>>;
}

export const ResidentManager: React.FC<Props> = ({ residents, setResidents }) => {
  // New Resident State
  const [newResidentName, setNewResidentName] = useState('');
  const [newResidentLevel, setNewResidentLevel] = useState<PgyLevel>(1);
  const [newResidentCohort, setNewResidentCohort] = useState<number>(0);
  
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editLevel, setEditLevel] = useState<PgyLevel>(1);
  const [editCohort, setEditCohort] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    if (!newResidentName.trim()) return;
    const newId = `manual-${Date.now()}`;
    const newResident: Resident = {
      id: newId,
      name: newResidentName,
      level: newResidentLevel,
      cohort: newResidentCohort,
      avoidResidentIds: [],
    };
    setResidents(prev => [...prev, newResident]);
    setNewResidentName('');
  };

  const handleRemove = (id: string) => {
    if(confirm('Are you sure you want to remove this resident?')) {
        setResidents(prev => prev.filter(r => r.id !== id));
    }
  };

  const startEditing = (resident: Resident) => {
    setEditingId(resident.id);
    setEditName(resident.name);
    setEditLevel(resident.level);
    setEditCohort(resident.cohort);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName('');
    setEditLevel(1);
    setEditCohort(0);
  };

  const saveEditing = () => {
    if (editingId) {
      setResidents(prev => prev.map(r => {
        if (r.id === editingId) {
          return {
            ...r,
            name: editName,
            level: editLevel,
            cohort: editCohort
          };
        }
        return r;
      }));
      cancelEditing();
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processCSV(text);
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const processCSV = (text: string) => {
    const lines = text.split('\n');
    const newResidents: Resident[] = [];
    
    // Check for header row (heuristic: check if first row has "Name" or "Level")
    let startIndex = 0;
    const firstLineLower = lines[0].toLowerCase();
    if (firstLineLower.includes('name') || firstLineLower.includes('level') || firstLineLower.includes('cohort')) {
        startIndex = 1;
    }

    let idCounter = 1;

    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Split by comma
        const parts = line.split(',').map(p => p.trim());
        
        // Flexible format: 
        // 1. Name, Level, Cohort
        // 2. Name, Level (Cohort auto-assigned)
        if (parts.length < 2) continue; 

        const name = parts[0];
        // Remove quotes if present
        const cleanName = name.replace(/^"|"$/g, '');
        
        const levelStr = parts[1];
        const level = parseInt(levelStr) as PgyLevel;
        
        // Validation
        if (!cleanName || ![1, 2, 3].includes(level)) continue;

        let cohort = 0;
        if (parts[2]) {
            const parsedCohort = parseInt(parts[2]);
            if (!isNaN(parsedCohort) && parsedCohort >= 0 && parsedCohort < COHORT_COUNT) {
                cohort = parsedCohort;
            } else {
                 cohort = (newResidents.length) % COHORT_COUNT;
            }
        } else {
             // Auto distribute
             cohort = (newResidents.length) % COHORT_COUNT;
        }

        newResidents.push({
            id: `imported-${Date.now()}-${idCounter++}`,
            name: cleanName,
            level,
            cohort,
            avoidResidentIds: []
        });
    }

    if (newResidents.length > 0) {
        if(confirm(`Found ${newResidents.length} residents. Replace existing list?`)) {
            setResidents(newResidents);
        }
    } else {
        alert("No valid residents found. Format expected: Name, Level (1-3), [Cohort (0-4)]");
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept=".csv" 
        className="hidden" 
      />

      <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
            <UserPlus className="w-5 h-5" /> Manage Residents
            </h2>
            <button
                onClick={handleImportClick}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 px-3 py-1.5 rounded hover:bg-blue-50 transition-colors"
            >
                <Upload size={14} /> Import CSV
            </button>
        </div>
        
        <div className="flex gap-4 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={newResidentName}
              onChange={(e) => setNewResidentName(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="e.g. Dr. Smith"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PGY Level</label>
            <select
              value={newResidentLevel}
              onChange={(e) => setNewResidentLevel(Number(e.target.value) as PgyLevel)}
              className="border border-gray-300 rounded-md p-2 w-24 bg-white"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cohort</label>
            <select
              value={newResidentCohort}
              onChange={(e) => setNewResidentCohort(Number(e.target.value))}
              className="border border-gray-300 rounded-md p-2 w-24 bg-white"
            >
              {[0,1,2,3,4].map(c => (
                <option key={c} value={c}>{String.fromCharCode(65 + c)}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAdd}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus size={16} /> Add
          </button>
        </div>
        <div className="mt-2 text-xs text-gray-400">
            CSV Format: Name, Level, Cohort (optional). Example: "John Doe, 1, 0"
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="p-4 border-b bg-gray-50 font-semibold text-gray-700 grid grid-cols-12 gap-4">
            <div className="col-span-6">Name</div>
            <div className="col-span-2 text-center">Level</div>
            <div className="col-span-2 text-center">Cohort</div>
            <div className="col-span-2 text-center">Actions</div>
        </div>
        <div className="overflow-visible">
            {residents.map(r => {
              const isEditing = editingId === r.id;
              
              return (
                <div key={r.id} className={`p-4 border-b last:border-0 grid grid-cols-12 gap-4 items-center ${isEditing ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    {isEditing ? (
                      <>
                        <div className="col-span-6">
                          <input 
                            type="text" 
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full border border-blue-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-200 outline-none"
                            autoFocus
                          />
                        </div>
                        <div className="col-span-2 text-center">
                          <select
                            value={editLevel}
                            onChange={(e) => setEditLevel(Number(e.target.value) as PgyLevel)}
                            className="border border-blue-300 rounded px-1 py-1 text-sm bg-white"
                          >
                            <option value={1}>PGY-1</option>
                            <option value={2}>PGY-2</option>
                            <option value={3}>PGY-3</option>
                          </select>
                        </div>
                        <div className="col-span-2 text-center">
                          <select
                            value={editCohort}
                            onChange={(e) => setEditCohort(Number(e.target.value))}
                            className="border border-blue-300 rounded px-1 py-1 text-sm bg-white"
                          >
                            {[0,1,2,3,4].map(c => (
                              <option key={c} value={c}>{String.fromCharCode(65 + c)}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2 text-center flex justify-center gap-2">
                           <button onClick={saveEditing} className="text-green-600 hover:text-green-800 p-1 bg-green-100 rounded hover:bg-green-200" title="Save">
                             <Check size={16}/>
                           </button>
                           <button onClick={cancelEditing} className="text-gray-500 hover:text-gray-700 p-1 bg-gray-200 rounded hover:bg-gray-300" title="Cancel">
                             <X size={16}/>
                           </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="col-span-6 font-medium">{r.name}</div>
                        <div className="col-span-2 text-center">
                            <span className={`px-2 py-1 rounded text-xs font-bold 
                                ${r.level === 1 ? 'bg-green-100 text-green-800' : r.level === 2 ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                                PGY-{r.level}
                            </span>
                        </div>
                        <div className="col-span-2 text-center font-mono">
                            {String.fromCharCode(65 + r.cohort)}
                        </div>
                        <div className="col-span-2 text-center flex justify-center gap-2">
                            <button 
                                onClick={() => startEditing(r)}
                                className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50"
                                title="Edit"
                            >
                                <Pencil size={16} />
                            </button>
                            <button 
                                onClick={() => handleRemove(r.id)}
                                className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                                title="Delete"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                      </>
                    )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};