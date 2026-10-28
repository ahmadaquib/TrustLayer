import { useState, useEffect } from 'react';
import './App.css';
import { api } from './api/client';
import { Header } from './components/Header';
import { ChatPage } from './routes/customer/ChatPage';
import { ApproverQueuePage } from './routes/approver/ApproverQueuePage';
import { DashboardPage } from './routes/admin/DashboardPage';
import type { UserProfile } from './types';

const DEFAULT_USERS: UserProfile[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Alice Johnson',
    role: 'customer',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Bob Smith',
    role: 'customer',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Charlie Brown',
    role: 'customer',
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'Sarah Davis',
    role: 'staff',
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    name: 'David Miller',
    role: 'staff',
  },
  {
    id: '66666666-6666-6666-6666-666666666666',
    name: 'Eleanor Vance',
    role: 'approver',
  },
];

function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'approvals' | 'analytics'>('chat');
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>(DEFAULT_USERS);
  const [currentUser, setCurrentUser] = useState<UserProfile>(DEFAULT_USERS[0]);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Check backend health & sync users
  useEffect(() => {
    let isMounted = true;

    const checkBackend = async () => {
      const t0 = performance.now();
      try {
        await api.checkHealth();
        if (!isMounted) return;
        const latency = Math.round(performance.now() - t0);
        setLatencyMs(latency);
        setBackendOnline(true);

        const users = await api.getUsers();
        if (isMounted && users && users.length > 0) {
          setAvailableUsers(users);
        }
      } catch {
        if (isMounted) {
          setBackendOnline(false);
          setLatencyMs(null);
        }
      }
    };

    const checkPendingApprovals = async () => {
      if (currentUser.role !== 'approver') {
        if (isMounted) setPendingCount(0);
        return;
      }
      try {
        const pending = await api.getPendingApprovals(currentUser.id, 10, 0);
        if (isMounted) setPendingCount(pending.length);
      } catch {
        if (isMounted) setPendingCount(0);
      }
    };

    checkBackend();
    checkPendingApprovals();

    const interval = setInterval(() => {
      checkBackend();
      checkPendingApprovals();
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [currentUser]);

  // When switching user role, auto-switch to permitted view for role
  const handleSelectUser = (user: UserProfile) => {
    setCurrentUser(user);
    if (user.role === 'customer') {
      setActiveTab('chat');
    } else if (user.role === 'staff' && activeTab === 'approvals') {
      setActiveTab('analytics');
    }
  };

  return (
    <div className="tl-app-shell">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        currentUser={currentUser}
        availableUsers={availableUsers}
        onSelectUser={handleSelectUser}
        backendOnline={backendOnline}
        latencyMs={latencyMs}
        pendingCount={pendingCount}
      />

      <main className="tl-main-container">
        {backendOnline === false && (
          <div className="tl-banner error" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
            <div>
              <strong style={{ display: 'block', marginBottom: '0.25rem', fontSize: '1rem' }}>
                Backend unreachable, start the server
              </strong>
              <span>
                Could not connect to the TrustLayer FastAPI gateway at <code>http://localhost:8000</code>.
                Start the backend server with:
              </span>
              <div style={{ marginTop: '0.4rem' }}>
                <code>npm start</code> or <code>cd backend &amp;&amp; uv run uvicorn trustlayer.main:app --port 8000</code>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'chat' && <ChatPage currentUser={currentUser} />}
        {activeTab === 'approvals' && currentUser.role === 'approver' && (
          <ApproverQueuePage currentUser={currentUser} />
        )}
        {activeTab === 'analytics' && (currentUser.role === 'staff' || currentUser.role === 'approver') && (
          <DashboardPage currentUser={currentUser} />
        )}
      </main>
    </div>
  );
}

export default App;
