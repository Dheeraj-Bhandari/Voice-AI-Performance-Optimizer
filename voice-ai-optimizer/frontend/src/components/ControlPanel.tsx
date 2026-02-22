import React from 'react';
import { Phase } from '../types';
import { styles } from '../styles';

interface ControlPanelProps {
  phase: Phase;
  maxIterations: number;
  hasOptimized: boolean;
  onMaxIterationsChange: (value: number) => void;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onCheckOptimized: () => void;
  onResetOptimization: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  phase,
  maxIterations,
  hasOptimized,
  onMaxIterationsChange,
  onStart,
  onStop,
  onReset,
  onCheckOptimized,
  onResetOptimization,
}) => {
  return (
    <div style={styles.controlPanel}>
      <div style={styles.inputGroup}>
        <label style={styles.label}>Max Iterations:</label>
        <input
          type="number"
          min="1"
          max="10"
          value={maxIterations}
          onChange={(e) => onMaxIterationsChange(parseInt(e.target.value) || 3)}
          style={styles.input}
          disabled={phase === 'running'}
        />
      </div>
      
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {phase === 'idle' && (
          <>
            <button
              style={{ ...styles.button, ...styles.startButton }}
              onClick={onStart}
            >
              🚀 Start Optimizer
            </button>
            {hasOptimized && (
              <>
                <button
                  style={{ ...styles.button, backgroundColor: '#2196F3' }}
                  onClick={onCheckOptimized}
                >
                  ✅ Check Optimized
                </button>
                <button
                  style={{ ...styles.button, backgroundColor: '#ff9800' }}
                  onClick={onResetOptimization}
                >
                  🔄 Reset Optimization
                </button>
              </>
            )}
          </>
        )}
        
        {phase === 'running' && (
          <button
            style={{ ...styles.button, ...styles.stopButton }}
            onClick={onStop}
          >
            ⛔ Stop
          </button>
        )}
        
        {(phase === 'complete' || phase === 'stopped') && (
          <>
            <button
              style={{ ...styles.button, ...styles.startButton }}
              onClick={onReset}
            >
              🔄 Start Over
            </button>
            {hasOptimized && (
              <>
                <button
                  style={{ ...styles.button, backgroundColor: '#2196F3' }}
                  onClick={onCheckOptimized}
                >
                  ✅ Check Optimized
                </button>
                <button
                  style={{ ...styles.button, backgroundColor: '#ff9800' }}
                  onClick={onResetOptimization}
                >
                  🗑️ Reset Optimization
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
