import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { AuthScreen } from './components/auth/AuthScreen';
import { Dashboard } from './components/dashboard/Dashboard';
import { ConnectionStatusBanner } from './components/common/ConnectionStatusBanner';
import { MobilePrototypeContainer } from './components/prototype/MobilePrototypeContainer';
import { Loader2, Smartphone } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { currentUser, isLoading } = useAuth();
  const [isPrototype, setIsPrototype] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      return p.has('variant') || p.get('prototype') === 'true';
    }
    return false;
  });

  useEffect(() => {
    const handlePopState = () => {
      const p = new URLSearchParams(window.location.search);
      setIsPrototype(p.has('variant') || p.get('prototype') === 'true');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (isPrototype) {
    return <MobilePrototypeContainer />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Verifying session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative">
      <ConnectionStatusBanner />

      {/* Quick Launch Pill for Mobile Prototypes */}
      <a
        href="?variant=A"
        className="fixed bottom-4 right-4 z-40 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-xl flex items-center gap-1.5 transition active:scale-95 cursor-pointer border border-indigo-400/40"
        title="Mở giao diện thử nghiệm Mobile (Prototype)"
      >
        <Smartphone className="w-4 h-4" />
        <span>Bản thử Mobile (Prototype)</span>
      </a>

      {currentUser ? <Dashboard /> : <AuthScreen />}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <SocketProvider>
        <MainLayout />
      </SocketProvider>
    </AuthProvider>
  );
};

export default App;

