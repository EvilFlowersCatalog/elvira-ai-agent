/**
 * Local in-memory database adapter
 * Uses local in-memory storage with daily limits support
 */
import { v4 as uuidv4 } from 'uuid';
import { User, Message } from '../../accounts';
import { DatabaseAdapter, DailyLimit } from '../adapter';
import * as localStore from '../localStore';

export class LocalDatabaseAdapter implements DatabaseAdapter {
  private dailyLimits: Record<string, DailyLimit> = {};

  async init(): Promise<void> {
    // Local adapter doesn't need initialization
    console.log('Local database adapter initialized');
  }

  // User operations (delegated to local store)
  async initUser(user: User): Promise<User | null> {
    return localStore.initUserLocal(user);
  }

  async getUser(userId: string): Promise<User | undefined> {
    return localStore.getUserLocal(userId);
  }

  async userExists(userId: string): Promise<boolean> {
    return localStore.userExistsLocal(userId);
  }

  async isUserBlocked(userId: string): Promise<boolean> {
    return localStore.isUserBlockedLocal(userId);
  }

  async setUserBlocked(userId: string, blocked: boolean, reason?: string, until?: Date): Promise<User | null> {
    // Note: Local adapter doesn't persist blocked_reason and blocked_until
    return localStore.setUserBlockedLocal(userId, blocked);
  }

  async updateUserLastSeen(userId: string): Promise<void> {
    localStore.updateUserLastSeenLocal(userId);
  }

  async listUsers(): Promise<User[]> {
    return localStore.listUsersLocal();
  }

  async getUsersPaginated(page = 1, limit = 25): Promise<{ users: User[]; total: number; page: number; limit: number }> {
    return localStore.getUsersPaginatedLocal(page, limit);
  }

  // Message/Chat operations (delegated to local store)
  async createChat(
    chatId: string,
    userId: string,
    title?: string
  ): Promise<{ chatId: string; userId: string; startedAt: string } | null> {
    return localStore.createChatLocal(chatId, userId, title);
  }

  async logMessage(
    chatId: string,
    sender: 'user' | 'agent',
    text: string,
    opts?: { entryId?: string; msg_id?: string; userId?: string; tokensUsed?: number; bookIds?: string[]; bookCatalogs?: Record<string, string> }
  ): Promise<Message | null> {
    return localStore.logMessageLocal(chatId, sender, text, opts);
  }

  async getChatHistory(chatId: string): Promise<Message[]> {
    return localStore.getChatHistoryLocal(chatId);
  }

  async clearChatHistory(chatId: string): Promise<void> {
    localStore.clearChatHistoryLocal(chatId);
  }

  async getChatsByUser(userId: string): Promise<{ chatId: string; startedAt?: string }[]> {
    return localStore.getChatsByUserLocal(userId);
  }

  async getUserMessagesInChat(chatId: string, userId: string): Promise<Message[]> {
    return localStore.getUserMessagesInChatLocal(chatId, userId);
  }

  async getFullChatHistory(chatId: string): Promise<Message[]> {
    return localStore.getFullChatHistoryLocal(chatId);
  }

  async getAllChatIds(): Promise<string[]> {
    return localStore.getAllChatIdsLocal();
  }

  async getChatCount(): Promise<number> {
    return localStore.getChatCountLocal();
  }

  // Daily limit operations
  async getDailyLimit(userId: string, date: string): Promise<DailyLimit | null> {
    const key = `${userId}:${date}`;
    return this.dailyLimits[key] || null;
  }

  async listDailyLimits(userId?: string, date?: string): Promise<DailyLimit[]> {
    let limits = Object.values(this.dailyLimits);

    if (userId) {
      limits = limits.filter(l => l.user_id === userId);
    }

    if (date) {
      limits = limits.filter(l => l.date === date);
    }

    // Sort by date desc
    return limits.sort((a, b) => b.date.localeCompare(a.date));
  }

  async createDailyLimit(userId: string, date: string, messagesLimit: number, tokensLimit: number): Promise<DailyLimit> {
    const key = `${userId}:${date}`;
    const limit: DailyLimit = {
      id: uuidv4(),
      user_id: userId,
      date,
      messages_used: 0,
      messages_limit: messagesLimit,
      tokens_used: 0,
      tokens_limit: tokensLimit,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.dailyLimits[key] = limit;
    return limit;
  }

  async updateDailyLimitUsage(dailyLimitId: string, messagesUsed: number, tokensUsed: number): Promise<DailyLimit | null> {
    for (const limit of Object.values(this.dailyLimits)) {
      if (limit.id === dailyLimitId) {
        limit.messages_used = messagesUsed;
        limit.tokens_used = tokensUsed;
        limit.updated_at = new Date().toISOString();
        return limit;
      }
    }
    return null;
  }

  async incrementDailyLimitUsage(dailyLimitId: string, messages: number, tokens: number): Promise<DailyLimit | null> {
    for (const limit of Object.values(this.dailyLimits)) {
      if (limit.id === dailyLimitId) {
        limit.messages_used += messages;
        limit.tokens_used += tokens;
        limit.updated_at = new Date().toISOString();
        return limit;
      }
    }
    return null;
  }

  async resetDailyLimits(date: string): Promise<void> {
    // Remove daily limits for the given date
    for (const key of Object.keys(this.dailyLimits)) {
      if (key.endsWith(`:${date}`)) {
        delete this.dailyLimits[key];
      }
    }
  }

  async close(): Promise<void> {
    // Local adapter doesn't need cleanup
    console.log('Local database adapter closed');
  }
}
