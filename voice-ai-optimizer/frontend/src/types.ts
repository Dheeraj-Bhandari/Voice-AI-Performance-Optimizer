export interface TestCase {
  id: string;
  name: string;
  category: string;
  description: string;
}

export interface TestSuite {
  id: string;
  _id?: string;
  name: string;
  testCases: TestCase[];
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface Evaluation {
  testCaseId: string;
  testCaseName?: string;
  passed: boolean;
  overallScore: number;
  reasoning: string;
  conversation?: ConversationTurn[];
}

export interface PromptChange {
  type: string;
  description: string;
  targetedFailure: string;
}

export interface PerformanceMetrics {
  relevance: number;
  accuracy: number;
  completeness: number;
  helpfulness: number;
  overall: number;
}

export interface TestResults {
  passRate: number;
  overallScore: number;
  evaluations: Evaluation[];
  metrics?: PerformanceMetrics;
}

export interface OptimizationResult {
  success: boolean;
  iterations: number;
  initialScore: number;
  finalScore: number;
  originalPrompt: string;
  optimizedPrompt: string;
  changes: PromptChange[];
  metrics?: PerformanceMetrics;
  testResults: {
    before: TestResults;
    after: TestResults;
  };
}

export interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'step';
}

export type Phase = 'idle' | 'running' | 'complete' | 'stopped';

export interface TestConversation {
  testName: string;
  conversation: ConversationTurn[];
  passed: boolean;
  score: number;
  reasoning: string;
}
