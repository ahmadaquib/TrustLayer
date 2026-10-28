import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import type { PendingApprovalItem, UserProfile } from '../../types';
import { colors, getDecisionBadgeStyles } from '../../theme/colors';

interface ApproverQueueViewProps {
  currentUser: UserProfile;
}

export const ApproverQueueView: React.FC<ApproverQueueViewProps> = ({ currentUser }) => {
  const [items, setItems] = useState<PendingApprovalItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<PendingApprovalItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [justification, setJustification] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const approverId = currentUser.id;

  const loadPendingApprovals = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const data = await api.getPendingApprovals(approverId);
      setItems(data);
      if (data.length > 0) {
        setSelectedItem((prev) => (prev ? data.find((d) => d.decision_id === prev.decision_id) || data[0] : data[0]));
      } else {
        setSelectedItem(null);
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Failed to load approval queue: ${err.message || 'Network error'}. Note: Approver role is required.`,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingApprovals();
  }, [approverId]);

  const handleApprove = async () => {
    if (!selectedItem || actionLoading) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await api.approveAction(
        selectedItem.decision_id,
        approverId,
        justification || 'Approved via Senior Staff console'
      );
      setFeedback({
        type: 'success',
        message: `Decision #${selectedItem.decision_id.slice(0, 8)} approved and executed against mock ledger! Tool: ${res.tool_name}`,
      });
      setJustification('');
      await loadPendingApprovals();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Failed to approve action: ${err.message}`,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedItem || actionLoading) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      await api.rejectAction(
        selectedItem.decision_id,
        approverId,
        justification || 'Rejected via Senior Staff console'
      );
      setFeedback({
        type: 'success',
        message: `Decision #${selectedItem.decision_id.slice(0, 8)} rejected. Tool action was safely blocked from execution.`,
      });
      setJustification('');
      await loadPendingApprovals();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Failed to reject action: ${err.message}`,
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="tl-approver-layout">
      <div className="tl-page-header">
        <div>
          <h2 className="tl-page-title">Senior Staff & Approver Queue</h2>
          <p className="tl-page-subtitle">
            Review, inspect risk breakdowns, and authorize or reject held high-risk banking operations.
          </p>
        </div>
        <button className="tl-btn-secondary" onClick={loadPendingApprovals} disabled={loading}>
          ↻ Refresh Queue
        </button>
      </div>

      {feedback && (
        <div className={`tl-banner ${feedback.type}`}>
          <span>{feedback.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{feedback.message}</span>
        </div>
      )}

      {loading ? (
        <div className="tl-loading-state">
          <span className="tl-spinner" />
          <span>Fetching unresolved items from PostgreSQL approval queue...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="tl-empty-state">
          <div className="tl-empty-icon">🛡️</div>
          <h3>Approval Queue Clear</h3>
          <p>No high-risk actions currently held for manual review. Check customer chat to propose test actions.</p>
        </div>
      ) : (
        <div className="tl-queue-split-view">
          {/* List of pending items */}
          <div className="tl-queue-list-panel">
            <div className="tl-panel-title">Held Actions ({items.length})</div>
            <div className="tl-queue-cards">
              {items.map((item) => {
                const isSelected = selectedItem?.decision_id === item.decision_id;
                const badge = getDecisionBadgeStyles(item.decision);
                return (
                  <div
                    key={item.decision_id}
                    className={`tl-queue-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="tl-queue-card-top">
                      <span className="tl-tool-tag">{item.tool_name || 'Generic Action'}</span>
                      <span
                        className="tl-badge-pill"
                        style={{ backgroundColor: badge.bg, color: badge.color, borderColor: badge.border }}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <div className="tl-queue-card-body">
                      <div className="tl-queue-risk-row">
                        <span>Combined Risk:</span>
                        <strong
                          style={{
                            color:
                              (item.final_risk || 0) > 0.6
                                ? colors.red
                                : (item.final_risk || 0) >= 0.3
                                ? colors.amber
                                : colors.green,
                          }}
                        >
                          {((item.final_risk ?? 0) * 100).toFixed(1)}%
                        </strong>
                      </div>
                      <div className="tl-queue-meta">
                        Ref: #{item.decision_id.slice(0, 8)}
                        {item.proposed_at && ` • ${new Date(item.proposed_at).toLocaleTimeString()}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Deep inspection detail pane */}
          {selectedItem && (
            <div className="tl-inspection-panel">
              <div className="tl-inspection-header">
                <h3>Inspection: {selectedItem.tool_name || 'Proposed Action'}</h3>
                <span className="tl-decision-ref">Decision ID: {selectedItem.decision_id}</span>
              </div>

              {/* Risk Breakdown Cards */}
              <div className="tl-risk-cards-grid">
                <div className="tl-risk-card">
                  <div className="tl-risk-label">Grounding Score</div>
                  <div className="tl-risk-value" style={{ color: colors.blue }}>
                    {selectedItem.grounding_score !== null && selectedItem.grounding_score !== undefined
                      ? `${(selectedItem.grounding_score * 100).toFixed(1)}%`
                      : 'N/A (0.0%)'}
                  </div>
                  <div className="tl-progress-bar-bg">
                    <div
                      className="tl-progress-bar-fill"
                      style={{
                        width: `${Math.max(0, Math.min(100, (selectedItem.grounding_score || 0) * 100))}%`,
                        backgroundColor: colors.blue,
                      }}
                    />
                  </div>
                  <small className="tl-risk-desc">NLI cross-encoder entailment level</small>
                </div>

                <div className="tl-risk-card">
                  <div className="tl-risk-label">Policy Risk</div>
                  <div className="tl-risk-value" style={{ color: colors.purple }}>
                    {selectedItem.policy_risk_score !== null && selectedItem.policy_risk_score !== undefined
                      ? `${(selectedItem.policy_risk_score * 100).toFixed(1)}%`
                      : '0.0%'}
                  </div>
                  <div className="tl-progress-bar-bg">
                    <div
                      className="tl-progress-bar-fill"
                      style={{
                        width: `${Math.max(0, Math.min(100, (selectedItem.policy_risk_score || 0) * 100))}%`,
                        backgroundColor: colors.purple,
                      }}
                    />
                  </div>
                  <small className="tl-risk-desc">RBAC matrix & sequence anomaly</small>
                </div>

                <div className="tl-risk-card highlighted">
                  <div className="tl-risk-label">Combined Final Risk</div>
                  <div
                    className="tl-risk-value"
                    style={{
                      color:
                        (selectedItem.final_risk || 0) > 0.6
                          ? colors.red
                          : (selectedItem.final_risk || 0) >= 0.3
                          ? colors.amber
                          : colors.green,
                    }}
                  >
                    {((selectedItem.final_risk ?? 0) * 100).toFixed(1)}%
                  </div>
                  <div className="tl-progress-bar-bg">
                    <div
                      className="tl-progress-bar-fill"
                      style={{
                        width: `${Math.max(0, Math.min(100, (selectedItem.final_risk || 0) * 100))}%`,
                        backgroundColor:
                          (selectedItem.final_risk || 0) > 0.6
                            ? colors.red
                            : (selectedItem.final_risk || 0) >= 0.3
                            ? colors.amber
                            : colors.green,
                      }}
                    />
                  </div>
                  <small className="tl-risk-desc">Fused dual-grounding decision index</small>
                </div>
              </div>

              {/* Proposed Action Parameters */}
              <div className="tl-inspection-section">
                <h4>Proposed Tool Call & Arguments</h4>
                <div className="tl-params-viewer">
                  <div className="tl-code-header">
                    <span>Tool: <strong>{selectedItem.tool_name}</strong></span>
                    {selectedItem.action_id && <span>Action ID: {selectedItem.action_id.slice(0, 8)}</span>}
                  </div>
                  <pre className="tl-json-pre">
                    {JSON.stringify(selectedItem.params || {}, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Approval Decision Controls */}
              <div className="tl-inspection-controls">
                <h4>Authorization Decision</h4>
                <label className="tl-input-label">Audit Justification / Reviewer Notes:</label>
                <textarea
                  className="tl-textarea"
                  rows={2}
                  placeholder="Enter justification for compliance audit log..."
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  disabled={actionLoading}
                />

                <div className="tl-action-buttons-row">
                  <button
                    className="tl-btn-approve"
                    onClick={handleApprove}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Executing...' : '✓ Approve & Execute Action'}
                  </button>

                  <button
                    className="tl-btn-reject"
                    onClick={handleReject}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Processing...' : '✕ Reject & Block Tool'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
