import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import axios from 'axios';

declare global {
  interface Window {
    Plaid?: {
      create: (options: {
        token: string;
        onSuccess: (public_token: string, metadata: { institution?: { name?: string } }) => void;
        onExit?: () => void;
      }) => { open: () => void };
    };
  }
}

type ItemWithAccounts = {
  id: string;
  institutionName?: string | null;
  accounts: Array<{
    id: string;
    plaidAccountId?: string;
    name: string;
    type: string;
    balance: number;
    available?: number | null;
  }>;
};

type Tx = {
  account_id: string;
  name: string;
  amount: number;
  date: string;
  pending?: boolean;
  logo_url?: string;
};

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL as string });

export default function Dashboard() {
  const { getAccessTokenSilently, user } = useAuth0();
  const [items, setItems] = useState<ItemWithAccounts[]>([]);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const PAGE_SIZE = 10;

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [queryText, setQueryText] = useState<string>('');
  const [pendingOnly, setPendingOnly] = useState<boolean>(false);
  const [flow, setFlow] = useState<'all' | 'credits' | 'debits'>('all');

  const authGet = useCallback(async (url: string) => {
    const token = await getAccessTokenSilently();
    return api.get(url, { headers: { Authorization: `Bearer ${token}` } });
  }, [getAccessTokenSilently]);

  const authPost = useCallback(async (url: string, body?: any) => {
    const token = await getAccessTokenSilently();
    return api.post(url, body, { headers: { Authorization: `Bearer ${token}` } });
  }, [getAccessTokenSilently]);

  const refresh = useCallback(async (opts?: { start?: string; end?: string; accountId?: string }) => {
    const itemsResp = await authGet('/plaid/accounts');
    setItems(itemsResp.data);
    const now = new Date();
    const defaultEnd = now.toISOString().slice(0, 10);
    const startDateObj = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const defaultStart = startDateObj.toISOString().slice(0, 10);
    const s = opts?.start || startDate || defaultStart;
    const e = opts?.end || endDate || defaultEnd;
    const id = opts?.accountId ?? selectedAccountId;
    const params = new URLSearchParams({ start: s, end: e });
    if (id) params.set('account_ids', id);
    const txResp = await authGet(`/plaid/transactions?${params.toString()}`);
    setTransactions(txResp.data.transactions || []);
    setStartDate(s);
    setEndDate(e);
  }, [authGet, startDate, endDate, selectedAccountId]);


  const resetFilters = useCallback(() => {
    setSelectedAccountId('');
    setStartDate('');
    setEndDate('');
    setQueryText('');
    setPendingOnly(false);
    setFlow('all');
  }, []);

  const createLink = useCallback(async () => {
    const token = await getAccessTokenSilently();
    const { data } = await api.post('/plaid/link/token/create', {}, { headers: { Authorization: `Bearer ${token}` } });
    const linkToken = data.link_token as string;

    // Ensure Plaid script is loaded
    const win = window as any;
    if (!win.Plaid || !win.Plaid.create) {
      alert('Plaid Link failed to load');
      return;
    }

    const handler = win.Plaid.create({
      token: linkToken,
      onSuccess: async (public_token: string, metadata: { institution?: { name?: string } }) => {
        const institution_name = metadata?.institution?.name;
        await authPost('/plaid/item/public_token/exchange', { public_token, institution_name });
        await refresh();
      },
      onExit: () => {},
    });
    handler.open();
  }, [authPost, getAccessTokenSilently, refresh]);

  const unlinkItem = useCallback(async (itemId: string) => {
    const ok = window.confirm('Are you sure you want to unlink this institution? This will remove all its accounts.');
    if (!ok) return;
    await authPost(`/plaid/item/${itemId}/unlink`);
    await refresh();
  }, [authPost, refresh]);

  const relinkItem = useCallback(async (itemId: string) => {
    const { data } = await authPost('/plaid/link/token/create/update', { itemId });
    const linkToken = (data as any).link_token as string;

    const win = window as any;
    if (!win.Plaid || !win.Plaid.create) {
      alert('Plaid Link failed to load');
      return;
    }

    const handler = win.Plaid.create({
      token: linkToken,
      onSuccess: async () => {
        await refresh();
      },
      onExit: () => {},
    });
    handler.open();
  }, [authPost, refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setCurrentPage(1);
  }, [transactions]);

  const monthSums = useMemo(() => {
    const thisMonth = new Date().toISOString().slice(0, 7);
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastMonth = lastMonthDate.toISOString().slice(0, 7);
    const sums = { thisIn: 0, thisOut: 0, lastIn: 0, lastOut: 0 };
    for (const t of transactions) {
      const month = t.date.slice(0, 7);
      if (month === thisMonth) {
        if (t.amount < 0) sums.thisIn += Math.abs(t.amount); else sums.thisOut += t.amount;
      } else if (month === lastMonth) {
        if (t.amount < 0) sums.lastIn += Math.abs(t.amount); else sums.lastOut += t.amount;
      }
    }
    return sums;
  }, [transactions]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const displayName = useMemo(() => {
    return (user?.given_name as string) || (user?.name as string) || 'there';
  }, [user]);

  const totalAccounts = useMemo(() => {
    return items.reduce((sum, it) => sum + it.accounts.length, 0);
  }, [items]);

  const computeAccountSignedBalance = useCallback((type: string, balance: number) => {
    const t = type.toLowerCase();
    // Treat liabilities (credit, loan) as negative, depository/investment as positive
    if (t.includes('credit') || t.includes('loan') || t.includes('liability')) return -Math.abs(balance);
    return balance;
  }, []);

  const totalBalanceAllInstitutions = useMemo(() => {
    let sum = 0;
    for (const it of items) {
      for (const a of it.accounts) {
        sum += computeAccountSignedBalance(a.type, Number(a.balance) || 0);
      }
    }
    return sum;
  }, [items, computeAccountSignedBalance]);

  const filteredTransactions = useMemo(() => {
    let list = transactions;
    if (queryText.trim()) {
      const q = queryText.trim().toLowerCase();
      list = list.filter(t => t.name.toLowerCase().includes(q));
    }
    if (pendingOnly) {
      list = list.filter(t => t.pending);
    }
    if (flow === 'credits') list = list.filter(t => t.amount < 0);
    if (flow === 'debits') list = list.filter(t => t.amount > 0);
    if (selectedAccountId) list = list.filter(t => t.account_id === selectedAccountId);
    return list;
  }, [transactions, queryText, pendingOnly, flow, selectedAccountId]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  }, [filteredTransactions.length]);

  const visibleTransactions = useMemo(() => {
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    return filteredTransactions.slice(startIdx, startIdx + PAGE_SIZE);
  }, [filteredTransactions, currentPage]);

  const pageNumbers = useMemo(() => {
    const pages: Array<number | string> = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    if (currentPage <= 4) {
      pages.push(1, 2, 3, 4, 5, '...', totalPages);
      return pages;
    }
    if (currentPage >= totalPages - 3) {
      pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      return pages;
    }
    pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
    return pages;
  }, [totalPages, currentPage]);

  return (
    <div className="space-y-6">
      {/** Greeting Header */}
      <div className="flex items-center justify-between">
        <div className="text-xl font-medium">{greeting}, {displayName}</div>
      </div>

      {/** Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4 md:col-span-1">
          <div className="font-medium mb-2 text-primary-700">Total Balance</div>
          <div className={`text-2xl font-semibold ${totalBalanceAllInstitutions >= 0 ? 'text-primary-700' : 'text-red-600'}`}>
            ${Math.abs(totalBalanceAllInstitutions).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="card p-4 md:col-span-1">
          <div className="font-medium mb-2 text-primary-700">This Month’s Breakdown</div>
          <div>Money In: ${monthSums.thisIn.toFixed(2)}</div>
          <div>Money Out: ${monthSums.thisOut.toFixed(2)}</div>
        </div>
        <div className="card p-4 md:col-span-1">
          <div className="font-medium mb-2 text-primary-700">Last Month’s Breakdown</div>
          <div>Money In: ${monthSums.lastIn.toFixed(2)}</div>
          <div>Money Out: ${monthSums.lastOut.toFixed(2)}</div>
        </div>
      </div>

      {/** Accounts List */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium text-primary-700">Accounts</div>
          <button className="px-3 py-2 btn-primary" onClick={createLink}>Link More Accounts</button>
        </div>
        {totalAccounts === 0 ? (
          <div className="text-sm text-gray-600">No accounts to display.</div>
        ) : (
          items.map((it) => (
            <div key={it.id} className="mb-4">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                <div>
                  {(() => {
                    const instTotal = it.accounts.reduce((acc, a) => acc + computeAccountSignedBalance(a.type, Number(a.balance) || 0), 0);
                    const formatted = `${instTotal < 0 ? '-' : ''}$${Math.abs(instTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    return `${it.institutionName || 'Institution'} - ${formatted}`;
                  })()}
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-2 py-1 text-xs border rounded text-gray-700 hover:bg-gray-50" onClick={() => unlinkItem(it.id)}>Unlink</button>
                  <button className="px-2 py-1 text-xs btn-primary" onClick={() => relinkItem(it.id)}>Relink</button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {it.accounts.map((a) => {
                  const signed = computeAccountSignedBalance(a.type, Number(a.balance) || 0);
                  const isNegative = signed < 0;
                  return (
                    <div
                      key={a.id}
                      className={`card p-4 transition ${isNegative ? 'border-red-300 bg-red-50 hover:border-red-400 hover:bg-red-50' : 'border-primary-200 hover:border-primary-300 hover:bg-primary-50'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium">{a.name}</div>
                          <div className="mt-1 badge-primary inline-block">{a.type}</div>
                        </div>
                        <div className="text-right">
                          <div className={`font-semibold ${isNegative ? 'text-red-600' : 'text-primary-700'}`}>
                            {isNegative ? '-' : ''}${Math.abs(signed).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          {a.available !== undefined && a.available !== null && (
                            <div className="text-xs text-gray-500">Avail: ${Number(a.available || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/** Recent Transactions */}
      <div className="card p-4">
        <div className="font-medium mb-2 text-primary-700">Recent Transactions</div>
        <div className="mb-3 grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Start</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">End</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Accounts</label>
            <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} className="w-full border rounded px-2 py-1 h-[34px]">
              <option value="">All accounts</option>
              {items.flatMap(i => i.accounts).map(a => (
                <option key={a.id} value={a.plaidAccountId || ''}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Search text</label>
            <input type="text" value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder="Contains..." className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Credits vs Debits</label>
            <select value={flow} onChange={(e) => setFlow(e.target.value as any)} className="w-full border rounded px-2 py-1">
              <option value="all">All</option>
              <option value="credits">Credits (money in)</option>
              <option value="debits">Debits (money out)</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-gray-700">
              <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} />
              Pending only
            </label>
            <button className="ml-auto px-3 py-2 btn-primary" onClick={() => {
              setCurrentPage(1);
              refresh({ start: startDate, end: endDate, accountId: selectedAccountId });
            }}>Apply</button>
            <button className="px-3 py-1 text-xs border rounded text-gray-600 hover:bg-gray-50" onClick={() => {
              resetFilters();
            }}>Reset</button>
          </div>
        </div>
        {transactions.length === 0 ? (
          <div className="text-sm text-gray-600">No transactions to display.</div>
        ) : (
          <>
            <div className="space-y-2">
              {visibleTransactions.map((t, idx) => (
                <div key={`${currentPage}-${idx}`} className="flex justify-between border-b py-2 hover:bg-primary-100 px-2">
                  <div className="flex flex-row gap-2 items-center">
                    <div className="text-xs text-gray-600">{t.date}</div>
                    {t.logo_url ? (
                      <img src={t.logo_url} alt={t.name} className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                    )}
                    <div className="text-sm font-medium">{t.name}</div>
                  </div>
                  <div className={t.amount < 0 ? 'text-green-600' : 'text-red-600'}>
                    {t.amount < 0 ? '+' : '-'}${Math.abs(t.amount).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button
                className="px-3 py-1 border rounded disabled:opacity-50"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
              >
                ←
              </button>

              <div className="flex items-center gap-1">
                {pageNumbers.map((p, i) => (
                  typeof p === 'number' ? (
                    <button
                      key={`p-${p}-${i}`}
                      className={`px-2 py-1 rounded ${p === currentPage ? 'bg-black text-white' : 'border'}`}
                      onClick={() => setCurrentPage(p)}
                    >
                      {p}
                    </button>
                  ) : (
                    <span key={`el-${i}`} className="px-2 text-gray-500">{p}</span>
                  )
                ))}
              </div>

              <button
                className="px-3 py-1 border rounded disabled:opacity-50"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                aria-label="Next page"
              >
                →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

