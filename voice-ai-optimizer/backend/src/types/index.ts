// ============================================
// Enums
// ============================================

export enum TestCategory {
  HAPPY_PATH = 'happy-path',
  EDGE_CASE = 'edge-case',
  ADVERSARIAL = 'adversarial',
  COMPLIANCE = 'compliance',
  INTERRUPTION = 'interruption',
  CLARIFICATION = 'clarification',
}

export enum CriteriaType {
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not-contains',
  SENTIMENT = 'sentiment',
  ACTION_TAKEN = 'action-taken',
  INFORMATION_COLLECTED = 'information-collected',
  TONE = 'tone',
  CUSTOM_LLM = 'custom-llm',
}

export enum EvaluatorType {
  REGEX = 'regex',
  KEYWORD = 'keyword',
  LLM = 'llm',
  FUNCTION = 'function',
}

export enum TestSuiteStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  PARTIAL = 'partial',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  RATE_LIMITED = 'rate-limited',
}

export enum OptimizationStatus {
  PENDING = 'pending',
  APPLIED = 'applied',
  VALIDATED = 'validated',
  ROLLED_BACK = 'rolled-back',
}

export enum Priority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}


// ============================================
// Conversation Types
// ============================================

export interface ConversationTurn {
  role: 'user' | 'expected-agent' | 'actual-agent';
  content: string;
  timing?: number; // Simulated delay in ms
  metadata?: Record<string, unknown>;
}

// ============================================
// Success Criteria Types
// ============================================

export interface RegexEvaluatorConfig {
  type: EvaluatorType.REGEX;
  config: {
    pattern: string;
    flags?: string;
  };
}

export interface KeywordEvaluatorConfig {
  type: EvaluatorType.KEYWORD;
  config: {
    keywords: string[];
    matchAll: boolean;
  };
}

export interface LLMEvaluatorConfig {
  type: EvaluatorType.LLM;
  config: {
    prompt: string;
    threshold: number;
  };
}

export interface FunctionEvaluatorConfig {
  type: EvaluatorType.FUNCTION;
  config: {
    functionName: string;
    params?: Record<string, unknown>;
  };
}

export type EvaluatorConfig = 
  | RegexEvaluatorConfig 
  | KeywordEvaluatorConfig 
  | LLMEvaluatorConfig 
  | FunctionEvaluatorConfig;

export interface SuccessCriteria {
  id: string;
  name: string;
  description: string;
  type: CriteriaType;
  evaluator: EvaluatorConfig;
  weight: number; // 0-1, importance for scoring
  required: boolean; // If true, failure = test failure
}

// ============================================
// Test Case Types
// ============================================

export interface TestCase {
  id: string;
  suiteId: string;
  name: string;
  description: string;
  category: TestCategory;
  conversationScript: ConversationTurn[];
  successCriteria: SuccessCriteria[];
  priority: Priority;
  tags: string[];
}

// ============================================
// Test Suite Types
// ============================================

export interface TestSuite {
  id: string;
  agentId: string;
  name: string;
  description: string;
  testCases: TestCase[];
  globalCriteria: SuccessCriteria[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
  status: TestSuiteStatus;
}


// ============================================
// Test Execution Types
// ============================================

export interface TestResponse {
  id: string;
  executionId: string;
  testCaseId: string;
  conversationTurns: ConversationTurn[];
  latency: number;
  rawResponse: string;
  timestamp: Date;
}

export interface CriteriaResult {
  criterionId: string;
  passed: boolean;
  score: number;
  reasoning: string;
}

export interface Evaluation {
  testCaseId: string;
  testCaseName?: string;
  passed: boolean;
  criteriaResults: CriteriaResult[];
  overallScore: number;
  reasoning: string;
  confidence: number;
  conversation?: { role: 'user' | 'assistant'; content: string }[];
}

export interface ExecutionResult {
  id: string;
  suiteId: string;
  agentId: string;
  responses: TestResponse[];
  evaluations: Evaluation[];
  duration: number;
  status: ExecutionStatus;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

// ============================================
// Analysis Types
// ============================================

export interface FailurePattern {
  id: string;
  description: string;
  affectedTestCases: string[];
  frequency: number;
  severity: Priority;
  suggestedFix?: string;
}

export interface AnalysisReport {
  executionId: string;
  overallScore: number;
  passRate: number;
  evaluations: Evaluation[];
  failurePatterns: FailurePattern[];
  recommendations: string[];
  generatedAt: Date;
}

export interface OptimizationInsights {
  failurePatterns: FailurePattern[];
  recommendations: string[];
  prioritizedFixes: string[];
}


// ============================================
// Optimization Types
// ============================================

export interface PromptChange {
  type: 'addition' | 'modification' | 'removal' | 'restructure';
  description: string;
  targetedFailure: string;
  before?: string;
  after?: string;
}

export interface PerformanceMetrics {
  overallScore: number;
  passRate: number;
  criteriaScores: Record<string, number>;
  avgResponseLatency: number;
}

export interface OptimizationRecord {
  id: string;
  agentId: string;
  executionId: string;
  originalPrompt: string;
  optimizedPrompt: string;
  changes: PromptChange[];
  beforeMetrics: PerformanceMetrics;
  afterMetrics?: PerformanceMetrics;
  status: OptimizationStatus;
  appliedAt?: Date;
  validatedAt?: Date;
  createdAt: Date;
}

// ============================================
// Agent Types
// ============================================

export interface VoiceSettings {
  voice?: string;
  speed?: number;
  pitch?: number;
}

export interface BusinessContext {
  industry?: string;
  useCase?: string;
  targetAudience?: string;
  complianceRequirements?: string[];
}

export interface AgentConfig {
  agentId: string;
  systemPrompt: string;
  voiceSettings?: VoiceSettings;
  businessContext?: BusinessContext;
  existingTestCases?: TestCase[];
}


// ============================================
// API Types
// ============================================

export interface GenerateTestsRequest {
  agentId: string;
  options?: {
    categories?: TestCategory[];
    minCases?: number;
    focus?: string;
  };
}

export interface GenerateTestsResponse {
  success: boolean;
  testSuite: TestSuite;
}

export interface ExecuteTestsRequest {
  suiteId: string;
}

export interface ExecuteTestsResponse {
  success: boolean;
  jobId: string;
}

export interface OptimizeRequest {
  suiteId: string;
  maxIterations?: number;
  targetScore?: number;
}

export interface OptimizeResponse {
  success: boolean;
  jobId: string;
}

export interface JobStatusResponse {
  id: string;
  status: string;
  progress: number;
  phase?: string;
  result?: unknown;
  error?: string;
}

// ============================================
// Validation Helpers
// ============================================

export function isValidWeight(weight: number): boolean {
  return weight >= 0 && weight <= 1;
}

export function isValidRequiredCriteriaWeight(criteria: SuccessCriteria): boolean {
  if (criteria.required) {
    return criteria.weight >= 0.5;
  }
  return true;
}

export function doWeightsSumToOne(criteria: SuccessCriteria[]): boolean {
  if (criteria.length === 0) return true;
  const sum = criteria.reduce((acc, c) => acc + c.weight, 0);
  return Math.abs(sum - 1) < 0.001; // Allow small floating point error
}

export function isConversationScriptValid(script: ConversationTurn[]): boolean {
  if (script.length === 0) return false;
  return script[0].role === 'user';
}
