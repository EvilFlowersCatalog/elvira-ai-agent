import { v4 as uuidv4 } from 'uuid';

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
};

// ============================================================
// In-Memory Stores (to be replaced with database later)
// ============================================================

const users: Record<string, User> = {};
const chats: Record<string, Message[]> = {};

// ============================================================
// User Management Functions
// ============================================================

/**
 * Initialize or update a user in the local store
 * Called when user is verified via Elvira API
 */
export function initUser(user: User): User | null {
  if (!user || !user.id) return null;

  const now = new Date().toISOString();

  if (users[user.id]) {
    // Update existing user with new data (except blocked status)
    const existingBlocked = users[user.id].blocked;
    users[user.id] = {
      ...user,
      blocked: existingBlocked, // Preserve local blocked status
      createdAt: users[user.id].createdAt,
      lastSeenAt: now
    };
  } else {
    // Create new user
    users[user.id] = {
      ...user,
      blocked: false,
      createdAt: now,
      lastSeenAt: now
    };
  }

  return users[user.id];
}

/**
 * Get a user by ID
 */
export function getUser(userId: string): User | undefined {
  return users[userId];
}

/**
 * Check if a user exists
 */
export function userExists(userId: string): boolean {
  return userId in users;
}

/**
 * Check if a user is blocked
 */
export function isUserBlocked(userId: string): boolean {
  const user = users[userId];
  return user?.blocked ?? false;
}

/**
 * Set user blocked status
 * Returns the updated user or null if not found
 */
export function setUserBlocked(userId: string, blocked: boolean): User | null {
  if (!users[userId]) {
    return null;
  }
  users[userId].blocked = blocked;
  return users[userId];
}

/**
 * Update user's last seen timestamp
 */
export function updateUserLastSeen(userId: string): void {
  if (users[userId]) {
    users[userId].lastSeenAt = new Date().toISOString();
  }
}

/**
 * List all users
 */
export function listUsers(): User[] {
  return Object.values(users);
}

/**
 * Get users with pagination
 */
export function getUsersPaginated(page = 1, limit = 25): {
  users: User[];
  total: number;
  page: number;
  limit: number;
} {
  const all = Object.values(users);
  const total = all.length;
  const start = (page - 1) * limit;
  const slice = all.slice(start, start + limit);
  return { users: slice, total, page, limit };
}

// ============================================================
// Message/Chat Logging Functions
// ============================================================

/**
 * Log a message to a chat
 */
export function logMessage(
  chatId: string,
  sender: 'user' | 'agent',
  text: string,
  opts?: { entryId?: string; msg_id?: string; userId?: string }
): Message | null {
  if (!chatId) return null;

  const msg: Message = {
    id: uuidv4(),
    chatId,
    sender,
    text,
    timestamp: new Date().toISOString(),
    entryId: opts?.entryId,
    msg_id: opts?.msg_id,
    userId: opts?.userId,
  };

  chats[chatId] = chats[chatId] || [];
  chats[chatId].push(msg);

  return msg;
}

/**
 * Get all messages in a chat
 */
export function getChatHistory(chatId: string): Message[] {
  return chats[chatId] || [];
}

/**
 * Clear chat history for a specific chat
 */
export function clearChatHistory(chatId: string): void {
  delete chats[chatId];
}

/**
 * Get all chats for a specific user
 */
export function getChatsByUser(userId: string): { chatId: string; startedAt?: string }[] {
  const result: { chatId: string; startedAt?: string }[] = [];

  for (const [chatId, msgs] of Object.entries(chats)) {
    if (!msgs || msgs.length === 0) continue;

    // Find if user participated in this chat
    const firstUserMsg = msgs.find((m) => m.sender === 'user' && m.userId === userId);
    if (firstUserMsg) {
      result.push({ chatId, startedAt: firstUserMsg.timestamp });
    }
  }

  return result;
}

/**
 * Get messages from a specific user in a specific chat
 */
export function getUserMessagesInChat(chatId: string, userId: string): Message[] {
  const msgs = chats[chatId] || [];
  return msgs.filter((m) => m.sender === 'user' && m.userId === userId);
}

/**
 * Get full chat history (both user and agent messages)
 */
export function getFullChatHistory(chatId: string): Message[] {
  return chats[chatId] || [];
}

/**
 * Get all chat IDs
 */
export function getAllChatIds(): string[] {
  return Object.keys(chats);
}

/**
 * Get chat count
 */
export function getChatCount(): number {
  return Object.keys(chats).length;
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
  logMessage,
  getChatHistory,
  clearChatHistory,
  getChatsByUser,
  getUserMessagesInChat,
  getFullChatHistory,
  getAllChatIds,
  getChatCount,
};
