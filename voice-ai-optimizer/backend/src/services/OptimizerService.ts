import { v4 as uuidv4 } from 'uuid';
import { llmClient } from './LLMClient.js';
import { highLevelClient } from './HighLevelClient.js';
import { TestSuiteModel, OptimizedPromptModel, getOrCreateAgent } from '../models/index.js';
import {
  TestSuite,
  TestCase,
  TestCategory,
  CriteriaType,
  EvaluatorType,
  TestSuiteStatus,
  Priority,
  SuccessCriteria,
  Evaluation,
  PromptChange,
} from '../types/index.js';

export interface PerformanceMetrics {
  relevance: number;
  accuracy: number;
  completeness: number;
  helpfulness: number;
  overall: number;
}

export interface OptimizationResult {
  success: boolean;
  iterations: number;
  initialScore: number;
  finalScore: number;
  originalPrompt: string;
  optimizedPrompt: string;
  changes: PromptChange[];
  metrics: PerformanceMetrics;
  testResults: {
    before: { passRate: number; evaluations: Evaluation[] };
    after: { passRate: number; evaluations: Evaluation[] };
  };
}

class OptimizerService {
  /**
   * Generate a test suite for an agent (reuse existing or create new)
   */
  async generateTestSuite(agentId: string): Promise<TestSuite> {
    console.log(`📋 Generating test suite for agent ${agentId}`);
    
    // Ensure agent exists in DB
    await getOrCreateAgent(agentId);
    
    // Check if we already have a test suite for this agent
    const existingSuite = await TestSuiteModel.findOne({ agentId }).sort({ createdAt: -1 });
    if (existingSuite) {
      console.log(`📦 Using existing test suite for ${agentId} (${existingSuite.testCases.length} tests)`);
      return existingSuite.toJSON() as TestSuite;
    }
    
    // Get agent config
    const agentConfig = await highLevelClient.getAgent(agentId);
    
    if (agentConfig.systemPrompt.length < 20) {
      throw new Error('Agent prompt must be at least 20 characters');
    }

    // Analyze the prompt
    console.log('🔍 Analyzing agent prompt...');
    const analysis = await llmClient.analyzePrompt(agentConfig.systemPrompt);
    console.log(`✅ Found ${analysis.intents.length} intents, ${analysis.constraints.length} constraints`);

    // Generate test cases for different categories
    const categories: TestCategory[] = [
      TestCategory.HAPPY_PATH,
      TestCategory.EDGE_CASE,
      TestCategory.ADVERSARIAL,
    ];

    const allTestCases: TestCase[] = [];
    const suiteId = uuidv4();    for (const category of categories) {
      console.log(`🧪 Generating ${category} test cases...`);
      
      const generatedCases = await llmClient.generateTestCases({
        promptAnalysis: analysis,
        category,
        count: 2, // 2 per category = 6 total (minimum viable)
        businessContext: agentConfig.businessContext,
      });

      // Transform to our TestCase format
      for (const tc of generatedCases) {
        // Normalize success criteria from LLM response
        const successCriteria: SuccessCriteria[] = (tc.successCriteria || []).map((sc: any) => {
          const evalType = String(sc.evaluatorType || 'llm').toLowerCase();
          let evaluator;
          
          if (evalType === 'llm' || evalType === EvaluatorType.LLM) {
            evaluator = {
              type: EvaluatorType.LLM as const,
              config: { prompt: sc.description || sc.name || 'Evaluate response', threshold: 0.7 },
            };
          } else if (evalType === 'keyword' || evalType === EvaluatorType.KEYWORD) {
            evaluator = {
              type: EvaluatorType.KEYWORD as const,
              config: { keywords: [sc.name || 'keyword'], matchAll: false },
            };
          } else if (evalType === 'regex' || evalType === EvaluatorType.REGEX) {
            evaluator = {
              type: EvaluatorType.REGEX as const,
              config: { pattern: '.*', flags: 'i' },
            };
          } else {
            evaluator = {
              type: EvaluatorType.LLM as const,
              config: { prompt: sc.description || sc.name || 'Evaluate response', threshold: 0.7 },
            };
          }
          
          return {
            id: uuidv4(),
            name: sc.name || sc.criterion || 'Unnamed Criterion',
            description: sc.description || sc.name || 'No description',
            type: (sc.type || 'custom-llm') as CriteriaType,
            evaluator,
            weight: typeof sc.weight === 'number' ? sc.weight : 0.33,
            required: sc.required ?? false,
          };
        });

        // Ensure we have at least one criterion
        if (successCriteria.length === 0) {
          successCriteria.push({
            id: uuidv4(),
            name: 'Response Quality',
            description: 'Agent provides a helpful and appropriate response',
            type: CriteriaType.CUSTOM_LLM,
            evaluator: { type: EvaluatorType.LLM, config: { prompt: 'Evaluate if the response is helpful', threshold: 0.7 } },
            weight: 1.0,
            required: true,
          });
        }

        // Normalize conversation script - handle various LLM response formats
        const tcAny = tc as any;
        const rawScript = tc.conversationScript || tcAny.conversation || tcAny.script || [];
        console.log(`  📝 Raw conversation script for "${tc.name}":`, JSON.stringify(rawScript).slice(0, 200));
        
        const normalizedScript = rawScript.map((turn: any) => {
          // Handle different role names from LLM
          let role: 'user' | 'expected-agent' = 'user';
          const turnRole = String(turn.role || turn.speaker || turn.from || '').toLowerCase();
          if (turnRole === 'agent' || turnRole === 'assistant' || turnRole === 'expected-agent' || turnRole === 'bot' || turnRole === 'ai') {
            role = 'expected-agent';
          }
          
          // Handle different content field names - try multiple possible keys
          let content = '';
          if (typeof turn === 'string') {
            content = turn;
          } else if (turn.content) {
            content = String(turn.content);
          } else if (turn.text) {
            content = String(turn.text);
          } else if (turn.message) {
            content = String(turn.message);
          } else if (turn.utterance) {
            content = String(turn.utterance);
          } else if (turn.input) {
            content = String(turn.input);
          } else if (turn.output) {
            content = String(turn.output);
          } else {
            // Try to find any string value in the object
            for (const key of Object.keys(turn)) {
              if (typeof turn[key] === 'string' && turn[key].length > 0 && key !== 'role') {
                content = turn[key];
                break;
              }
            }
          }
          
          // Fallback if still empty
          if (!content) {
            content = role === 'user' ? 'Hello' : 'How can I help you?';
          }
          
          return { role, content };
        });

        // Ensure conversation starts with user turn
        if (normalizedScript.length === 0 || normalizedScript[0].role !== 'user') {
          normalizedScript.unshift({ role: 'user' as const, content: 'Hello' });
        }

        const testCase: TestCase = {
          id: uuidv4(),
          suiteId,
          name: tc.name || 'Unnamed Test',
          description: tc.description || 'No description',
          category: (tc.category as TestCategory) || category,
          conversationScript: normalizedScript,
          successCriteria,
          priority: (tc.priority as Priority) || Priority.MEDIUM,
          tags: tc.tags || [],
        };
        allTestCases.push(testCase);
      }
    }

    // Create test suite
    const testSuite: Omit<TestSuite, 'createdAt' | 'updatedAt'> = {
      id: suiteId,
      agentId,
      name: `Test Suite - ${new Date().toISOString().split('T')[0]}`,
      description: `Auto-generated test suite for agent. ${analysis.summary}`,
      testCases: allTestCases,
      globalCriteria: [],
      version: 1,
      status: TestSuiteStatus.ACTIVE,
    };

    // Save to database
    const saved = await TestSuiteModel.create(testSuite);
    console.log(`✅ Created test suite with ${allTestCases.length} test cases`);

    return saved.toJSON() as TestSuite;
  }

