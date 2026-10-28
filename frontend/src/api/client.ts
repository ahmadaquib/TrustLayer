/**
 * TrustLayer API Client
 * Strongly typed HTTP client communicating with FastAPI backend.
 */

import type {
  ApprovalActionRequest,
  ApprovalActionResponse,
  AuditLogResponse,
  ChatRequest,
  ChatResponse,
  DashboardSummaryResponse,
  PendingApprovalItem,
  UserProfile,
} from '../types';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers = new Headers(options.headers || {});

    if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }

    try {
      const response = await fetch(url, { ...options, headers });
      if (!response.ok) {
        let errorDetail = `HTTP ${response.status} ${response.statusText}`;
        try {
          const errData = await response.json();
          if (errData && errData.detail) {
            errorDetail = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
          }
        } catch {
          // fallback to status text
        }
        throw new Error(errorDetail);
      }
      return (await response.json()) as T;
    } catch (err: any) {
      console.error(`API request error on [${options.method || 'GET'} ${url}]:`, err);
      throw err;
    }
  }

  // ── Health & Seeded Users ─────────────────────────────────────────────────

  async checkHealth(): Promise<{ status: string }> {
    return this.request<{ status: string }>('/health');
  }

  async getUsers(): Promise<UserProfile[]> {
    return this.request<UserProfile[]>('/users');
  }

  // ── Chat API ──────────────────────────────────────────────────────────────

  async sendChatMessage(payload: ChatRequest): Promise<ChatResponse> {
    return this.request<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // ── Approvals API ─────────────────────────────────────────────────────────

  async getPendingApprovals(
    approverId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<PendingApprovalItem[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });
    return this.request<PendingApprovalItem[]>(`/approvals/pending?${params.toString()}`, {
      method: 'GET',
      headers: {
        'X-User-Id': approverId,
      },
    });
  }

  async approveAction(
    decisionId: string,
    approverId: string,
    reason?: string
  ): Promise<ApprovalActionResponse> {
    const payload: ApprovalActionRequest = {
      reason: reason || 'Approved via Senior Staff console',
      user_id: approverId,
    };
    return this.request<ApprovalActionResponse>(`/approvals/${decisionId}/approve`, {
      method: 'POST',
      headers: {
        'X-User-Id': approverId,
      },
      body: JSON.stringify(payload),
    });
  }

  async rejectAction(
    decisionId: string,
    approverId: string,
    reason?: string
  ): Promise<ApprovalActionResponse> {
    const payload: ApprovalActionRequest = {
      reason: reason || 'Action rejected via Senior Staff console',
      user_id: approverId,
    };
    return this.request<ApprovalActionResponse>(`/approvals/${decisionId}/reject`, {
      method: 'POST',
      headers: {
        'X-User-Id': approverId,
      },
      body: JSON.stringify(payload),
    });
  }

  // ── Analytics & Audit API ─────────────────────────────────────────────────

  async getDashboardSummary(
    userId: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<DashboardSummaryResponse> {
    const params = new URLSearchParams();
    if (dateFrom) params.append('from', dateFrom);
    if (dateTo) params.append('to', dateTo);
    const qs = params.toString() ? `?${params.toString()}` : '';

    return this.request<DashboardSummaryResponse>(`/dashboard/summary${qs}`, {
      method: 'GET',
      headers: {
        'X-User-Id': userId,
      },
    });
  }

  async getAuditLogs(
    userId: string,
    filters?: {
      limit?: number;
      offset?: number;
      decision?: string;
      role?: string;
      tool?: string;
      from?: string;
      to?: string;
    }
  ): Promise<AuditLogResponse> {
    const params = new URLSearchParams();
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset !== undefined) params.append('offset', filters.offset.toString());
    if (filters?.decision && filters.decision !== 'all') params.append('decision', filters.decision);
    if (filters?.role && filters.role !== 'all') params.append('role', filters.role);
    if (filters?.tool && filters.tool !== 'all') params.append('tool', filters.tool);
    if (filters?.from) params.append('from', filters.from);
    if (filters?.to) params.append('to', filters.to);

    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<AuditLogResponse>(`/audit${qs}`, {
      method: 'GET',
      headers: {
        'X-User-Id': userId,
      },
    });
  }
}

export const api = new ApiClient();
export default api;
