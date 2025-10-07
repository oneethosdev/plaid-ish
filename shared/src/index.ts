export type User = {
  id: string;
  auth0Sub: string;
  firstName?: string | null;
  email?: string | null;
};

export type Account = {
  id: string;
  itemId: string;
  name: string;
  type: string;
  balance: number;
  available?: number | null;
};

export type Transaction = {
  id: string;
  accountId: string;
  name: string;
  amount: number;
  date: string; // ISO date
  category?: string | null;
  pending: boolean;
};
