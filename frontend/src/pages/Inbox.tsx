import { useEffect, useState } from 'react';

interface Conversation {
  id: string;
  guest_name: string;
  platform: string;
  property_name: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

interface Message {
  id: string;
  conversation_id: string;
  sender: string;
  content: string;
  created_at: string;
}

const API = 'http://localhost:3001/api';

function headers() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Inbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState('');

  useEffect(() => {
    fetch(`${API}/messages/conversations`, { headers: headers() })
      .then(r => r.json())
      .then(data => {
        setConversations(data.conversations || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    fetch(`${API}/messages/${selectedId}`, { headers: headers() })
      .then(r => r.json())
      .then(data => {
        setMessages(data.messages || []);
        // Mark conversation as read
        setConversations(prev =>
          prev.map(c => c.id === selectedId ? { ...c, unread_count: 0 } : c)
        );
      });
  }, [selectedId]);

  function sendReply() {
    if (!replyText.trim() || !selectedId) return;
    fetch(`${API}/messages/${selectedId}/reply`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ content: replyText }),
    })
      .then(r => r.json())
      .then(msg => {
        setMessages(prev => [...prev, msg]);
        setReplyText('');
        setConversations(prev =>
          prev.map(c => c.id === selectedId ? { ...c, last_message: msg.content } : c)
        );
      });
  }

  function seedData() {
    setSeeding(true);
    fetch(`${API}/messages/seed`, { method: 'POST', headers: headers() })
      .then(r => r.json())
      .then(() => {
        setSeeding(false);
        fetch(`${API}/messages/conversations`, { headers: headers() })
          .then(r => r.json())
          .then(data => setConversations(data.conversations || []));
      })
      .catch(() => setSeeding(false));
  }

  function getAiSuggestion() {
    if (!selectedId || suggesting) return;
    setSuggesting(true);
    setSuggestion('');
    fetch(`${API}/messages/${selectedId}/suggest`, {
      method: 'POST',
      headers: headers(),
    })
      .then(r => r.json())
      .then(data => {
        setSuggesting(false);
        const text = data.suggestion || data.error || '';
        setSuggestion(text);
        if (text && !data.error) setReplyText(text);
      })
      .catch(() => setSuggesting(false));
  }

  function getPlatformBadge(p: string) {
    const colors: Record<string, string> = {
      Airbnb: '#FF385C',
      'Booking.com': '#003580',
      Vrbo: '#2151c0',
    };
    return (
      <span style={{
        background: colors[p] || '#475569', color: '#fff',
        padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
      }}>
        {p}
      </span>
    );
  }

  const selectedConv = conversations.find(c => c.id === selectedId);

