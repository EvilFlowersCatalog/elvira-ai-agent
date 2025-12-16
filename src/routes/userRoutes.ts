import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { validateApiKey } from '../middleware/auth';
import { getChatsByUser, getFullChatHistory } from '../accounts';

const router = Router();

/**
 * GET /user/chats
 * Lists all chats for the authenticated user
 */
router.get('/chats', validateApiKey, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const chats = await getChatsByUser(req.user.id);
    
    // Transform the response to include chat metadata
    const chatsWithMetadata = await Promise.all(
      chats.map(async (chat) => {
        const messages = await getFullChatHistory(chat.chatId);
        const lastMessage = messages[messages.length - 1];
        const messageCount = messages.length;
        
        // Extract first user message as title if available
        const firstUserMessage = messages.find(m => m.sender === 'user');
        const title = firstUserMessage?.text.substring(0, 50) || 'New Chat';
        
        return {
          chatId: chat.chatId,
          startedAt: chat.startedAt,
          title,
          messageCount,
          lastMessage: lastMessage ? {
            sender: lastMessage.sender,
            text: lastMessage.text.substring(0, 100),
            timestamp: lastMessage.timestamp
          } : null
        };
      })
    );

    // Sort by most recent first
    chatsWithMetadata.sort((a, b) => {
      const timeA = new Date(a.startedAt || 0).getTime();
      const timeB = new Date(b.startedAt || 0).getTime();
      return timeB - timeA;
    });

    res.json({ 
      chats: chatsWithMetadata,
      total: chatsWithMetadata.length 
    });
  } catch (err) {
    console.error('Error fetching user chats:', err);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

/**
 * GET /user/chats/:chatId
 * Get full chat history for a specific chat
 */
router.get('/chats/:chatId', validateApiKey, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { chatId } = req.params;
    
    // Verify the chat belongs to the user
    const userChats = await getChatsByUser(req.user.id);
    const chatBelongsToUser = userChats.some(chat => chat.chatId === chatId);
    
    if (!chatBelongsToUser) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    const messages = await getFullChatHistory(chatId);
    
    res.json({ 
      chatId,
      messages,
      messageCount: messages.length
    });
  } catch (err) {
    console.error('Error fetching chat history:', err);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

export default router;
