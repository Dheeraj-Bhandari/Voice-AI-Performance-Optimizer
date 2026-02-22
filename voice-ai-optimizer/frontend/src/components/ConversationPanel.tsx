import React from 'react';
import { styles } from '../styles';

interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface TestConversation {
  testName: string;
  conversation: ConversationTurn[];
  passed: boolean;
  score: number;
  reasoning: string;
}

interface ConversationPanelProps {
  currentPrompt: string;
  conversations: TestConversation[];
}

const conversationStyles: Record<string, React.CSSProperties> = {
  container: {
    marginBottom: '20px',
    padding: '16px',
    background: '#f9f9f9',
    borderRadius: '8px',
  },
  promptSection: {
    marginBottom: '20px',
  },
  promptBox: {
    padding: '12px',
    background: '#1a1a2e',
    color: '#e0e0e0',
    borderRadius: '6px',
    fontSize: '13px',
    lineHeight: '1.6',
    maxHeight: '150px',
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    fontFamily: 'Monaco, Consolas, monospace',
  },
  testCard: {
    marginBottom: '16px',
    padding: '16px',
    background: 'white',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  },
  testHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    paddingBottom: '8px',
    borderBottom: '1px solid #eee',
  },
  testName: {
    fontWeight: 600,
    fontSize: '14px',
  },
  badge: {
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500,
  },
  passBadge: {
    background: '#D1FAE5',
    color: '#065F46',
  },
  failBadge: {
    background: '#FEE2E2',
    color: '#991B1B',
  },
  conversationBox: {
    marginBottom: '12px',
  },
  turn: {
    padding: '10px 12px',
    marginBottom: '8px',
    borderRadius: '8px',
    fontSize: '13px',
    lineHeight: '1.5',
  },
  userTurn: {
    background: '#EFF6FF',
    borderLeft: '3px solid #3B82F6',
    marginRight: '40px',
  },
  agentTurn: {
    background: '#F0FDF4',
    borderLeft: '3px solid #10B981',
    marginLeft: '40px',
  },
  roleLabel: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    marginBottom: '4px',
    color: '#666',
  },
  reasoningBox: {
    padding: '10px 12px',
    background: '#FEF3C7',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#92400E',
    borderLeft: '3px solid #F59E0B',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '12px',
    color: '#444',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
};

export const ConversationPanel: React.FC<ConversationPanelProps> = ({
  currentPrompt,
  conversations,
}) => {
  if (!currentPrompt && conversations.length === 0) return null;

  return (
    <div style={conversationStyles.container}>
      {/* Current Prompt */}
      {currentPrompt && (
        <div style={conversationStyles.promptSection}>
          <h3 style={conversationStyles.sectionTitle}>
            📝 Current Agent Prompt
          </h3>
          <div style={conversationStyles.promptBox}>
            {currentPrompt}
          </div>
        </div>
      )}

      {/* Test Conversations */}
      {conversations.length > 0 && (
        <div>
          <h3 style={conversationStyles.sectionTitle}>
            💬 Test Conversations & Evaluations
          </h3>
          
          {conversations.map((test, idx) => (
            <div key={idx} style={conversationStyles.testCard}>
              <div style={conversationStyles.testHeader}>
                <span style={conversationStyles.testName}>{test.testName}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#666' }}>
                    Score: {(test.score * 100).toFixed(0)}%
                  </span>
                  <span style={{
                    ...conversationStyles.badge,
                    ...(test.passed ? conversationStyles.passBadge : conversationStyles.failBadge)
                  }}>
                    {test.passed ? '✓ PASS' : '✗ FAIL'}
                  </span>
                </div>
              </div>

              <div style={conversationStyles.conversationBox}>
                {test.conversation.map((turn, turnIdx) => (
                  <div
                    key={turnIdx}
                    style={{
                      ...conversationStyles.turn,
                      ...(turn.role === 'user' ? conversationStyles.userTurn : conversationStyles.agentTurn)
                    }}
                  >
                    <div style={conversationStyles.roleLabel}>
                      {turn.role === 'user' ? '👤 User' : '🤖 Agent'}
                    </div>
                    {turn.content}
                  </div>
                ))}
              </div>

              <div style={conversationStyles.reasoningBox}>
                <strong>🧠 LLM Judge Reasoning:</strong>
                <p style={{ marginTop: '4px' }}>{test.reasoning}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
