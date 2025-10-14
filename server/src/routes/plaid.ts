import { Router } from 'express';
import { PlaidClient } from '../plaid/PlaidClient';
import { addAccountsForItem, createPlaidItem, getItemsWithAccountsForUser, getItemsWithAccessTokens, findItemById, deleteItemAndAccounts, getItemsWithAccessTokensAndNames } from '../db/csvDb';

const router = Router();
const plaid = new PlaidClient();

// Protected routes assumed to have userRecord attached

router.post('/link/token/create', async (req, res, next) => {
  try {
    const user = (req as any).userRecord as { id: string };
    const data = await plaid.createLinkToken({ userId: user.id });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/item/public_token/exchange', async (req, res, next) => {
  try {
    const user = (req as any).userRecord as { id: string };
    const { public_token, institution_name } = req.body as { public_token: string; institution_name?: string };
    const { access_token } = await plaid.exchangePublicToken(public_token);
    const item = await createPlaidItem(user.id, access_token, institution_name);
    res.json({ itemId: item.id });
  } catch (err) {
    next(err);
  }
});

router.get('/accounts', async (req, res, next) => {
  try {
    const user = (req as any).userRecord as { id: string };
    const items = await getItemsWithAccessTokensAndNames(user.id);
    const enriched = await Promise.all(items.map(async (it) => {
      try {
        const statusResp = await plaid.getItem(it.accessToken);
        const hasError = Boolean(statusResp?.item?.error);
        if (hasError) {
          return { id: it.id, institutionName: it.institutionName, accounts: [], hasError };
        }
        const accountsResp = await plaid.getAccounts(it.accessToken);
        const accounts = (accountsResp.accounts || []).map((a: any) => ({
          id: a.account_id,
          plaidAccountId: a.account_id,
          name: a.name || a.official_name || 'Account',
          type: a.type,
          balance: a.balances.current ?? 0,
          available: a.balances.available ?? null,
        }));
        return { id: it.id, institutionName: it.institutionName, accounts, hasError };
      } catch (_e) {
        return { id: it.id, institutionName: it.institutionName, accounts: [], hasError: true };
      }
    }));
    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

router.get('/transactions', async (req, res, next) => {
  try {
    const user = (req as any).userRecord as { id: string };
    const { start, end, account_ids, count, offset, include_pfc, include_original_description } = req.query as {
      start?: string; end?: string; account_ids?: string; count?: string; offset?: string; include_pfc?: string; include_original_description?: string;
    };
    const items = await getItemsWithAccessTokens(user.id);
    const allTxs: any[] = [];
    for (const item of items) {
      if (!start || !end) continue;
      const options: any = {};
      if (account_ids) options.account_ids = account_ids.split(',');
      if (count) options.count = parseInt(count, 10);
      if (offset) options.offset = parseInt(offset, 10);
      if (include_pfc) options.include_personal_finance_category = include_pfc === 'true';
      if (include_original_description) options.include_original_description = include_original_description === 'true';
      try {
        const resp = await plaid.getTransactions(item.accessToken, start, end, options);
        allTxs.push(...resp.transactions);
      } catch (_e) {
        console.error('Error getting transactions for item', item.id, _e);
      }
    }
    res.json({ transactions: allTxs });
  } catch (err) {
    next(err);
  }
});

router.get('/summary', async (req, res, next) => {
  try {
    const user = (req as any).userRecord as { id: string };
    const items = await getItemsWithAccessTokens(user.id);

    const now = new Date();
    const thisStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const thisEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    const lastStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
    const lastStart = lastStartDate.toISOString().slice(0, 10);
    const lastEnd = lastEndDate.toISOString().slice(0, 10);

    const sums = { thisIn: 0, thisOut: 0, lastIn: 0, lastOut: 0 } as { thisIn: number; thisOut: number; lastIn: number; lastOut: number };

    for (const item of items) {
      try {
        const thisResp = await plaid.getTransactions(item.accessToken, thisStart, thisEnd);
        for (const t of thisResp.transactions || []) {
          if (t.amount < 0) sums.thisIn += Math.abs(t.amount); else sums.thisOut += t.amount;
        }
      } catch (_e) {
        // ignore item errors for this aggregation
      }
      try {
        const lastResp = await plaid.getTransactions(item.accessToken, lastStart, lastEnd);
        for (const t of lastResp.transactions || []) {
          if (t.amount < 0) sums.lastIn += Math.abs(t.amount); else sums.lastOut += t.amount;
        }
      } catch (_e) {
        // ignore item errors for this aggregation
      }
    }

    res.json(sums);
  } catch (err) {
    next(err);
  }
});

// Note: webhook route should be mounted unprotected in server index, not here

router.post('/item/:itemId/unlink', async (req, res, next) => {
  try {
    const user = (req as any).userRecord as { id: string };
    const { itemId } = req.params as { itemId: string };
    const item = await findItemById(itemId);
    if (!item || item.userId !== user.id) {
      return res.status(404).json({ error: 'Item not found' });
    }
    // Remove at Plaid first
    await plaid.removeItem(item.accessToken);
    // Remove locally
    await deleteItemAndAccounts(itemId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/link/token/create/update', async (req, res, next) => {
  try {
    const user = (req as any).userRecord as { id: string };
    const { itemId } = req.body as { itemId: string };
    const item = await findItemById(itemId);
    if (!item || item.userId !== user.id) {
      return res.status(404).json({ error: 'Item not found' });
    }
    const data = await plaid.createUpdateModeLinkToken({ userId: user.id, accessToken: item.accessToken });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/item/:itemId/trigger-error', async (req, res, next) => {
  try {
    const user = (req as any).userRecord as { id: string };
    const { itemId } = req.params as { itemId: string };
    const item = await findItemById(itemId);
    if (!item || item.userId !== user.id) {
      return res.status(404).json({ error: 'Item not found' });
    }
    // Sandbox: force ITEM_LOGIN_REQUIRED error state
    await plaid.sandboxResetLogin(item.accessToken);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;

