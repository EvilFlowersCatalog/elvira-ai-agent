import { OpenAIClient } from '../openAIClient/openaiClient';
import { ElviraClient } from '../elviraClient';
import { MessageQueueItem, ChatSessionListeners } from '../types';
import { clearChatHistory, createChat, logMessage, getFullChatHistory } from '../accounts';

// In-memory stores for chat sessions and message queues
const chatSessions: Record<string, OpenAIClient> = {};
const messagesQueues: Record<string, MessageQueueItem[]> = {};

/**
 * Creates a new chat session with the given ID
 */
export async function createSession(
  chatId: string,
  entryId: string | null,
  elviraClient: ElviraClient,
  userId: string,
  loadHistory: boolean = false
): Promise<OpenAIClient> {
  // Create the chat in the database first (required for foreign key constraint)
  const chat = await createChat(chatId, userId);
  if (!chat) {
    console.error(`Failed to create chat ${chatId} in database for user ${userId}`);
  }

  // Initialize message queue for this chat
  messagesQueues[chatId] = [];

  // Create listeners that push to the message queue
  const listeners: ChatSessionListeners = {
    messageListener: (message: string, msg_id?: string) => {
      console.log(`Agent@${chatId}:`, message);
      messagesQueues[chatId].push({ type: 'message', data: message });
      // Log agent message to database with msg_id (fire and forget)
      logMessage(chatId, 'agent', message, { userId, msg_id }).catch((err) => {
        console.error(`Failed to log agent message for chat ${chatId}:`, err);
      });
    },
    displayBooksListener: (bookIds: string[]) => {
      console.log(`DisplayBooks@${chatId}:`, bookIds);
      messagesQueues[chatId].push({ type: 'entries', data: bookIds });
      // Include book IDs in the message text so the agent can reference them in conversation
      const messageText = `[Displayed ${bookIds.length} book(s) with IDs: ${bookIds.join(', ')}]`;
      // Log book display to database with bookIds in both text and metadata (fire and forget)
      logMessage(chatId, 'agent', messageText, { userId, bookIds }).catch((err) => {
        console.error(`Failed to log book display for chat ${chatId}:`, err);
      });
    },
    chunkListener: (msg_id: string, chunk: string) => {
      messagesQueues[chatId].push({ type: 'chunk', data: chunk, msg_id });
    }
  };

  const session = new OpenAIClient(entryId, listeners, elviraClient, userId);
  
  // Load chat history from database if requested
  if (loadHistory) {
    await loadChatHistoryIntoSession(chatId, session);
  }
  
  chatSessions[chatId] = session;

  return session;
}

/**
 * Retrieves an existing chat session by ID
 */
export function getSession(chatId: string): OpenAIClient | undefined {
  return chatSessions[chatId];
}

/**
 * Checks if a chat session exists
 */
export function hasSession(chatId: string): boolean {
  return chatId in chatSessions;
}

/**
 * Removes a chat session and its message queue
 */
export async function removeSession(chatId: string): Promise<void> {
  delete chatSessions[chatId];
  delete messagesQueues[chatId];
  await clearChatHistory(chatId);
}

/**
 * Gets the message queue for a chat session
 */
export function getMessageQueue(chatId: string): MessageQueueItem[] | undefined {
  return messagesQueues[chatId];
}

/**
 * Gets current message queue length for a chat
 */
export function getMessageQueueLength(chatId: string): number {
  return messagesQueues[chatId]?.length ?? 0;
}

/**
 * Gets message from queue at specific index
 */
export function getMessageAtIndex(chatId: string, index: number): MessageQueueItem | undefined {
  return messagesQueues[chatId]?.[index];
}

/**
 * Terminates all sessions for a specific user
 * Used when blocking a user
 */
export async function terminateUserSessions(userId: string): Promise<string[]> {
  const terminatedChats: string[] = [];

  for (const [chatId, session] of Object.entries(chatSessions)) {
    if (session.userId === userId) {
      console.log(`Terminating active session ${chatId} for user ${userId}`);
      await removeSession(chatId);
      terminatedChats.push(chatId);
    }
  }

  return terminatedChats;
}

/**
 * Gets all active session IDs for a user
 */
export function getUserSessionIds(userId: string): string[] {
  const sessionIds: string[] = [];

  for (const [chatId, session] of Object.entries(chatSessions)) {
    if (session.userId === userId) {
      sessionIds.push(chatId);
    }
  }

  return sessionIds;
}

/**
 * Gets count of active sessions
 */
export function getActiveSessionCount(): number {
  return Object.keys(chatSessions).length;
}

/**
 * Loads chat history from database into an OpenAI session
 * Converts database messages to OpenAI's ResponseInput format
 * Note: We reconstruct the conversation by alternating user/assistant messages
 */
async function loadChatHistoryIntoSession(chatId: string, session: OpenAIClient): Promise<void> {
  try {
    const messages = await getFullChatHistory(chatId);
    
    // Convert database messages to OpenAI format
    const chatHistory = session.getChatHistory();
    
    // Process messages in conversation order
    for (const msg of messages) {
      if (msg.sender === 'user') {
        // Add user messages in the standard input format
        chatHistory.push({
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: msg.text
            }
          ]
        });
      } else if (msg.sender === 'agent') {
        // Add assistant messages using the message type from responses
        // This matches the structure returned by the OpenAI API
        // Generate a valid OpenAI message ID if msg_id is missing or invalid
        let messageId = msg.msg_id;
        if (!messageId || !messageId.startsWith('msg_')) {
          // Generate a valid OpenAI-style message ID using the database ID
          messageId = `msg_${msg.id.replace(/-/g, '')}`;
        }
        
        // Ensure book IDs are in the message text for agent reference
        let messageText = msg.text;
        if (msg.bookIds && msg.bookIds.length > 0) {
          // Check if book IDs are already in the text (for backward compatibility)
          const hasBookIds = messageText.includes(msg.bookIds[0]) || messageText.includes('[Displayed');
          if (!hasBookIds) {
            // Append book IDs to the message text so agent can reference them
            messageText = `${messageText}\n\n[Displayed ${msg.bookIds.length} book(s) with IDs: ${msg.bookIds.join(', ')}]`;
          }
        }
        
        chatHistory.push({
          type: 'message',
          id: messageId,
          role: 'assistant',
          status: 'completed',
          content: [
            {
              type: 'output_text',
              text: messageText,
              annotations: []
            }
          ]
        });
        
        // If this message has bookIds, push them to the message queue to display them
        if (msg.bookIds && msg.bookIds.length > 0) {
          console.log(`Restoring book display for message ${msg.id} with ${msg.bookIds.length} books`);
          messagesQueues[chatId].push({ type: 'entries', data: msg.bookIds });
        }
      }
    }
    
    console.log(`Loaded ${messages.length} messages into chat session ${chatId}`);
  } catch (err) {
    console.error(`Failed to load chat history for ${chatId}:`, err);
    throw err;
  }
}

/**
 * Resumes an existing chat session by loading its history from the database
 * Creates a new in-memory session with the chat history restored
 */
export async function resumeSession(
  chatId: string,
  entryId: string | null,
  elviraClient: ElviraClient,
  userId: string
): Promise<OpenAIClient> {
  console.log(`Resuming chat session: ${chatId}`);
  
  // If session already exists in memory, return it
  if (hasSession(chatId)) {
    console.log(`Chat session ${chatId} already active in memory`);
    return getSession(chatId)!;
  }
  
  // Create new session with history loaded from database
  return await createSession(chatId, entryId, elviraClient, userId, true);
}
