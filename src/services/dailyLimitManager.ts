/**
 * Daily Limit Manager Service
 * Handles daily usage limits and tracking
 */
import { getDatabaseAdapter } from '../database';
import { getDailyLimitConfig } from '../database/config';
import { calculateQueryWeight } from './queryWeightCalculator';

export interface UsageCheck {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: string;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get the next reset time based on the configured reset hour
 */
function getNextResetTime(): Date {
  const now = new Date();
  const resetHour = parseInt(process.env.DAILY_LIMIT_RESET_HOUR || '0', 10);

  const resetTime = new Date(now);
  resetTime.setHours(resetHour, 0, 0, 0);

  // If reset time has already passed today, set it to tomorrow
  if (resetTime <= now) {
    resetTime.setDate(resetTime.getDate() + 1);
  }

  return resetTime;
}

/**
 * Check if user has message quota available
 */
export async function checkMessageQuota(userId: string): Promise<UsageCheck> {
  const db = getDatabaseAdapter();
  const config = getDailyLimitConfig();
  const today = getTodayDate();

  let limit = await db.getDailyLimit(userId, today);

  if (!limit) {
    // Create daily limit if it doesn't exist
    limit = await db.createDailyLimit(
      userId,
      today,
      config.messagesPerDay,
      config.tokensPerDay
    );
  }

  const hasQuota = limit.messages_used < limit.messages_limit;
  const remaining = Math.max(0, limit.messages_limit - limit.messages_used);
  const resetAt = getNextResetTime().toISOString();

  return {
    allowed: hasQuota,
    remaining,
    limit: limit.messages_limit,
    resetAt,
  };
}

/**
 * Check if user has token quota available
 */
export async function checkTokenQuota(userId: string, estimatedTokens: number): Promise<UsageCheck> {
  const db = getDatabaseAdapter();
  const config = getDailyLimitConfig();
  const today = getTodayDate();

  let limit = await db.getDailyLimit(userId, today);

  if (!limit) {
    // Create daily limit if it doesn't exist
    limit = await db.createDailyLimit(
      userId,
      today,
      config.messagesPerDay,
      config.tokensPerDay
    );
  }

  const hasQuota = limit.tokens_used + estimatedTokens <= limit.tokens_limit;
  const remaining = Math.max(0, limit.tokens_limit - limit.tokens_used);
  const resetAt = getNextResetTime().toISOString();

  return {
    allowed: hasQuota,
    remaining,
    limit: limit.tokens_limit,
    resetAt,
  };
}

/**
 * Record message usage
 */
export async function recordMessageUsage(userId: string, query: string, tokensUsed: number = 0): Promise<boolean> {
  const db = getDatabaseAdapter();
  const config = getDailyLimitConfig();
  const today = getTodayDate();

  let limit = await db.getDailyLimit(userId, today);

  if (!limit) {
    limit = await db.createDailyLimit(
      userId,
      today,
      config.messagesPerDay,
      config.tokensPerDay
    );
  }

  // Calculate weight for this query
  const weight = await calculateQueryWeight(query);
  const messagesUsed = Math.ceil(weight);

  // Check if user has quota
  if (limit.messages_used + messagesUsed > limit.messages_limit) {
    console.log(
      `User ${userId} exceeded message quota. Used: ${limit.messages_used}, Limit: ${limit.messages_limit}, Requested: ${messagesUsed}`
    );
    return false;
  }

  // Check if user has token quota
  if (limit.tokens_used + tokensUsed > limit.tokens_limit) {
    console.log(
      `User ${userId} exceeded token quota. Used: ${limit.tokens_used}, Limit: ${limit.tokens_limit}, Requested: ${tokensUsed}`
    );
    return false;
  }

  // Update usage
  await db.incrementDailyLimitUsage(
    limit.id,
    messagesUsed,
    tokensUsed
  );

  console.log(
    `Recorded usage for user ${userId}: ${messagesUsed} messages, ${tokensUsed} tokens`
  );

  return true;
}

/**
 * Get user's current daily usage
 */
export async function getDailyUsage(userId: string) {
  const db = getDatabaseAdapter();
  const config = getDailyLimitConfig();
  const today = getTodayDate();

  let limit = await db.getDailyLimit(userId, today);

  if (!limit) {
    limit = await db.createDailyLimit(
      userId,
      today,
      config.messagesPerDay,
      config.tokensPerDay
    );
  }

  return {
    messages: {
      used: limit.messages_used,
      limit: limit.messages_limit,
      remaining: Math.max(0, limit.messages_limit - limit.messages_used),
    },
    tokens: {
      used: limit.tokens_used,
      limit: limit.tokens_limit,
      remaining: Math.max(0, limit.tokens_limit - limit.tokens_used),
    },
    resetAt: getNextResetTime().toISOString(),
  };
}

/**
 * Reset daily limits for expired dates
 */
export async function resetExpiredDailyLimits(): Promise<void> {
  const db = getDatabaseAdapter();
  const resetHour = parseInt(process.env.DAILY_LIMIT_RESET_HOUR || '0', 10);
  const now = new Date();

  // Only reset if we're past the reset hour
  if (now.getHours() >= resetHour) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = yesterday.toISOString().split('T')[0];

    await db.resetDailyLimits(yesterdayDate);
    console.log(`Reset daily limits for date: ${yesterdayDate}`);
  }
}
