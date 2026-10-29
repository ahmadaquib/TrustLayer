import React, { useMemo, useState } from 'react';
import ablationCsvRaw from '@data/results/ablation_results.csv?raw';
import resultsCsvRaw from '@data/results/results.csv?raw';
import casesJson from '@data/eval/cases.json';
import hardCasesJson from '@data/eval/hard_cases.json';
import { parseAblationCsv, parseResultsCsv } from '../../utils/csvParser';

interface EvalCase {
  id: string;
  bucket: string;
  user_role?: string;
  user_message?: string;
  agent_claims?: string[];
  proposed_tool_call?: {
    tool?: string;
    name?: string;
    tool_name?: string;
    params?: Record<string, unknown>;
  };
  expected_decision: string;
}

export const EvaluationPage: React.FC = () => {
  const [selectedBucket, setSelectedBucket] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'correct' | 'incorrect'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [browserMode, setBrowserMode] = useState<string>('full');

  // Parse raw ablation CSV rows
  const { ablationRows, resultsRows, allCases, parseError } = useMemo(() => {
    try {
      const aRows = parseAblationCsv(ablationCsvRaw);
      const rRows = parseResultsCsv(resultsCsvRaw);
      const combinedCases: EvalCase[] = [
        ...(Array.isArray(casesJson) ? (casesJson as EvalCase[]) : []),
        ...(Array.isArray(hardCasesJson) ? (hardCasesJson as EvalCase[]) : []),
      ];
      return { ablationRows: aRows, resultsRows: rRows, allCases: combinedCases, parseError: null };
    } catch (err) {
      return {
        ablationRows: [],
        resultsRows: [],
        allCases: [],
        parseError: err instanceof Error ? err.message : 'Failed to parse evaluation files',
      };
    }
  }, []);

  // Compute overall accuracy per mode
  const modeStats = useMemo(() => {
    const modes = ['rbac_only', 'grounding_only', 'full'];
    return modes.map((m) => {
      const rowsForMode = ablationRows.filter((r) => r.mode === m);
      const total = rowsForMode.length;
      const correct = rowsForMode.filter((r) => r.correct).length;
      const pct = total > 0 ? (correct / total) * 100 : 0;
      return { mode: m, total, correct, pct };
    });
  }, [ablationRows]);

  // Compute accuracy per bucket per mode
  const bucketTable = useMemo(() => {
    const buckets = Array.from(new Set(ablationRows.map((r) => r.bucket))).sort();
    const modes = ['rbac_only', 'grounding_only', 'full'];

    return buckets.map((bucket) => {
      const modeData: Record<string, { correct: number; total: number; pct: number }> = {};
      for (const m of modes) {
        const matching = ablationRows.filter((r) => r.bucket === bucket && r.mode === m);
        const total = matching.length;
        const correct = matching.filter((r) => r.correct).length;
        const pct = total > 0 ? (correct / total) * 100 : 0;
        modeData[m] = { correct, total, pct };
      }
      return { bucket, modeData };
    });
  }, [ablationRows]);

  // Compute False-Positive Rate per mode on benign and control buckets
  const fprStats = useMemo(() => {
    const modes = ['rbac_only', 'grounding_only', 'full'];
    return modes.map((m) => {
      const cleanRows = ablationRows.filter(
        (r) =>
          r.mode === m &&
          (r.bucket === 'benign' || r.bucket === 'agent_true_claim_control')
      );
      const cleanTotal = cleanRows.length;
      const falsePositives = cleanRows.filter((r) => r.actual.toLowerCase() !== 'allow').length;
      const fpr = cleanTotal > 0 ? (falsePositives / cleanTotal) * 100 : 0;
      return { mode: m, cleanTotal, falsePositives, fpr };
    });
  }, [ablationRows]);

  // Sanity check banner: ~54.6% for rbac_only, ~84.5% for grounding_only, ~100% for full
  const sanityCheck = useMemo(() => {
    if (modeStats.length === 0) return { passed: true, message: '' };
    const rbac = modeStats.find((s) => s.mode === 'rbac_only');
    const grounding = modeStats.find((s) => s.mode === 'grounding_only');
    const full = modeStats.find((s) => s.mode === 'full');

    const rbacOk = rbac && Math.abs(rbac.pct - 54.6) <= 2.0;
    const groundingOk = grounding && Math.abs(grounding.pct - 84.5) <= 2.0;
    const fullOk = full && Math.abs(full.pct - 100.0) <= 1.0;

    const passed = Boolean(rbacOk && groundingOk && fullOk);
    return {
      passed,
      message: passed
        ? 'Results verify correctly against baseline benchmarks (54.6% / 84.5% / 100.0%).'
        : 'results file differs from the reported numbers',
    };
  }, [modeStats]);

  // Case browser joined records
  const joinedCases = useMemo(() => {
    const resultsMap = new Map(
      ablationRows
        .filter((r) => r.mode === browserMode)
        .map((r) => [r.caseId, r])
    );
    const fullDetailMap = new Map(resultsRows.map((r) => [r.caseId, r]));

    return allCases.map((c) => {
      const res = resultsMap.get(c.id);
      const detail = fullDetailMap.get(c.id);
      return {
        id: c.id,
        bucket: c.bucket,
        message: c.user_message || '(No direct user message)',
        toolCall: c.proposed_tool_call
          ? `${c.proposed_tool_call.tool || c.proposed_tool_call.name || c.proposed_tool_call.tool_name || 'tool'} (${JSON.stringify(c.proposed_tool_call.params || {})})`
          : 'None',
        expected: res ? res.expected : c.expected_decision,
        actual: res ? res.actual : 'unknown',
        correct: res ? res.correct : false,
        riskScore: detail ? detail.riskScore : null,
        groundingScore: detail ? detail.groundingScore : null,
      };
    });
  }, [allCases, ablationRows, resultsRows, browserMode]);

  // Filtered cases for browser
  const filteredCases = useMemo(() => {
    return joinedCases.filter((c) => {
      if (selectedBucket !== 'all' && c.bucket !== selectedBucket) return false;
      if (statusFilter === 'correct' && !c.correct) return false;
      if (statusFilter === 'incorrect' && c.correct) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = c.id.toLowerCase().includes(q);
        const matchMsg = c.message.toLowerCase().includes(q);
        const matchBucket = c.bucket.toLowerCase().includes(q);
        if (!matchId && !matchMsg && !matchBucket) return false;
      }
      return true;
    });
  }, [joinedCases, selectedBucket, statusFilter, searchQuery]);

  const allBuckets = useMemo(() => {
    return Array.from(new Set(allCases.map((c) => c.bucket))).sort();
  }, [allCases]);

  const modeLabels: Record<string, string> = {
    rbac_only: 'RBAC Only (Access Matrix Only)',
    grounding_only: 'Grounding Only (NLI + RAG Only)',
    full: 'Full Dual-Verification Pipeline',
  };

  const modeColors: Record<string, string> = {
    rbac_only: '#F59E0B',
    grounding_only: '#3B82F6',
    full: '#10B981',
  };

  return (
    <div className="tl-page-container" style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Header section */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.35rem' }}>
          Dual-Verification Evaluation &amp; Ablation Suite
        </h1>
        <p style={{ color: '#475569', fontSize: '0.92rem' }}>
          Comparative empirical performance of TrustLayer under isolated and fused verification modes.
        </p>
      </div>

      {parseError && (
        <div className="tl-banner error" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
          <strong>Error reading evaluation data:</strong> {parseError}
        </div>
      )}

      {/* Sanity Check Banner */}
      {!sanityCheck.passed ? (
        <div
          className="tl-banner error"
          style={{
            marginBottom: '1.5rem',
            padding: '1rem 1.25rem',
            borderLeft: '4px solid #DC2626',
            backgroundColor: '#FEE2E2',
            color: '#991B1B',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <span style={{ fontSize: '1.3rem' }}>⚠️</span>
          <div>
            <strong>Warning:</strong> {sanityCheck.message}
          </div>
        </div>
      ) : (
        <div
          style={{
            marginBottom: '1.5rem',
            padding: '0.75rem 1.25rem',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#065F46',
            borderRadius: '6px',
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
          }}
        >
          <span>✓</span>
          <span>{sanityCheck.message}</span>
        </div>
      )}

      {/* Mandatory benchmark note */}
      <div
        style={{
          backgroundColor: '#F1F5F9',
          borderLeft: '4px solid #2563EB',
          padding: '0.85rem 1.25rem',
          marginBottom: '1.5rem',
          borderRadius: '4px',
          fontSize: '0.9rem',
          color: '#334155',
        }}
      >
        <strong>Benchmark Note:</strong> 97 self-authored cases (75 + 22 hard held-out). External benchmarks are planned (step 8).
      </div>

      {/* Grid: 3-Bar Overall Accuracy & FPR Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        {/* CSS Accuracy Bars */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            padding: '1.25rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0F172A', marginBottom: '1rem' }}>
            Overall Accuracy by Mode
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {modeStats.map((item) => (
              <div key={item.mode}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.88rem' }}>
                  <span style={{ fontWeight: 600, color: '#1E293B' }}>{modeLabels[item.mode] || item.mode}</span>
                  <span style={{ fontWeight: 700, color: modeColors[item.mode] }}>
                    {item.correct}/{item.total} ({item.pct.toFixed(1)}%)
                  </span>
                </div>
                {/* CSS Bar Container */}
                <div
                  style={{
                    backgroundColor: '#E2E8F0',
                    height: '14px',
                    borderRadius: '7px',
                    overflow: 'hidden',
                    width: '100%',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${item.pct}%`,
                      backgroundColor: modeColors[item.mode],
                      borderRadius: '7px',
                      transition: 'width 0.4s ease-in-out',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* False Positive Rate Stats */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            padding: '1.25rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0F172A', marginBottom: '0.5rem' }}>
            False-Positive Rate (FPR) on Clean Cases
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#64748B', marginBottom: '1rem' }}>
            Measured on benign requests and control cases where the correct expected decision is <code>allow</code>.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            {fprStats.map((f) => (
              <div
                key={f.mode}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.65rem 0.85rem',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '6px',
                  border: '1px solid #E2E8F0',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1E293B' }}>
                    {modeLabels[f.mode] || f.mode}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                    {f.falsePositives} false blocks out of {f.cleanTotal} clean cases
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: f.fpr === 0 ? '#059669' : '#DC2626',
                    backgroundColor: f.fpr === 0 ? '#D1FAE5' : '#FEE2E2',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '4px',
                  }}
                >
                  {f.fpr.toFixed(1)}% FPR
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Accuracy per Bucket Table */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '8px',
          padding: '1.25rem',
          marginBottom: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          overflowX: 'auto',
        }}
      >
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0F172A', marginBottom: '1rem' }}>
          Accuracy by Evaluation Bucket
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
              <th style={{ padding: '0.75rem', fontWeight: 600, color: '#475569' }}>Evaluation Bucket</th>
              <th style={{ padding: '0.75rem', fontWeight: 600, color: '#F59E0B' }}>RBAC Only</th>
              <th style={{ padding: '0.75rem', fontWeight: 600, color: '#3B82F6' }}>Grounding Only</th>
              <th style={{ padding: '0.75rem', fontWeight: 600, color: '#10B981' }}>Full Pipeline</th>
            </tr>
          </thead>
          <tbody>
            {bucketTable.map((row) => (
              <tr key={row.bucket} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '0.65rem 0.75rem', fontWeight: 500, color: '#1E293B' }}>
                  <code>{row.bucket}</code>
                </td>
                <td style={{ padding: '0.65rem 0.75rem' }}>
                  {row.modeData.rbac_only.correct}/{row.modeData.rbac_only.total} (
                  {row.modeData.rbac_only.pct.toFixed(1)}%)
                </td>
                <td style={{ padding: '0.65rem 0.75rem' }}>
                  {row.modeData.grounding_only.correct}/{row.modeData.grounding_only.total} (
                  {row.modeData.grounding_only.pct.toFixed(1)}%)
                </td>
                <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600, color: '#059669' }}>
                  {row.modeData.full.correct}/{row.modeData.full.total} ({row.modeData.full.pct.toFixed(1)}%)
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #CBD5E1', backgroundColor: '#F8FAFC', fontWeight: 700 }}>
              <td style={{ padding: '0.75rem' }}>OVERALL TOTAL</td>
              {modeStats.map((m) => (
                <td key={m.mode} style={{ padding: '0.75rem' }}>
                  {m.correct}/{m.total} ({m.pct.toFixed(1)}%)
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Case Browser */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '8px',
          padding: '1.25rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0F172A' }}>
            Case Browser ({filteredCases.length} of {allCases.length} cases)
          </h2>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Mode selection for browser comparison */}
            <select
              value={browserMode}
              onChange={(e) => setBrowserMode(e.target.value)}
              style={{
                padding: '0.4rem 0.6rem',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '0.85rem',
              }}
            >
              <option value="full">Mode: Full Pipeline</option>
              <option value="grounding_only">Mode: Grounding Only</option>
              <option value="rbac_only">Mode: RBAC Only</option>
            </select>

            {/* Bucket Filter */}
            <select
              value={selectedBucket}
              onChange={(e) => setSelectedBucket(e.target.value)}
              style={{
                padding: '0.4rem 0.6rem',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '0.85rem',
              }}
            >
              <option value="all">All Buckets</option>
              {allBuckets.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            {/* Correctness Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'correct' | 'incorrect')}
              style={{
                padding: '0.4rem 0.6rem',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '0.85rem',
              }}
            >
              <option value="all">All Outcomes</option>
              <option value="correct">Correct (Match) Only</option>
              <option value="incorrect">Incorrect (Mismatch) Only</option>
            </select>

            {/* Text Search */}
            <input
              type="text"
              placeholder="Search case ID or message..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '0.85rem',
                minWidth: '220px',
              }}
            />
          </div>
        </div>

        {/* Case Table */}
        {filteredCases.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: '#64748B' }}>
            <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No evaluation cases matched your filters.</p>
            <button
              onClick={() => {
                setSelectedBucket('all');
                setStatusFilter('all');
                setSearchQuery('');
              }}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '4px',
                border: '1px solid #CBD5E1',
                background: '#F1F5F9',
                cursor: 'pointer',
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                  <th style={{ padding: '0.65rem', fontWeight: 600, color: '#475569' }}>Case ID</th>
                  <th style={{ padding: '0.65rem', fontWeight: 600, color: '#475569' }}>Bucket</th>
                  <th style={{ padding: '0.65rem', fontWeight: 600, color: '#475569' }}>User Message</th>
                  <th style={{ padding: '0.65rem', fontWeight: 600, color: '#475569' }}>Expected</th>
                  <th style={{ padding: '0.65rem', fontWeight: 600, color: '#475569' }}>Actual</th>
                  <th style={{ padding: '0.65rem', fontWeight: 600, color: '#475569' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '0.65rem', fontWeight: 600, color: '#1E293B', whiteSpace: 'nowrap' }}>
                      <code>{c.id}</code>
                    </td>
                    <td style={{ padding: '0.65rem', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          backgroundColor: '#F1F5F9',
                          color: '#475569',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          fontSize: '0.78rem',
                        }}
                      >
                        {c.bucket}
                      </span>
                    </td>
                    <td style={{ padding: '0.65rem', maxWidth: '380px', color: '#334155' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.message}>
                        {c.message}
                      </div>
                    </td>
                    <td style={{ padding: '0.65rem', textTransform: 'uppercase', fontSize: '0.8rem', fontWeight: 600 }}>
                      <span
                        style={{
                          color:
                            c.expected === 'allow' ? '#059669' : c.expected === 'block' ? '#DC2626' : '#D97706',
                        }}
                      >
                        {c.expected}
                      </span>
                    </td>
                    <td style={{ padding: '0.65rem', textTransform: 'uppercase', fontSize: '0.8rem', fontWeight: 600 }}>
                      <span
                        style={{
                          color:
                            c.actual === 'allow' ? '#059669' : c.actual === 'block' ? '#DC2626' : '#D97706',
                        }}
                      >
                        {c.actual}
                      </span>
                    </td>
                    <td style={{ padding: '0.65rem', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          backgroundColor: c.correct ? '#D1FAE5' : '#FEE2E2',
                          color: c.correct ? '#065F46' : '#991B1B',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                        }}
                      >
                        {c.correct ? 'PASS' : 'FAIL'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

