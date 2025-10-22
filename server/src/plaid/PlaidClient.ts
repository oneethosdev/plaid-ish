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
    // WORKSHOP TODO (Step 1: Initializing Link Session)
    // Goal: Create a Link Token for the current user and return it to the client
    // Steps:
    // 1) Build request body per Plaid docs with at minimum:
    //    user.client_user_id, client_name, products, country_codes, language, optional webhook
    // 2) POST to /link/token/create with client_id and secret
    // 3) Return { link_token, expiration }
    // Docs:
    // - Creating Link Token: https://plaid.com/docs/link/token-flow/#create-link-token
    // - API Reference: https://plaid.com/docs/api/tokens/#linktokencreate
    // Tip: Use this.http.post('/link/token/create', this.authBody(body))
    throw new Error('WORKSHOP_TODO: Implement createLinkToken() per Plaid docs');
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
    // WORKSHOP TODO (Step 2: Exchanging Public Token)
    // Goal: Exchange the public_token returned from Link for a permanent access_token
    // Steps:
    // 1) Build body with public_token
    // 2) POST to /item/public_token/exchange with client_id and secret
    // 3) Return { access_token, item_id }
    // Docs: https://plaid.com/docs/api/tokens/#itempublic_tokenexchange
    throw new Error('WORKSHOP_TODO: Implement exchangePublicToken() per Plaid docs');
  }

  async getAccounts(accessToken: string, options?: { account_ids?: string[] }) {
    // WORKSHOP TODO (Step 3: Fetching Plaid Data)
    // Goal: Retrieve accounts for a user's Item using the access_token
    // Steps:
    // 1) Build body with access_token and optional options.account_ids
    // 2) POST to /accounts/get
    // 3) Return the accounts list
    // Docs: https://plaid.com/docs/api/accounts/#accountsget
    throw new Error('WORKSHOP_TODO: Implement getAccounts() per Plaid docs');
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
    // WORKSHOP TODO (Step 3: Fetching Plaid Data)
    // Goal: Retrieve transactions for a date range and optional filters
    // Steps:
    // 1) Build body with access_token, start_date, end_date, and optional options
    // 2) POST to /transactions/get
    // 3) Return transactions data
    // Docs: https://plaid.com/docs/api/products/transactions/#transactionsget
    throw new Error('WORKSHOP_TODO: Implement getTransactions() per Plaid docs');
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
    // WORKSHOP TODO (Step 3 helper)
    // Goal: Retrieve Item status (useful to detect login_required or other errors)
    // Steps:
    // 1) POST to /item/get with access_token
    // Docs: https://plaid.com/docs/api/items/#itemget
    throw new Error('WORKSHOP_TODO: Implement getItem() per Plaid docs');
  }

  async sandboxResetLogin(accessToken: string) {
    const { data } = await this.http.post('/sandbox/item/reset_login', this.authBody({
      access_token: accessToken,
    }));
    return data as { request_id: string };
  }
}

