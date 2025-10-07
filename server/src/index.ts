import express from 'express';
import cors from 'cors';
import { env } from './env';
import { errorHandler } from './middleware/errorHandler';
import plaidRouter from './routes/plaid';
import webhookRouter from './routes/webhook';
import { initDb } from './db/csvDb';
import { attachUser, checkJwt } from './auth';

const app = express();
app.use(cors({ origin: env.corsOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

// Webhook must be unprotected
app.use(webhookRouter);

// Protected Plaid endpoints
app.use(checkJwt, attachUser);
app.use('/plaid', plaidRouter);

// Fallback error handler
app.use(errorHandler);

initDb().then(() => {
  console.log('CSV DB initialized');
}).catch((e) => {
  // eslint-disable-next-line no-console
  console.error('Failed to init CSV DB', e);
});

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${env.port}`);
});
