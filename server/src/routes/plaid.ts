import { Router } from 'express';
import { PlaidClient } from '../plaid/PlaidClient';
import { addAccountsForItem, createPlaidItem, getItemsWithAccountsForUser, getItemsWithAccessTokens, findItemById, deleteItemAndAccounts, getItemsWithAccessTokensAndNames } from '../db/csvDb';

const router = Router();
const plaid = new PlaidClient();

// Protected routes assumed to have userRecord attached

router.post('/link/token/create', async (req, res, next) => {
  try {
    // WORKSHOP TODO (Step 1: Initializing Link Session)
    // Replace this 501 response by implementing:
    // 1) Read the authenticated user id from req.userRecord
    // 2) Call plaid.createLinkToken({ userId }) which should POST to /link/token/create
    // 3) Return the link token payload to the client
    // Docs:
    // - Link token flow overview: https://plaid.com/docs/link/token-flow/
    // - API reference: https://plaid.com/docs/api/tokens/#linktokencreate
    return res.status(501).json({
      error: 'WORKSHOP_TODO',
      message: 'Implement /plaid/link/token/create to return a Plaid Link token. See server comments.'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/item/public_token/exchange', async (req, res, next) => {
  try {
    // WORKSHOP TODO (Step 2: Exchanging Public Token)
    // Replace this 501 response by implementing:
    // 1) Read the public_token (and optional institution_name) from req.body
    // 2) Call plaid.exchangePublicToken(public_token) to get { access_token, item_id }
    // 3) Persist the access_token for this user using createPlaidItem(userId, access_token, institution_name)
    // 4) Return a success payload
    // Docs: https://plaid.com/docs/api/tokens/#itempublic_tokenexchange
    return res.status(501).json({
      error: 'WORKSHOP_TODO',
      message: 'Implement public_token exchange and save access_token.'
    });
  } catch (err) {
    next(err);
  }
});

router.get('/accounts', async (req, res, next) => {
  try {
    // WORKSHOP TODO (Step 3: Fetching Plaid Data — Accounts)
    // Replace this 501 response by implementing:
    // 1) Fetch Items with access tokens for the user via getItemsWithAccessTokensAndNames(userId)
    // 2) For each Item, call plaid.getItem(accessToken) to detect errors
    // 3) If healthy, call plaid.getAccounts(accessToken) and map into UI-friendly shape
    // Docs:
    // - Accounts Get: https://plaid.com/docs/api/accounts/#accountsget
    // - Item Get: https://plaid.com/docs/api/items/#itemget
    return res.status(501).json({ error: 'WORKSHOP_TODO', message: 'Implement fetching accounts for user Items.' });
  } catch (err) {
    next(err);
  }
});

router.get('/transactions', async (req, res, next) => {
  try {
    // WORKSHOP TODO (Step 3: Fetching Plaid Data — Transactions)
    // Replace this 501 response by implementing:
    // 1) Read query params start, end, and optional filters
    // 2) For each user Item, call plaid.getTransactions(accessToken, start, end, options)
    // 3) Aggregate and return a flat transactions array
    // Docs: https://plaid.com/docs/api/products/transactions/#transactionsget
    return res.status(501).json({ error: 'WORKSHOP_TODO', message: 'Implement fetching transactions across user Items.' });
  } catch (err) {
    next(err);
  }
});

router.get('/summary', async (req, res, next) => {
  try {
    // WORKSHOP TODO (Step 3: Fetching Plaid Data — Aggregation)
    // Replace this 501 response by implementing a simple monthly summary:
    // 1) Compute date ranges for current and previous month
    // 2) For each Item, call plaid.getTransactions for both ranges
    // 3) Accumulate money in (negative amounts) and money out (positive amounts)
    // Return shape: { thisIn, thisOut, lastIn, lastOut }
    // Docs: https://plaid.com/docs/api/products/transactions/#transactionsget
    return res.status(501).json({ error: 'WORKSHOP_TODO', message: 'Implement monthly summary using transactions.' });
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

