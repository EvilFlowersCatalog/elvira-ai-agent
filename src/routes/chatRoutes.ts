import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticatedRequest } from '../types';
import { validateSessionApiKey } from '../middleware/auth';
import {
  createSession,
  getSession,
  getMessageQueueLength,
  getMessageAtIndex
} from '../services/sessionManager';
import { logMessage, getUser, initUser } from '../accounts';
import { ElviraClient } from '../elviraClient';

const router = Router();

/**
 * POST /api/startchat
 * Starts a new chat session
 */
router.post('/startchat', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const chatId = uuidv4();
    const { apiKey, entryId, catalogId } = req.body;

    if (!apiKey) {
      res.status(401).json({ error: 'API key required' });
      return;
    }

    if (!catalogId) {
      res.status(400).json({ error: 'Catalog ID required' });
      return;
    }

    const elviraClient = new ElviraClient(apiKey, catalogId);
    const user = await elviraClient.getCurrentUserInfo();

    if (!user || !user.id) {
      res.status(401).json({ error: 'Invalid API key or user not found' });
      return;
    }

    initUser(user);
    
    const localUser = getUser(user.id);
    if (localUser?.blocked) {
      console.warn(`Blocked user attempted access: ${user.id}`);
      res.status(403).json({ error: 'User is blocked' });
      return;
    }
    
    console.log(`Starting new chat: ${chatId}`);
    createSession(chatId, entryId || null, elviraClient, user.id);
    res.json({ chatId });
  } catch (err) {
    console.error('Error starting chat:', err);
    res.status(500).json({ error: 'Failed to start chat session' });
  }
});

/**
 * POST /api/sendchat
 * Sends a message in an existing chat session
 * Returns a Server-Sent Events stream
 */
router.post('/sendchat', async (req, res: Response) => {
  const { chatId, message, entryId, apiKey } = req.body;

  if (!chatId || !message) {
    return res.status(400).json({ error: 'chatId and message are required' });
  }

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  const chatSession = getSession(chatId);
  if (!chatSession) {
    return res.status(404).json({ error: 'Chat session not found' });
  }

  // Check whether the user who owns this session is blocked
  const owner = getUser(chatSession.userId);
  if (owner?.blocked) {
    console.warn(`Blocked user attempted to send message in chat ${chatId}: ${chatSession.userId}`);
    return res.status(403).json({ error: 'User is blocked' });
  }

  // Validate API key matches the session
  if (!validateSessionApiKey(chatSession.elviraClient, apiKey)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // Set up Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const startIndex = getMessageQueueLength(chatId);

  // Update entry ID if provided
  if (entryId !== undefined) {
    chatSession.setEntryId(entryId);
  }

  console.log(`User@${chatId}:`, message);
  logMessage(chatId, 'user', message, { userId: chatSession.userId });

  try {
    let finished = false;
    let chatError: Error | null = null;

    // Start the chat processing
    chatSession
      .chat(message)
      .catch((err: Error) => {
        chatError = err;
      })
      .then(() => {
        finished = true;
      });

    // Stream items as they appear in the message queue
    let readIndex = startIndex;
    while (!finished || getMessageQueueLength(chatId) > readIndex) {
      while (getMessageQueueLength(chatId) > readIndex) {
        const item = getMessageAtIndex(chatId, readIndex++);
        if (item) {
          res.write(`data: ${JSON.stringify(item)}\n\n`);
        }
      }
      if (!finished) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    if (chatError) {
      console.error(`Error in chat stream ${chatId}:`, chatError);
      res.write(`data: ${JSON.stringify({ type: 'error', data: 'An error occurred' })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    }
  } catch (err) {
    console.error(`Unexpected error in chat ${chatId}:`, err);
    res.write(`data: ${JSON.stringify({ type: 'error', data: 'An unexpected error occurred' })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;
