import { Router, Request, Response } from 'express';
import { optimizerService } from '../services/OptimizerService.js';
import { highLevelClient } from '../services/HighLevelClient.js';
import { TestSuiteModel, OptimizedPromptModel } from '../models/index.js';

const router = Router();

// Get agent info
router.get('/agents/:agentId', async (req: Request, res: Response) => {
  try {
    const agent = await highLevelClient.getAgent(req.params.agentId);
    res.json({ success: true, agent });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Get optimized prompt for agent
router.get('/agents/:agentId/optimized-prompt', async (req: Request, res: Response) => {
  try {
    const optimized = await OptimizedPromptModel.findOne({ agentId: req.params.agentId });
    if (!optimized) {
      return res.json({ success: true, hasOptimized: false });
    }
    res.json({ 
      success: true, 
      hasOptimized: true,
      optimizedPrompt: optimized.optimizedPrompt,
      originalPrompt: optimized.originalPrompt,
      score: optimized.score,
      iterations: optimized.iterations,
      updatedAt: optimized.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Delete optimized prompt (reset optimization)
router.delete('/agents/:agentId/optimized-prompt', async (req: Request, res: Response) => {
  try {
    // Delete optimized prompt
    await OptimizedPromptModel.deleteOne({ agentId: req.params.agentId });
    // Delete all test suites for this agent
    await TestSuiteModel.deleteMany({ agentId: req.params.agentId });
    // Clear the agent cache so next request gets the bad prompt
    highLevelClient.clearCache();
    res.json({ success: true, message: 'Optimization and test suites reset successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Check optimized version (run tests with current prompt)
router.post('/agents/:agentId/check-optimized', async (req: Request, res: Response) => {
  try {
    // Get the latest test suite for this agent
    const suite = await TestSuiteModel.findOne({ agentId: req.params.agentId }).sort({ createdAt: -1 });
    if (!suite) {
      return res.status(404).json({ success: false, error: 'No test suite found. Run optimization first.' });
    }
    
    // Get current prompt
    const agent = await highLevelClient.getAgent(req.params.agentId);
    
    // Run tests
    const results = await optimizerService.executeTests(req.params.agentId, suite.testCases);
    
    res.json({ 
      success: true, 
      results,
      currentPrompt: agent.systemPrompt,
      testSuite: suite,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Generate test suite
router.post('/agents/:agentId/generate-tests', async (req: Request, res: Response) => {
  try {
    const testSuite = await optimizerService.generateTestSuite(req.params.agentId);
    res.json({ success: true, testSuite });
  } catch (error) {
    console.error('❌ Generate tests error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Get test suites for agent
router.get('/agents/:agentId/test-suites', async (req: Request, res: Response) => {
  try {
    const suites = await TestSuiteModel.find({ agentId: req.params.agentId }).sort({ createdAt: -1 });
    res.json({ success: true, testSuites: suites });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Run tests
router.post('/test-suites/:suiteId/execute', async (req: Request, res: Response) => {
  try {
    const suite = await TestSuiteModel.findById(req.params.suiteId);
    if (!suite) {
      return res.status(404).json({ success: false, error: 'Test suite not found' });
    }
    
    // Get current prompt
    const agent = await highLevelClient.getAgent(suite.agentId);
    
    const results = await optimizerService.executeTests(suite.agentId, suite.testCases);
    res.json({ 
      success: true, 
      results,
      currentPrompt: agent.systemPrompt,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Run optimization
router.post('/test-suites/:suiteId/optimize', async (req: Request, res: Response) => {
  try {
    const suite = await TestSuiteModel.findById(req.params.suiteId);
    if (!suite) {
      return res.status(404).json({ success: false, error: 'Test suite not found' });
    }
    
    const { maxIterations = 2 } = req.body;
    const result = await optimizerService.optimize(suite.agentId, req.params.suiteId, maxIterations);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
