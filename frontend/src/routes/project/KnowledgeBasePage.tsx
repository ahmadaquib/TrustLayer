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

  return (
    <div className="tl-page-container" style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.35rem' }}>
          Banking Policy Knowledge Base
        </h1>
        <p style={{ color: '#475569', fontSize: '0.92rem' }}>
          Authoritative policy documents used for access-aware RAG retrieval and NLI claim grounding.
        </p>
      </div>

      {/* Controls & Search */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          backgroundColor: '#FFFFFF',
          padding: '1rem 1.25rem',
          borderRadius: '8px',
          border: '1px solid #E2E8F0',
          marginBottom: '1.5rem',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '280px' }}>
          <span style={{ color: '#94A3B8' }}>🔍</span>
          <input
            type="text"
            placeholder="Search documents by title, policy clause, or scope..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              fontSize: '0.92rem',
              color: '#0F172A',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                background: 'none',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              ✕
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 500 }}>Scope:</label>
          <select
            value={selectedRoleScope}
            onChange={(e) => setSelectedRoleScope(e.target.value)}
            style={{
              padding: '0.35rem 0.65rem',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              fontSize: '0.85rem',
              color: '#1E293B',
              backgroundColor: '#FFFFFF',
            }}
          >
            <option value="all">All Scopes</option>
            <option value="customer">Customer Accessible</option>
            <option value="staff">Staff Accessible</option>
            <option value="approver">Approver Accessible</option>
          </select>
          <span style={{ fontSize: '0.85rem', color: '#64748B', marginLeft: '0.5rem' }}>
            {filteredDocs.length} of {ALL_DOCUMENTS.length} docs
          </span>
        </div>
      </div>

      {/* Document List */}
      {filteredDocs.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '3rem 1.5rem',
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            border: '1px solid #E2E8F0',
            color: '#64748B',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
          <p style={{ fontSize: '1.05rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>
            No documents matched your query.
          </p>
          <p style={{ fontSize: '0.85rem' }}>Try clearing the search text or changing the role scope filter.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredDocs.map((doc, idx) => (
            <div
              key={doc.id}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                padding: '1.25rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              {/* Card Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  marginBottom: '0.75rem',
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: '#2563EB',
                      backgroundColor: '#DBEAFE',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                      marginRight: '0.5rem',
                    }}
                  >
                    DOC #{String(idx + 1).padStart(2, '0')}
                  </span>
                  <h2
                    style={{
                      display: 'inline',
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      color: '#0F172A',
                    }}
                  >
                    {doc.title}
                  </h2>
                </div>

                {/* Scope badges */}
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {(doc.role_scope || []).map((scope) => (
                    <span
                      key={scope}
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
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
                      }}
                    >
                      {scope.toUpperCase()}
                    </span>
                  ))}
                  {doc.tier && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        backgroundColor: '#F1F5F9',
                        color: '#475569',
                      }}
                    >
                      {doc.tier}
                    </span>
                  )}
                  {doc.source && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        border: '1px solid #E2E8F0',
                        color: '#64748B',
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
                  borderRadius: '6px',
                  padding: '0.9rem 1rem',
                  fontSize: '0.9rem',
                  color: '#334155',
                  lineHeight: 1.6,
                  border: '1px solid #F1F5F9',
                }}
              >
                {doc.content}
              </div>

              {/* Card Footer: Metadata */}
              <div
                style={{
                  marginTop: '0.75rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.78rem',
                  color: '#94A3B8',
                }}
              >
                <span>
                  UUID: <code>{doc.id}</code>
                </span>
                <span>Access-Aware pgvector RAG Index</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

