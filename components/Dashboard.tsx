import React from 'react';
import { Resident, ScheduleStats, AssignmentType } from '../types';
import { ASSIGNMENT_COLORS } from '../constants';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Props {
  residents: Resident[];
  stats: ScheduleStats;
}

export const Dashboard: React.FC<Props> = ({ residents, stats }) => {
  
  // Transform data for Recharts
  const data = residents.map(r => {
    const s = stats[r.id] || {};
    return {
      name: r.name,
      pgy: `PGY${r.level}`,
      [AssignmentType.WARDS_RED]: s[AssignmentType.WARDS_RED] || 0,
      [AssignmentType.WARDS_BLUE]: s[AssignmentType.WARDS_BLUE] || 0,
      [AssignmentType.ICU]: s[AssignmentType.ICU] || 0,
      [AssignmentType.NIGHT_FLOAT]: s[AssignmentType.NIGHT_FLOAT] || 0,
      [AssignmentType.EM]: s[AssignmentType.EM] || 0,
      [AssignmentType.CLINIC]: s[AssignmentType.CLINIC] || 0,
      [AssignmentType.ELECTIVE]: s[AssignmentType.ELECTIVE] || 0,
      [AssignmentType.VACATION]: s[AssignmentType.VACATION] || 0,
      [AssignmentType.MET_WARDS]: s[AssignmentType.MET_WARDS] || 0,
    };
  });

  // Split by PGY for cleaner charts
  const pgy1Data = data.filter(d => d.pgy === 'PGY1');
  const pgy2Data = data.filter(d => d.pgy === 'PGY2');
  const pgy3Data = data.filter(d => d.pgy === 'PGY3');

  const ChartSection = ({ title, dataSet }: { title: string, dataSet: any[] }) => (
    <div className="mb-8 p-4 bg-white rounded-lg border shadow-sm">
      <h3 className="text-lg font-bold mb-4 text-gray-700">{title} Workload Distribution</h3>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dataSet} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" fontSize={10} angle={-45} textAnchor="end" height={60} />
            <YAxis domain={[0, 52]} />
            <Tooltip />
            <Legend />
            <Bar dataKey={AssignmentType.WARDS_RED} stackId="a" fill="#fca5a5" name="Wards Red" />
            <Bar dataKey={AssignmentType.WARDS_BLUE} stackId="a" fill="#93c5fd" name="Wards Blue" />
            <Bar dataKey={AssignmentType.ICU} stackId="a" fill="#d8b4fe" name="ICU" />
            <Bar dataKey={AssignmentType.NIGHT_FLOAT} stackId="a" fill="#4f46e5" name="Night Float" />
            <Bar dataKey={AssignmentType.EM} stackId="a" fill="#fdba74" name="EM" />
            <Bar dataKey={AssignmentType.CLINIC} stackId="a" fill="#fde047" name="Clinic" />
            <Bar dataKey={AssignmentType.ELECTIVE} stackId="a" fill="#86efac" name="Elective" />
            <Bar dataKey={AssignmentType.VACATION} stackId="a" fill="#e5e7eb" name="Vacation" />
            <Bar dataKey={AssignmentType.MET_WARDS} stackId="a" fill="#99f6e4" name="Met Wards" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <ChartSection title="PGY 1 (Interns)" dataSet={pgy1Data} />
      <ChartSection title="PGY 2" dataSet={pgy2Data} />
      <ChartSection title="PGY 3" dataSet={pgy3Data} />
    </div>
  );
};
