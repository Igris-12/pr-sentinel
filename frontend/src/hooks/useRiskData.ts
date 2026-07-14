import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

/**
 * RiskData interface matching the PRSentinel risk score schema.
 */
export interface RiskAnalysis {
  riskScore: number;
  riskLabel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  rationale: string[];
  radar: {
    dependencyRisk: number;
    logicRisk: number;
    dataExposure: number;
    testingCoverage: number;
  };
  blastRadius: {
    affectedServiceCount: number;
    affectedFiles: string[];
  };
  staticMetrics: {
    linesAdded: number;
    linesRemoved: number;
    filesChanged: number;
    cyclomaticComplexityDelta: number;
    churnHistoryScore: number;
  };
  diffAnnotations: Array<{
    file: string;
    line: number;
    severity: string;
    note: string;
  }>;
  geminiModelVersion: string;
  analyzedAt: string;
}

export interface PRRiskDetailResponse {
  pr: PRMetadata;
  analysis: RiskAnalysis | null;
}

interface PRMetadata {
  _id: string;
  number: number;
  title: string;
  repoFullName: string;
  body?: string;
}

export interface RiskDataResult {
  pr: PRMetadata;
  analysis: RiskAnalysis | null;
}

/**
 * Hook to fetch actual risk data from the backend.
 */
export const useRiskData = (prId: string) => {
  return useQuery<RiskDataResult>({
    queryKey: ['risk-data', prId],
    queryFn: async () => {
      const response = await api.get(`/risk/${prId}`);
      return response.data.data;
    },
    enabled: !!prId,
  });
};
