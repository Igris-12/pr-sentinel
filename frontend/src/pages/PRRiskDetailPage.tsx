import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCcw } from 'lucide-react';
import { useRiskData } from '../hooks/useRiskData';
import ComplexityTrendsPanel from '../components/risk/ComplexityTrendsPanel';
import VulnerabilityRadarPanel from '../components/risk/VulnerabilityRadarPanel';
import ExplainableAIPanel from '../components/risk/ExplainableAIPanel';
import AnnotatedDiffPanel from '../components/risk/AnnotatedDiffPanel';

/**
 * PRRiskDetailPage
 * Displays detailed AI risk analysis for a specific pull request,
 * fetching actual data from the /api/risk/:prId endpoint.
 */
export const PRRiskDetailPage: React.FC = () => {
  const { prId } = useParams<{ prId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } = useRiskData(prId || '');

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <RefreshCcw className="animate-spin text-ps-primary" size={32} />
        <p className="text-ps-text-muted">Analyzing PR risk intelligence...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 text-center px-4">
        <div className="p-4 rounded-full bg-red-500/10 text-red-400 mb-2">
          <RefreshCcw size={32} />
        </div>
        <h2 className="text-xl font-bold">Failed to load risk data</h2>
        <p className="text-ps-text-muted max-w-md">
          {error?.message || 'The PR analysis might still be in progress or does not exist.'}
        </p>
        <div className="flex gap-3 mt-4">
          <button onClick={() => navigate(-1)} className="btn-ghost">
            <ArrowLeft size={16} className="mr-2" /> Go Back
          </button>
          <button onClick={() => refetch()} className="btn-magnetic">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const { pr, analysis } = data;

  // Transform radar data for Recharts
  const radarData = analysis ? [
    { subject: 'Logic', A: analysis.radar.logicRisk, fullMark: 10 },
    { subject: 'Dependencies', A: analysis.radar.dependencyRisk, fullMark: 10 },
    { subject: 'Data Exposure', A: analysis.radar.dataExposure, fullMark: 10 },
    { subject: 'Testing', A: analysis.radar.testingCoverage, fullMark: 10 },
  ] : [];

  // Mock Complexity Trends (since it's not yet in the analysis model but requested for the UI)
  const mockComplexityTrends = [
    { date: '2026-05-01', linesOfCode: 120, cyclomaticComplexity: 5, maintainabilityIndex: 85, churn: 2, cognitiveLoad: 4 },
    { date: '2026-05-05', linesOfCode: 240, cyclomaticComplexity: 12, maintainabilityIndex: 78, churn: 5, cognitiveLoad: 8 },
    { date: '2026-05-10', linesOfCode: 310, cyclomaticComplexity: 18, maintainabilityIndex: 70, churn: 8, cognitiveLoad: 12 },
    { date: '2026-05-15', linesOfCode: 450, cyclomaticComplexity: 25, maintainabilityIndex: 62, churn: 12, cognitiveLoad: 18 },
    { date: 'Today', linesOfCode: pr.linesAdded || 0, cyclomaticComplexity: analysis?.staticMetrics.cyclomaticComplexityDelta || 0, maintainabilityIndex: 65, churn: analysis?.staticMetrics.churnHistoryScore || 0, cognitiveLoad: 20 },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-ps-text-muted text-xs mb-1 uppercase tracking-widest font-bold">
            <button onClick={() => navigate(-1)} className="hover:text-ps-primary transition-colors">
              PR Health
            </button>
            <span>/</span>
            <span>{pr.repoFullName}</span>
          </div>
          <h1 className="text-2xl font-bold">
            PR #{pr.number}: {pr.title}
          </h1>
        </div>
        <div className="flex gap-2">
           <button onClick={() => refetch()} className="btn-ghost p-2">
             <RefreshCcw size={18} />
           </button>
           <a 
             href={`https://github.com/${pr.repoFullName}/pull/${pr.number}`} 
             target="_blank" 
             rel="noreferrer"
             className="btn-magnetic text-sm px-4"
           >
             View on GitHub
           </a>
        </div>
      </div>

      {/* 5-Panel Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Panel 1: Risk Overview & Score */}
        <div className="ps-card p-6 rounded-xl border border-ps-border bg-ps-card shadow-sm col-span-1 lg:col-span-1 min-h-[200px]">
          <h3 className="text-sm font-medium text-ps-text-muted mb-4 text-center">Current Risk State</h3>
          <div className="flex flex-col items-center justify-center h-full -mt-4">
            <div className={`text-6xl font-black mb-2 ${
              analysis?.riskLabel === 'CRITICAL' ? 'text-red-500' :
              analysis?.riskLabel === 'HIGH' ? 'text-orange-500' :
              analysis?.riskLabel === 'MEDIUM' ? 'text-ps-primary' : 'text-green-500'
            }`}>
              {analysis?.riskScore.toFixed(1) || '0.0'}
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase ${
              analysis?.riskLabel === 'CRITICAL' ? 'bg-red-500/10 text-red-400' :
              analysis?.riskLabel === 'HIGH' ? 'bg-orange-500/10 text-orange-400' :
              analysis?.riskLabel === 'MEDIUM' ? 'bg-ps-primary/10 text-ps-primary' : 'bg-green-500/10 text-green-400'
            }`}>
              {analysis?.riskLabel || 'UNRANKED'}
            </div>
          </div>
        </div>

        {/* Panel 2: Complexity Trends */}
        <div className="ps-card p-6 rounded-xl border border-ps-border bg-ps-card shadow-sm col-span-1 md:col-span-2 lg:col-span-2 min-h-[300px]">
          <h3 className="text-sm font-medium text-ps-text-muted mb-4">Complexity Trends</h3>
          <ComplexityTrendsPanel data={mockComplexityTrends} />
        </div>

        {/* Panel 3: Risk Radar */}
        <div className="ps-card p-6 rounded-xl border border-ps-border bg-ps-card shadow-sm min-h-[350px]">
          <h3 className="text-sm font-medium text-ps-text-muted mb-4">Risk Dimensions</h3>
          <VulnerabilityRadarPanel data={radarData} />
        </div>

        {/* Panel 4: Explainable AI (Rationale) */}
        <div className="ps-card p-6 rounded-xl border border-ps-border bg-ps-card shadow-sm col-span-1 md:col-span-2 lg:col-span-2 min-h-[350px]">
          <ExplainableAIPanel 
            rationale={analysis?.rationale || ['No rationale provided.']} 
            confidence={analysis?.confidence || 0} 
          />
        </div>

        {/* Panel 5: Annotated Code Diff */}
        <div className="ps-card p-6 rounded-xl border border-ps-border bg-ps-card shadow-sm col-span-1 md:col-span-3 lg:col-span-3 min-h-[400px]">
          {/* Note: In a real app, we might need a separate endpoint for the diff if it's large, 
              but for now we assume it's part of the risk analysis or PR metadata */}
          <AnnotatedDiffPanel 
            diff={pr.body || 'No diff content available for display.'} 
            annotations={analysis?.diffAnnotations || []} 
          />
        </div>

      </div>
    </div>
  );
};

export default PRRiskDetailPage;
