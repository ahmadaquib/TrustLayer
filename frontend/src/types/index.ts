/**
 * TrustLayer Frontend TypeScript Type Definitions
 * Aligned strictly with backend schemas in docs/05 and FastAPI endpoints.
 */

export type UserRole = 'customer' | 'staff' | 'approver';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  email?: string;
}

// ── Chat API Types ──────────────────────────────────────────────────────────

export interface ChatRequest {
  user_id: string;
  message: string;
  role?: string;
  session_id?: string | null;
  request_id?: string | null;
}

export interface ChatResponse {
  request_id: string;
  session_id: string;
  user_id: string;
  role: string;
  decision: 'allow' | 'approve' | 'block' | string;
  final_risk: number;
  grounding_score?: number | null;
  policy_risk?: number | null;
  tool_called?: string | null;
  tool_params?: Record<string, any> | null;
  tool_result?: Record<string, any> | null;
  decision_id?: string | null;
  audit_log_id?: string | null;
  response: string;
}

export interface ChatMessageItem {
  id: string;
  sender: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
  decision?: string;
  tool_called?: string | null;
  tool_result?: Record<string, any> | null;
  decision_id?: string | null;
  final_risk?: number;
  grounding_score?: number | null;
  policy_risk?: number | null;
}

// ── Approval Queue Types ────────────────────────────────────────────────────

export interface PendingApprovalItem {
  decision_id: string;
  action_id?: string | null;
  session_id?: string | null;
  tool_name?: string | null;
  params?: Record<string, any> | null;
  grounding_score?: number | null;
  policy_risk_score?: number | null;
  final_risk?: number | null;
  decision: string;
  resolution_status?: string | null;
  proposed_at?: string | null;
}

export interface ApprovalActionRequest {
  reason?: string | null;
  user_id?: string | null;
}

export interface ApprovalActionResponse {
  approval_id: string;
  decision: string;
  resolution_status: 'approved' | 'rejected' | string;
  status: string;
  tool_name?: string | null;
  tool_result?: Record<string, any> | null;
  approver_id: string;
  resolved_at: string;
  reason?: string | null;
  message: string;
}

// ── Analytics & Dashboard Types ─────────────────────────────────────────────

export interface DecisionBreakdown {
  allow: number;
  approve: number;
  block: number;
}

export interface RoleBreakdown {
  customer: number;
  staff: number;
  approver: number;
}

export interface ToolBreakdown {
  tool_name: string;
  count: number;
}

export interface DecisionAvgScores {
  decision: string;
  avg_risk?: number | null;
  avg_grounding?: number | null;
}

export interface DashboardSummaryResponse {
  total_decisions: number;
  by_decision: DecisionBreakdown;
  by_role: RoleBreakdown;
  by_tool: ToolBreakdown[];
  avg_scores_per_decision: DecisionAvgScores[];
  date_from?: string | null;
  date_to?: string | null;
}

export interface AuditLogItem {
  audit_id: string;
  request_id?: string | null;
  session_id?: string | null;
  action_id?: string | null;
  decision_id?: string | null;
  event?: string | null;
  event_type?: string | null;
  actor_id?: string | null;
  reason?: string | null;
  timestamp?: string | null;
  decision?: string | null;
  tool_name?: string | null;
  grounding_score?: number | null;
  policy_risk_score?: number | null;
  final_risk?: number | null;
  user_role?: string | null;
}

export interface AuditLogResponse {
  total: number;
  limit: number;
  offset: number;
  items: AuditLogItem[];
}

// ── Demo Presets ────────────────────────────────────────────────────────────

export interface DemoPreset {
  id: string;
  label: string;
  user: {
    id: string;
    name: string;
    role: UserRole;
  };
  message: string;
  expected_decision: 'allow' | 'approve' | 'block' | string;
}


