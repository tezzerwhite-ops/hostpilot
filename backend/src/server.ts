import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { getDb, migrate } from './db/database';
import { waitlistRouter } from './routes/waitlist';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { messagesRouter } from './routes/messages';
import { channelsRouter } from './routes/channels';
import { calendarRouter } from './routes/calendar';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Auto-migrate
migrate();

// Serve frontend static files in production
import path from 'path';
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
import fs from 'fs';
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  console.log('📦 Serving frontend from:', frontendDist);
}

// Routes
app.use('/api/health', healthRouter);
app.use('/api/waitlist', waitlistRouter);
app.use('/api/auth', authRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/channels', channelsRouter);
app.use('/api/calendar', calendarRouter);

// SPA fallback: serve index.html for non-API routes
if (fs.existsSync(frontendDist)) {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  // Catch-all for API-only mode
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
}

app.listen(PORT, () => {
  console.log(`🚀 HostPilot API running on http://localhost:${PORT}`);
});

export default app;