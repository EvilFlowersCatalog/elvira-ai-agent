import axios from 'axios';

class ElviraClient {
  private baseUrl: string;
  private apiKey: string;
  private catalogId: string;

  constructor() {
    this.baseUrl = process.env.ELVIRA_BASE_URL || '';
    this.apiKey = process.env.ELVIRA_API_KEY || '';
    this.catalogId = process.env.ELVIRA_CATALOG_ID || '';
    if (!this.baseUrl || !this.apiKey || !this.catalogId) {
      throw new Error('Missing ELVIRA_BASE_URL, ELVIRA_API_KEY, or ELVIRA_CATALOG_ID in environment variables');
    }
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

export const elviraClient = new ElviraClient();