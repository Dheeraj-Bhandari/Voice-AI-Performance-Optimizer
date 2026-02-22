import React from 'react';
import { OptimizationResult } from '../types';
import { styles } from '../styles';

interface ResultsPanelProps {
  result: OptimizationResult;
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({ result }) => {
  return (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>📊 Optimization Results</h2>
      
      {/* Score Comparison */}
      <div style={styles.comparison}>
        <div style={styles.comparisonBox}>
          <h3 style={{ marginBottom: '8px', color: '#991B1B' }}>Before</h3>
          <div style={{ fontSize: '36px', fontWeight: 700, color: '#991B1B', textAlign: 'center' }}>
            {(result.initialScore * 100).toFixed(0)}%
          </div>
          <p style={{ textAlign: 'center', fontSize: '13px', color: '#666' }}>
            Pass Rate: {(result.testResults.before.passRate * 100).toFixed(0)}%
          </p>
        </div>
        <div style={styles.comparisonBox}>
          <h3 style={{ marginBottom: '8px', color: '#065F46' }}>After</h3>
          <div style={{ fontSize: '36px', fontWeight: 700, color: '#065F46', textAlign: 'center' }}>
            {(result.finalScore * 100).toFixed(0)}%
          </div>
          <p style={{ textAlign: 'center', fontSize: '13px', color: '#666' }}>
            Pass Rate: {(result.testResults.after.passRate * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Performance Metrics */}
      {result.metrics && (
        <div style={{ marginTop: '16px', padding: '16px', background: '#F0FDF4', borderRadius: '8px' }}>
          <h3 style={{ marginBottom: '12px', color: '#065F46' }}>📈 Performance Metrics</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            <MetricBar label="Relevance" value={result.metrics.relevance} />
            <MetricBar label="Accuracy" value={result.metrics.accuracy} />
            <MetricBar label="Completeness" value={result.metrics.completeness} />
            <MetricBar label="Helpfulness" value={result.metrics.helpfulness} />
          </div>
        </div>
      )}

      {/* Changes Made */}
      {result.changes.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <h3 style={{ marginBottom: '8px' }}>Changes Made:</h3>
          {result.changes.map((change, i) => (
            <div key={i} style={{ ...styles.testCase, borderLeft: '3px solid #4F46E5' }}>
              <strong style={{ textTransform: 'capitalize' }}>{change.type}</strong>
              <p style={{ fontSize: '13px', marginTop: '4px' }}>{change.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* Prompt Comparison */}
      <div style={{ marginTop: '16px' }}>
        <h3 style={{ marginBottom: '8px' }}>Prompt Comparison:</h3>
        <div style={styles.comparison}>
          <div>
            <p style={{ fontWeight: 500, marginBottom: '8px', color: '#991B1B' }}>Original</p>
            <div style={styles.promptBox}>{result.originalPrompt}</div>
          </div>
          <div>
            <p style={{ fontWeight: 500, marginBottom: '8px', color: '#065F46' }}>Optimized</p>
            <div style={styles.promptBox}>{result.optimizedPrompt}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricBar: React.FC<{ label: string; value: number }> = ({ label, value }) => {
  const percentage = Math.round(value * 100);
  const color = percentage >= 70 ? '#10B981' : percentage >= 40 ? '#F59E0B' : '#EF4444';
  
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '12px', color: '#374151' }}>{label}</span>
        <span style={{ fontSize: '12px', fontWeight: 600, color }}>{percentage}%</span>
      </div>
      <div style={{ height: '8px', background: '#E5E7EB', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${percentage}%`, background: color, borderRadius: '4px' }} />
      </div>
    </div>
  );
};
