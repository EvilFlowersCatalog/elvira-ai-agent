/**
 * PostgreSQL database adapter
 * Implements persistent storage using PostgreSQL
 */
import { Pool, QueryResult } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseAdapter, DailyLimit } from '../adapter';
import { runMigrations } from '../migrations';
import { DatabaseConfig } from '../config';
import { Message, User } from '../../accounts';

export class PostgresDatabaseAdapter implements DatabaseAdapter {
  private pool: Pool;

  constructor(config: DatabaseConfig) {
    if (!config.postgres) {
      throw new Error('PostgreSQL config is required for PostgresDatabaseAdapter');
    }

    this.pool = new Pool({
      host: config.postgres.host,
      port: config.postgres.port,
      user: config.postgres.user,
      password: config.postgres.password,
      database: config.postgres.database,
    });
  }

  async init(): Promise<void> {
    console.log('Initializing PostgreSQL database adapter...');
    try {
      // Test connection
      const result = await this.pool.query('SELECT NOW()');
      console.log('✓ Connected to PostgreSQL database');

      // Run migrations
      await runMigrations(this.pool);
    } catch (error) {
      console.error('Failed to initialize PostgreSQL database:', error);
      throw error;
    }
  }

  // User operations
  async initUser(user: User): Promise<User | null> {
    if (!user || !user.id) return null;

    const now = new Date().toISOString();

    try {
      const query = `
        INSERT INTO users (id, username, name, surname, is_superuser, permissions, catalog_permissions, blocked, created_at, last_seen_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          username = $2,
          name = $3,
          surname = $4,
          is_superuser = $5,
          permissions = $6,
          catalog_permissions = $7,
          last_seen_at = $10,
          updated_at = $11
        RETURNING *;
      `;

      const result = await this.pool.query(query, [
        user.id,
        user.username,
        user.name,
        user.surname,
        user.is_superuser || false,
        user.permissions || [],
        JSON.stringify(user.catalog_permissions || {}),
        user.blocked || false,
        user.createdAt || now,
        now,
        now,
      ]);

      return this.rowToUser(result.rows[0]);
    } catch (error) {
      console.error('Error initializing user:', error);
      return null;
    }
  }

  async getUser(userId: string): Promise<User | undefined> {
    try {
      const result = await this.pool.query('SELECT * FROM users WHERE id = $1', [userId]);
      return result.rows.length > 0 ? this.rowToUser(result.rows[0]) : undefined;
    } catch (error) {
      console.error('Error getting user:', error);
      return undefined;
    }
  }

