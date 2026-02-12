import { useState } from 'react';
import { useAuthStore } from '../../stores/auth.js';
import { useConnectionStore } from '../../stores/connection.js';
import logoSrc from '../../assets/faceless-logo.png';

export function LoginScreen() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const setServerUrl = useConnectionStore((s) => s.setServerUrl);

  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Save server URL before attempting auth
    setServerUrl(serverUrl);

    try {
      if (isRegister) {
        await register(username, password);
      } else {
        await login(username, password);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-900">
      <div className="w-full max-w-sm p-8 bg-gray-800 rounded-lg shadow-xl">
        <img src={logoSrc} alt="Faceless" className="w-20 h-20 mx-auto mb-4 object-contain" />
        <h1 className="text-2xl font-bold text-center text-white mb-2">Faceless</h1>
        <p className="text-gray-400 text-center text-sm mb-6">
          {isRegister ? 'Create an account' : 'Welcome back'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Server</label>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 font-mono text-sm"
              placeholder="192.168.1.100:3000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
              placeholder="Enter username"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
              placeholder="Enter password"
              required
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded font-medium transition-colors"
          >
            {loading ? '...' : isRegister ? 'Register' : 'Log In'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-400">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            className="text-indigo-400 hover:text-indigo-300"
          >
            {isRegister ? 'Log in' : 'Register'}
          </button>
        </p>
      </div>
    </div>
  );
}
