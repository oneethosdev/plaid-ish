import { Router } from 'express';
import { appendWebhookLog } from '../db/csvDb';

const router = Router();

router.post('/plaid/webhook', async (req, res, next) => {
  try {
    const type = (req.body && (req.body.webhook_type || req.body.event_type)) || 'unknown';
    await appendWebhookLog(type, req.body);
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
});

export default router;