  /**
   * Execute tests against the agent with performance metrics
   */
  async executeTests(
    agentId: string,
    testCases: TestCase[]
  ): Promise<{ 
    evaluations: Evaluation[]; 
    passRate: number; 
    overallScore: number;
    metrics: PerformanceMetrics;
  }> {
    console.log(`🏃 Executing ${testCases.length} tests...`);
    
    const evaluations: Evaluation[] = [];
    const allMetrics: PerformanceMetrics[] = [];

    for (const testCase of testCases) {
      console.log(`  Testing: ${testCase.name}`);
      
      // Get user messages from conversation script
      const userMessages = testCase.conversationScript
        .filter(t => t.role === 'user')
        .map(t => t.content);

      // Simulate conversation with agent
      const { turns } = await highLevelClient.simulateConversation(agentId, userMessages);

      // Evaluate with structured metrics
      const result = await llmClient.evaluateResponse({
        criterion: {
          name: testCase.name,
          description: testCase.description,
        },
        conversationTurns: turns,
      });

      // Store metrics
      allMetrics.push({
        ...result.metrics,
        overall: result.score,
      });

      const criteriaResults = [{
        criterionId: testCase.id,
        passed: result.passed,
        score: result.score,
        reasoning: result.reasoning,
      }];

      evaluations.push({
        testCaseId: testCase.id,
        testCaseName: testCase.name,
        passed: result.passed,
        criteriaResults,
        overallScore: result.score,
        reasoning: result.reasoning,
        confidence: 0.85,
        conversation: turns,
      });
    }

    const passRate = evaluations.filter(e => e.passed).length / evaluations.length;
    const overallScore = evaluations.reduce((sum, e) => sum + e.overallScore, 0) / evaluations.length;

    // Calculate aggregate metrics
    const avgMetrics: PerformanceMetrics = {
      relevance: allMetrics.reduce((sum, m) => sum + m.relevance, 0) / allMetrics.length,
      accuracy: allMetrics.reduce((sum, m) => sum + m.accuracy, 0) / allMetrics.length,
      completeness: allMetrics.reduce((sum, m) => sum + m.completeness, 0) / allMetrics.length,
      helpfulness: allMetrics.reduce((sum, m) => sum + m.helpfulness, 0) / allMetrics.length,
      overall: overallScore,
    };

    console.log(`✅ Tests complete: ${(passRate * 100).toFixed(0)}% pass rate, ${(overallScore * 100).toFixed(0)}% score`);
    console.log(`  📊 Metrics - Relevance: ${(avgMetrics.relevance * 100).toFixed(0)}%, Accuracy: ${(avgMetrics.accuracy * 100).toFixed(0)}%, Completeness: ${(avgMetrics.completeness * 100).toFixed(0)}%, Helpfulness: ${(avgMetrics.helpfulness * 100).toFixed(0)}%`);

    return { evaluations, passRate, overallScore, metrics: avgMetrics };
  }


