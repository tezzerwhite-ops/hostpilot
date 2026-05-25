import { Router, Request, Response } from 'express';
import { getDb } from '../db/database';
import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Airbnb OAuth config — set these in .env
const AIRBNB_CLIENT_ID = process.env.AIRBNB_CLIENT_ID || '';
const AIRBNB_CLIENT_SECRET = process.env.AIRBNB_CLIENT_SECRET || '';
const AIRBNB_REDIRECT_URI = process.env.AIRBNB_REDIRECT_URI || 'http://localhost:3001/api/channels/airbnb/callback';

const AIRBNB_AUTH_URL = 'https://www.airbnb.com/oauth2/authorize';
const AIRBNB_TOKEN_URL = 'https://www.airbnb.com/oauth2/token';

// Middleware: require auth
function requireAuth(req: Request, res: Response, next: Function) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    const db = getDb();
    // Find session token in users? For now check token header
    // TODO: proper session middleware — stub for MVP
    const user = db.prepare('SELECT id, email FROM users LIMIT 1').get() as any;
    if (!user) return res.status(401).json({ error: 'Invalid session' });
    (req as any).userId = user.id;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid session' });
  }
}

// POST /api/channels/airbnb/connect — returns auth URL (state stored in DB)
router.post('/airbnb/connect', requireAuth, (req: Request, res: Response) => {
  if (!AIRBNB_CLIENT_ID) {
    return res.status(500).json({ error: 'Airbnb client ID not configured' });
  }

  const state = randomBytes(32).toString('hex');
  const db = getDb();
  const userId = (req as any).userId;

  // Store state temporarily
  db.prepare(`
    INSERT OR REPLACE INTO oauth_states (state, user_id, platform, created_at)
    VALUES (?, ?, 'airbnb', datetime('now'))
  `).run(state, userId);

  const params = new URLSearchParams({
    client_id: AIRBNB_CLIENT_ID,
    response_type: 'code',
    redirect_uri: AIRBNB_REDIRECT_URI,
    scope: 'listings_read messages_read messages_write calendar_read calendar_write',
    state,
  });

  const url = `${AIRBNB_AUTH_URL}?${params.toString()}`;
  res.json({ url });
});

// GET /api/channels/airbnb/callback — Airbnb redirects here after user authorizes
router.get('/airbnb/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/channels/error?error=${error}`);
  }

  if (!code || !state) {
    return res.status(400).json({ error: 'Missing code or state' });
  }

  // Verify state
  const db = getDb();
  const stateRow = db.prepare('SELECT user_id FROM oauth_states WHERE state = ? AND platform = ?').get(state as string, 'airbnb') as any;
  if (!stateRow) {
    return res.status(400).json({ error: 'Invalid state' });
  }

  // Exchange code for token
  try {
    const tokenRes = await fetch(AIRBNB_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: AIRBNB_CLIENT_ID,
        client_secret: AIRBNB_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: AIRBNB_REDIRECT_URI,
      }).toString(),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/channels/error?error=${tokenData.error}`);
    }

    // Save channel account
    const accountId = uuidv4();
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    db.prepare(`
      INSERT INTO channel_accounts (id, user_id, platform, access_token, refresh_token, token_expires, platform_user_id)
      VALUES (?, ?, 'airbnb', ?, ?, ?, ?)
    `).run(
      accountId,
      stateRow.user_id,
      tokenData.access_token,
      tokenData.refresh_token || null,
      expiresAt,
      tokenData.user_id || null
    );

    // Clean up state
    db.prepare('DELETE FROM oauth_states WHERE state = ?').run(state);

    // Redirect to frontend success
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/channels/success?platform=airbnb`);
  } catch (err) {
    console.error('Airbnb OAuth error:', err);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/channels/error?error=token_exchange_failed`);
  }
});

// GET /api/channels — list connected channels for current user
router.get('/', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const userId = (req as any).userId;
  const channels = db.prepare('SELECT id, platform, platform_user_id, created_at FROM channel_accounts WHERE user_id = ?').all(userId);
  res.json({ channels });
});

export { router as channelsRouter };
