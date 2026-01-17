import { PacificaResponse } from './types.js';
import { RateLimiter } from './rate-limiter.js';

const BASE_URL = 'https://api.pacifica.fi/api/v1';
const MAX_RETRIES = 3;

export class PacificaFetcher {
  private rateLimiter: RateLimiter;
  private silent: boolean;

  constructor(silent: boolean = false) {
    this.rateLimiter = new RateLimiter();
    this.silent = silent;
  }

  async fetchAllPages<T>(
    endpoint: string,
    params: Record<string, string>
  ): Promise<T[]> {
    let cursor: string | undefined = undefined;
    let allData: T[] = [];
    let pageCount = 0;

    do {
      await this.rateLimiter.waitIfNeeded();

      const queryParams = { ...params };
      if (cursor) {
        queryParams.cursor = cursor;
      }

      const url = this.buildUrl(endpoint, queryParams);
      const response = await this.fetchWithRetry<T>(url);

      if (!response.success) {
        throw new Error(`API Error: ${response.error || 'Unknown error'}`);
      }

      allData.push(...response.data);
      pageCount++;

      if (!this.silent) {
        console.log(`  Page ${pageCount}: ${response.data.length} records`);
      }

      cursor = response.next_cursor;
    } while (cursor && cursor !== '');

    return allData;
  }

  private async fetchWithRetry<T>(
    url: string,
    attempt: number = 1
  ): Promise<PacificaResponse<T>> {
    try {
      const headers: Record<string, string> = {
        'Accept': '*/*',
      };

      const response = await fetch(url, { headers });

      if (response.status === 429) {
        const waitTime = Math.pow(2, attempt) * 1000;
        if (!this.silent) {
          console.warn(`  Rate limited (429). Waiting ${waitTime}ms... (Attempt ${attempt}/${MAX_RETRIES})`);
        }
        await this.sleep(waitTime);

        if (attempt < MAX_RETRIES) {
          return this.fetchWithRetry<T>(url, attempt + 1);
        }
        throw new Error('Rate limit exceeded after max retries');
      }

      if (response.status >= 500) {
        if (!this.silent) {
          console.warn(`  Server error (${response.status}). Retry ${attempt}/${MAX_RETRIES}`);
        }
        await this.sleep(1000 * attempt);

        if (attempt < MAX_RETRIES) {
          return this.fetchWithRetry<T>(url, attempt + 1);
        }
        throw new Error(`Server error ${response.status} after max retries`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json() as PacificaResponse<T>;
      return data;
    } catch (error) {
      if (attempt < MAX_RETRIES && error instanceof Error && error.message.includes('fetch')) {
        if (!this.silent) {
          console.warn(`  Network error. Retry ${attempt}/${MAX_RETRIES}`);
        }
        await this.sleep(1000 * attempt);
        return this.fetchWithRetry<T>(url, attempt + 1);
      }
      throw error;
    }
  }

  private buildUrl(endpoint: string, params: Record<string, string>): string {
    const queryString = Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== '')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');

    return `${BASE_URL}${endpoint}${queryString ? '?' + queryString : ''}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }
}
