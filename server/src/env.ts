import dotenv from 'dotenv';

dotenv.config();

function getEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var ${name}`);
  }
  return value;
}

export const env = {
  port: parseInt(getEnv('PORT', '4000'), 10),
  nodeEnv: getEnv('NODE_ENV', 'development'),
  // No database in CSV mode
  databaseUrl: '',
  auth0: {
    domain: getEnv('AUTH0_DOMAIN'),
    audience: getEnv('AUTH0_AUDIENCE'),
  },
  plaid: {
    baseUrl: getEnv('PLAID_BASE_URL', 'https://sandbox.plaid.com'),
    clientId: getEnv('PLAID_CLIENT_ID'),
    secret: getEnv('PLAID_SECRET'),
    webhookUrl: getEnv('PLAID_WEBHOOK_URL'),
  },
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',')
};

