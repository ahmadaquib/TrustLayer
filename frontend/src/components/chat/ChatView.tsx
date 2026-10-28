import React, { useState, useEffect, useRef } from 'react';
import demoPresets from '@data/demo/presets.json';
import { api } from '../../api/client';
import type { ChatMessageItem, DemoPreset, UserProfile } from '../../types';
import { getDecisionBadgeStyles } from '../../theme/colors';

const PRESETS = demoPresets as DemoPreset[];

interface ChatViewProps {
  currentUser: UserProfile;
}

export const ChatView: React.FC<ChatViewProps> = ({ currentUser }) => {
  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      id: 'welcome',
      sender: 'agent',
      content:
        `Hello ${currentUser.name}! I am your TrustLayer banking assistant. ` +
        `How can I assist you with your checking, savings, or debit card operations today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || loading) return;

    const userMsg: ChatMessageItem = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputText('');
    setLoading(true);

    try {
      const resp = await api.sendChatMessage({
        user_id: currentUser.id,
        role: currentUser.role,
        message: text,
        session_id: sessionId,
      });

      if (resp.session_id) {
        setSessionId(resp.session_id);
      }

      const agentMsg: ChatMessageItem = {
        id: resp.request_id || `agt_${Date.now()}`,
        sender: 'agent',
        content: resp.response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        decision: resp.decision,
        tool_called: resp.tool_called,
        tool_result: resp.tool_result,
        decision_id: resp.decision_id,
        final_risk: resp.final_risk,
        grounding_score: resp.grounding_score,
        policy_risk: resp.policy_risk,
      };

      setMessages((prev) => [...prev, agentMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessageItem = {
        id: `err_${Date.now()}`,
        sender: 'system',
        content: `Error connecting to TrustLayer Gateway: ${err.message || 'Unknown network error'}. Please ensure backend is running.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPreset = async (preset: DemoPreset) => {
    if (loading) return;
    if (preset.id === 'drain_pattern') {
      await handleSendMessage('Check my checking account balance');
      setTimeout(() => {
        handleSendMessage(preset.message);
      }, 300);
    } else {
      await handleSendMessage(preset.message);
    }
  };

  return (
    <div className="tl-chat-container">
      <div className="tl-chat-header-bar">
        <div>
          <h2 className="tl-chat-title">Banking Assistant Chat</h2>
          <p className="tl-chat-subtitle">
            User: <strong>{currentUser.name}</strong> ({currentUser.role.toUpperCase()}) • Session: {sessionId ? sessionId.slice(0, 8) : 'New'}
          </p>
        </div>

        <div className="tl-quick-prompts-bar">
          {PRESETS.map((preset) => {
            const badge = getDecisionBadgeStyles(preset.expected_decision);
            return (
              <button
                key={preset.id}
                className="tl-chip-btn"
                disabled={loading}
                onClick={() => handleSelectPreset(preset)}
                title={`Expected: ${preset.expected_decision.toUpperCase()}`}
              >
                <span>{preset.label}</span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    backgroundColor: badge.bg,
                    color: badge.color,
                    border: `1px solid ${badge.border}`,
                    fontWeight: 700,
                  }}
                >
                  {badge.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="tl-messages-area">
        {messages.map((msg) => {
          if (msg.sender === 'user') {
            return (
              <div key={msg.id} className="tl-message-row user">
                <div className="tl-bubble user">
                  <div className="tl-message-text">{msg.content}</div>
                  <div className="tl-message-time">{msg.timestamp}</div>
                </div>
              </div>
            );
          }

          if (msg.sender === 'system') {
            return (
              <div key={msg.id} className="tl-message-row system">
                <div className="tl-bubble system">
                  <span className="tl-system-icon">⚠️</span>
                  <span>{msg.content}</span>
                </div>
              </div>
            );
          }

          const badgeStyles = msg.decision ? getDecisionBadgeStyles(msg.decision) : null;

          return (
            <div key={msg.id} className="tl-message-row agent">
              <div className="tl-avatar-agent">TL</div>
              <div className="tl-bubble agent">
                {/* Decision Banner Chip */}
                {badgeStyles && (
                  <div
                    className="tl-decision-chip"
                    style={{
                      backgroundColor: badgeStyles.bg,
                      color: badgeStyles.color,
                      borderColor: badgeStyles.border,
                    }}
                  >
                    <span className="tl-chip-dot" style={{ backgroundColor: badgeStyles.color }} />
                    <span className="tl-chip-title">
                      {msg.decision === 'allow'
                        ? `Action Completed: ${msg.tool_called?.replace('_', ' ') || 'Allowed'}`
                        : msg.decision === 'approve'
                        ? `Under Review: Routed for Senior Staff Approval (Ref: #${msg.decision_id?.slice(0, 8) || 'pending'})`
                        : `Action Blocked: Security / Policy Restriction`}
                    </span>
                    <span className="tl-badge-pill" style={{ backgroundColor: badgeStyles.color, color: '#fff' }}>
                      {badgeStyles.label}
                    </span>
                  </div>
                )}

                <div className="tl-message-text">{msg.content}</div>

                {/* Tool Result Inspection Card */}
                {msg.tool_result && msg.tool_result.status === 'success' && (
                  <div className="tl-tool-result-box">
                    <div className="tl-tool-result-header">
                      <span>✓ Execution Details: {msg.tool_called}</span>
                    </div>
                    {msg.tool_result.accounts && (
                      <div className="tl-account-list">
                        {msg.tool_result.accounts.map((acc: any, idx: number) => (
                          <div key={idx} className="tl-account-row">
                            <span className="tl-acc-type">{acc.account_type}:</span>
                            <span className="tl-acc-bal">${Number(acc.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {msg.tool_result.transaction_id && (
                      <div className="tl-tx-info">
                        Transaction ID: <code>{msg.tool_result.transaction_id.slice(0, 8)}...</code>
                        {msg.tool_result.new_balance !== undefined && (
                          <span> • New Checking Balance: ${Number(msg.tool_result.new_balance).toFixed(2)}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="tl-message-time">{msg.timestamp}</div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="tl-message-row agent">
            <div className="tl-avatar-agent">TL</div>
            <div className="tl-bubble agent loading">
              <span className="tl-spinner" />
              <span>Interception Gateway verifying grounding and policy checks...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        className="tl-chat-input-bar"
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
      >
        <input
          type="text"
          className="tl-chat-input"
          placeholder="Ask a question or request an action (e.g. 'Transfer $50 to Bob')..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={loading}
        />
        <button type="submit" className="tl-chat-send-btn" disabled={!inputText.trim() || loading}>
          Send ↵
        </button>
      </form>
    </div>
  );
};
