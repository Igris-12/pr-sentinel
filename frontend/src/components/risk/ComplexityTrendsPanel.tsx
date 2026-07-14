import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface ComplexityTrend {
  date: string;
  linesOfCode: number;
  cyclomaticComplexity: number;
  maintainabilityIndex: number;
  churn: number;
  cognitiveLoad: number;
}

interface ComplexityTrendsPanelProps {
  data: ComplexityTrend[];
}

const ComplexityTrendsPanel: React.FC<ComplexityTrendsPanelProps> = ({ data }) => {
  return (
    <div className="w-full h-full min-h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorLoC" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--ps-border, rgba(255,255,255,0.07))" />
          <XAxis 
            dataKey="date" 
            stroke="var(--ps-text-muted)" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            stroke="var(--ps-text-muted)" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'var(--ps-card, #1c2333)', 
              borderColor: 'var(--ps-border, rgba(255,255,255,0.07))',
              borderRadius: '8px',
              fontSize: '12px'
            }} 
          />
          <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
          <Area
            type="monotone"
            dataKey="linesOfCode"
            stroke="#8884d8"
            fillOpacity={1}
            fill="url(#colorLoC)"
            name="Lines of Code"
          />
          <Area
            type="monotone"
            dataKey="cyclomaticComplexity"
            stroke="#82ca9d"
            fill="transparent"
            name="Cyclomatic Complexity"
          />
          <Area
            type="monotone"
            dataKey="maintainabilityIndex"
            stroke="#ffc658"
            fill="transparent"
            name="Maintainability Index"
          />
          <Area
            type="monotone"
            dataKey="churn"
            stroke="#ff7300"
            fill="transparent"
            name="Churn Score"
          />
          <Area
            type="monotone"
            dataKey="cognitiveLoad"
            stroke="#0088fe"
            fill="transparent"
            name="Cognitive Load"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ComplexityTrendsPanel;