  /**
   * Run the full optimization loop
   */
  async optimize(
    agentId: string,
    suiteId: string,
    maxIterations: number = 2
  ): Promise<OptimizationResult> {
    console.log(`🔧 Starting optimization for agent ${agentId}`);

    // Get test suite
    const suite = await TestSuiteModel.findById(suiteId);
    if (!suite) {
      throw new Error('Test suite not found');
    }

    // Get current agent config
    const agentConfig = await highLevelClient.getAgent(agentId);
    const originalPrompt = agentConfig.systemPrompt;
    let currentPrompt = originalPrompt;

    // Run initial tests
    console.log('📊 Running initial tests...');
    const initialResults = await this.executeTests(agentId, suite.testCases);
    const initialScore = initialResults.overallScore;

    let bestScore = initialScore;
    let bestPrompt = currentPrompt;
    let allChanges: PromptChange[] = [];
    let iteration = 0;

    // Check if already at 100%
    if (bestScore >= 1.0) {
      console.log('✅ Already at 100% score! No optimization needed');
      return {
        success: true,
        iterations: 0,
        initialScore,
        finalScore: bestScore,
        originalPrompt,
        optimizedPrompt: currentPrompt,
        changes: [],
        metrics: initialResults.metrics,
        testResults: {
          before: { passRate: initialResults.passRate, evaluations: initialResults.evaluations },
          after: { passRate: initialResults.passRate, evaluations: initialResults.evaluations },
        },
      };
    }

    // Optimization loop - stop at 100% (1.0)
    while (iteration < maxIterations && bestScore < 1.0) {
      iteration++;
      console.log(`\n🔄 Optimization iteration ${iteration}/${maxIterations}`);

      // Generate insights from failures
      const failedTests = initialResults.evaluations.filter(e => !e.passed);
      if (failedTests.length === 0) {
        console.log('✅ All tests passing, stopping optimization');
        break;
      }

      const insights = await llmClient.generateInsights({
        evaluations: initialResults.evaluations.map((e, i) => ({
          testCaseId: e.testCaseId,
          testCaseName: suite.testCases[i]?.name || 'Unknown',
          passed: e.passed,
          overallScore: e.overallScore,
          reasoning: e.reasoning,
        })),
        passRate: initialResults.passRate,
        overallScore: initialResults.overallScore,
      });

      // Optimize prompt
      console.log('🔧 Generating optimized prompt...');
      const optimization = await llmClient.optimizePrompt({
        currentPrompt,
        failurePatterns: insights.failurePatterns,
        recommendations: insights.recommendations,
      });

      // Apply optimization (mock update)
      await highLevelClient.updateAgentPrompt(agentId, optimization.optimizedPrompt);
      currentPrompt = optimization.optimizedPrompt;
      allChanges.push(...optimization.changes);

      // Re-run tests
      console.log('📊 Re-running tests with optimized prompt...');
      const newResults = await this.executeTests(agentId, suite.testCases);

      if (newResults.overallScore > bestScore) {
        bestScore = newResults.overallScore;
        bestPrompt = currentPrompt;
        console.log(`✅ Improvement: ${(initialScore * 100).toFixed(0)}% → ${(bestScore * 100).toFixed(0)}%`);
        
        // Check if we hit 100%
        if (bestScore >= 1.0) {
          console.log('🎉 Reached 100% score! Stopping optimization.');
          break;
        }
      } else {
        console.log('⚠️ No improvement detected (mock mode - responses are static)');
        // In mock mode, still keep the optimized prompt to show the changes
        bestPrompt = currentPrompt;
        break;
      }
    }

    // Final test run
    const finalResults = await this.executeTests(agentId, suite.testCases);

    // Save optimized prompt to DB if we improved
    if (finalResults.overallScore > initialScore) {
      await OptimizedPromptModel.findOneAndUpdate(
        { agentId },
        {
          agentId,
          originalPrompt,
          optimizedPrompt: bestPrompt,
          score: finalResults.overallScore,
          iterations: iteration,
        },
        { upsert: true, new: true }
      );
      console.log(`💾 Saved optimized prompt to DB (score: ${(finalResults.overallScore * 100).toFixed(0)}%)`);
    }

    return {
      success: finalResults.overallScore > initialScore,
      iterations: iteration,
      initialScore,
      finalScore: finalResults.overallScore,
      originalPrompt,
      optimizedPrompt: bestPrompt,
      changes: allChanges,
      metrics: finalResults.metrics,
      testResults: {
        before: { passRate: initialResults.passRate, evaluations: initialResults.evaluations },
        after: { passRate: finalResults.passRate, evaluations: finalResults.evaluations },
      },
    };
  }
}

export const optimizerService = new OptimizerService();
