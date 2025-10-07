import { Router } from 'express';
import { PlaidClient } from '../plaid/PlaidClient';
import { addAccountsForItem, createPlaidItem, getItemsWithAccountsForUser } from '../db/csvDb';

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
    const { start, end } = req.query as { start?: string; end?: string };
    const items = await getItemsWithAccountsForUser(user.id);
    const allTxs: any[] = [];
    for (const item of items) {
      // We don't store transactions; fetch from Plaid and map accounts by plaidAccountId
      // Need access token; since not stored here, we need to load it—extend getItemsWithAccountsForUser if needed.
      // For simplicity in CSV mode, skip transactions fetch when no access token available.
      // This route will be supplemented as needed in the workshop.
      continue;
    }
    res.json({ transactions: allTxs });
  } catch (err) {
    next(err);
  }
});

// Note: webhook route should be mounted unprotected in server index, not here

export default router;

