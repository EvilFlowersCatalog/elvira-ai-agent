import axios, { AxiosError } from 'axios';
import dotenv from 'dotenv';
import { User } from './accounts';

dotenv.config();

export class ElviraClient {
  private baseUrl: string;
  private apiKey: string;
  private catalogId: string;
  
  constructor(apiKey: string, catalogId?: string) {
    this.baseUrl = process.env.ELVIRA_BASE_URL || '';
    this.catalogId = catalogId || '';
    this.apiKey = apiKey;

    if (!this.baseUrl) {
      throw new Error('Missing ELVIRA_BASE_URL in environment variables');
    }

    if (!apiKey) {
      throw new Error('API key is required');
    }
  }

  /**
   * Validates if the provided key matches the client's API key
   */
  validateApiKey(providedKey: string): boolean {
    return this.apiKey === providedKey;
  }

  /**
   * Gets the current catalog ID
   */
  getCatalogId(): string {
    return this.catalogId;
  }

  /**
   * Sets or updates the catalog ID
   * Useful when the catalog context changes during a session
   */
  setCatalogId(catalogId: string): void {
    this.catalogId = catalogId;
  }

  /**
   * Get entries with pagination and filtering support
   * Supports filtering by: title, summary, category, author, language, date range, readium status, and custom query
   * Note: catalogId is optional - if not provided, entries from all catalogs will be returned
   */
  async getEntries(
    page = 1,
    limit = 25,
    filters?: {
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
  ) {
    const url = `${this.baseUrl}/api/v1/entries`;
    
    try {
      const params: Record<string, any> = {
        page,
        limit,
        pagination: true,
        ...filters,
      };

      if (this.catalogId) {
        params.catalog_id = this.catalogId;
      }

      const res = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        params,
      });
      
      return res.data;
    } catch (error) {
      this.handleApiError(error, 'getEntries');
      throw error;
    }
  }

  /**
   * Get detailed information about a specific entry
   * REQUIRES catalogId to be set - throws error if not provided
   */
  async getEntryDetail(entryId: string) {
    if (!entryId) {
      throw new Error('Entry ID is required');
    }

    if (!this.catalogId) {
      throw new Error('Catalog ID is required for fetching entry details');
    }

    const url = `${this.baseUrl}/api/v1/catalogs/${this.catalogId}/entries/${entryId}`;
    
    try {
      const res = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return res.data;
    } catch (error) {
      console.error(`[ElviraClient.getEntryDetail] Failed for catalogId: ${this.catalogId}, entryId: ${entryId}`);
      this.handleApiError(error, 'getEntryDetail');
      throw error;
    }
  }

  /**
   * Get current authenticated user information
   * This is the primary method for user verification
   */
  async getCurrentUserInfo(): Promise<User> {
    const url = `${this.baseUrl}/api/v1/users/me`;
    try {
      const res = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });

      if (!res.data?.response || !res.data.response.id) {
        console.log('invalid user api')
        throw new Error('Invalid user response from API');
      }

      return res.data.response;
    } catch (error) {
      this.handleApiError(error, 'getCurrentUserInfo');
      throw error;
    }
  }

  /**
   * Get list of users (admin only)
   */
  async getUsers(page = 1, limit = 25) {
    const url = `${this.baseUrl}/api/v1/users`;
    try {
      const res = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        params: { page, limit }
      });
      return res.data.response;
    } catch (error) {
      this.handleApiError(error, 'getUsers');
      throw error;
    }
  }

  /**
   * Handle API errors with proper logging
   */
  private handleApiError(error: unknown, context: string): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const message = axiosError.message;

      if (status === 401) {
        console.error(`[ElviraClient.${context}] Unauthorized - invalid API key`);
      } else if (status === 403) {
        console.error(`[ElviraClient.${context}] Forbidden - insufficient permissions`);
      } else if (status === 404) {
        console.error(`[ElviraClient.${context}] Resource not found`);
      } else {
        console.error(`[ElviraClient.${context}] API error: ${status} - ${message}`);
      }
    } else {
      console.error(`[ElviraClient.${context}] Unexpected error:`, error);
    }
  }
}