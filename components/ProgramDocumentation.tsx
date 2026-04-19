import React from 'react';
import { 
  BookOpen, 
  HelpCircle, 
  AlertTriangle, 
  Info, 
  ShieldCheck, 
  Zap, 
  Scale, 
  RefreshCcw,
  Stethoscope,
  Clock
} from 'lucide-react';
import { ROTATION_METADATA, REQUIREMENTS } from '../constants';
import { AssignmentType } from '../types';

export const ProgramDocumentation: React.FC = () => {
  return (
    <div className="p-8 h-full overflow-y-auto bg-gray-50 pb-64 font-sans">
      <div className="max-w-4xl mx-auto space-y-10">
        
        {/* Header */}
        <div className="bg-indigo-900 text-white p-8 rounded-2xl shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="w-8 h-8 text-indigo-300" />
            <h1 className="text-3xl font-black tracking-tight">Documentation</h1>
          </div>
          <p className="text-indigo-100 text-lg opacity-90 max-w-2xl">
            An overview of the mathematical assumptions, clinical rotations, and known constraints within the 4+1 Residency Scheduling Engine.
          </p>
        </div>

        {/* 1. Rotation Taxonomy */}
        <section>
          <div className="flex items-center gap-2 mb-4 border-b pb-2">
            <Stethoscope className="text-indigo-600" size={20} />
            <h2 className="text-xl font-bold text-gray-800">1. Rotation Taxonomy</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border shadow-sm">
                <h3 className="font-bold text-red-600 mb-2 uppercase text-xs tracking-widest">Staffing-Critical</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  <strong>Wards, ICU, Night Float.</strong> These are the engine's highest priority. The hospital cannot function without minimum resident counts. The scheduler fills these first.
                </p>
            </div>
            <div className="bg-white p-5 rounded-xl border shadow-sm">
                <h3 className="font-bold text-blue-600 mb-2 uppercase text-xs tracking-widest">Graduation-Required</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  <strong>Specialties (Cards, GI, etc).</strong> Essential for board eligibility. The scheduler attempts to "slot" these into the remaining gaps left by Staffing blocks.
                </p>
            </div>
            <div className="bg-white p-5 rounded-xl border shadow-sm">
                <h3 className="font-bold text-green-600 mb-2 uppercase text-xs tracking-widest">Maintenance</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  <strong>Clinic (CCIM), Vacation.</strong> These are non-negotiable. Clinic is locked based on Cohort (A-E), ensuring outpatient volume is predictable and steady.
                </p>
            </div>
          </div>
        </section>

        {/* 2. Core Assumptions */}
        <section>
          <div className="flex items-center gap-2 mb-4 border-b pb-2">
            <Zap className="text-amber-500" size={20} />
            <h2 className="text-xl font-bold text-gray-800">2. Algorithmic Assumptions</h2>
          </div>
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="p-6 space-y-6">
              <div className="flex gap-4">
                <div className="bg-indigo-50 p-3 rounded-lg h-fit text-indigo-600"><Clock size={20}/></div>
                <div>
                  <h4 className="font-bold text-gray-800">The "4+1" Cohort Assumption</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Every resident is assigned to one of five cohorts (0-4). The system assumes that every 5th week (e.g., Week 1, 6, 11) is dedicated to outpatient clinic. No inpatient service can pull a resident from their clinic week.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 border-t pt-6">
                <div className="bg-green-50 p-3 rounded-lg h-fit text-green-600"><ShieldCheck size={20}/></div>
                <div>
                  <h4 className="font-bold text-gray-800">Staffing-First Priority</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Phase 1 of the generator fills "must-staff" blocks. It assumes that hospital coverage is more critical than specific elective timing. A resident may receive their cardiology block early or late depending on when the ICU needs bodies.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 border-t pt-6">
                <div className="bg-blue-50 p-3 rounded-lg h-fit text-blue-600"><Scale size={20}/></div>
                <div>
                  <h4 className="font-bold text-gray-800">Diversity vs. Stability</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    The engine assumes team diversity is a pedagogical benefit. It uses a random-weighted shuffle to ensure interns don't work with the same senior for more than 8-10 weeks per year.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. The "Scheduling Problem" */}
        <section>
          <div className="flex items-center gap-2 mb-4 border-b pb-2">
            <AlertTriangle className="text-red-500" size={20} />
            <h2 className="text-xl font-bold text-gray-800">3. Known Problems & Challenges</h2>
          </div>
          <div className="space-y-4">
            <div className="bg-red-50 p-6 rounded-xl border border-red-100 flex gap-4">
              <div className="p-2 bg-white rounded-lg text-red-600 shadow-sm h-fit"><RefreshCcw size={20}/></div>
              <div>
                <h4 className="font-bold text-red-900">The "NP-Hard" Staffing Conflict</h4>
                <p className="text-sm text-red-800/80 mt-1">
                  With 38 residents and 52 weeks, the system occasionally reaches a mathematical "deadlock." For example, if too many residents take vacation in December, the system may be unable to meet the ICU minimum staffing requirements while still fulfilling individual specialty goals.
                </p>
              </div>
            </div>

            <div className="bg-orange-50 p-6 rounded-xl border border-orange-100 flex gap-4">
                <div className="p-2 bg-white rounded-lg text-orange-600 shadow-sm h-fit"><Scale size={20}/></div>
                <div>
                  <h4 className="font-bold text-orange-900">High-Intensity Streaks (Burnout)</h4>
                  <p className="text-sm text-orange-800/80 mt-1">
                    While the scheduler tracks "Intensity Score," it does not always prevent "Back-to-Back" heavy rotations. A resident might theoretically receive 4 weeks of ICU followed immediately by 4 weeks of Wards-Red if that is the only way to satisfy staffing minimums.
                  </p>
                </div>
            </div>

            <div className="bg-gray-100 p-6 rounded-xl border border-gray-200 flex gap-4">
                <div className="p-2 bg-white rounded-lg text-gray-600 shadow-sm h-fit"><HelpCircle size={20}/></div>
                <div>
                  <h4 className="font-bold text-gray-900">The "Missing Requirement" Failure</h4>
                  <p className="text-sm text-gray-700/80 mt-1">
                    The generator is a "greedy" algorithm. If it cannot find a 2-week gap for a required specialty (like Pulmonary), it will fill that week with an Elective to prevent a blank schedule. Users must use the <strong>Requirements Tab</strong> to audit these rare failures.
                  </p>
                </div>
            </div>
          </div>
        </section>

        {/* Closing Tip */}
        <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-2xl flex gap-4 items-center">
          <Info className="text-blue-600 shrink-0" size={32} />
          <div>
            <h4 className="font-bold text-blue-900">Chief Resident Tip:</h4>
            <p className="text-blue-800 text-sm">
              Use the <strong>"Auto-Optimize (Batch Generate)"</strong> button in the Comparison view. It runs the simulation 20 times and keeps only the candidates with the highest fairness scores and lowest staffing violations.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};