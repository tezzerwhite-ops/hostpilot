import { useEffect, useState } from 'react';

interface CalendarEvent {
  id: string;
  guest_name: string | null;
  check_in: string;
  check_out: string;
  status: string;
  color: string;
  platform: string;
  property_name: string | null;
}

const API = 'http://localhost:3001/api';

function headers() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function Calendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [loading, setLoading] = useState(true);

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  useEffect(() => {
    fetch(`${API}/calendar/events?month=${monthKey}`, { headers: headers() })
      .then(r => r.json())
      .then(data => {
        setEvents(data.events || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [monthKey]);

  function seedData() {
    setSeeding(true);
    fetch(`${API}/calendar/seed`, { method: 'POST', headers: headers() })
      .then(r => r.json())
      .then(() => {
        return fetch(`${API}/calendar/events?month=${monthKey}`, { headers: headers() });
      })
      .then(r => r.json())
      .then(data => {
        setEvents(data.events || []);
        setSeeding(false);
      })
      .catch(() => setSeeding(false));
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }
  function goToday() {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  }

  // Build grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Map events to day spans
  function getEventForDay(day: number): CalendarEvent[] {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.check_in <= dateStr && e.check_out > dateStr);
  }

  function isFirstDay(evt: CalendarEvent, day: number): boolean {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return evt.check_in === dateStr;
  }

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', margin: 0 }}>Calendar</h1>
          <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>{events.length} bookings this month</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={goToday} style={navBtnStyle}>Today</button>
          <button onClick={prevMonth} style={{ ...navBtnStyle, width: 32, padding: '6px 0' }}>‹</button>
          <span style={{ fontWeight: 600, fontSize: 15, minWidth: 160, textAlign: 'center' }}>
            {MONTHS[month]} {year}
          </span>
          <button onClick={nextMonth} style={{ ...navBtnStyle, width: 32, padding: '6px 0' }}>›</button>
          {events.length === 0 && (
            <button onClick={seedData} disabled={seeding} style={seedBtnStyle}>
              {seeding ? 'Loading...' : '✨ Demo'}
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      {events.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          {[...new Set(events.map(e => e.guest_name || e.platform))].map((name, i) => {
            const evt = events.find(e => (e.guest_name || e.platform) === name);
            const color = evt?.color || '#3b82f6';
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8' }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
                {name}
              </div>
            );
          })}
        </div>
      )}

      {/* Calendar grid */}
      <div style={{
        background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
        overflow: 'hidden',
      }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #334155' }}>
          {DAYS.map(d => (
            <div key={d} style={{
              padding: '10px 8px', textAlign: 'center',
              fontSize: 11, fontWeight: 600, color: '#64748b',
              textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {cells.map((day, i) => {
            const dayEvents = day ? getEventForDay(day) : [];
            const dateStr = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
            const isToday = dateStr === todayStr;

            return (
              <div key={i} style={{
                minHeight: 100,
                borderRight: (i + 1) % 7 !== 0 ? '1px solid #0f172a' : 'none',
                borderBottom: i < cells.length - 7 ? '1px solid #0f172a' : 'none',
                padding: '4px 6px',
                background: isToday ? 'rgba(59,130,246,0.06)' : 'transparent',
              }}>
                {day && (
                  <>
                    <div style={{
                      fontSize: 12, fontWeight: isToday ? 700 : 500,
                      color: isToday ? '#60a5fa' : '#94a3b8',
                      marginBottom: 4,
                      background: isToday ? 'rgba(59,130,246,0.2)' : 'transparent',
                      width: 22, height: 22, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{day}</div>
                    {dayEvents.map((evt, j) => {
                      const first = isFirstDay(evt, day);
                      return (
                        <div
                          key={j}
                          title={`${evt.guest_name || 'Blocked'} — ${evt.check_in} → ${evt.check_out}`}
                          style={{
                            background: evt.color,
                            borderRadius: first ? '4px 4px 0 0' : 0,
                            ...(first ? { marginTop: 0 } : { marginTop: -1 }),
                            padding: '3px 6px',
                            fontSize: 11, fontWeight: 600, color: '#fff',
                            overflow: 'hidden', whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            cursor: 'default',
                            borderTopLeftRadius: first ? 4 : 0,
                            borderBottomLeftRadius: first ? 4 : 0,
                          }}>
                          {first ? evt.guest_name || evt.platform : ''}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* No events empty state */}
      {!loading && events.length === 0 && (
        <div style={{
          marginTop: 24, background: '#1e293b', border: '1px solid #334155',
          borderRadius: 12, padding: 60, textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
          <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 20 }}>
            No bookings this month. Sync your channel calendars or add bookings manually.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            {['Airbnb', 'Booking.com', 'iCal URL'].map(p => (
              <button key={p} style={{
                background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
                color: '#60a5fa', padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                fontSize: 13, fontWeight: 500,
              }}>+ {p}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  background: '#1e293b', border: '1px solid #334155', color: '#94a3b8',
  padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
  fontWeight: 500,
};

const seedBtnStyle: React.CSSProperties = {
  background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
  color: '#60a5fa', padding: '6px 14px', borderRadius: 8,
  cursor: 'pointer', fontSize: 12, fontWeight: 500,
};