  async userExists(userId: string): Promise<boolean> {
    try {
      const result = await this.pool.query('SELECT 1 FROM users WHERE id = $1', [userId]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking user existence:', error);
      return false;
    }
  }

  async isUserBlocked(userId: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        'SELECT blocked, blocked_until FROM users WHERE id = $1',
        [userId]
      );
      if (result.rows.length === 0) return false;

      const { blocked, blocked_until } = result.rows[0];
      if (!blocked) return false;

      // Check if block has expired
      if (blocked_until && new Date(blocked_until) < new Date()) {
        await this.pool.query('UPDATE users SET blocked = FALSE, blocked_until = NULL WHERE id = $1', [userId]);
        return false;
      }

      return blocked;
    } catch (error) {
      console.error('Error checking user blocked status:', error);
      return false;
    }
  }

  async setUserBlocked(userId: string, blocked: boolean, reason?: string, until?: Date): Promise<User | null> {
    try {
      const query = `
        UPDATE users
        SET blocked = $2, blocked_reason = $3, blocked_until = $4, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *;
      `;

      const result = await this.pool.query(query, [userId, blocked, reason || null, until || null]);
      return result.rows.length > 0 ? this.rowToUser(result.rows[0]) : null;
    } catch (error) {
      console.error('Error setting user blocked status:', error);
      return null;
    }
  }

  async updateUserLastSeen(userId: string): Promise<void> {
    try {
      await this.pool.query('UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
    } catch (error) {
      console.error('Error updating user last seen:', error);
    }
  }

  async listUsers(): Promise<User[]> {
    try {
      const result = await this.pool.query('SELECT * FROM users ORDER BY created_at DESC');
      return result.rows.map((row) => this.rowToUser(row));
    } catch (error) {
      console.error('Error listing users:', error);
      return [];
    }
  }

  async getUsersPaginated(page = 1, limit = 25): Promise<{ users: User[]; total: number; page: number; limit: number }> {
    try {
      const offset = (page - 1) * limit;
      const totalResult = await this.pool.query('SELECT COUNT(*) FROM users');
      const total = parseInt(totalResult.rows[0].count, 10);

      const result = await this.pool.query(
        'SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      );

      return {
        users: result.rows.map((row) => this.rowToUser(row)),
        total,
        page,
        limit,
      };
    } catch (error) {
      console.error('Error getting paginated users:', error);
      return { users: [], total: 0, page, limit };
    }
  }

  // Message/Chat operations
  async createChat(
    chatId: string,
    userId: string,
    title?: string
  ): Promise<{ chatId: string; userId: string; startedAt: string } | null> {
    try {
      const query = `
        INSERT INTO chats (id, user_id, title, started_at, is_active)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP, TRUE)
        ON CONFLICT (id) DO NOTHING
        RETURNING id, user_id, started_at;
      `;

      const result = await this.pool.query(query, [chatId, userId, title || null]);
      
      if (result.rows.length === 0) {
        // Chat already exists, fetch it
        const existingChat = await this.pool.query(
          'SELECT id, user_id, started_at FROM chats WHERE id = $1',
          [chatId]
        );
        if (existingChat.rows.length > 0) {
          const row = existingChat.rows[0];
          return {
            chatId: row.id,
            userId: row.user_id,
            startedAt: row.started_at?.toISOString?.() || row.started_at,
          };
        }
        return null;
      }

      const row = result.rows[0];
      return {
        chatId: row.id,
        userId: row.user_id,
        startedAt: row.started_at?.toISOString?.() || row.started_at,
      };
    } catch (error) {
      console.error('Error creating chat:', error);
      return null;
    }
  }

  async logMessage(
    chatId: string,
    sender: 'user' | 'agent',
    text: string,
    opts?: { entryId?: string; msg_id?: string; userId?: string; weight?: number; tokensUsed?: number; bookIds?: string[]; bookCatalogs?: Record<string, string> }
  ): Promise<Message | null> {
    if (!chatId) return null;

    try {
      const query = `
        INSERT INTO messages (id, chat_id, user_id, sender, text, entry_id, msg_id, weight, tokens_used, book_ids, book_catalogs, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
        RETURNING id, chat_id, sender, text, timestamp, entry_id, msg_id, user_id, book_ids, book_catalogs;
      `;

      const result = await this.pool.query(query, [
        uuidv4(),
        chatId,
        opts?.userId || null,
        sender,
        text,
        opts?.entryId || null,
        opts?.msg_id || null,
        opts?.weight || 1.0,
        opts?.tokensUsed || 0,
        opts?.bookIds ? JSON.stringify(opts.bookIds) : null,
        opts?.bookCatalogs ? JSON.stringify(opts.bookCatalogs) : null,
      ]);

      return this.rowToMessage(result.rows[0]);
    } catch (error) {
      console.error('Error logging message:', error);
      return null;
    }
  }

  async getChatHistory(chatId: string): Promise<Message[]> {
    try {
      const result = await this.pool.query(
        'SELECT id, chat_id, sender, text, timestamp, entry_id, msg_id, user_id, book_ids, book_catalogs FROM messages WHERE chat_id = $1 ORDER BY timestamp ASC',
        [chatId]
      );
      return result.rows.map((row) => this.rowToMessage(row));
    } catch (error) {
      console.error('Error getting chat history:', error);
      return [];
    }
  }

  async clearChatHistory(chatId: string): Promise<void> {
    try {
      await this.pool.query('DELETE FROM messages WHERE chat_id = $1', [chatId]);
    } catch (error) {
      console.error('Error clearing chat history:', error);
    }
  }

  async getChatsByUser(userId: string): Promise<{ chatId: string; startedAt?: string }[]> {
    try {
      const result = await this.pool.query(
        `SELECT DISTINCT c.id as chatId, MIN(m.timestamp) as startedAt
         FROM chats c
         LEFT JOIN messages m ON c.id = m.chat_id
         WHERE c.user_id = $1
         GROUP BY c.id
         ORDER BY startedAt DESC`,
        [userId]
      );

      return result.rows.map((row) => ({
        chatId: row.chatid,
        startedAt: row.startedat,
      }));
    } catch (error) {
      console.error('Error getting chats by user:', error);
      return [];
    }
  }

  async getUserMessagesInChat(chatId: string, userId: string): Promise<Message[]> {
    try {
      const result = await this.pool.query(
        `SELECT id, chat_id, sender, text, timestamp, entry_id, msg_id, user_id, book_ids, book_catalogs
         FROM messages WHERE chat_id = $1 AND sender = 'user' AND user_id = $2
         ORDER BY timestamp ASC`,
        [chatId, userId]
      );
      return result.rows.map((row) => this.rowToMessage(row));
    } catch (error) {
      console.error('Error getting user messages in chat:', error);
      return [];
    }
  }

  async getFullChatHistory(chatId: string): Promise<Message[]> {
    return this.getChatHistory(chatId);
  }

  async getAllChatIds(): Promise<string[]> {
    try {
      const result = await this.pool.query('SELECT DISTINCT id FROM chats');
      return result.rows.map((row) => row.id);
    } catch (error) {
      console.error('Error getting all chat IDs:', error);
      return [];
    }
  }

  async getChatCount(): Promise<number> {
    try {
      const result = await this.pool.query('SELECT COUNT(DISTINCT id) FROM chats');
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      console.error('Error getting chat count:', error);
      return 0;
    }
  }

  // Daily limit operations
  async getDailyLimit(userId: string, date: string): Promise<DailyLimit | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM daily_limits WHERE user_id = $1 AND date = $2',
        [userId, date]
      );
      return result.rows.length > 0 ? this.rowToDailyLimit(result.rows[0]) : null;
    } catch (error) {
      console.error('Error getting daily limit:', error);
      return null;
    }
  }

  async createDailyLimit(userId: string, date: string, messagesLimit: number, tokensLimit: number): Promise<DailyLimit> {
    try {
      const query = `
        INSERT INTO daily_limits (id, user_id, date, messages_limit, tokens_limit)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `;

      const result = await this.pool.query(query, [uuidv4(), userId, date, messagesLimit, tokensLimit]);
      return this.rowToDailyLimit(result.rows[0]);
    } catch (error) {
      console.error('Error creating daily limit:', error);
      throw error;
    }
  }

  async updateDailyLimitUsage(dailyLimitId: string, messagesUsed: number, tokensUsed: number): Promise<DailyLimit | null> {
    try {
      const query = `
        UPDATE daily_limits
        SET messages_used = $2, tokens_used = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *;
      `;

      const result = await this.pool.query(query, [dailyLimitId, messagesUsed, tokensUsed]);
      return result.rows.length > 0 ? this.rowToDailyLimit(result.rows[0]) : null;
    } catch (error) {
      console.error('Error updating daily limit usage:', error);
      return null;
    }
  }

  async incrementDailyLimitUsage(dailyLimitId: string, messages: number, tokens: number): Promise<DailyLimit | null> {
    try {
      const query = `
        UPDATE daily_limits
        SET messages_used = messages_used + $2, tokens_used = tokens_used + $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *;
      `;

      const result = await this.pool.query(query, [dailyLimitId, messages, tokens]);
      return result.rows.length > 0 ? this.rowToDailyLimit(result.rows[0]) : null;
    } catch (error) {
      console.error('Error incrementing daily limit usage:', error);
      return null;
    }
  }

  async resetDailyLimits(date: string): Promise<void> {
    try {
      await this.pool.query('DELETE FROM daily_limits WHERE date = $1', [date]);
    } catch (error) {
      console.error('Error resetting daily limits:', error);
    }
  }

  async close(): Promise<void> {
    try {
      await this.pool.end();
      console.log('✓ PostgreSQL connection closed');
    } catch (error) {
      console.error('Error closing PostgreSQL connection:', error);
    }
  }

  // Helper methods
  private rowToUser(row: any): User {
    return {
      id: row.id,
      username: row.username,
      name: row.name,
      surname: row.surname,
      is_superuser: row.is_superuser,
      permissions: row.permissions || [],
      catalog_permissions: typeof row.catalog_permissions === 'string' ? JSON.parse(row.catalog_permissions) : row.catalog_permissions || {},
      blocked: row.blocked,
      createdAt: row.created_at?.toISOString?.() || row.created_at,
      lastSeenAt: row.last_seen_at?.toISOString?.() || row.last_seen_at,
    };
  }

  private rowToMessage(row: any): Message {
    return {
      id: row.id,
      chatId: row.chat_id,
      sender: row.sender,
      text: row.text,
      timestamp: row.timestamp?.toISOString?.() || row.timestamp,
      entryId: row.entry_id,
      msg_id: row.msg_id,
      userId: row.user_id,
      bookIds: row.book_ids ? (typeof row.book_ids === 'string' ? JSON.parse(row.book_ids) : row.book_ids) : undefined,
      bookCatalogs: row.book_catalogs ? (typeof row.book_catalogs === 'string' ? JSON.parse(row.book_catalogs) : row.book_catalogs) : undefined,
    };
  }

  private rowToDailyLimit(row: any): DailyLimit {
    return {
      id: row.id,
      user_id: row.user_id,
      date: typeof row.date === 'string' ? row.date : row.date?.toISOString?.().split('T')[0],
      messages_used: row.messages_used,
      messages_limit: row.messages_limit,
      tokens_used: row.tokens_used,
      tokens_limit: row.tokens_limit,
      created_at: row.created_at?.toISOString?.() || row.created_at,
      updated_at: row.updated_at?.toISOString?.() || row.updated_at,
    };
  }
}
