import { Router } from 'express';
import { PlaidClient } from '../plaid/PlaidClient';
import { addAccountsForItem, createPlaidItem, getItemsWithAccountsForUser, getItemsWithAccessTokens, findItemById, deleteItemAndAccounts } from '../db/csvDb';

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
    // Fetch and store accounts
    const accountsResp = await plaid.getAccounts(access_token);
    await addAccountsForItem(item.id, accountsResp.accounts);
    res.json({ itemId: item.id });
  } catch (err) {
    next(err);
  }
});

router.get('/accounts', async (req, res, next) => {
  try {
    const user = (req as any).userRecord as { id: string };
    const items = await getItemsWithAccountsForUser(user.id);
    res.json(items);
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
      const resp = await plaid.getTransactions(item.accessToken, start, end, options);
      allTxs.push(...resp.transactions);
    }
    res.json({ transactions: allTxs });
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

export default router;

