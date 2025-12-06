import { OpenAIClient } from '../openAIClient/openaiClient';
import { ElviraClient } from '../elviraClient';
import { MessageQueueItem, ChatSessionListeners } from '../types';
import { clearChatHistory, createChat, logMessage } from '../accounts';

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
  userId: string
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
    messageListener: (message: string) => {
      console.log(`Agent@${chatId}:`, message);
      messagesQueues[chatId].push({ type: 'message', data: message });
      // Log agent message to database (fire and forget)
      logMessage(chatId, 'agent', message, { userId }).catch((err) => {
        console.error(`Failed to log agent message for chat ${chatId}:`, err);
      });
    },
    displayBooksListener: (bookIds: string[]) => {
      messagesQueues[chatId].push({ type: 'entries', data: bookIds });
    },
    chunkListener: (msg_id: string, chunk: string) => {
      messagesQueues[chatId].push({ type: 'chunk', data: chunk, msg_id });
    }
  };

  const session = new OpenAIClient(entryId, listeners, elviraClient, userId);
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
