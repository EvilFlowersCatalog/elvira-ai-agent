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
   * Get entries with pagination and filtering support
   * Supports filtering by: title, summary, category, author, language, date range, readium status, and custom query
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
      console.log(`ElviraClient.getEntries: Fetching entries from ${url}`);
      console.log('With filters:', filters);
      const params: Record<string, any> = {
        catalog_id: this.catalogId,
        page,
        limit,
        pagination: true,
        ...filters,
      };

      const res = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        params,
      });
      console.log(`ElviraClient.getEntries: Retrieved ${res.data?.items.length || 0} entries`);
      return res.data;
    } catch (error) {
      this.handleApiError(error, 'getEntries');
      throw error;
    }
  }

  /**
   * Get detailed information about a specific entry
   */
  async getEntryDetail(entryId: string) {
    if (!entryId) {
      throw new Error('Entry ID is required');
    }

    const url = `${this.baseUrl}/api/v1/catalogs/${this.catalogId}/entries/${entryId}`;
    try {
      console.log(`ElviraClient.getEntryDetail: Fetching entry detail from ${url}`);
      const res = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      console.log(`ElviraClient.getEntryDetail: Retrieved entry: `, res.data?.response.title);
      return res.data;
    } catch (error) {
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