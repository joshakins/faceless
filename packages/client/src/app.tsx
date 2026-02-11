import { useAuthStore } from './stores/auth.js';
import { LoginScreen } from './components/auth/login-screen.js';
import { AppShell } from './components/layout/app-shell.js';

export function App() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-gray-400 text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <AppShell />;
}
