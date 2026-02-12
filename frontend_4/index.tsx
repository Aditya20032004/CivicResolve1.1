import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { UserSession } from './types';
import LoginView from './views/LoginView';
import LandingView from './views/LandingView';
import Layout from './components/Layout';
import AdminView from './views/AdminView';
import WorkerView from './views/WorkerView';
import CameraView from './views/CameraView';

function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [view, setView] = useState<'landing' | 'login'>('landing');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('civic_session');
    if (saved) {
      try {
        setSession(JSON.parse(saved));
      } catch (e) {
        localStorage.removeItem('civic_session');
      }
    }
  }, []);

  const handleLogin = (user: UserSession) => {
    setSession(user);
    localStorage.setItem('civic_session', JSON.stringify(user));
  };

  const handleLogout = () => {
    setSession(null);
    setView('landing');
    localStorage.removeItem('civic_session');
  };

  if (!mounted) {
    return <div className="min-h-screen bg-[#0c0a09]" />;
  }

  // If logged in, show the application dashboard
  if (session) {
    return (
      <Layout session={session} onLogout={handleLogout}>
        {session.role === 'Admin' && <AdminView />}
        {session.role === 'Worker' && <WorkerView session={session} />}
        {session.role === 'Camera' && <CameraView session={session} />}
      </Layout>
    );
  }

  // If not logged in, switch between Public Landing and Login Portal
  if (view === 'landing') {
    return <LandingView onEnterPortal={() => setView('login')} onReportIssue={() => setView('login')} />;
  }

  return <LoginView onLogin={handleLogin} onBack={() => setView('landing')} />;
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}