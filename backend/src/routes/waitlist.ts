import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../db/database';

export const waitlistRouter = Router();

const signupSchema = z.object({
  email: z.string().email(),
  plan: z.string().optional(),
  properties: z.number().int().min(0).max(500).optional(),
  source: z.string().optional(),
});

// POST /api/waitlist — join waitlist
waitlistRouter.post('/', (req: Request, res: Response) => {
  const parsed = signupSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid email', details: parsed.error.flatten() });
    return;
  }

  const { email, plan, properties, source } = parsed.data;
  const db = getDb();

  try {
    const stmt = db.prepare(
      'INSERT INTO waitlist (email, plan, properties, source, early_bird) VALUES (?, ?, ?, ?, 1)'
    );
    stmt.run(email, plan || null, properties || null, source || 'landing');
    res.status(201).json({ success: true, message: 'Welcome aboard! 🎉' });
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(200).json({ success: true, message: "You're already on the list!" });
    } else {
      console.error('Waitlist error:', err);
      res.status(500).json({ error: 'Something went wrong' });
    }
  }
});

// GET /api/waitlist/count — how many signed up
waitlistRouter.get('/count', (_req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM waitlist').get() as any;
  res.json({ count: row.count });
});

// DELETE /api/waitlist/:email — remove entry (admin)
waitlistRouter.delete('/:email', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM waitlist WHERE email = ?').run(req.params.email);
  res.json({ success: true });
});