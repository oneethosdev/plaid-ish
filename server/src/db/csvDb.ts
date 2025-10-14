import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

type Row = Record<string, any>;

const DB_DIR = path.resolve(__dirname, '../../DB');

const FILES = {
  users: { name: 'users.csv', headers: ['id', 'auth0Sub', 'firstName', 'email'] },
  items: { name: 'plaid_items.csv', headers: ['id', 'userId', 'accessToken', 'institutionName', 'transactionsCursor'] },
  accounts: { name: 'accounts.csv', headers: ['id', 'itemId', 'plaidAccountId', 'name', 'type', 'balance', 'available'] },
  transactions: { name: 'transactions.csv', headers: ['id', 'accountId', 'name', 'amount', 'date', 'category', 'pending'] },
  webhookLogs: { name: 'webhook_logs.csv', headers: ['id', 'type', 'body', 'timestamp'] },
};

function getFilePath(key: keyof typeof FILES): string {
  return path.join(DB_DIR, FILES[key].name);
}

function csvEscape(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      values.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  values.push(cur);
  return values;
}

async function ensureFile(key: keyof typeof FILES): Promise<void> {
  await fsp.mkdir(DB_DIR, { recursive: true });
  const filePath = getFilePath(key);
  if (!fs.existsSync(filePath)) {
    const header = FILES[key].headers.join(',') + '\n';
    await fsp.writeFile(filePath, header, 'utf8');
  }
}

async function readAll(key: keyof typeof FILES): Promise<Row[]> {
  const filePath = getFilePath(key);
  if (!fs.existsSync(filePath)) return [];
  const text = await fsp.readFile(filePath, 'utf8');
  const lines = text.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];
  const headers = FILES[key].headers;
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCsvLine(lines[i]);
    const row: Row = {};
    headers.forEach((h, idx) => {
      row[h] = parts[idx] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

async function appendRow(key: keyof typeof FILES, row: Row): Promise<void> {
  await ensureFile(key);
  const headers = FILES[key].headers;
  const line = headers.map(h => csvEscape(row[h])).join(',') + '\n';
  await fsp.appendFile(getFilePath(key), line, 'utf8');
}

async function writeAll(key: keyof typeof FILES, rows: Row[]): Promise<void> {
  await ensureFile(key);
  const headers = FILES[key].headers;
  const content = [headers.join(',')].concat(
    rows.map(r => headers.map(h => csvEscape(r[h])).join(','))
  ).join('\n') + '\n';
  await fsp.writeFile(getFilePath(key), content, 'utf8');
}

function uuid(): string {
  return (global as any).crypto?.randomUUID?.() || require('crypto').randomUUID();
}

export async function initDb(): Promise<void> {
  await Promise.all(Object.keys(FILES).map(k => ensureFile(k as keyof typeof FILES)));
}

export type UserRow = { id: string; auth0Sub: string; firstName?: string; email?: string };
export async function findOrCreateUserBySub(auth0Sub: string): Promise<UserRow> {
  const users = await readAll('users');
  const found = users.find(u => u.auth0Sub === auth0Sub);
  if (found) return found as UserRow;
  const newUser: UserRow = { id: uuid(), auth0Sub, firstName: '', email: '' };
  await appendRow('users', newUser);
  return newUser;
}

export type PlaidItemRow = { id: string; userId: string; accessToken: string; institutionName?: string; transactionsCursor?: string };
export async function createPlaidItem(userId: string, accessToken: string, institutionName?: string): Promise<PlaidItemRow> {
  const item: PlaidItemRow = { id: uuid(), userId, accessToken, institutionName: institutionName || '', transactionsCursor: '' };
  await appendRow('items', item);
  return item;
}

export type AccountRow = { id: string; itemId: string; plaidAccountId: string; name: string; type: string; balance: number; available?: number | '' };
export async function addAccountsForItem(itemId: string, accounts: Array<{ account_id: string; name?: string; official_name?: string; type: string; balances: { current?: number; available?: number } }>): Promise<void> {
  const existing = await readAll('accounts');
  const toAdd: Row[] = [];
  for (const a of accounts) {
    if (existing.some(e => e.plaidAccountId === a.account_id)) continue;
    toAdd.push({
      id: uuid(),
      itemId,
      plaidAccountId: a.account_id,
      name: a.name || a.official_name || 'Account',
      type: a.type,
      balance: a.balances.current ?? 0,
      available: a.balances.available ?? '',
    });
  }
  if (toAdd.length) {
    const rows = existing.concat(toAdd);
    await writeAll('accounts', rows);
  }
}

export async function getItemsWithAccountsForUser(userId: string): Promise<Array<{ id: string; institutionName?: string; accounts: AccountRow[] }>> {
  const items = await readAll('items');
  const accounts = await readAll('accounts');
  const userItems = items.filter(i => i.userId === userId);
  return userItems.map(i => ({
    id: i.id,
    institutionName: i.institutionName,
    accounts: accounts.filter(a => a.itemId === i.id) as AccountRow[],
  }));
}

export async function getItemsWithAccessTokens(userId: string): Promise<Array<{ id: string; accessToken: string }>> {
  const items = await readAll('items');
  return (items.filter(i => i.userId === userId) as Array<{ id: string; accessToken: string }>);
}

export async function appendWebhookLog(type: string, body: any): Promise<void> {
  await appendRow('webhookLogs', { id: uuid(), type, body: JSON.stringify(body), timestamp: new Date().toISOString() });
}

export async function findItemById(itemId: string): Promise<PlaidItemRow | undefined> {
  const items = await readAll('items');
  return items.find(i => i.id === itemId) as PlaidItemRow | undefined;
}

export async function deleteItemAndAccounts(itemId: string): Promise<void> {
  const [items, accounts, transactions] = await Promise.all([
    readAll('items'),
    readAll('accounts'),
    readAll('transactions'),
  ]);

  const remainingItems = items.filter(i => i.id !== itemId);
  const accountsToDelete = (accounts.filter(a => a.itemId === itemId) as AccountRow[]).map(a => a.id);
  const remainingAccounts = accounts.filter(a => a.itemId !== itemId);
  const remainingTransactions = transactions.filter(t => !accountsToDelete.includes(t.accountId));

  await Promise.all([
    writeAll('items', remainingItems),
    writeAll('accounts', remainingAccounts),
    writeAll('transactions', remainingTransactions),
  ]);
}

