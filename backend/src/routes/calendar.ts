import { Router, Request, Response } from 'express';
import { getDb } from '../db/database';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

export const calendarRouter = Router();

// Middleware: require auth
function requireAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hostpilot-dev-secret-change-in-prod');
    (req as any).userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// GET /api/calendar/events?month=2026-05
calendarRouter.get('/events', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const userId = (req as any).userId;
  const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);

  const startDate = `${month}-01`;
  const [year, mon] = month.split('-').map(Number);
  const endDate = new Date(year, mon, 0).toISOString().slice(0, 10); // last day of month

  const events = db.prepare(`
    SELECT e.*, p.name as property_name
    FROM calendar_events e
    LEFT JOIN properties p ON e.property_id = p.id
    WHERE e.user_id = ?
      AND e.check_out > ?
      AND e.check_in <= ?
    ORDER BY e.check_in ASC
  `).all(userId, startDate, endDate);

  res.json({ events });
});

// POST /api/calendar/events — create booking
calendarRouter.post('/events', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const userId = (req as any).userId;
  const { guest_name, check_in, check_out, status, color, notes, property_id } = req.body;

  if (!check_in || !check_out) {
    return res.status(400).json({ error: 'check_in and check_out required' });
  }

  const id = uuidv4();
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  const eventColor = color || colors[Math.floor(Math.random() * colors.length)];

  db.prepare(`
    INSERT INTO calendar_events (id, user_id, property_id, platform, guest_name, check_in, check_out, status, color, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, property_id || null, 'manual', guest_name || null, check_in, check_out, status || 'confirmed', eventColor, notes || null);

  const event = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(id);
  res.status(201).json(event);
});

// DELETE /api/calendar/events/:id
calendarRouter.delete('/events/:id', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const userId = (req as any).userId;

  db.prepare('DELETE FROM calendar_events WHERE id = ? AND user_id = ?')
    .run(req.params.id, userId);

  res.json({ deleted: true });
});

// POST /api/calendar/feeds — add iCal feed
calendarRouter.post('/feeds', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const userId = (req as any).userId;
  const { name, url, property_id } = req.body;

  if (!name || !url) {
    return res.status(400).json({ error: 'name and url required' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO ical_feeds (id, user_id, property_id, name, url)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userId, property_id || null, name, url);

  const feed = db.prepare('SELECT * FROM ical_feeds WHERE id = ?').get(id);
  res.status(201).json(feed);
});

// GET /api/calendar/feeds
calendarRouter.get('/feeds', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const userId = (req as any).userId;

  const feeds = db.prepare(`
    SELECT f.*, p.name as property_name
    FROM ical_feeds f
    LEFT JOIN properties p ON f.property_id = p.id
    WHERE f.user_id = ?
  `).all(userId);

  res.json({ feeds });
});

// POST /api/calendar/seed — seed demo bookings
calendarRouter.post('/seed', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const userId = (req as any).userId;

  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Calculate next month for bookings that span month boundaries
  const nextMonth = (`${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}`);
  const fixedBookings = [
    { guest_name: 'Sarah Johnson', check_in: `${ym}-03`, check_out: `${ym}-07`, color: '#3b82f6' },
    { guest_name: 'Emma & James', check_in: `${ym}-10`, check_out: `${ym}-14`, color: '#10b981' },
    { guest_name: 'David Chen', check_in: `${ym}-15`, check_out: `${ym}-18`, color: '#f59e0b' },
    { guest_name: 'The Smiths', check_in: `${ym}-22`, check_out: `${ym}-27`, color: '#8b5cf6' },
    { guest_name: 'Anna Müller', check_in: `${ym}-28`, check_out: `${nextMonth}-02`, color: '#ec4899' },
  ];

  const insert = db.prepare(`
    INSERT OR IGNORE INTO calendar_events (id, user_id, platform, guest_name, check_in, check_out, status, color)
    VALUES (?, ?, 'airbnb', ?, ?, ?, 'confirmed', ?)
  `);

  for (const b of fixedBookings) {
    insert.run(uuidv4(), userId, b.guest_name, b.check_in, b.check_out, b.color);
  }

  res.json({ seeded: fixedBookings.length });
});
