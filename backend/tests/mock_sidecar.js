import nock from 'nock';

/**
 * Mock the FastAPI sidecar /analyze endpoint
 */
export const mockSidecarAnalyze = (sidecarUrl = 'http://localhost:8000') => {
  return nock(sidecarUrl)
    .post('/api/analyze')
    .reply(200, {
      riskScore: 3.5,
      riskLabel: 'LOW',
      confidence: 0.9,
      rationale: ['Small change, well tested.'],
      radar: {
        dependencyRisk: 1,
        logicRisk: 2,
        dataExposure: 0,
        testingCoverage: 8,
      },
      blastRadius: {
        affectedServiceCount: 1,
        affectedFiles: ['index.js'],
        graphSnapshot: null,
      },
      staticMetrics: {
        linesAdded: 10,
        linesRemoved: 2,
        filesChanged: 1,
        cyclomaticComplexityDelta: 1,
        churnHistoryScore: 0.1,
        vulnerabilityFlags: [],
      },
      recommendedReviewers: ['developer1'],
      assignedReviewer: 'developer1',
      assignmentMethod: 'ai_suggested',
      diffAnnotations: [],
      similarHistoricalPRs: [],
      analyzedAt: new Date().toISOString(),
      geminiModelVersion: 'gemini-2.0-flash',
    });
};
