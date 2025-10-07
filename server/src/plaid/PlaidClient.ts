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

  async exchangePublicToken(publicToken: string) {
    const { data } = await this.http.post('/item/public_token/exchange', this.authBody({
      public_token: publicToken,
    }));
    return data as { access_token: string; item_id: string };
  }

  async getAccounts(accessToken: string) {
    const { data } = await this.http.post('/accounts/get', this.authBody({ access_token: accessToken }));
    return data as { accounts: any[]; item: any; request_id: string };
  }

  async getTransactions(accessToken: string, startDate: string, endDate: string) {
    const { data } = await this.http.post('/transactions/get', this.authBody({
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
      options: { count: 100 }
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
}

