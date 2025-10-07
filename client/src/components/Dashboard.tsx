import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import axios from 'axios';

type ItemWithAccounts = {
  id: string;
  institutionName?: string | null;
  accounts: Array<{
    id: string;
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
};

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL as string });

export default function Dashboard() {
  const { getAccessTokenSilently } = useAuth0();
  const [items, setItems] = useState<ItemWithAccounts[]>([]);
  const [transactions, setTransactions] = useState<Tx[]>([]);

  const authGet = useCallback(async (url: string) => {
    const token = await getAccessTokenSilently();
    return api.get(url, { headers: { Authorization: `Bearer ${token}` } });
  }, [getAccessTokenSilently]);

  const authPost = useCallback(async (url: string, body?: any) => {
    const token = await getAccessTokenSilently();
    return api.post(url, body, { headers: { Authorization: `Bearer ${token}` } });
  }, [getAccessTokenSilently]);

  const createLink = useCallback(async () => {
    alert('Use the Plaid Link sandbox widget. If not loaded, populate public_token manually via backend during the workshop.');
  }, [authPost]);

  const refresh = useCallback(async () => {
    const itemsResp = await authGet('/plaid/accounts');
    setItems(itemsResp.data);
    const now = new Date();
    const end = now.toISOString().slice(0, 10);
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const start = startDate.toISOString().slice(0, 10);
    const txResp = await authGet(`/plaid/transactions?start=${start}&end=${end}`);
    setTransactions(txResp.data.transactions || []);
  }, [authGet]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-xl font-medium">Good day</div>
        <button className="px-3 py-2 bg-black text-white rounded" onClick={createLink}>Connect Bank</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded p-4">
          <div className="font-medium mb-2">This Month’s Breakdown</div>
          <div>Money In: ${monthSums.thisIn.toFixed(2)}</div>
          <div>Money Out: ${monthSums.thisOut.toFixed(2)}</div>
        </div>
        <div className="border rounded p-4">
          <div className="font-medium mb-2">Last Month’s Breakdown</div>
          <div>Money In: ${monthSums.lastIn.toFixed(2)}</div>
          <div>Money Out: ${monthSums.lastOut.toFixed(2)}</div>
        </div>
      </div>

      <div className="border rounded p-4">
        <div className="font-medium mb-2">Accounts</div>
        {items.map((it) => (
          <div key={it.id} className="mb-4">
            <div className="text-sm text-gray-600">{it.institutionName || 'Institution'}</div>
            {it.accounts.map((a) => (
              <div key={a.id} className="flex justify-between border-b py-2">
                <div>
                  <div className="font-medium">{a.name}</div>
                  <div className="text-sm text-gray-600">{a.type}</div>
                </div>
                <div className="font-semibold">${a.balance.toFixed(2)}</div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="border rounded p-4">
        <div className="font-medium mb-2">Recent Transactions</div>
        <div className="space-y-2">
          {transactions.slice(0, 15).map((t, idx) => (
            <div key={idx} className="flex justify-between border-b py-2">
              <div>{t.name}</div>
              <div className={t.amount < 0 ? 'text-green-600' : 'text-red-600'}>
                {t.amount < 0 ? '+' : '-'}${Math.abs(t.amount).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

