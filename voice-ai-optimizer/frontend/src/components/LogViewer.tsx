import React, { useRef, useEffect } from 'react';
import { LogEntry } from '../types';
import { styles } from '../styles';

interface LogViewerProps {
  logs: LogEntry[];
}

const getLogStyle = (type: LogEntry['type']): React.CSSProperties => {
  switch (type) {
    case 'success': return styles.logSuccess;
    case 'warning': return styles.logWarning;
    case 'error': return styles.logError;
    case 'step': return styles.logStep;
    default: return styles.logInfo;
  }
};

export const LogViewer: React.FC<LogViewerProps> = ({ logs }) => {
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (logs.length === 0) return null;

  return (
    <div style={styles.logsContainer}>
      {logs.map((log, i) => (
        <div key={i} style={styles.logEntry}>
          <span style={styles.logTimestamp}>[{log.timestamp}]</span>
          <span style={getLogStyle(log.type)}>{log.message}</span>
        </div>
      ))}
      <div ref={logsEndRef} />
    </div>
  );
};
