import React from 'react';
import type { UserProfile } from '../types';
import { colors } from '../theme/colors';

interface HeaderProps {
  activeTab: 'chat' | 'approvals' | 'analytics';
  onSelectTab: (tab: 'chat' | 'approvals' | 'analytics') => void;
  currentUser: UserProfile;
  availableUsers: UserProfile[];
  onSelectUser: (user: UserProfile) => void;
  backendOnline: boolean | null;
  latencyMs?: number | null;
  pendingCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  currentUser,
  availableUsers,
  onSelectUser,
  backendOnline,
  latencyMs,
  pendingCount = 0,
}) => {
  return (
    <header className="tl-header">
      <div className="tl-header-left">
        <div className="tl-logo-group">
          <div className="tl-logo-icon">TL</div>
          <div>
            <div className="tl-brand-title">TrustLayer</div>
            <div className="tl-brand-subtitle">Access-Aware RAG Gateway & Policy Firewall</div>
          </div>
        </div>

        <nav className="tl-nav-tabs">
          <button
            className={`tl-nav-btn ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => onSelectTab('chat')}
          >
            <span className="tl-nav-icon">💬</span>
            Customer Chat
          </button>

          {currentUser.role === 'approver' && (
            <button
              className={`tl-nav-btn ${activeTab === 'approvals' ? 'active' : ''}`}
              onClick={() => onSelectTab('approvals')}
            >
              <span className="tl-nav-icon">🛡️</span>
              Approver Queue
              {pendingCount > 0 && (
                <span className="tl-badge-counter">{pendingCount}</span>
              )}
            </button>
          )}

          {(currentUser.role === 'staff' || currentUser.role === 'approver') && (
            <button
              className={`tl-nav-btn ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => onSelectTab('analytics')}
            >
              <span className="tl-nav-icon">📊</span>
              Audit & Analytics
            </button>
          )}
        </nav>
      </div>

      <div className="tl-header-right">
        <div
          className="tl-status-pill"
          title={
            backendOnline
              ? `Unified Gateway connected to FastAPI backend. Latency: ${latencyMs}ms`
              : 'FastAPI backend unreachable on :8000. Run: npm start or uv run uvicorn trustlayer.main:app'
          }
        >
          <span
            className="tl-status-dot"
            style={{
              backgroundColor:
                backendOnline === true
                  ? colors.green
                  : backendOnline === false
                  ? colors.red
                  : colors.amber,
            }}
          />
          <span className="tl-status-label">
            {backendOnline === true
              ? `Unified API (${latencyMs ?? 0}ms)`
              : backendOnline === false
              ? 'Backend Disconnected'
              : 'Connecting...'}
          </span>
        </div>

        <div className="tl-user-selector">
          <span className="tl-user-role-tag" data-role={currentUser.role}>
            {currentUser.role.toUpperCase()}
          </span>
          <select
            className="tl-user-select"
            value={currentUser.id}
            onChange={(e) => {
              const selected = availableUsers.find((u) => u.id === e.target.value);
              if (selected) onSelectUser(selected);
            }}
          >
            {availableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
};
