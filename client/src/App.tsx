import { useAuth0 } from '@auth0/auth0-react';
import React from 'react';
import Dashboard from './components/Dashboard';

export default function App() {
  const { isAuthenticated, loginWithRedirect, logout, error } = useAuth0();

  console.log('isAuthenticated', isAuthenticated);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="p-8 card space-y-4 text-center">
          <h1 className="text-2xl font-semibold">Plaid-ish</h1>
          <p className="text-gray-500">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="p-8 card space-y-4 text-center">
          <h1 className="text-2xl font-semibold">Plaid-ish</h1>
          <button
            className="px-4 py-2 btn-primary"
            onClick={() => loginWithRedirect()}
          >
            Log in with Auth0
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <button className="px-3 py-2 border rounded" onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}>
          Logout
        </button>
      </div>
      <Dashboard />
    </div>
  );
}

