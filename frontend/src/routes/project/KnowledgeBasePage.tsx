import React, { useMemo, useState } from 'react';
import doc01 from '@data/kb/doc_01.json';
import doc02 from '@data/kb/doc_02.json';
import doc03 from '@data/kb/doc_03.json';
import doc04 from '@data/kb/doc_04.json';
import doc05 from '@data/kb/doc_05.json';
import doc06 from '@data/kb/doc_06.json';
import doc07 from '@data/kb/doc_07.json';
import doc08 from '@data/kb/doc_08.json';
import doc09 from '@data/kb/doc_09.json';
import doc10 from '@data/kb/doc_10.json';
import doc11 from '@data/kb/doc_11.json';
import doc12 from '@data/kb/doc_12.json';

interface KBDocument {
  id: string;
  title: string;
  content: string;
  source?: string;
  role_scope?: string[];
  tier?: string;
  tier_scope?: string[];
}

const ALL_DOCUMENTS: KBDocument[] = [
  doc01,
  doc02,
  doc03,
  doc04,
  doc05,
  doc06,
  doc07,
  doc08,
  doc09,
  doc10,
  doc11,
  doc12,
];

export const KnowledgeBasePage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRoleScope, setSelectedRoleScope] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredDocs = useMemo(() => {
    return ALL_DOCUMENTS.filter((doc) => {
      // Role scope filter
      if (selectedRoleScope !== 'all') {
        const scopes = doc.role_scope || [];
        if (!scopes.includes(selectedRoleScope)) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = doc.title.toLowerCase().includes(q);
        const matchContent = doc.content.toLowerCase().includes(q);
        const matchScope = (doc.role_scope || []).some((s) => s.toLowerCase().includes(q));
        const matchSource = (doc.source || '').toLowerCase().includes(q);
        if (!matchTitle && !matchContent && !matchScope && !matchSource) return false;
      }
      return true;
    });
  }, [searchQuery, selectedRoleScope]);

  const handleCopyId = (id: string) => {
    navigator.clipboard?.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page Header */}
      <div className="tl-page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="tl-page-title">Banking Policy Knowledge Base</h1>
          <p className="tl-page-subtitle">
            Authoritative documents indexed via BGE-M3 1024-d embeddings into pgvector for role-scoped retrieval.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', background: '#DBEAFE', color: '#1D4ED8', padding: '0.25rem 0.65rem', borderRadius: '6px', fontWeight: 700 }}>
            12 Active Policies
          </span>
          <span style={{ fontSize: '0.78rem', background: '#EDE9FE', color: '#6D28D9', padding: '0.25rem 0.65rem', borderRadius: '6px', fontWeight: 700 }}>
            Role-Scoped RAG
          </span>
        </div>
      </div>

      {/* Controls & Search Card */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          backgroundColor: '#FFFFFF',
          padding: '1rem 1.4rem',
          borderRadius: '10px',
          border: '1px solid #E2E8F0',
          boxShadow: 'var(--tl-shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '300px' }}>
          <span style={{ color: '#94A3B8', fontSize: '1.1rem' }}>🔍</span>
          <input
            type="text"
            placeholder="Search documents by policy title, rule clauses, or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              fontSize: '0.92rem',
              color: '#0F172A',
              fontWeight: 500,
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                background: '#F1F5F9',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                fontWeight: 700,
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.7rem',
              }}
            >
              ✕
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{ fontSize: '0.84rem', color: '#64748B', fontWeight: 600 }}>Filter Scope:</label>
          <select
            value={selectedRoleScope}
            onChange={(e) => setSelectedRoleScope(e.target.value)}
            className="tl-select-filter"
          >
            <option value="all">All Scopes (12)</option>
            <option value="customer">Customer Accessible</option>
            <option value="staff">Staff Accessible</option>
            <option value="approver">Approver Accessible</option>
          </select>
          <span style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600, marginLeft: '0.4rem' }}>
            Showing {filteredDocs.length} of {ALL_DOCUMENTS.length} docs
          </span>
        </div>
      </div>

      {/* Document Cards List */}
      {filteredDocs.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '3.5rem 1.5rem',
            backgroundColor: '#FFFFFF',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            color: '#64748B',
            boxShadow: 'var(--tl-shadow-sm)',
          }}
        >
          <div style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>📄</div>
          <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
            No policy documents matched your query.
          </p>
          <p style={{ fontSize: '0.88rem' }}>Try clearing the search query or selecting "All Scopes".</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          {filteredDocs.map((doc, idx) => (
            <div
              key={doc.id}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                padding: '1.4rem',
                boxShadow: 'var(--tl-shadow-sm)',
                transition: 'box-shadow 0.15s, border-color 0.15s',
              }}
            >
              {/* Card Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  marginBottom: '0.85rem',
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      color: '#2563EB',
                      backgroundColor: '#EFF6FF',
                      border: '1px solid #BFDBFE',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      marginRight: '0.6rem',
                    }}
                  >
                    DOC #{String(idx + 1).padStart(2, '0')}
                  </span>
                  <h2
                    style={{
                      display: 'inline',
                      fontSize: '1.15rem',
                      fontWeight: 800,
                      color: '#0F172A',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {doc.title}
                  </h2>
                </div>

                {/* Scope badges */}
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {(doc.role_scope || []).map((scope) => (
                    <span
                      key={scope}
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '0.2rem 0.55rem',
                        borderRadius: '9999px',
                        letterSpacing: '0.04em',
                        backgroundColor:
                          scope === 'customer'
                            ? '#E0F2FE'
                            : scope === 'staff'
                            ? '#FEF3C7'
                            : '#F3E8FF',
                        color:
                          scope === 'customer'
                            ? '#0369A1'
                            : scope === 'staff'
                            ? '#B45309'
                            : '#6B21A8',
                        border: `1px solid ${
                          scope === 'customer'
                            ? '#BAE6FD'
                            : scope === 'staff'
                            ? '#FDE68A'
                            : '#E9D5FF'
                        }`,
                      }}
                    >
                      {scope.toUpperCase()}
                    </span>
                  ))}
                  {doc.source && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        border: '1px solid #E2E8F0',
                        color: '#64748B',
                        background: '#F8FAFC',
                        fontWeight: 600,
                      }}
                    >
                      {doc.source}
                    </span>
                  )}
                </div>
              </div>

              {/* Document Content */}
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  borderRadius: '8px',
                  padding: '1.1rem 1.25rem',
                  fontSize: '0.92rem',
                  color: '#334155',
                  lineHeight: 1.65,
                  border: '1px solid #F1F5F9',
                }}
              >
                {doc.content}
              </div>

              {/* Card Footer: Metadata & Copy ID */}
              <div
                style={{
                  marginTop: '0.85rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.78rem',
                  color: '#94A3B8',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>UUID:</span>
                  <code style={{ background: '#F1F5F9', padding: '0.15rem 0.4rem', borderRadius: '4px', color: '#475569' }}>
                    {doc.id}
                  </code>
                  <button
                    onClick={() => handleCopyId(doc.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: copiedId === doc.id ? '#059669' : '#3B82F6',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.74rem',
                    }}
                  >
                    {copiedId === doc.id ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <span>Access-Aware pgvector RAG Index</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
