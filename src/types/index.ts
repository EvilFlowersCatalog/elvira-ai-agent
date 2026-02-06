import { Request } from 'express';
import { ElviraClient } from '../elviraClient';
import { User } from '../accounts';

// Extended Express Request with auth context
export interface AuthenticatedRequest extends Request {
  elviraClient?: ElviraClient;
  user?: User;
  apiKey?: string;
}

export interface AdminRequest extends AuthenticatedRequest {
  adminUser?: User;
}

// Message queue item types
export interface MessageQueueItem {
  type: 'message' | 'entries' | 'chunk' | 'error' | 'done';
  data: string | string[];
  msg_id?: string;
  bookCatalogs?: Record<string, string>; // Map of bookId -> catalogId
}

// Chat session listeners
export interface ChatSessionListeners {
  messageListener: (message: string, msg_id?: string) => void;
  displayBooksListener: (bookIds: string[], bookCatalogs?: Record<string, string>) => void;
  chunkListener: (msg_id: string, chunk: string) => void;
}

// Entry filtering options
export interface EntryFilterOptions {
  title?: string;
  summary?: string;
  category_term?: string;
  author?: string;
  language_code?: string;
  published_at__gte?: string;
  published_at__lte?: string;
  config__readium_enabled?: boolean;
  query?: string;
}

// Entry query parameters
export interface EntryQueryParams {
  page: number;
  limit: number;
  filters?: EntryFilterOptions;
}

// Entry response from Elvira API
export interface EntryResponse {
  id: string;
  title: string;
  summary?: string;
  author?: string;
  category?: string;
  language_code?: string;
  published_at?: string;
  config?: {
    readium_enabled?: boolean;
  };
  [key: string]: any;
}

// Entries list response
export interface EntriesListResponse {
  items: EntryResponse[];
  total: number;
  page: number;
  limit: number;
}

// Daily Limit types
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

// Usage statistics
export interface UsageCheck {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: string;
}

// Query weight analysis
export interface QueryWeightAnalysis {
  weight: number;
  category: 'library_related' | 'other' | 'complex';
  reason: string;
}
