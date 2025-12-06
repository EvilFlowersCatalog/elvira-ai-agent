/**
 * In-memory storage implementation for local development
 * This is used by the LocalDatabaseAdapter and avoids circular dependencies
 */
import { v4 as uuidv4 } from 'uuid';
import { User, Message } from '../accounts';

// ============================================================
// In-Memory Stores
// ============================================================

const users: Record<string, User> = {};
const chats: Record<string, Message[]> = {};
const chatsMetadata: Record<string, { chatId: string; userId: string; startedAt: string; title?: string }> = {};

// ============================================================
// User Management Functions
// ============================================================

export function initUserLocal(user: User): User | null {
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

export function getUserLocal(userId: string): User | undefined {
  return users[userId];
}

export function userExistsLocal(userId: string): boolean {
  return userId in users;
}

export function isUserBlockedLocal(userId: string): boolean {
  const user = users[userId];
  return user?.blocked ?? false;
}

export function setUserBlockedLocal(userId: string, blocked: boolean): User | null {
  if (!users[userId]) {
    return null;
  }
  users[userId].blocked = blocked;
  return users[userId];
}

export function updateUserLastSeenLocal(userId: string): void {
  if (users[userId]) {
    users[userId].lastSeenAt = new Date().toISOString();
  }
}

export function listUsersLocal(): User[] {
  return Object.values(users);
}

export function getUsersPaginatedLocal(page = 1, limit = 25): {
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

export function createChatLocal(
  chatId: string,
  userId: string,
  title?: string
): { chatId: string; userId: string; startedAt: string } | null {
  if (!chatId || !userId) return null;

  // If chat already exists, return the existing metadata
  if (chatsMetadata[chatId]) {
    return chatsMetadata[chatId];
  }

  const chatMeta = {
    chatId,
    userId,
    startedAt: new Date().toISOString(),
    title,
  };

  chatsMetadata[chatId] = chatMeta;
  // Initialize empty messages array for this chat
  chats[chatId] = chats[chatId] || [];

  return chatMeta;
}

export function logMessageLocal(
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

export function getChatHistoryLocal(chatId: string): Message[] {
  return chats[chatId] || [];
}

export function clearChatHistoryLocal(chatId: string): void {
  delete chats[chatId];
}

export function getChatsByUserLocal(userId: string): { chatId: string; startedAt?: string }[] {
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

export function getUserMessagesInChatLocal(chatId: string, userId: string): Message[] {
  const msgs = chats[chatId] || [];
  return msgs.filter((m) => m.sender === 'user' && m.userId === userId);
}

export function getFullChatHistoryLocal(chatId: string): Message[] {
  return chats[chatId] || [];
}

export function getAllChatIdsLocal(): string[] {
  return Object.keys(chats);
}

export function getChatCountLocal(): number {
  return Object.keys(chats).length;
}
