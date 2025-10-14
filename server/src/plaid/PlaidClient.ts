import axios, { AxiosInstance } from 'axios';
import { env } from '../env';

type CreateLinkTokenParams = { userId: string };

export class PlaidClient {
  private http: AxiosInstance;
  private clientId: string;
  private secret: string;

  constructor() {
    this.clientId = env.plaid.clientId;
    this.secret = env.plaid.secret;
    this.http = axios.create({ baseURL: env.plaid.baseUrl, timeout: 15000 });
  }

  private authBody<T extends Record<string, any>>(body: T): T & { client_id: string; secret: string } {
    return { ...body, client_id: this.clientId, secret: this.secret };
  }

  async createLinkToken({ userId }: CreateLinkTokenParams) {
    const { data } = await this.http.post('/link/token/create', this.authBody({
      user: { client_user_id: userId },
      client_name: 'Plaid-ish',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
      webhook: env.plaid.webhookUrl,
    }));
    return data as { link_token: string; expiration: string };
  }

  async createUpdateModeLinkToken({ userId, accessToken }: { userId: string; accessToken: string }) {
    const { data } = await this.http.post('/link/token/create', this.authBody({
      user: { client_user_id: userId },
      client_name: 'Plaid-ish',
      country_codes: ['US'],
      language: 'en',
      webhook: env.plaid.webhookUrl,
      access_token: accessToken,
    }));
    return data as { link_token: string; expiration: string };
  }

  async exchangePublicToken(publicToken: string) {
    const { data } = await this.http.post('/item/public_token/exchange', this.authBody({
      public_token: publicToken,
    }));
    return data as { access_token: string; item_id: string };
  }

  async getAccounts(accessToken: string, options?: { account_ids?: string[] }) {
    const { data } = await this.http.post('/accounts/get', this.authBody({
      access_token: accessToken,
      options: options || undefined,
    }));
    return data as { accounts: any[]; item: any; request_id: string };
  }

  async getTransactions(
    accessToken: string,
    startDate: string,
    endDate: string,
    options?: {
      account_ids?: string[];
      count?: number;
      offset?: number;
      include_personal_finance_category?: boolean;
      include_original_description?: boolean;
    }
  ) {
    const { data } = await this.http.post('/transactions/get', this.authBody({
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
      options: options || undefined,
    }));
    return data as { transactions: any[]; accounts: any[]; total_transactions: number };
  }

  async syncTransactions(accessToken: string, cursor?: string) {
    const { data } = await this.http.post('/transactions/sync', this.authBody({
      access_token: accessToken,
      cursor,
      count: 100
    }));
    return data as {
      added: any[];
      modified: any[];
      removed: any[];
      next_cursor: string;
      has_more: boolean;
    };
  }

  async removeItem(accessToken: string) {
    const { data } = await this.http.post('/item/remove', this.authBody({
      access_token: accessToken,
    }));
    return data as { removed: boolean; request_id: string };
  }

  async invalidateAccessToken(accessToken: string) {
    const { data } = await this.http.post('/item/access_token/invalidate', this.authBody({
      access_token: accessToken,
    }));
    return data as { new_access_token: string; request_id: string };
  }

  async getItem(accessToken: string) {
    const { data } = await this.http.post('/item/get', this.authBody({
      access_token: accessToken,
    }));
    return data as { item: any; status?: any };
  }

  async sandboxResetLogin(accessToken: string) {
    const { data } = await this.http.post('/sandbox/item/reset_login', this.authBody({
      access_token: accessToken,
    }));
    return data as { request_id: string };
  }
}

