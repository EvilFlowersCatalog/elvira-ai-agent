/**
 * Database Adapter Interface
 * Defines the contract for both local and postgres storage
 */
import { User, Message } from '../accounts';

export interface DailyLimit {
  id: string;
  user_id: string;
  date: string;
  messages_used: number;
  messages_limit: number;
  tokens_used: number;
  tokens_limit: number;
  created_at: string;
  updated_at: string;
}

export interface DatabaseAdapter {
  // Initialize the database
  init(): Promise<void>;

  // User operations
  initUser(user: User): Promise<User | null>;
  getUser(userId: string): Promise<User | undefined>;
  userExists(userId: string): Promise<boolean>;
  isUserBlocked(userId: string): Promise<boolean>;
  setUserBlocked(userId: string, blocked: boolean, reason?: string, until?: Date): Promise<User | null>;
  updateUserLastSeen(userId: string): Promise<void>;
  listUsers(): Promise<User[]>;
  getUsersPaginated(page: number, limit: number): Promise<{ users: User[]; total: number; page: number; limit: number }>;

  // Message/Chat operations
  createChat(chatId: string, userId: string, title?: string): Promise<{ chatId: string; userId: string; startedAt: string } | null>;
  logMessage(chatId: string, sender: 'user' | 'agent', text: string, opts?: { entryId?: string; msg_id?: string; userId?: string; tokensUsed?: number; bookIds?: string[]; bookCatalogs?: Record<string, string> }): Promise<Message | null>;
  getChatHistory(chatId: string): Promise<Message[]>;
  clearChatHistory(chatId: string): Promise<void>;
  getChatsByUser(userId: string): Promise<{ chatId: string; startedAt?: string }[]>;
  getUserMessagesInChat(chatId: string, userId: string): Promise<Message[]>;
  getFullChatHistory(chatId: string): Promise<Message[]>;
  getAllChatIds(): Promise<string[]>;
  getChatCount(): Promise<number>;

  // Daily limit operations
  getDailyLimit(userId: string, date: string): Promise<DailyLimit | null>;
  createDailyLimit(userId: string, date: string, messagesLimit: number, tokensLimit: number): Promise<DailyLimit>;
  updateDailyLimitUsage(dailyLimitId: string, messagesUsed: number, tokensUsed: number): Promise<DailyLimit | null>;
  incrementDailyLimitUsage(dailyLimitId: string, messages: number, tokens: number): Promise<DailyLimit | null>;
  resetDailyLimits(date: string): Promise<void>;

  // Cleanup
  close(): Promise<void>;
}
