import React, { useState } from 'react';
import roadmapData from '@data/demo/roadmap.json';

interface RoadmapItem {
  id: string;
  title: string;
  badge: 'IMPLEMENTED' | 'PLANNED';
  note: string;
}

interface RoadmapSchema {
  implemented: RoadmapItem[];
  planned: RoadmapItem[];
}

export const RoadmapPage: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'implemented' | 'planned'>('all');

  const data = roadmapData as RoadmapSchema;
  const implementedList = data.implemented || [];
  const plannedList = data.planned || [];

  const showImplemented = filter === 'all' || filter === 'implemented';
  const showPlanned = filter === 'all' || filter === 'planned';

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page Header */}
      <div className="tl-page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="tl-page-title">TrustLayer Architecture Roadmap</h1>
          <p className="tl-page-subtitle">
            Current verified safety capabilities vs. planned enterprise platform extensions.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', background: '#D1FAE5', color: '#065F46', padding: '0.25rem 0.65rem', borderRadius: '6px', fontWeight: 700 }}>
            {implementedList.length} Implemented
          </span>
          <span style={{ fontSize: '0.78rem', background: '#EDE9FE', color: '#6D28D9', padding: '0.25rem 0.65rem', borderRadius: '6px', fontWeight: 700 }}>
            {plannedList.length} Planned
          </span>
        </div>
      </div>

      {/* Filter Tabs & Status Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          backgroundColor: '#FFFFFF',
          padding: '0.85rem 1.4rem',
          borderRadius: '10px',
          border: '1px solid #E2E8F0',
          boxShadow: 'var(--tl-shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setFilter('all')}
            className={`tl-btn-secondary ${filter === 'all' ? 'active' : ''}`}
            style={{
              backgroundColor: filter === 'all' ? '#EFF6FF' : '#FFFFFF',
              borderColor: filter === 'all' ? '#3B82F6' : '#CBD5E1',
              color: filter === 'all' ? '#1D4ED8' : '#475569',
              fontWeight: filter === 'all' ? 700 : 500,
            }}
          >
            All Milestones ({implementedList.length + plannedList.length})
          </button>
          <button
            onClick={() => setFilter('implemented')}
            className={`tl-btn-secondary ${filter === 'implemented' ? 'active' : ''}`}
            style={{
              backgroundColor: filter === 'implemented' ? '#ECFDF5' : '#FFFFFF',
              borderColor: filter === 'implemented' ? '#10B981' : '#CBD5E1',
              color: filter === 'implemented' ? '#047857' : '#475569',
              fontWeight: filter === 'implemented' ? 700 : 500,
            }}
          >
            ✓ Implemented ({implementedList.length})
          </button>
          <button
            onClick={() => setFilter('planned')}
            className={`tl-btn-secondary ${filter === 'planned' ? 'active' : ''}`}
            style={{
              backgroundColor: filter === 'planned' ? '#F5F3FF' : '#FFFFFF',
              borderColor: filter === 'planned' ? '#8B5CF6' : '#CBD5E1',
              color: filter === 'planned' ? '#6D28D9' : '#475569',
              fontWeight: filter === 'planned' ? 700 : 500,
            }}
          >
            🎯 Planned ({plannedList.length})
          </button>
        </div>

        <div style={{ fontSize: '0.84rem', color: '#64748B', fontWeight: 500 }}>
          Architecture Baseline: <strong style={{ color: '#0F172A' }}>Friday Review</strong>
        </div>
      </div>

      {/* IMPLEMENTED SECTION */}
      {showImplemented && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span
              style={{
                backgroundColor: '#D1FAE5',
                color: '#065F46',
                fontWeight: 800,
                fontSize: '0.78rem',
                padding: '0.2rem 0.65rem',
                borderRadius: '9999px',
                border: '1px solid #A7F3D0',
              }}
            >
              {implementedList.length} VERIFIED
            </span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
              Implemented System Capabilities
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {implementedList.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  padding: '1.15rem 1.35rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  boxShadow: 'var(--tl-shadow-sm)',
                  borderLeft: '4px solid #059669',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 700 }}>
                      #{String(idx + 1).padStart(2, '0')}
                    </span>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A' }}>{item.title}</h3>
                  </div>
                  <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.55 }}>{item.note}</p>
                </div>
                <span
                  style={{
                    backgroundColor: '#D1FAE5',
                    color: '#065F46',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '0.25rem 0.65rem',
                    borderRadius: '9999px',
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.04em',
                    border: '1px solid #A7F3D0',
                  }}
                >
                  ✓ {item.badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PLANNED SECTION */}
      {showPlanned && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: showImplemented ? '1rem' : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span
              style={{
                backgroundColor: '#EDE9FE',
                color: '#6D28D9',
                fontWeight: 800,
                fontSize: '0.78rem',
                padding: '0.2rem 0.65rem',
                borderRadius: '9999px',
                border: '1px solid #DDD6FE',
              }}
            >
              {plannedList.length} PLANNED
            </span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
              Planned Roadmap &amp; Future Scope
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {plannedList.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  padding: '1.15rem 1.35rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  boxShadow: 'var(--tl-shadow-sm)',
                  borderLeft: '4px solid #7C3AED',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 700 }}>
                      #{String(idx + 1).padStart(2, '0')}
                    </span>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A' }}>{item.title}</h3>
                  </div>
                  <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.55 }}>{item.note}</p>
                </div>
                <span
                  style={{
                    backgroundColor: '#EDE9FE',
                    color: '#6D28D9',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '0.25rem 0.65rem',
                    borderRadius: '9999px',
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.04em',
                    border: '1px solid #DDD6FE',
                  }}
                >
                  🎯 {item.badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
