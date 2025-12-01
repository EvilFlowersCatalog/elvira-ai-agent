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
}

// Chat session listeners
export interface ChatSessionListeners {
  messageListener: (message: string) => void;
  displayBooksListener: (bookIds: string[]) => void;
  chunkListener: (msg_id: string, chunk: string) => void;
}
