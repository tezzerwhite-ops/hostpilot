import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) navigate('/login');
  }, [navigate]);

  const navItems = [
    { path: '/dashboard', label: '📥 Inbox', active: location.pathname === '/dashboard' },
    { path: '/dashboard/calendar', label: '📅 Calendar', active: location.pathname === '/dashboard/calendar' },
    { path: '/dashboard/connect', label: '🔌 Connect', active: location.pathname === '/dashboard/connect' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: 240, background: '#1e293b', borderRight: '1px solid #334155',
        display: 'flex', flexDirection: 'column', padding: '24px 16px',
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 40 }}>
          Host<span style={{ color: '#3b82f6' }}>Pilot</span>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {navItems.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                background: item.active ? 'rgba(59,130,246,0.15)' : 'transparent',
                border: item.active ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                color: item.active ? '#f1f5f9' : '#94a3b8',
                padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                textAlign: 'left', fontSize: 14, fontWeight: 500, width: '100%',
                transition: 'all 0.2s',
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div style={{ marginTop: 'auto' }}>
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
            {user.name || user.email}
          </div>
          <button
            onClick={() => { localStorage.clear(); navigate('/login'); }}
            style={{
              background: 'transparent', border: '1px solid #334155', color: '#94a3b8',
              padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, width: '100%',
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: '32px 40px', overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
