import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import type { DashboardSummaryResponse, AuditLogResponse, UserProfile } from '../../types';
import { colors, getDecisionBadgeStyles } from '../../theme/colors';

interface AnalyticsDashboardViewProps {
  currentUser: UserProfile;
}

export const AnalyticsDashboardView: React.FC<AnalyticsDashboardViewProps> = ({ currentUser }) => {
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [auditLoading, setAuditLoading] = useState<boolean>(false);
  const [decisionFilter, setDecisionFilter] = useState<string>('all');
  const [toolFilter, setToolFilter] = useState<string>('all');
  const [page, setPage] = useState<number>(0);
  const pageSize = 15;
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const authUserId = currentUser.id;

  const loadSummaryData = async () => {
    try {
      const data = await api.getDashboardSummary(authUserId);
      setSummary(data);
    } catch (err: any) {
      console.error('Failed to load dashboard summary:', err);
      setErrorMsg(`Summary fetch error: ${err.message}`);
    }
  };

  const loadAuditData = async () => {
    setAuditLoading(true);
    try {
      const data = await api.getAuditLogs(authUserId, {
        limit: pageSize,
        offset: page * pageSize,
        decision: decisionFilter,
        tool: toolFilter,
      });
      setAuditLogs(data);
    } catch (err: any) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadSummaryData(), loadAuditData()]).finally(() => setLoading(false));
  }, [authUserId]);

  useEffect(() => {
    loadAuditData();
  }, [decisionFilter, toolFilter, page]);

  const totalDecisions = summary?.total_decisions || 0;
  const allowPct = totalDecisions > 0 ? ((summary?.by_decision.allow || 0) / totalDecisions) * 100 : 0;
  const approvePct = totalDecisions > 0 ? ((summary?.by_decision.approve || 0) / totalDecisions) * 100 : 0;
  const blockPct = totalDecisions > 0 ? ((summary?.by_decision.block || 0) / totalDecisions) * 100 : 0;

  return (
    <div className="tl-dashboard-layout">
      <div className="tl-page-header">
        <div>
          <h2 className="tl-page-title">Executive Audit & Risk Analytics</h2>
          <p className="tl-page-subtitle">
            Real-time compliance monitoring, multi-source risk distributions, and immutable audit logs.
          </p>
        </div>
        <button
          className="tl-btn-secondary"
          onClick={() => {
            loadSummaryData();
            loadAuditData();
          }}
          disabled={loading || auditLoading}
        >
          ↻ Refresh Metrics
        </button>
      </div>

      {errorMsg && (
        <div className="tl-banner error">
          <span>⚠️</span>
          <span>{errorMsg} (Staff or Approver role required for analytics)</span>
        </div>
      )}

      {/* Top-Level KPI Row */}
      <div className="tl-kpi-grid">
        <div className="tl-kpi-card">
          <div className="tl-kpi-title">Total Processed Requests</div>
          <div className="tl-kpi-value">{totalDecisions.toLocaleString()}</div>
          <div className="tl-kpi-subtitle">End-to-end intercepted operations</div>
        </div>

        <div className="tl-kpi-card" style={{ borderLeft: `4px solid ${colors.green}` }}>
          <div className="tl-kpi-title">Allowed Outright</div>
          <div className="tl-kpi-value" style={{ color: colors.green }}>
            {allowPct.toFixed(1)}%
          </div>
          <div className="tl-kpi-subtitle">
            {summary?.by_decision.allow || 0} actions ({'< 30% combined risk'})
          </div>
        </div>

        <div className="tl-kpi-card" style={{ borderLeft: `4px solid ${colors.amber}` }}>
          <div className="tl-kpi-title">Held for Approval</div>
          <div className="tl-kpi-value" style={{ color: colors.amber }}>
            {approvePct.toFixed(1)}%
          </div>
          <div className="tl-kpi-subtitle">
            {summary?.by_decision.approve || 0} actions ({'30% - 60% risk / floor'})
          </div>
        </div>

        <div className="tl-kpi-card" style={{ borderLeft: `4px solid ${colors.red}` }}>
          <div className="tl-kpi-title">Security Blocked</div>
          <div className="tl-kpi-value" style={{ color: colors.red }}>
            {blockPct.toFixed(1)}%
          </div>
          <div className="tl-kpi-subtitle">
            {summary?.by_decision.block || 0} actions ({'> 60% risk / hard deny'})
          </div>
        </div>
      </div>

      {/* Summary Visual Breakdowns */}
      <div className="tl-analytics-split">
        {/* Decision Ratio Bar */}
        <div className="tl-analytics-card">
          <h4>Decision Ratio Distribution</h4>
          {totalDecisions > 0 ? (
            <div className="tl-ratio-bar-container">
              <div
                className="tl-ratio-segment"
                style={{ width: `${allowPct}%`, backgroundColor: colors.green }}
                title={`ALLOW: ${allowPct.toFixed(1)}%`}
              />
              <div
                className="tl-ratio-segment"
                style={{ width: `${approvePct}%`, backgroundColor: colors.amber }}
                title={`APPROVE: ${approvePct.toFixed(1)}%`}
              />
              <div
                className="tl-ratio-segment"
                style={{ width: `${blockPct}%`, backgroundColor: colors.red }}
                title={`BLOCK: ${blockPct.toFixed(1)}%`}
              />
            </div>
          ) : (
            <div className="tl-empty-bar-state">
              <span>No decision events recorded yet. Run a demo preset in Chat to populate metrics.</span>
            </div>
          )}
          <div className="tl-ratio-legend">
            <span><strong style={{ color: colors.green }}>●</strong> ALLOW: {summary?.by_decision.allow || 0}</span>
            <span><strong style={{ color: colors.amber }}>●</strong> APPROVE: {summary?.by_decision.approve || 0}</span>
            <span><strong style={{ color: colors.red }}>●</strong> BLOCK: {summary?.by_decision.block || 0}</span>
          </div>

          <div className="tl-avg-scores-box">
            <div className="tl-subheading">Average Score Indices:</div>
            {summary?.avg_scores_per_decision && summary.avg_scores_per_decision.length > 0 ? (
              <div className="tl-score-table">
                {summary.avg_scores_per_decision.map((sc, i) => (
                  <div key={i} className="tl-score-row">
                    <span className="tl-score-tag">{sc.decision.toUpperCase()}</span>
                    <span>Avg Risk: <strong>{sc.avg_risk !== null && sc.avg_risk !== undefined ? `${(sc.avg_risk * 100).toFixed(1)}%` : '—'}</strong></span>
                    <span>Avg Grounding: <strong>{sc.avg_grounding !== null && sc.avg_grounding !== undefined ? `${(sc.avg_grounding * 100).toFixed(1)}%` : '—'}</strong></span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="tl-text-muted">Awaiting decision telemetry...</div>
            )}
          </div>
        </div>

        {/* Breakdown by Tool & Role */}
        <div className="tl-analytics-card">
          <h4>Activity by Role & Requested Tool</h4>
          <div className="tl-role-tool-grid">
            <div>
              <div className="tl-subheading">By User Role:</div>
              <ul className="tl-stat-list">
                <li>
                  <span>Customer:</span>
                  <strong>{summary?.by_role.customer || 0}</strong>
                </li>
                <li>
                  <span>Staff:</span>
                  <strong>{summary?.by_role.staff || 0}</strong>
                </li>
                <li>
                  <span>Approver:</span>
                  <strong>{summary?.by_role.approver || 0}</strong>
                </li>
              </ul>
            </div>

            <div>
              <div className="tl-subheading">By Tool Invocation:</div>
              <ul className="tl-stat-list">
                {summary?.by_tool && summary.by_tool.length > 0 ? (
                  summary.by_tool.map((tb, idx) => (
                    <li key={idx}>
                      <span>{tb.tool_name}:</span>
                      <strong>{tb.count}</strong>
                    </li>
                  ))
                ) : (
                  <li className="tl-text-muted">No tool records yet.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Log Table Section */}
      <div className="tl-audit-section">
        <div className="tl-audit-header">
          <div>
            <h3>Correlated Audit Log</h3>
            <p className="tl-text-muted">
              Total Recorded Events: {auditLogs?.total || 0} (Showing page {page + 1})
            </p>
          </div>

          <div className="tl-audit-filters">
            <select
              className="tl-select-filter"
              value={decisionFilter}
              onChange={(e) => {
                setDecisionFilter(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">All Decisions</option>
              <option value="allow">ALLOW only</option>
              <option value="approve">APPROVE only</option>
              <option value="block">BLOCK only</option>
            </select>

            <select
              className="tl-select-filter"
              value={toolFilter}
              onChange={(e) => {
                setToolFilter(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">All Tools</option>
              <option value="transfer_funds">transfer_funds</option>
              <option value="check_balance">check_balance</option>
              <option value="block_card">block_card</option>
              <option value="dispute_charge">dispute_charge</option>
              <option value="get_transactions">get_transactions</option>
            </select>
          </div>
        </div>

        {auditLoading ? (
          <div className="tl-loading-state">
            <span className="tl-spinner" />
            <span>Loading audit log entries...</span>
          </div>
        ) : !auditLogs || auditLogs.items.length === 0 ? (
          <div className="tl-empty-state">
            <p>No audit rows matching the current filter criteria.</p>
          </div>
        ) : (
          <div className="tl-table-wrapper">
            <table className="tl-audit-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Decision</th>
                  <th>Tool Requested</th>
                  <th>Role</th>
                  <th>Grounding</th>
                  <th>Policy Risk</th>
                  <th>Final Risk</th>
                  <th>Reason / Event</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.items.map((row) => {
                  const badge = getDecisionBadgeStyles(row.decision);
                  return (
                    <tr key={row.audit_id}>
                      <td className="tl-nowrap-cell">
                        {row.timestamp ? new Date(row.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' }) : '—'}
                      </td>
                      <td>
                        <span
                          className="tl-badge-pill"
                          style={{
                            backgroundColor: badge.bg,
                            color: badge.color,
                            borderColor: badge.border,
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td>
                        <code>{row.tool_name || 'chat_query'}</code>
                      </td>
                      <td>
                        <span className="tl-role-tag">{row.user_role || 'customer'}</span>
                      </td>
                      <td>
                        {row.grounding_score !== null && row.grounding_score !== undefined
                          ? `${(row.grounding_score * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                      <td>
                        {row.policy_risk_score !== null && row.policy_risk_score !== undefined
                          ? `${(row.policy_risk_score * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                      <td>
                        <strong>
                          {row.final_risk !== null && row.final_risk !== undefined
                            ? `${(row.final_risk * 100).toFixed(1)}%`
                            : '—'}
                        </strong>
                      </td>
                      <td className="tl-reason-cell" title={row.reason || row.event || ''}>
                        {row.reason || row.event || 'Action logged'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination bar */}
        {auditLogs && auditLogs.total > pageSize && (
          <div className="tl-pagination-bar">
            <button
              className="tl-btn-secondary"
              disabled={page === 0 || auditLoading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              ← Previous
            </button>
            <span>
              Page {page + 1} of {Math.ceil(auditLogs.total / pageSize)}
            </span>
            <button
              className="tl-btn-secondary"
              disabled={(page + 1) * pageSize >= auditLogs.total || auditLoading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
