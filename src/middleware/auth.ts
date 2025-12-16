import { Response, NextFunction } from 'express';
import { ElviraClient } from '../elviraClient';
import { AuthenticatedRequest, AdminRequest } from '../types';

/**
 * Extracts API key from various sources in the request
 */
function extractApiKey(req: AuthenticatedRequest): string | undefined {
  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.split(' ')[1];
  }


  // Check x-api-key header
  if (req.headers['x-api-key'] && typeof req.headers['x-api-key'] === 'string') {
    return req.headers['x-api-key'];
  }

  // Check query param
  if (req.query?.apiKey && typeof req.query.apiKey === 'string') {
    return req.query.apiKey;
  }

  // Check body
  if (req.body?.apiKey && typeof req.body.apiKey === 'string') {
    return req.body.apiKey;
  }

  return undefined;
}

/**
 * Middleware to authenticate admin/superuser access
 * Requires user to have is_superuser flag
 */
export async function adminAuth(
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const apiKey = extractApiKey(req);

    if (!apiKey) {
      res.status(401).json({ error: 'API key required' });
      return;
    }

    const elviraClient = new ElviraClient(apiKey);
    const user = await elviraClient.getCurrentUserInfo();

    if (!user || !user.id) {
      res.status(401).json({ error: 'Invalid API key or user not found' });
      return;
    }

    if (!user.is_superuser) {
      res.status(403).json({ error: 'Forbidden - superuser required' });
      return;
    }

    req.elviraClient = elviraClient;
    req.adminUser = user;
    req.apiKey = apiKey;
    next();
  } catch (err) {
    console.error('Admin auth error:', err);
    res.status(401).json({ error: 'Invalid API key or unable to verify user' });
  }
}

/**
 * Validates API key matches the one used to create the session
 */
export function validateSessionApiKey(
  sessionClient: ElviraClient,
  providedKey: string
): boolean {
  return sessionClient.validateApiKey(providedKey);
}

/**
 * Middleware to authenticate regular user access
 * Validates API key and loads user info
 */
export async function validateApiKey(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const apiKey = extractApiKey(req);

    if (!apiKey) {
      res.status(401).json({ error: 'API key required' });
      return;
    }

    // Get catalogId from query or body
    const catalogId = (req.query?.catalogId || req.body?.catalogId) as string | undefined;

    if (!catalogId) {
      res.status(400).json({ error: 'catalogId is required' });
      return;
    }
    const elviraClient = new ElviraClient(apiKey, catalogId);
    const user = await elviraClient.getCurrentUserInfo();

    if (!user || !user.id) {
      res.status(401).json({ error: 'Invalid API key or user not found' });
      return;
    }

    req.elviraClient = elviraClient;
    req.user = user;
    req.apiKey = apiKey;
    next();
  } catch (err) {
    console.error('API key validation error:', err);
    res.status(401).json({ error: 'Invalid API key or unable to verify user' });
  }
}
