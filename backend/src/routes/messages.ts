import { Router, Request, Response } from 'express';
import { getDb } from '../db/database';
import { v4 as uuidv4 } from 'uuid';

export const messagesRouter = Router();

// Middleware: require auth
function requireAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.slice(7);
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hostpilot-dev-secret-change-in-prod');
    (req as any).userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// GET /api/messages/conversations
messagesRouter.get('/conversations', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const userId = (req as any).userId;

  const conversations = db.prepare(`
    SELECT c.*, p.name as property_name
    FROM conversations c
    LEFT JOIN properties p ON c.property_id = p.id
    WHERE c.user_id = ?
    ORDER BY c.last_message_at DESC
  `).all(userId);

  res.json({ conversations });
});

// GET /api/messages/:conversationId
messagesRouter.get('/:conversationId', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const userId = (req as any).userId;

  const conversation = db.prepare(`
    SELECT c.*, p.name as property_name
    FROM conversations c
    LEFT JOIN properties p ON c.property_id = p.id
    WHERE c.id = ? AND c.user_id = ?
  `).get(req.params.conversationId, userId);

  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  const messages = db.prepare(`
    SELECT * FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at ASC
  `).all(req.params.conversationId);

  // Mark as read
  db.prepare('UPDATE conversations SET unread_count = 0 WHERE id = ?').run(req.params.conversationId);

  res.json({ conversation, messages });
});

// POST /api/messages/:conversationId/reply
messagesRouter.post('/:conversationId/reply', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const userId = (req as any).userId;

  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?')
    .get(req.params.conversationId, userId);

  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'Message content required' });
  }

  const msgId = uuidv4();
  db.prepare(`
    INSERT INTO messages (id, conversation_id, sender, content)
    VALUES (?, ?, 'host', ?)
  `).run(msgId, req.params.conversationId, content);

  db.prepare(`
    UPDATE conversations SET last_message = ?, last_message_at = datetime('now')
    WHERE id = ?
  `).run(content, req.params.conversationId);

  res.json({
    id: msgId,
    conversation_id: req.params.conversationId,
    sender: 'host',
    content,
    created_at: new Date().toISOString(),
  });
});

// POST /api/messages/seed — seed demo data
messagesRouter.post('/seed', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const userId = (req as any).userId;

  const conversations = [
    {
      id: uuidv4(), guest_name: 'Sarah Johnson', platform: 'Airbnb',
      last_message: 'Is early check-in possible? Our flight lands at 10am.',
      last_message_at: '2026-05-25T10:30:00Z',
    },
    {
      id: uuidv4(), guest_name: 'Marco Rossi', platform: 'Booking.com',
      last_message: 'Thank you! Everything is perfect. 😊',
      last_message_at: '2026-05-24T18:15:00Z',
    },
    {
      id: uuidv4(), guest_name: 'Emma & James Wilson', platform: 'Airbnb',
      last_message: 'What are your restaurant recommendations nearby?',
      last_message_at: '2026-05-24T09:00:00Z',
    },
  ];

  const insertConv = db.prepare(`
    INSERT OR IGNORE INTO conversations (id, user_id, guest_name, platform, last_message, last_message_at, unread_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMsg = db.prepare(`
    INSERT OR IGNORE INTO messages (id, conversation_id, sender, content, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const conv of conversations) {
    insertConv.run(conv.id, userId, conv.guest_name, conv.platform, conv.last_message, conv.last_message_at, 1);

    // Add demo thread
    const threadMessages = [
      { sender: 'guest', content: conv.last_message, time: conv.last_message_at },
      { sender: 'host', content: getMockReply(conv.last_message), time: conv.last_message_at },
    ];

    for (const msg of threadMessages) {
      insertMsg.run(uuidv4(), conv.id, msg.sender, msg.content, msg.time);
    }
  }

  res.json({ seeded: conversations.length });
});

// POST /api/messages/:conversationId/suggest — AI reply suggestion
messagesRouter.post('/:conversationId/suggest', requireAuth, async (req: Request, res: Response) => {
  const db = getDb();
  const userId = (req as any).userId;

  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?')
    .get(req.params.conversationId, userId) as any;

  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  // Get last 5 messages for context
  const messages = db.prepare(`
    SELECT sender, content FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at DESC LIMIT 5
  `).all(req.params.conversationId).reverse();

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'AI not configured' });
  }

  const thread = messages.map((m: any) => `${m.sender === 'guest' ? 'Guest' : 'Host'}: ${m.content}`).join('\n');

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `You are a helpful, friendly short-term rental host. Guest name: ${conversation.guest_name}. Property platform: ${conversation.platform}. Keep replies warm, professional, and concise (2-4 sentences). Never invent details about the property — stick to what the guest asks.`
          },
          { role: 'user', content: `Here is the conversation so far:\n\n${thread}\n\nWrite a natural reply as the host to the guest's last message. Return ONLY the reply text, no explanation.` }
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    const suggestion = data.choices?.[0]?.message?.content || '';

    res.json({ suggestion: suggestion.trim() });
  } catch (err) {
    console.error('AI suggestion error:', err);
    res.status(500).json({ error: 'AI suggestion failed' });
  }
});

function getMockReply(lastMessage: string): string {
  if (lastMessage.includes('early check-in')) {
    return 'Hi Sarah! Yes, we can accommodate early check-in. The property will be ready by 12pm — earlier than usual. Let us know your arrival time!';
  }
  if (lastMessage.includes('perfect')) {
    return 'So glad you enjoyed your stay, Marco! Safe travels home. You are welcome back anytime.';
  }
  return 'Great question! There are several excellent restaurants within walking distance — I\'ll send you our curated list of favorites.';
}