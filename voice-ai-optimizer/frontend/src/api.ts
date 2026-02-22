import axios from 'axios';
import { TestSuite, OptimizationResult, TestResults } from './types';

const API_BASE = '/api';

export interface ExecuteTestsResponse {
  results: TestResults;
  currentPrompt: string;
}

export interface OptimizedPromptResponse {
  success: boolean;
  hasOptimized: boolean;
  optimizedPrompt?: string;
  originalPrompt?: string;
  score?: number;
  iterations?: number;
  updatedAt?: string;
}

export interface CheckOptimizedResponse {
  success: boolean;
  results: TestResults;
  currentPrompt: string;
  testSuite: TestSuite;
}

export const api = {
  async generateTests(agentId: string, signal?: AbortSignal): Promise<TestSuite> {
    const response = await axios.post(
      `${API_BASE}/agents/${agentId}/generate-tests`,
      {},
      { signal }
    );
    return response.data.testSuite;
  },

  async executeTests(suiteId: string, signal?: AbortSignal): Promise<ExecuteTestsResponse> {
    const response = await axios.post(
      `${API_BASE}/test-suites/${suiteId}/execute`,
      {},
      { signal }
    );
    return {
      results: response.data.results,
      currentPrompt: response.data.currentPrompt,
    };
  },

  async optimize(suiteId: string, maxIterations: number, signal?: AbortSignal): Promise<OptimizationResult> {
    const response = await axios.post(
      `${API_BASE}/test-suites/${suiteId}/optimize`,
      { maxIterations },
      { signal }
    );
    return response.data.result;
  },

  async getOptimizedPrompt(agentId: string): Promise<OptimizedPromptResponse> {
    const response = await axios.get(`${API_BASE}/agents/${agentId}/optimized-prompt`);
    return response.data;
  },

  async resetOptimization(agentId: string): Promise<{ success: boolean; message: string }> {
    const response = await axios.delete(`${API_BASE}/agents/${agentId}/optimized-prompt`);
    return response.data;
  },

  async checkOptimized(agentId: string, signal?: AbortSignal): Promise<CheckOptimizedResponse> {
    const response = await axios.post(
      `${API_BASE}/agents/${agentId}/check-optimized`,
      {},
      { signal }
    );
    return response.data;
  },
};
