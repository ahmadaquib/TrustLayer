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
    <div className="tl-page-container" style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.35rem' }}>
          TrustLayer Architecture Roadmap
        </h1>
        <p style={{ color: '#475569', fontSize: '0.92rem' }}>
          Current verified safety capabilities vs. planned enterprise platform extensions.
        </p>
      </div>

      {/* Filter Tabs & Summary Counter */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          backgroundColor: '#FFFFFF',
          padding: '0.75rem 1.25rem',
          borderRadius: '8px',
          border: '1px solid #E2E8F0',
          marginBottom: '1.5rem',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setFilter('all')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '6px',
              border: filter === 'all' ? '1px solid #2563EB' : '1px solid #CBD5E1',
              backgroundColor: filter === 'all' ? '#DBEAFE' : '#FFFFFF',
              color: filter === 'all' ? '#1D4ED8' : '#475569',
              fontWeight: filter === 'all' ? 600 : 500,
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            All Items ({implementedList.length + plannedList.length})
          </button>
          <button
            onClick={() => setFilter('implemented')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '6px',
              border: filter === 'implemented' ? '1px solid #059669' : '1px solid #CBD5E1',
              backgroundColor: filter === 'implemented' ? '#D1FAE5' : '#FFFFFF',
              color: filter === 'implemented' ? '#065F46' : '#475569',
              fontWeight: filter === 'implemented' ? 600 : 500,
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Implemented ({implementedList.length})
          </button>
          <button
            onClick={() => setFilter('planned')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '6px',
              border: filter === 'planned' ? '1px solid #7C3AED' : '1px solid #CBD5E1',
              backgroundColor: filter === 'planned' ? '#EDE9FE' : '#FFFFFF',
              color: filter === 'planned' ? '#6D28D9' : '#475569',
              fontWeight: filter === 'planned' ? 600 : 500,
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Planned ({plannedList.length})
          </button>
        </div>

        <div style={{ fontSize: '0.82rem', color: '#64748B' }}>
          Stage: <strong>Friday Review Baseline</strong>
        </div>
      </div>

      {/* IMPLEMENTED SECTION */}
      {showImplemented && (
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
            <span
              style={{
                backgroundColor: '#D1FAE5',
                color: '#065F46',
                fontWeight: 700,
                fontSize: '0.78rem',
                padding: '0.2rem 0.6rem',
                borderRadius: '9999px',
                border: '1px solid #A7F3D0',
              }}
            >
              {implementedList.length} VERIFIED
            </span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A' }}>
              Implemented System Capabilities
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {implementedList.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  borderLeft: '4px solid #059669',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 600 }}>
                      #{String(idx + 1).padStart(2, '0')}
                    </span>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0F172A' }}>{item.title}</h3>
                  </div>
                  <p style={{ fontSize: '0.88rem', color: '#334155', lineHeight: 1.5 }}>{item.note}</p>
                </div>
                <span
                  style={{
                    backgroundColor: '#D1FAE5',
                    color: '#065F46',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.55rem',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.5px',
                  }}
                >
                  {item.badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PLANNED SECTION */}
      {showPlanned && (
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
            <span
              style={{
                backgroundColor: '#EDE9FE',
                color: '#6D28D9',
                fontWeight: 700,
                fontSize: '0.78rem',
                padding: '0.2rem 0.6rem',
                borderRadius: '9999px',
                border: '1px solid #DDD6FE',
              }}
            >
              {plannedList.length} PLANNED
            </span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A' }}>
              Planned Roadmap &amp; Enhancements
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {plannedList.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  borderLeft: '4px solid #7C3AED',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 600 }}>
                      #{String(idx + 1).padStart(2, '0')}
                    </span>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0F172A' }}>{item.title}</h3>
                  </div>
                  <p style={{ fontSize: '0.88rem', color: '#475569', lineHeight: 1.5 }}>{item.note}</p>
                </div>
                <span
                  style={{
                    backgroundColor: '#EDE9FE',
                    color: '#6D28D9',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.55rem',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.5px',
                  }}
                >
                  {item.badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

