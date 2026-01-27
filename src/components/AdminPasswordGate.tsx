import { useState, type ReactNode, type FormEvent } from 'react';
import { isAuthenticated, authenticate, isPasswordRequired } from '../lib/admin-auth';

interface AdminPasswordGateProps {
  children: ReactNode;
}

export function AdminPasswordGate({ children }: AdminPasswordGateProps) {
  const [authed, setAuthed] = useState(() => isAuthenticated());
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  if (!isPasswordRequired() || authed) {
    return <>{children}</>;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (authenticate(password)) {
      setAuthed(true);
      setError(false);
    } else {
      setError(true);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-2xl font-bold text-white">Admin Access</h1>
        <p className="text-gray-400 text-sm">Enter the admin password to continue.</p>
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(false);
          }}
          placeholder="Password"
          autoFocus
          className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        {error && <p className="text-red-400 text-sm">Incorrect password.</p>}
        <button
          type="submit"
          className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors"
        >
          Unlock
        </button>
      </form>
    </div>
  );
}