  return (
    <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 112px)' }}>
      {/* Conversation list */}
      <div style={{
        width: 380, flexShrink: 0, borderRight: '1px solid #334155',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #334155',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Messages</h2>
          {conversations.length === 0 && !loading && (
            <button
              onClick={seedData}
              disabled={seeding}
              style={{
                background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
                color: '#60a5fa', padding: '4px 12px', borderRadius: 6,
                cursor: seeding ? 'default' : 'pointer', fontSize: 12, fontWeight: 500,
                opacity: seeding ? 0.5 : 1,
              }}
            >
              {seeding ? 'Loading...' : '✨ Demo'}
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
              Loading...
            </div>
          ) : conversations.length === 0 ? (
            <div style={{
              padding: '60px 20px', textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📥</div>
              <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16 }}>
                No conversations yet
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                {['Airbnb', 'Booking.com'].map(p => (
                  <button key={p} style={{
                    width: '100%', background: 'rgba(59,130,246,0.1)',
                    border: '1px solid rgba(59,130,246,0.3)',
                    color: '#60a5fa', padding: '10px 16px', borderRadius: 8,
                    cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  }}>
                    + Connect {p}
                  </button>
                ))}
              </div>
              <p style={{ color: '#64748b', fontSize: 11, marginTop: 12 }}>
                or click Demo to try with sample data
              </p>
            </div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                style={{
                  padding: '14px 20px', cursor: 'pointer', borderBottom: '1px solid #1e293b',
                  background: selectedId === conv.id ? 'rgba(59,130,246,0.08)' : 'transparent',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{conv.guest_name}</span>
                    {conv.unread_count > 0 && (
                      <span style={{
                        background: '#3b82f6', color: '#fff',
                        width: 18, height: 18, borderRadius: '50%',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700,
                      }}>
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {getPlatformBadge(conv.platform)}
                    <span style={{ color: '#64748b', fontSize: 11 }}>{timeAgo(conv.last_message_at)}</span>
                  </div>
                </div>
                <p style={{
                  color: '#94a3b8', fontSize: 13, margin: 0,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {conv.last_message}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Message view */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selectedConv && (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#64748b', fontSize: 14,
          }}>
            Select a conversation to view messages
          </div>
        )}

        {selectedConv && (
          <>
            {/* Header */}
            <div style={{
              padding: '14px 24px', borderBottom: '1px solid #334155',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{selectedConv.guest_name}</span>
                <span style={{ color: '#94a3b8', fontSize: 13, marginLeft: 12 }}>
                  {selectedConv.property_name || 'No property'} · {getPlatformBadge(selectedConv.platform)}
                </span>
              </div>
              <span style={{
                background: 'rgba(16,185,129,0.15)', color: '#10b981',
                padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 500,
              }}>
                AI Active
              </span>
            </div>

            {/* Messages */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '20px 24px',
              display: 'flex', flexDirection: 'column', gap: 16,
            }}>
              {messages.map(msg => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: msg.sender === 'host' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div style={{
                    maxWidth: '75%',
                    background: msg.sender === 'host' ? 'rgba(59,130,246,0.2)' : '#1e293b',
                    border: msg.sender === 'host' ? '1px solid rgba(59,130,246,0.3)' : '1px solid #334155',
                    borderRadius: 12,
                    padding: '12px 16px',
                    fontSize: 14, lineHeight: 1.5,
                  }}>
                    {msg.content}
                  </div>
                  <span style={{
                    color: '#64748b', fontSize: 11, marginTop: 4,
                    paddingLeft: 4, paddingRight: 4,
                  }}>
                    {msg.sender === 'host' ? 'You' : selectedConv.guest_name.split(' ')[0]} · {timeAgo(msg.created_at)}
                  </span>
                </div>
              ))}

              {/* AI suggestion */}
              {messages.length > 0 && (
                <div style={{
                  alignSelf: 'flex-end', maxWidth: '75%',
                  background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)',
                  borderRadius: 12, padding: '12px 16px', marginTop: 8,
                  cursor: suggesting ? 'default' : 'pointer',
                  opacity: suggesting ? 0.6 : 1,
                }}
                  onClick={getAiSuggestion}
                >
                  <div style={{ fontSize: 10, color: '#a78bfa', marginBottom: 4, fontWeight: 600 }}>
                    ✨ AI SUGGESTION — CLICK TO GENERATE
                  </div>
                  {suggesting ? (
                    <div style={{ fontSize: 13, color: '#c4b5fd' }}>Thinking…</div>
                  ) : suggestion ? (
                    <div style={{ fontSize: 13, color: '#c4b5fd', lineHeight: 1.5 }}>{suggestion}</div>
                  ) : (
                    <div style={{ fontSize: 13, color: '#c4b5fd' }}>
                      Click to generate an AI reply suggestion
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Reply box */}
            <div style={{
              padding: '16px 24px', borderTop: '1px solid #334155',
              display: 'flex', gap: 12,
            }}>
              <input
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendReply()}
                placeholder="Type a reply..."
                style={{
                  flex: 1, background: '#0f172a', border: '1px solid #334155',
                  borderRadius: 8, padding: '10px 14px', color: '#f1f5f9',
                  fontSize: 14, outline: 'none',
                }}
              />
              <button
                onClick={sendReply}
                disabled={!replyText.trim()}
                style={{
                  background: replyText.trim() ? '#3b82f6' : '#1e293b',
                  border: '1px solid ' + (replyText.trim() ? '#3b82f6' : '#334155'),
                  color: replyText.trim() ? '#fff' : '#64748b',
                  padding: '10px 20px', borderRadius: 8, cursor: replyText.trim() ? 'pointer' : 'default',
                  fontSize: 14, fontWeight: 500,
                }}
              >
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}