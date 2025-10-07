## Plaid-ish Workshop App

### Prerequisites
- Node.js 18+

### Setup
1. Create `.env` in `server/` from `.env.example` and fill values (Plaid Sandbox, Auth0).
2. Create `.env` in `client/` from `.env.example` and fill values.
3. Install deps:
   - `cd server && npm install && npx prisma generate && npm run prisma:migrate`
   - `cd ../client && npm install`

### Run
- Server: `cd server && npm run dev` (http://localhost:4000)
- Client: `cd client && npm run dev` (http://localhost:3000)

### Plaid Sandbox Linking
1. From the client, click "Connect Bank".
2. Use sandbox credentials (`user_good`, `pass_good`).
3. On success, the app exchanges the token and stores accounts.

### Dashboard
- Shows this vs last month income/expenses.
- Lists accounts and recent transactions.


