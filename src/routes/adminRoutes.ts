import { Router, Response } from 'express';
import { AdminRequest } from '../types';
import { adminAuth } from '../middleware/auth';
import { terminateUserSessions } from '../services/sessionManager';
import {
  getUsersPaginated,
  getChatsByUser,
  getUserMessagesInChat,
  setUserBlocked,
  getDailyLimits
} from '../accounts';

const router = Router();

/**
 * GET /admin/users
 * List users with pagination
 */
router.get('/users', adminAuth, async (req: AdminRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 25;

  try {
    const data = await getUsersPaginated(page, limit);
    res.json(data);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /admin/daily-limits
 * List daily limits with filtering
 */
router.get('/daily-limits', adminAuth, async (req: AdminRequest, res: Response) => {
  const userId = req.query.userId as string;
  const date = req.query.date as string;

  try {
    const limits = await getDailyLimits(userId, date);
    res.json({ limits });
  } catch (err) {
    console.error('Error fetching daily limits:', err);
    res.status(500).json({ error: 'Failed to fetch daily limits' });
  }
});

/**
 * GET /admin/users/:userId/chats
 * List chats started by a user
 */
router.get('/users/:userId/chats', adminAuth, async (req: AdminRequest, res: Response) => {
  const { userId } = req.params;

  try {
    const chats = await getChatsByUser(userId);
    res.json({ chats });
  } catch (err) {
    console.error('Error listing user chats:', err);
    res.status(500).json({ error: 'Failed to list chats' });
  }
});

/**
 * GET /admin/users/:userId/chats/:chatId
 * Get message history for a user in a specific chat
 */
router.get('/users/:userId/chats/:chatId', adminAuth, async (req: AdminRequest, res: Response) => {
  const { userId, chatId } = req.params;

  try {
    const history = await getUserMessagesInChat(chatId, userId);
    res.json({ history });
  } catch (err) {
    console.error('Error fetching chat history:', err);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

/**
 * POST /admin/users/block
 * Block or unblock a user
 */
router.post('/users/block', adminAuth, async (req: AdminRequest, res: Response) => {
  const { userId, blocked } = req.body || {};

  if (!userId || typeof blocked !== 'boolean') {
    return res.status(400).json({ error: 'userId and blocked (boolean) required' });
  }

  try {
    const result = await setUserBlocked(userId, blocked);

    if (!result) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If blocking, terminate all active sessions for this user
    if (blocked) {
      const terminatedChats = await terminateUserSessions(userId);
      console.log(`Terminated ${terminatedChats.length} sessions for blocked user ${userId}`);
    }

    res.json({ success: true, user: result });
  } catch (err) {
    console.error('Error blocking/unblocking user:', err);
    res.status(500).json({ error: 'Failed to update user block state' });
  }
});

export default router;
