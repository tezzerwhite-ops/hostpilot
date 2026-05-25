import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database';

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'hostpilot-dev-secret-change-in-prod';
const SALT_ROUNDS = 10;

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// POST /api/auth/signup
authRouter.post('/signup', async (req: Request, res: Response) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    return;
  }

  const { email, password, name } = parsed.data;
  const db = getDb();
  let hash: string;
  try {
    hash = await bcrypt.hash(password, SALT_ROUNDS);
  } catch (e) {
    console.error('Bcrypt error:', e);
    res.status(500).json({ error: 'Server error', detail: 'bcrypt failed: ' + String(e) });
    return;
  }
  const id = uuid();

  try {
    db.prepare(
      'INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)'
    ).run(id, email, name || email.split('@')[0], hash);

    const token = jwt.sign({ userId: id, email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id, email, name: name || email.split('@')[0] } });
  } catch (err: any) {
    if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ error: 'Email already registered' });
    } else {
      console.error('Signup error:', err);
      res.status(500).json({ error: 'Something went wrong', detail: String(err) });
    }
  }
});

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid email or password' });
    return;
  }

  const { email, password } = parsed.data;
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  try {
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
  } catch (e) {
    console.error('Bcrypt compare error:', e);
    res.status(500).json({ error: 'Server error', detail: String(e) });
    return;
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

// GET /api/auth/me — verify token
authRouter.get('/me', (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token' });
    return;
  }

  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as any;
    const db = getDb();
    const user = db.prepare('SELECT id, email, name, plan, properties_limit FROM users WHERE id = ?').get(payload.userId) as any;
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    res.json({ user });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});