import React from 'react';
import { UserSession } from '../types';
import { LogOut, User, Shield, Camera, Hammer, Activity, Menu, Globe, Settings } from 'lucide-react';
import { motion } from 'framer-motion';

interface LayoutProps {
  session: UserSession;
  onLogout: () => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ session, onLogout, children }) => {
  const getIcon = () => {
    switch (session.role) {
      case 'Admin': return <Shield className="w-5 h-5" />;
      case 'Worker': return <Hammer className="w-5 h-5" />;
      case 'Camera': return <Camera className="w-5 h-5" />;
    }
  };

  const getRoleBadge = () => {
    switch (session.role) {
      case 'Admin': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Worker': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'Camera': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
  };

  const showVideoBackground = session.role === 'Admin' || session.role === 'Worker';

  return (
    <div className="relative flex h-screen mesh-gradient-warm overflow-hidden text-stone-100">
      {showVideoBackground && (
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <video
            className="h-full w-full object-cover opacity-70"
            autoPlay
            muted
            loop
            playsInline
          >
            <source src="/video/27669-365224683.mp4" type="video/mp4" />
          </video>
        </div>
      )}
      {/* Sidebar */}
      <aside className="w-80 glass-warm flex flex-col hidden lg:flex border-r border-stone-800/50 relative z-50">
        <div className="p-10">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 font-black text-2xl"
          >
            <div className="p-2.5 bg-amber-600 rounded-xl shadow-lg shadow-amber-900/40">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <span className="tracking-tighter">CivicResolve</span>
          </motion.div>
        </div>

        <nav className="flex-1 px-6 space-y-10 mt-4">
          <div className="space-y-4">
            <p className="px-4 text-[10px] font-black text-stone-500 uppercase tracking-[0.4em]">Active Identity</p>
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="p-6 glass-card rounded-[2rem] border border-stone-700/50"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-stone-800 flex items-center justify-center text-amber-500 border border-stone-700 shadow-inner">
                  <User className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-stone-50 font-black text-sm truncate">{session.displayName}</p>
                  <p className="text-stone-500 text-[10px] font-bold tracking-widest uppercase">ID: {session.username}</p>
                </div>
              </div>
              <div className={`px-3 py-2 rounded-xl border flex items-center gap-2 text-[10px] font-black uppercase tracking-wider ${getRoleBadge()}`}>
                {getIcon()}
                {session.role} Role
              </div>
            </motion.div>
          </div>

          <div className="space-y-4">
            <p className="px-4 text-[10px] font-black text-stone-500 uppercase tracking-[0.4em]">Operations</p>
            <div className="space-y-2">
              <button className="w-full flex items-center gap-4 px-6 py-4 text-stone-400 hover:text-amber-200 hover:bg-white/5 rounded-2xl transition-all group border border-transparent hover:border-stone-800">
                <Globe className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-bold">Node Overview</span>
              </button>
              <button className="w-full flex items-center gap-4 px-6 py-4 text-stone-400 hover:text-amber-200 hover:bg-white/5 rounded-2xl transition-all group border border-transparent hover:border-stone-800">
                <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform" />
                <span className="text-sm font-bold">Preferences</span>
              </button>
            </div>
          </div>
        </nav>

        <div className="p-8 mt-auto border-t border-stone-800/50 bg-black/20">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-3 p-5 text-stone-500 hover:text-red-400 hover:bg-red-400/5 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest border border-transparent hover:border-red-400/20"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out Operator</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        <header className="glass-warm border-b border-stone-800/50 h-20 flex items-center justify-between px-10 flex-shrink-0 z-40">
           <div className="flex items-center gap-3 lg:hidden">
              <div className="p-2 bg-amber-600 rounded-lg">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <span className="font-black text-stone-50 tracking-tighter">CivicResolve</span>
           </div>
           
           <div className="hidden lg:flex items-center gap-6">
              <div className="glass-light px-4 py-1.5 rounded-full text-[9px] font-black text-emerald-500 uppercase tracking-[0.3em] border border-emerald-500/20 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                System Node Active
              </div>
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Bhopal Hub • Central Time: {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
           </div>

           <button className="lg:hidden p-3 glass-warm rounded-xl text-stone-400">
              <Menu className="w-5 h-5" />
           </button>
        </header>

        <main className="flex-1 overflow-y-auto hide-scrollbar">
          <div className="p-10 lg:p-16 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;