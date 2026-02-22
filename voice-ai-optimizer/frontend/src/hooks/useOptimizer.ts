import { useState, useRef, useCallback } from 'react';
import { api } from '../api';
import { Phase, LogEntry, TestSuite, OptimizationResult, TestCase, Evaluation, TestConversation } from '../types';

interface UseOptimizerReturn {
  phase: Phase;
  logs: LogEntry[];
  currentScore: number;
  currentIteration: number;
  testSuite: TestSuite | null;
  result: OptimizationResult | null;
  currentPrompt: string;
  conversations: TestConversation[];
  hasOptimized: boolean;
  startOptimization: (agentId: string, maxIterations: number) => Promise<void>;
  stopOptimization: () => void;
  reset: () => void;
  checkOptimized: (agentId: string) => Promise<void>;
  resetOptimization: (agentId: string) => Promise<void>;
  checkOptimizationStatus: (agentId: string) => Promise<void>;
}

export const useOptimizer = (): UseOptimizerReturn => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentScore, setCurrentScore] = useState(0);
  const [currentIteration, setCurrentIteration] = useState(0);
  const [testSuite, setTestSuite] = useState<TestSuite | null>(null);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [conversations, setConversations] = useState<TestConversation[]>([]);
  const [hasOptimized, setHasOptimized] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const shouldStopRef = useRef(false);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
  }, []);

  const checkOptimizationStatus = useCallback(async (agentId: string) => {
    try {
      const response = await api.getOptimizedPrompt(agentId);
      setHasOptimized(response.hasOptimized);
      if (response.hasOptimized && response.score) {
        setCurrentScore(response.score);
      }
    } catch (error) {
      console.error('Failed to check optimization status:', error);
    }
  }, []);

  const checkOptimized = useCallback(async (agentId: string) => {
    setPhase('running');
    setLogs([]);
    abortControllerRef.current = new AbortController();

    try {
      addLog('═══════════════════════════════════════', 'step');
      addLog('CHECKING OPTIMIZED VERSION', 'step');
      addLog('═══════════════════════════════════════', 'step');
      addLog('Running tests with current prompt...', 'info');

      const response = await api.checkOptimized(agentId, abortControllerRef.current.signal);
      
      setCurrentPrompt(response.currentPrompt);
      setCurrentScore(response.results.overallScore);
      setTestSuite(response.testSuite);

      // Build conversations from evaluations
      const convos: TestConversation[] = response.results.evaluations.map((ev: Evaluation, i: number) => ({
        testName: (ev as any).testCaseName || response.testSuite.testCases[i]?.name || 'Test',
        conversation: ev.conversation || [],
        passed: ev.passed,
        score: ev.overallScore,
        reasoning: ev.reasoning,
      }));
      setConversations(convos);

      addLog(`Score: ${(response.results.overallScore * 100).toFixed(0)}%`, response.results.overallScore >= 1.0 ? 'success' : 'warning');
      addLog(`Pass Rate: ${(response.results.passRate * 100).toFixed(0)}%`, 'info');
      
      response.results.evaluations.forEach((ev: Evaluation, i: number) => {
        const tc = response.testSuite.testCases[i];
        addLog(`  ${ev.passed ? '✓' : '✗'} ${tc?.name || 'Test'}: ${(ev.overallScore * 100).toFixed(0)}%`, ev.passed ? 'success' : 'error');
      });

      if (response.results.overallScore >= 1.0) {
        addLog('', 'info');
        addLog('🎉 Optimized version is at 100%!', 'success');
      }

      setPhase('complete');
    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`, 'error');
      setPhase('idle');
    }
  }, [addLog]);

  const resetOptimization = useCallback(async (agentId: string) => {
    setPhase('running');
    setLogs([]);

    try {
      addLog('═══════════════════════════════════════', 'step');
      addLog('RESETTING OPTIMIZATION', 'step');
      addLog('═══════════════════════════════════════', 'step');
      addLog('Deleting optimized prompt from database...', 'info');

      await api.resetOptimization(agentId);
      
      addLog('✓ Optimization data deleted', 'success');
      addLog('✓ Agent reset to initial (bad) prompt', 'success');
      addLog('', 'info');
      addLog('You can now run optimization again to see the improvement.', 'info');

      setHasOptimized(false);
      setCurrentScore(0);
      setCurrentPrompt('');
      setConversations([]);
      setResult(null);
      setTestSuite(null);
      setPhase('idle');
    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`, 'error');
      setPhase('idle');
    }
  }, [addLog]);

  const startOptimization = useCallback(async (agentId: string, maxIterations: number) => {
    setPhase('running');
    setLogs([]);
    setResult(null);
    setCurrentIteration(0);
    setCurrentScore(0);
    setCurrentPrompt('');
    setConversations([]);
    shouldStopRef.current = false;
    abortControllerRef.current = new AbortController();

    try {
      // Step 1: Generate Tests
      addLog('═══════════════════════════════════════', 'step');
      addLog('STEP 1: Generating Test Cases', 'step');
      addLog('═══════════════════════════════════════', 'step');
      addLog('Analyzing agent prompt with LLM...', 'info');
      
      if (shouldStopRef.current) throw new Error('Stopped by user');
      
      const suite = await api.generateTests(agentId, abortControllerRef.current.signal);
      setTestSuite(suite);
      
      addLog(`✓ Generated ${suite.testCases.length} test cases`, 'success');
      suite.testCases.forEach((tc: TestCase) => {
        addLog(`  • ${tc.name} [${tc.category}]`, 'info');
      });

      // Step 2: Initial Test Run
      addLog('', 'info');
      addLog('═══════════════════════════════════════', 'step');
      addLog('STEP 2: Running Initial Tests', 'step');
      addLog('═══════════════════════════════════════', 'step');
      
      if (shouldStopRef.current) throw new Error('Stopped by user');
      
      const suiteId = suite._id || suite.id;
      const { results: initialResults, currentPrompt: prompt } = await api.executeTests(
        suiteId, 
        abortControllerRef.current.signal
      );
      
      setCurrentPrompt(prompt);
      const initialScore = initialResults.overallScore;
      setCurrentScore(initialScore);
      
      // Build conversations from evaluations
      const convos: TestConversation[] = initialResults.evaluations.map((ev: Evaluation, i: number) => ({
        testName: (ev as any).testCaseName || suite.testCases[i]?.name || 'Test',
        conversation: ev.conversation || [],
        passed: ev.passed,
        score: ev.overallScore,
        reasoning: ev.reasoning,
      }));
      setConversations(convos);
      
      addLog(`Initial Score: ${(initialScore * 100).toFixed(0)}%`, initialScore >= 0.95 ? 'success' : 'warning');
      addLog(`Pass Rate: ${(initialResults.passRate * 100).toFixed(0)}%`, 'info');
      
      initialResults.evaluations.forEach((ev: Evaluation, i: number) => {
        const tc = suite.testCases[i];
        addLog(`  ${ev.passed ? '✓' : '✗'} ${tc?.name || 'Test'}: ${(ev.overallScore * 100).toFixed(0)}%`, ev.passed ? 'success' : 'error');
      });

      // Check if already at target (100%)
      if (initialScore >= 1.0) {
        addLog('', 'info');
        addLog('🎉 Already at 100% score! No optimization needed.', 'success');
        setHasOptimized(true);
        setPhase('complete');
        return;
      }

      // Step 3: Optimization Loop
      let iteration = 0;
      let bestScore = initialScore;
      let lastOptimizationResult: OptimizationResult | null = null;

      while (iteration < maxIterations && bestScore < 1.0) {
        iteration++;
        setCurrentIteration(iteration);
        
        if (shouldStopRef.current) throw new Error('Stopped by user');
        
        addLog('', 'info');
        addLog('═══════════════════════════════════════', 'step');
        addLog(`ITERATION ${iteration}/${maxIterations}: Optimizing`, 'step');
        addLog('═══════════════════════════════════════', 'step');
        
        addLog('Analyzing failures with LLM...', 'info');
        addLog('Generating optimized prompt...', 'info');
        
        lastOptimizationResult = await api.optimize(suiteId, 1, abortControllerRef.current.signal);
        const newScore = lastOptimizationResult.finalScore;
        setCurrentScore(newScore);
        setCurrentPrompt(lastOptimizationResult.optimizedPrompt);
        
        // Update conversations with new results
        const newConvos: TestConversation[] = lastOptimizationResult.testResults.after.evaluations.map((ev: Evaluation, i: number) => ({
          testName: (ev as any).testCaseName || suite.testCases[i]?.name || 'Test',
          conversation: ev.conversation || [],
          passed: ev.passed,
          score: ev.overallScore,
          reasoning: ev.reasoning,
        }));
        setConversations(newConvos);
        
        addLog(`Score: ${(bestScore * 100).toFixed(0)}% → ${(newScore * 100).toFixed(0)}%`, newScore > bestScore ? 'success' : 'warning');
        
        if (lastOptimizationResult.changes.length > 0) {
          addLog('Changes made:', 'info');
          lastOptimizationResult.changes.forEach(change => {
            addLog(`  • [${change.type}] ${change.description}`, 'info');
          });
        }
        
        if (newScore > bestScore) {
          bestScore = newScore;
          addLog(`✓ Improvement! New best score: ${(bestScore * 100).toFixed(0)}%`, 'success');
        } else {
          addLog('No improvement in this iteration', 'warning');
        }
        
        if (bestScore >= 1.0) {
          addLog('', 'info');
          addLog('🎉 Target score (100%) achieved!', 'success');
          setHasOptimized(true);
          break;
        }
      }

      // Final Summary
      addLog('', 'info');
      addLog('═══════════════════════════════════════', 'step');
      addLog('OPTIMIZATION COMPLETE', 'step');
      addLog('═══════════════════════════════════════', 'step');
      addLog(`Final Score: ${(bestScore * 100).toFixed(0)}%`, bestScore >= 1.0 ? 'success' : 'warning');
      addLog(`Iterations: ${iteration}/${maxIterations}`, 'info');
      addLog(`Improvement: ${((bestScore - initialScore) * 100).toFixed(0)}%`, bestScore > initialScore ? 'success' : 'info');

      if (lastOptimizationResult) {
        setResult({
          ...lastOptimizationResult,
          initialScore,
          iterations: iteration,
        });
        if (lastOptimizationResult.finalScore > initialScore) {
          setHasOptimized(true);
        }
      }

      setPhase('complete');
      
    } catch (error: any) {
      if (error.message === 'Stopped by user' || error.name === 'CanceledError') {
        addLog('', 'info');
        addLog('⛔ Optimization stopped by user', 'warning');
        setPhase('stopped');
      } else {
        addLog(`❌ Error: ${error.message}`, 'error');
        setPhase('idle');
      }
    }
  }, [addLog]);

  const stopOptimization = useCallback(() => {
    shouldStopRef.current = true;
    abortControllerRef.current?.abort();
    setLogs(prev => [...prev, { 
      timestamp: new Date().toLocaleTimeString(), 
      message: 'Stopping optimization...', 
      type: 'warning' 
    }]);
  }, []);

  const reset = useCallback(() => {
    setPhase('idle');
    setLogs([]);
    setResult(null);
    setTestSuite(null);
    setCurrentIteration(0);
    setCurrentScore(0);
    setCurrentPrompt('');
    setConversations([]);
  }, []);

  return {
    phase,
    logs,
    currentScore,
    currentIteration,
    testSuite,
    result,
    currentPrompt,
    conversations,
    hasOptimized,
    startOptimization,
    stopOptimization,
    reset,
    checkOptimized,
    resetOptimization,
    checkOptimizationStatus,
  };
};
