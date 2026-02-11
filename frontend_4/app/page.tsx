"use client";

import React, { useState, useEffect } from 'react';
import { UserSession } from '../types';
import LoginView from '../views/LoginView';
import LandingView from '../views/LandingView';
import CitizenView from '../views/CitizenView';
import Layout from '../components/Layout';
import AdminView from '../views/AdminView';
import WorkerView from '../views/WorkerView';
import CameraView from '../views/CameraView';

export default function Home() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [view, setView] = useState<'landing' | 'login' | 'citizen'>('landing');
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
    return <div className="min-h-screen bg-slate-900" />;
  }

  // If logged in, show the application
  if (session) {
    return (
      <Layout session={session} onLogout={handleLogout}>
        {session.role === 'Admin' && <AdminView />}
        {session.role === 'Worker' && <WorkerView session={session} />}
        {session.role === 'Camera' && <CameraView session={session} />}
      </Layout>
    );
  }

  // If not logged in, switch between Landing, Login, and Citizen Report
  if (view === 'landing') {
    return <LandingView 
      onEnterPortal={() => setView('login')} 
      onReportIssue={() => setView('citizen')}
    />;
  }

  if (view === 'citizen') {
    return <CitizenView onBack={() => setView('landing')} />;
  }

  return <LoginView onLogin={handleLogin} onBack={() => setView('landing')} />;
}
