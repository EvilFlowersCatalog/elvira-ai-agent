import { getDatabaseAdapter } from './database';

// ============================================================
// Types
// ============================================================

export type User = {
  id: string;
  username: string;
  name: string;
  surname: string;
  is_superuser: boolean;
  permissions: string[];
  catalog_permissions: {
    [catalogId: string]: string;
  };
  blocked?: boolean;
  createdAt?: string;
  lastSeenAt?: string;
};

export type Message = {
  id: string;
  chatId: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  entryId?: string;
  msg_id?: string;
  userId?: string;
  bookIds?: string[]; // Store book IDs from displayBooks function
  bookCatalogs?: Record<string, string>; // Map of bookId -> catalogId for each displayed book
};

// ============================================================
// User Management Functions
// ============================================================

/**
 * Initialize or update a user in the database
 * Called when user is verified via Elvira API
 */
export async function initUser(user: User): Promise<User | null> {
  const db = getDatabaseAdapter();
  return db.initUser(user);
}

/**
 * Get a user by ID
 */
export async function getUser(userId: string): Promise<User | undefined> {
  const db = getDatabaseAdapter();
  return db.getUser(userId);
}

/**
 * Check if a user exists
 */
export async function userExists(userId: string): Promise<boolean> {
  const db = getDatabaseAdapter();
  return db.userExists(userId);
}

/**
 * Check if a user is blocked
 */
export async function isUserBlocked(userId: string): Promise<boolean> {
  const db = getDatabaseAdapter();
  return db.isUserBlocked(userId);
}

/**
 * Set user blocked status
 * Returns the updated user or null if not found
 */
export async function setUserBlocked(userId: string, blocked: boolean, reason?: string, until?: Date): Promise<User | null> {
  const db = getDatabaseAdapter();
  return db.setUserBlocked(userId, blocked, reason, until);
}

/**
 * Update user's last seen timestamp
 */
export async function updateUserLastSeen(userId: string): Promise<void> {
  const db = getDatabaseAdapter();
  return db.updateUserLastSeen(userId);
}

/**
 * List all users
 */
export async function listUsers(): Promise<User[]> {
  const db = getDatabaseAdapter();
  return db.listUsers();
}

/**
 * Get users with pagination
 */
export async function getUsersPaginated(page = 1, limit = 25): Promise<{
  users: User[];
  total: number;
  page: number;
  limit: number;
}> {
  const db = getDatabaseAdapter();
  return db.getUsersPaginated(page, limit);
}

// ============================================================
// Message/Chat Logging Functions
// ============================================================

/**
 * Create a new chat in the database
 */
export async function createChat(
  chatId: string,
  userId: string,
  title?: string
): Promise<{ chatId: string; userId: string; startedAt: string } | null> {
  const db = getDatabaseAdapter();
  return db.createChat(chatId, userId, title);
}

/**
 * Log a message to a chat
 */
export async function logMessage(
  chatId: string,
  sender: 'user' | 'agent',
  text: string,
  opts?: { entryId?: string; msg_id?: string; userId?: string; tokensUsed?: number; bookIds?: string[]; bookCatalogs?: Record<string, string> }
): Promise<Message | null> {
  const db = getDatabaseAdapter();
  return db.logMessage(chatId, sender, text, opts);
}

/**
 * Get all messages in a chat
 */
export async function getChatHistory(chatId: string): Promise<Message[]> {
  const db = getDatabaseAdapter();
  return db.getChatHistory(chatId);
}

/**
 * Clear chat history for a specific chat
 */
export async function clearChatHistory(chatId: string): Promise<void> {
  const db = getDatabaseAdapter();
  return db.clearChatHistory(chatId);
}

/**
 * Get all chats for a specific user
 */
export async function getChatsByUser(userId: string): Promise<{ chatId: string; startedAt?: string }[]> {
  const db = getDatabaseAdapter();
  return db.getChatsByUser(userId);
}

/**
 * Get messages from a specific user in a specific chat
 */
export async function getUserMessagesInChat(chatId: string, userId: string): Promise<Message[]> {
  const db = getDatabaseAdapter();
  return db.getUserMessagesInChat(chatId, userId);
}

/**
 * Get full chat history (both user and agent messages)
 */
export async function getFullChatHistory(chatId: string): Promise<Message[]> {
  const db = getDatabaseAdapter();
  return db.getFullChatHistory(chatId);
}

/**
 * Get all chat IDs
 */
export async function getAllChatIds(): Promise<string[]> {
  const db = getDatabaseAdapter();
  return db.getAllChatIds();
}

/**
 * Get chat count
 */
export async function getChatCount(): Promise<number> {
  const db = getDatabaseAdapter();
  return db.getChatCount();
}

// ============================================================
// Default Export (for backwards compatibility)
// ============================================================

export default {
  initUser,
  getUser,
  userExists,
  isUserBlocked,
  setUserBlocked,
  updateUserLastSeen,
  listUsers,
  getUsersPaginated,
  createChat,
  logMessage,
  getChatHistory,
  clearChatHistory,
  getChatsByUser,
  getUserMessagesInChat,
  getFullChatHistory,
  getAllChatIds,
  getChatCount,
};
