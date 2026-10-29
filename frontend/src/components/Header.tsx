import React from 'react';
import type { UserProfile } from '../types';
import { colors } from '../theme/colors';

export type ActiveTab = 'chat' | 'approvals' | 'analytics' | 'evaluation' | 'kb' | 'roadmap';

interface HeaderProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
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
  const isPrivileged = currentUser.role === 'staff' || currentUser.role === 'approver';

  return (
    <header className="tl-header">
      <div className="tl-header-left">
        {/* Brand Logo with Shield Icon */}
        <div className="tl-logo-group" onClick={() => onSelectTab('chat')} style={{ cursor: 'pointer' }}>
          <div className="tl-logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 2L3 6V12C3 17.52 6.84 22.74 12 24C17.16 22.74 21 17.52 21 12V6L12 2Z"
                fill="url(#shield-grad)"
              />
              <path
                d="M10 12.5L8.5 11L7 12.5L10 15.5L17 8.5L15.5 7L10 12.5Z"
                fill="#ffffff"
              />
              <defs>
                <linearGradient id="shield-grad" x1="3" y1="2" x2="21" y2="24" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#3B82F6" />
                  <stop offset="1" stopColor="#1D4ED8" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <div className="tl-brand-title">TrustLayer</div>
            <div className="tl-brand-subtitle">Access-Aware RAG Gateway &amp; Policy Firewall</div>
          </div>
        </div>

        {/* Primary Navigation Tabs */}
        <nav className="tl-nav-tabs">
          <button
            className={`tl-nav-btn ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => onSelectTab('chat')}
            title="Customer AI Assistant"
          >
            <span className="tl-nav-icon">💬</span>
            <span>Customer Chat</span>
          </button>

          {currentUser.role === 'approver' && (
            <button
              className={`tl-nav-btn ${activeTab === 'approvals' ? 'active' : ''}`}
              onClick={() => onSelectTab('approvals')}
              title="Senior Approver Review Queue"
            >
              <span className="tl-nav-icon">🛡️</span>
              <span>Approver Queue</span>
              {pendingCount > 0 && (
                <span className="tl-badge-counter">{pendingCount}</span>
              )}
            </button>
          )}

          {isPrivileged && (
            <button
              className={`tl-nav-btn ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => onSelectTab('analytics')}
              title="Audit Logs & Risk Analytics"
            >
              <span className="tl-nav-icon">📊</span>
              <span>Audit &amp; Analytics</span>
            </button>
          )}

          {/* Project Review Group (Staff & Approver only) */}
          {isPrivileged && (
            <div className="tl-nav-project-group">
              <span className="tl-nav-group-label">PROJECT</span>
              <button
                className={`tl-nav-btn tl-project-btn ${activeTab === 'evaluation' ? 'active' : ''}`}
                onClick={() => onSelectTab('evaluation')}
                title="97-Case Evaluation Suite & Ablation Study"
              >
                <span className="tl-nav-icon">📈</span>
                <span>Evaluation</span>
              </button>
              <button
                className={`tl-nav-btn tl-project-btn ${activeTab === 'kb' ? 'active' : ''}`}
                onClick={() => onSelectTab('kb')}
                title="Access-Aware Policy Knowledge Base"
              >
                <span className="tl-nav-icon">📚</span>
                <span>Knowledge Base</span>
              </button>
              <button
                className={`tl-nav-btn tl-project-btn ${activeTab === 'roadmap' ? 'active' : ''}`}
                onClick={() => onSelectTab('roadmap')}
                title="Architecture & Implementation Roadmap"
              >
                <span className="tl-nav-icon">🗺️</span>
                <span>Roadmap</span>
              </button>
            </div>
          )}
        </nav>
      </div>

      <div className="tl-header-right">
        {/* Backend Connectivity Status Pill */}
        <div
          className="tl-status-pill"
          title={
            backendOnline
              ? `Unified Gateway connected to FastAPI backend. Latency: ${latencyMs ?? 0}ms`
              : 'FastAPI backend unreachable on :8000. Run: npm start'
          }
        >
          <span
            className={`tl-status-dot ${backendOnline === true ? 'pulse' : ''}`}
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
              ? `API Online (${latencyMs ?? 0}ms)`
              : backendOnline === false
              ? 'Backend Disconnected'
              : 'Connecting...'}
          </span>
        </div>

        {/* User Identity Switcher */}
        <div className="tl-user-selector">
          <div className="tl-user-avatar">
            {currentUser.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)}
          </div>
          <div className="tl-user-meta">
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
              title="Switch demo user"
            >
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>
  );
};
