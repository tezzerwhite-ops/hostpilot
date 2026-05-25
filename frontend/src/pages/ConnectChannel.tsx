import { useState, useEffect } from 'react';

const API = 'http://localhost:3001/api';

interface Channel {
  id: string;
  platform: string;
  platform_user_id: string;
  created_at: string;
}

export default function ConnectChannel() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token') || '';

  const fetchChannels = async () => {
    try {
      const res = await fetch(`${API}/channels`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setChannels(data.channels || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => { fetchChannels(); }, []);

  const connectAirbnb = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/channels/airbnb/connect`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Failed to connect');
      }
    } catch {
      setError('Connection failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const connected = channels.filter((c) => c.platform === 'airbnb').length > 0;

  return (
    <div style={{ maxWidth: 600 }}>
      <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Channels</h2>
      <p style={{ color: '#94a3b8', marginBottom: 32, fontSize: 14 }}>
        Connect your booking platforms to manage everything from one place.
      </p>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#fca5a5', padding: '12px 16px', borderRadius: 8, marginBottom: 24, fontSize: 13,
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Airbnb */}
        <div style={{
          background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
          padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
              🏠 Airbnb
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>
              {connected ? '✅ Connected — messages & calendar synced' : 'Sync messages, calendar, and listings'}
            </div>
          </div>
          {connected ? (
            <span style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80',
              border: '1px solid rgba(34,197,94,0.3)', padding: '8px 16px', borderRadius: 8, fontSize: 13 }}>
              Connected
            </span>
          ) : (
            <button
              onClick={connectAirbnb}
              disabled={loading}
              style={{
                background: '#FF5A5F', border: 'none', color: '#fff',
                padding: '12px 24px', borderRadius: 10, cursor: 'pointer',
                fontSize: 14, fontWeight: 600, opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Connecting…' : 'Connect Airbnb'}
            </button>
          )}
        </div>

        {/* Booking.com — placeholder */}
        <div style={{
          background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
          padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          opacity: 0.5,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
              🏨 Booking.com
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>
              Coming soon
            </div>
          </div>
          <span style={{ fontSize: 13, color: '#64748b' }}>Coming soon</span>
        </div>
      </div>
    </div>
  );
}