import React from 'react';
import { styles } from '../styles';

interface StatsPanelProps {
  currentScore: number;
  currentIteration: number;
  maxIterations: number;
  testCaseCount: number;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({
  currentScore,
  currentIteration,
  maxIterations,
  testCaseCount,
}) => {
  return (
    <div style={styles.statsGrid}>
      <div style={styles.statCard}>
        <div style={{ ...styles.statValue, color: currentScore >= 0.95 ? '#10B981' : '#3B82F6' }}>
          {(currentScore * 100).toFixed(0)}%
        </div>
        <div style={styles.statLabel}>Current Score</div>
      </div>
      <div style={styles.statCard}>
        <div style={styles.statValue}>{currentIteration}</div>
        <div style={styles.statLabel}>Iteration</div>
      </div>
      <div style={styles.statCard}>
        <div style={styles.statValue}>{maxIterations}</div>
        <div style={styles.statLabel}>Max Iterations</div>
      </div>
      <div style={styles.statCard}>
        <div style={styles.statValue}>{testCaseCount}</div>
        <div style={styles.statLabel}>Test Cases</div>
      </div>
    </div>
  );
};
