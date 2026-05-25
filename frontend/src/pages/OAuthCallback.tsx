import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export default function OAuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const isError = window.location.pathname.includes('/error');
  const platform = params.get('platform') || '';
  const errorMsg = params.get('error') || '';

  useEffect(() => {
    const timer = setTimeout(() => navigate('/dashboard/connect'), 2000);
    return () => clearTimeout(timer);
  }, [navigate]);

  if (isError) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100vh', background: '#0f172a',
        color: '#f1f5f9', padding: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Connection Failed</h2>
        <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24 }}>
          {errorMsg || 'Something went wrong during the connection.'}
        </p>
        <p style={{ color: '#64748b', fontSize: 13 }}>
          Redirecting back…
        </p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh', background: '#0f172a',
      color: '#f1f5f9', padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
      <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>
        {platform ? `${platform} Connected!` : 'Connected!'}
      </h2>
      <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24 }}>
        Your channel is now linked. Messages and calendar will sync automatically.
      </p>
      <p style={{ color: '#64748b', fontSize: 13 }}>
        Redirecting to dashboard…
      </p>
    </div>
  );
}
