import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

class ElviraClient {
  private baseUrl: string;
  private apiKey: string;
  private catalogId: string;

  constructor(apiKey: string) {
    this.baseUrl = process.env.ELVIRA_BASE_URL || '';
    this.catalogId = process.env.ELVIRA_CATALOG_ID || '';
    this.apiKey = apiKey;
    if (!this.baseUrl || !this.catalogId) {
      throw new Error('Missing ELVIRA_BASE_URL, or ELVIRA_CATALOG_ID in environment variables');
    }
  }

  validateApiKey(providedKey: string): boolean {
    return this.apiKey === providedKey;
  }

  async getEntries(page = 1, limit = 25, pagination = true) {
    const url = `${this.baseUrl}/api/v1/entries`;
    const res = await axios.get(url, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
      params: {
        catalog_id: this.catalogId,
        page,
        limit,
        pagination
      }
    });
    return res.data;
  }

  async getEntryDetail(entryId: string) {
    const url = `${this.baseUrl}/catalogs/${this.catalogId}/entries/${entryId}`;
    const res = await axios.get(url, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    });
    return res.data;
  }
}

export { ElviraClient };