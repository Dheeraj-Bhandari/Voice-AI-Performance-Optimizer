import React, { useState, useEffect } from 'react';
import { useOptimizer } from './hooks/useOptimizer';
import { ControlPanel, LogViewer, StatsPanel, ResultsPanel, ConversationPanel } from './components';
import { styles } from './styles';

const AGENT_ID = 'demo-agent-001';

export default function App() {
  const [maxIterations, setMaxIterations] = useState(3);
  
  const {
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
  } = useOptimizer();

  // Check if there's a saved optimization on mount
  useEffect(() => {
    checkOptimizationStatus(AGENT_ID);
  }, [checkOptimizationStatus]);

  const handleStart = () => startOptimization(AGENT_ID, maxIterations);
  const handleCheckOptimized = () => checkOptimized(AGENT_ID);
  const handleResetOptimization = () => resetOptimization(AGENT_ID);

  const showStats = phase === 'running' || phase === 'complete' || phase === 'stopped';
  const showConversations = conversations.length > 0;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>🎯 Voice AI Performance Optimizer</h1>
        <p style={styles.subtitle}>Automated testing and optimization for Voice AI agents</p>
        {hasOptimized && phase === 'idle' && (
          <p style={{ color: '#4CAF50', fontSize: '14px', marginTop: '8px' }}>
            ✅ Optimized prompt saved in database
          </p>
        )}
      </div>

      {/* Control Panel */}
      <ControlPanel
        phase={phase}
        maxIterations={maxIterations}
        hasOptimized={hasOptimized}
        onMaxIterationsChange={setMaxIterations}
        onStart={handleStart}
        onStop={stopOptimization}
        onReset={reset}
        onCheckOptimized={handleCheckOptimized}
        onResetOptimization={handleResetOptimization}
      />

      {/* Progress Bar */}
      {phase === 'running' && (
        <div style={styles.progressBar}>
          <div 
            style={{ 
              ...styles.progressFill, 
              width: `${Math.min(currentScore * 100, 100)}%` 
            }} 
          />
        </div>
      )}

      {/* Stats Panel */}
      {showStats && (
        <StatsPanel
          currentScore={currentScore}
          currentIteration={currentIteration}
          maxIterations={maxIterations}
          testCaseCount={testSuite?.testCases.length || 0}
        />
      )}

      {/* Log Viewer */}
      <LogViewer logs={logs} />

      {/* Conversation Panel - Shows prompt and test conversations */}
      {showConversations && (
        <ConversationPanel
          currentPrompt={currentPrompt}
          conversations={conversations}
        />
      )}

      {/* Results Panel */}
      {result && phase === 'complete' && (
        <ResultsPanel result={result} />
      )}

      {/* Idle State */}
      {phase === 'idle' && logs.length === 0 && (
        <IdleState />
      )}
    </div>
  );
}

const IdleState: React.FC = () => (
  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#666' }}>
    <p style={{ fontSize: '48px', marginBottom: '16px' }}>🤖</p>
    <p style={{ fontSize: '16px' }}>
      Click "Start Optimizer" to begin automated testing and optimization
    </p>
    <p style={{ fontSize: '14px', marginTop: '8px', color: '#999' }}>
      The optimizer will generate tests, run them, and iteratively improve the agent's prompt
    </p>
  </div>
);
