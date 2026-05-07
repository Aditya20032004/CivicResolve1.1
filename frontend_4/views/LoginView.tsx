import React, { useState } from 'react';
import { UserSession } from '../types';
// Added Loader2 to the imports from lucide-react
import { Shield, Key, Lock, Activity, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';

interface LoginViewProps {
  onLogin: (session: UserSession) => void;
  onBack?: () => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin, onBack }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    setTimeout(() => {
      if (username === 'admin' && password === 'admin123') {
        onLogin({ username: 'admin', role: 'Admin', displayName: 'Administrator' });
      } else if (username === 'worker' && password === 'fixit') {
        // Backwards-compatible demo login: maps generic "worker" to
        // a real worker ID in the pool so existing flows keep working.
        onLogin({ username: 'worker_001', role: 'Worker', displayName: 'Maintenance Crew 001' });
      } else if (username.startsWith('worker_') && password === 'fixit') {
        // New behaviour: workers log in with their actual worker ID
        // (e.g. worker_001, worker_002) and a shared password.
        onLogin({ username, role: 'Worker', displayName: `Field Worker ${username}` });
      } else if (username === 'cam' && password === 'smartcity') {
        onLogin({ username: 'cam_node_01', role: 'Camera', displayName: 'Bhopal Node 01' });
      } else {
        setError('Verification failed. Invalid operator credentials.');
        setIsSubmitting(false);
      }
    }, 800);
  };

  return (
    <div className="min-h-screen mesh-gradient-warm flex items-center justify-center p-6 relative overflow-hidden">
      {onBack && (
        <button 
          onClick={onBack}
          className="absolute top-10 left-10 flex items-center gap-3 text-stone-500 hover:text-amber-400 transition-all font-black uppercase tracking-[0.3em] text-[10px] z-20 group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          Hub Interface
        </button>
      )}

      {/* Decorative Orbs */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-amber-600/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-orange-700/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }}></div>

      <div className="glass-warm p-10 md:p-16 rounded-[3.5rem] shadow-2xl w-full max-w-xl relative z-10 border border-stone-800 animate-in fade-in zoom-in duration-700">
        <div className="flex flex-col items-center mb-14">
          <div className="w-24 h-24 bg-amber-600 text-white rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl shadow-amber-900/40 transform -rotate-6 hover:rotate-0 transition-all duration-500">
            <Activity className="w-14 h-14" />
          </div>
          <h1 className="text-5xl font-black text-stone-50 tracking-tighter mb-3">Operator Access</h1>
          <p className="text-amber-500/60 font-black tracking-[0.3em] text-[10px] uppercase">Secure Infrastructure Tunnel</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {error && (
            <div className="p-6 bg-red-500/10 text-red-400 text-xs font-bold rounded-[1.5rem] border border-red-500/20 flex items-center gap-4 animate-in slide-in-from-top-2">
              <Shield className="w-6 h-6 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-3">
            <label className="text-[10px] font-black text-stone-500 uppercase tracking-[0.4em] ml-2">Protocol Identity</label>
            <div className="relative group">
              <div className="absolute left-6 top-1/2 -translate-y-1/2 text-stone-600 group-focus-within:text-amber-500 transition-colors">
                <Key className="w-6 h-6" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Operator ID"
                className="w-full pl-16 pr-6 py-5 bg-stone-900/40 border border-stone-800 rounded-[1.5rem] focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all outline-none text-stone-100 placeholder-stone-700 font-bold"
                required
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-stone-500 uppercase tracking-[0.4em] ml-2">Authorization Key</label>
            <div className="relative group">
              <div className="absolute left-6 top-1/2 -translate-y-1/2 text-stone-600 group-focus-within:text-amber-500 transition-colors">
                <Lock className="w-6 h-6" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-16 pr-6 py-5 bg-stone-900/40 border border-stone-800 rounded-[1.5rem] focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all outline-none text-stone-100 placeholder-stone-700 font-bold"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-6 bg-amber-600 text-white font-black rounded-[1.5rem] shadow-2xl shadow-amber-900/40 hover:bg-amber-500 active:scale-[0.98] transition-all flex items-center justify-center gap-4 group mt-4 overflow-hidden relative"
          >
            {isSubmitting ? (
              <Loader2 className="w-7 h-7 animate-spin" />
            ) : (
              <>
                Initialize Handshake
                <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-16 text-center text-[10px] text-stone-700 font-black tracking-[0.5em] uppercase">
          Neural Interface Secured • v4.20
        </div>
      </div>
    </div>
  );
};

export default LoginView;