"use client";

import React, { useState, useEffect } from 'react';
import { api, endpoints, IMG_BASE_URL } from '../lib/api';
import { IncidentReport } from '../types';
import { RefreshCw, LayoutDashboard, CheckSquare, AlertCircle, CheckCircle2, List, Send, Map as MapIcon, ChevronRight, Activity, Database, ShieldCheck, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type DamageEstimate = {
  loading?: boolean;
  error?: string;
  incident_id?: number;
  incident_type?: string;
  issue_type?: string;
  summary?: string;
  repair?: {
    cost_range?: { min?: number; max?: number };
    materials?: string[];
    equipment?: string[];
    labor_hours?: number;
    [key: string]: any;
  };
  damage?: any;
};

const AdminView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'verification'>('dashboard');
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [assignForm, setAssignForm] = useState({ incidentId: '', workerId: '' });
  const [verifyLogs, setVerifyLogs] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [sweepSummary, setSweepSummary] = useState<any | null>(null);
  const [damageEstimates, setDamageEstimates] = useState<Record<number, DamageEstimate>>({});
  const [MapComponent, setMapComponent] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    let isMounted = true;
    import('../components/IncidentMap')
      .then((mod) => {
        if (isMounted) {
          setMapComponent(() => mod.default);
        }
      })
      .catch((err) => {
        console.error("Critical: Map loading failed", err);
      });
    return () => { isMounted = false; };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reportsRes, workersRes, logsRes, disputesRes] = await Promise.all([
        api.get(endpoints.admin.reports),
        api.get(endpoints.admin.workers),
        api.get(endpoints.workflow.verifyLogs),
        api.get(endpoints.workflow.disputes),
      ]);
      setIncidents(reportsRes.data);
      setWorkers(workersRes.data || []);
      setVerifyLogs(logsRes.data || []);
      setDisputes(disputesRes.data || []);

      // If no worker selected yet, default to first worker
      if (!assignForm.workerId && workersRes.data && workersRes.data.length > 0) {
        setAssignForm((prev) => ({ ...prev, workerId: workersRes.data[0].id }));
      }
    } catch (err) {
      console.error("Failed to fetch admin data", err);
    } finally {
      setTimeout(() => setLoading(false), 800);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const runDamageEstimate = async (incident: IncidentReport) => {
    const id = incident.id;
    setDamageEstimates((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), loading: true, error: undefined },
    }));

    try {
      const res = await api.post(endpoints.ai.damageIncident, {
        id: incident.id,
        type: incident.type,
      });

      setDamageEstimates((prev) => ({
        ...prev,
        [id]: { ...(res.data || {}), loading: false },
      }));
    } catch (err: any) {
      const apiError = err?.response?.data?.error || 'Failed to estimate damage';
      setDamageEstimates((prev) => ({
        ...prev,
        [id]: { ...(prev[id] || {}), loading: false, error: apiError },
      }));
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.incidentId) return;
    const incident = incidents.find(i => i.id === Number(assignForm.incidentId));
    if (!incident) return;
    try {
      await api.post(endpoints.workflow.assign, {
        id: incident.id,
        type: incident.type,
        worker_id: assignForm.workerId
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleVerify = async (id: number, type: string, decision: 'approve' | 'reject') => {
    try {
      await api.post(endpoints.workflow.verify, { id, type, decision });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCameraSweep = async () => {
    // Show immediate feedback while the sweep is running
    setSweepSummary({ loading: true });
    try {
      const res = await api.post(endpoints.workflow.cameraSweep, {});
      setSweepSummary(res.data || { message: 'Camera sweep completed' });
      fetchData();
    } catch (err: any) {
      console.error('Camera sweep failed', err);
      const apiError = err?.response?.data?.error || 'Camera sweep failed';
      setSweepSummary({ error: apiError });
    }
  };

  const now = new Date();
  const withSla = incidents.map((i) => {
    const created = i.created_at ? new Date(i.created_at) : null;
    const ageHours = created ? (now.getTime() - created.getTime()) / 36e5 : 0;
    let targetHours = 24;
    if (i.type === 'pothole') {
      if ((i as any).severity === 'high') targetHours = 4;
      else if ((i as any).severity === 'low') targetHours = 72;
    }
    const breached = ageHours > targetHours && i.status !== 'verified';
    return { ...i, ageHours, targetHours, breached } as any;
  });

  const pendingCount = withSla.filter(i => i.status === 'pending').length;
  const resolvedCount = withSla.filter(i => i.status === 'verified').length;
  const breachedCount = withSla.filter(i => i.breached).length;
  const totalTracked = withSla.length || 1;
  const nodeHealth = Math.max(0, 100 - Math.round((breachedCount / totalTracked) * 100));
  const verificationQueue = incidents.filter(i => i.status === 'completed');

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.1 } }
  };

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="space-y-12"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <h1 className="text-5xl font-black text-stone-50 tracking-tighter">Command Center</h1>
          <p className="text-stone-400 text-lg font-medium mt-2">Bhopal infrastructure state & dispatch controller</p>
        </div>
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-3 px-8 py-4 glass-warm border border-stone-700/50 rounded-2xl shadow-xl hover:bg-stone-800 transition-all font-black text-[10px] uppercase tracking-widest text-stone-100 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
            Refresh Nodes
          </motion.button>
        </div>
      </div>

      <div className="flex glass-warm p-2 rounded-[2rem] w-fit border border-stone-800/50">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-3 px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-500 ${activeTab === 'dashboard' ? 'bg-amber-600 text-white shadow-xl shadow-amber-900/40' : 'text-stone-500 hover:text-stone-300'}`}
        >
          <LayoutDashboard className="w-5 h-5" />
          Analytics & Dispatch
        </button>
        <button
          onClick={() => setActiveTab('verification')}
          className={`flex items-center gap-3 px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-500 relative ${activeTab === 'verification' ? 'bg-amber-600 text-white shadow-xl shadow-amber-900/40' : 'text-stone-500 hover:text-stone-300'}`}
        >
          <CheckSquare className="w-5 h-5" />
          Verification Gate
          {verificationQueue.length > 0 && (
            <span className="absolute -top-2 -right-2 flex h-6 w-6">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-6 w-6 bg-orange-500 text-[10px] font-black text-white items-center justify-center border-2 border-[#0c0a09]">
                {verificationQueue.length}
              </span>
            </span>
          )}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'dashboard' ? (
          <motion.div 
            key="dashboard"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="grid grid-cols-1 lg:grid-cols-4 gap-8"
          >
            <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { label: 'Active Alerts', val: pendingCount, icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-500/10' },
                { label: 'Resolved Assets', val: resolvedCount, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                { label: 'SLA Breaches', val: breachedCount, icon: ShieldCheck, color: 'text-red-500', bg: 'bg-red-500/10' },
                { label: 'Node Health', val: `${nodeHealth.toFixed(1)}%`, icon: Activity, color: 'text-white', bg: 'bg-amber-600', dark: true }
              ].map((stat, i) => (
                <motion.div 
                  key={i}
                  whileHover={{ y: -5 }}
                  className={`glass-card p-8 rounded-[2.5rem] border border-stone-800 shadow-xl flex flex-col justify-between h-52 ${stat.dark ? 'bg-amber-600 !border-amber-500/50' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`p-4 ${stat.bg} ${stat.color} rounded-2xl border ${!stat.dark ? 'border-white/5' : 'border-white/20'}`}>
                      <stat.icon className="w-8 h-8" />
                    </div>
                    {!stat.dark && <ChevronRight className="w-5 h-5 text-stone-700" />}
                  </div>
                  <div>
                    <p className={`text-4xl font-black tracking-tighter ${stat.dark ? 'text-white' : 'text-stone-50'}`}>{stat.val}</p>
                    <p className={`text-[10px] font-black uppercase tracking-[0.3em] mt-1 ${stat.dark ? 'text-amber-100' : 'text-stone-500'}`}>{stat.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="lg:col-span-3 space-y-8">
              <motion.div 
                className="glass-warm p-4 rounded-[3.5rem] shadow-2xl border border-stone-800 h-[600px] relative overflow-hidden"
              >
                <div className="absolute top-8 left-8 z-[10] glass-light px-6 py-3 rounded-2xl border border-white/5 shadow-xl flex items-center gap-3">
                  <MapIcon className="w-5 h-5 text-amber-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-stone-100">Spatial Telemetry Overlay</span>
                </div>
                {MapComponent ? (
                  <MapComponent incidents={incidents} />
                ) : (
                  <div className="w-full h-full bg-stone-900/40 flex items-center justify-center">
                    <p className="text-stone-600 font-black uppercase tracking-[0.5em] text-[10px] animate-pulse">Initializing Map Engine...</p>
                  </div>
                )}
              </motion.div>

              <div className="glass-warm rounded-[3rem] border border-stone-800 shadow-xl overflow-hidden">
                 <div className="p-10 border-b border-stone-800/50 flex items-center justify-between bg-white/5">
                    <h3 className="text-2xl font-black text-stone-50 tracking-tighter">Real-time Feed</h3>
                    <button className="text-amber-500 text-[10px] font-black uppercase tracking-widest hover:text-amber-400 transition-colors">Export Ledger</button>
                 </div>
                 <div className="overflow-x-auto p-4">
                   <table className="w-full text-left border-separate border-spacing-y-2">
                     <thead>
                       <tr className="text-[10px] font-black text-stone-600 uppercase tracking-[0.3em]">
                         <th className="px-8 py-4">Incident</th>
                         <th className="px-8 py-4">Classification</th>
                         <th className="px-8 py-4">Status</th>
                         <th className="px-8 py-4">Personnel</th>
                       </tr>
                     </thead>
                     <tbody>
                       {incidents.slice(0, 8).map((i) => (
                         <tr key={i.id} className="group hover:bg-white/5 transition-colors cursor-default">
                           <td className="px-8 py-6 glass-warm rounded-l-2xl border-r-0 border-stone-800">
                             <p className="font-black text-amber-500 tracking-tight text-lg">#{i.id}</p>
                             <p className="text-[10px] text-stone-500 font-bold uppercase truncate max-w-[150px]">{i.location.address}</p>
                           </td>
                           <td className="px-8 py-6 glass-warm border-x-0 border-stone-800">
                             <span className="px-4 py-1.5 glass-light text-amber-200 text-[9px] font-black uppercase rounded-xl border border-white/5 tracking-widest">
                               {i.type}
                             </span>
                           </td>
                           <td className="px-8 py-6 glass-warm border-x-0 border-stone-800 align-top">
                             <div className="flex flex-col gap-2">
                               <div className="flex items-center gap-3">
                                 <div className={`w-2 h-2 rounded-full ${i.status === 'pending' ? 'bg-orange-500' : i.status === 'completed' ? 'bg-amber-400' : 'bg-emerald-500'} animate-pulse`}></div>
                                 <span className="text-[10px] font-black text-stone-200 uppercase tracking-widest">{i.status}</span>
                               </div>
                               {(() => {
                                 const estimate = damageEstimates[i.id];
                                 const costRange = estimate?.repair?.cost_range;
                                 const hasEstimate = estimate && !estimate.loading && !estimate.error;

                                 return (
                                   <div className="flex items-center gap-2 text-[9px]">
                                     <button
                                       onClick={() => runDamageEstimate(i)}
                                       disabled={estimate?.loading}
                                       className="px-2 py-1 rounded-xl bg-amber-600/90 text-white font-black uppercase tracking-[0.2em] hover:bg-amber-500 disabled:opacity-60 flex items-center gap-1"
                                     >
                                       <Database className="w-3 h-3" />
                                       {estimate?.loading ? 'Running' : hasEstimate ? 'Re-run' : 'Damage'}
                                     </button>
                                     {hasEstimate && costRange && (
                                       <span className="text-amber-300 font-black uppercase tracking-[0.2em]">
                                         ₹{typeof costRange.min === 'number' ? costRange.min.toLocaleString('en-IN') : '?'}-
                                         {typeof costRange.max === 'number' ? costRange.max.toLocaleString('en-IN') : '?'}
                                       </span>
                                     )}
                                   </div>
                                 );
                               })()}
                             </div>
                           </td>
                           <td className="px-8 py-6 glass-warm rounded-r-2xl border-l-0 border-stone-800 text-[10px] font-black text-stone-500 italic tracking-wider">
                             {i.assigned_to || 'WAITING'}
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
              </div>
            </div>

            <div className="lg:col-span-1 space-y-6">
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="glass-card p-10 rounded-[3.5rem] shadow-2xl border border-stone-800"
              >
                <div className="p-5 bg-amber-600 rounded-[1.5rem] w-fit mb-8 shadow-xl shadow-amber-900/40">
                  <Send className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-3xl font-black mb-2 tracking-tighter text-stone-50">Rapid Dispatch</h3>
                <p className="text-stone-500 text-sm font-medium mb-10 leading-relaxed">Direct personnel coordination for active Bhopal alerts.</p>
                
                <form onSubmit={handleAssign} className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-stone-600 uppercase tracking-[0.4em] ml-2">Target Alert</label>
                    <select
                      value={assignForm.incidentId}
                      onChange={(e) => setAssignForm({ ...assignForm, incidentId: e.target.value })}
                      className="w-full p-5 bg-stone-900/40 border border-stone-800 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500/50 text-sm font-black text-stone-100 transition-all cursor-pointer"
                      required
                    >
                      <option value="">Select ID...</option>
                      {incidents.filter(i => i.status === 'pending').map(i => (
                        <option key={i.id} value={i.id}>#{i.id} - {i.type}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-stone-600 uppercase tracking-[0.4em] ml-2">Field Operator</label>
                    <select
                      value={assignForm.workerId}
                      onChange={(e) => setAssignForm({ ...assignForm, workerId: e.target.value })}
                      className="w-full p-5 bg-stone-900/40 border border-stone-800 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500/50 text-sm font-black text-stone-100 transition-all cursor-pointer"
                      required
                    >
                      <option value="">Select worker...</option>
                      {workers.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.id} 
                          {w.name ? `- ${w.name}` : ''}
                          {w.active_tasks !== undefined && w.max_tasks !== undefined
                            ? ` (tasks ${w.active_tasks}/${w.max_tasks})`
                            : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-6 bg-amber-600 text-white font-black rounded-3xl hover:bg-amber-500 transition-all shadow-2xl shadow-amber-900/40 flex items-center justify-center gap-3 group uppercase text-[10px] tracking-widest"
                  >
                    Deploy Operator
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </form>
              </motion.div>

              {workers.length > 0 && (
                <motion.div 
                  whileHover={{ scale: 1.01 }}
                  className="glass-card p-6 rounded-[3rem] shadow-xl border border-stone-800/80"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-black text-stone-200 uppercase tracking-[0.25em]">Worker Performance</h4>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {workers.map((w) => (
                      <div key={w.id} className="flex items-center justify-between text-xs glass-warm rounded-2xl px-3 py-2 border border-stone-800/80">
                        <div>
                          <p className="font-black text-stone-100 tracking-tight">{w.id}</p>
                          {w.name && <p className="text-[10px] text-stone-500 font-bold uppercase tracking-[0.25em]">{w.name}</p>}
                        </div>
                        <div className="text-right text-[10px] font-black uppercase tracking-[0.22em] space-y-1">
                          <p className="text-stone-400">Load {w.active_tasks}/{w.max_tasks}</p>
                          <p className="text-emerald-400">R {w.reward_points}</p>
                          <p className="text-red-400">P {w.penalty_points}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="verification"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-10"
          >
            <div className="lg:col-span-2 space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-stone-50 tracking-tighter">Human Verification Queue</h3>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleCameraSweep}
                  className="flex items-center gap-2 px-5 py-3 glass border border-amber-500/40 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] text-amber-300 hover:bg-amber-500/10"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Run Camera Sweep
                </motion.button>
              </div>

              {sweepSummary && (
                <div className="glass-warm border border-stone-800 rounded-2xl px-5 py-3 text-[11px] text-stone-200 flex items-center justify-between">
                  {sweepSummary.loading ? (
                    <span className="text-stone-400 font-black uppercase tracking-[0.2em]">Running camera sweep…</span>
                  ) : sweepSummary.error ? (
                    <span className="text-red-400 font-black uppercase tracking-[0.2em]">{sweepSummary.error}</span>
                  ) : (
                    <>
                      <span className="font-black uppercase tracking-[0.2em] text-stone-400">Camera sweep</span>
                      <span className="text-stone-300">
                        Scanned {sweepSummary.scanned_incidents ?? 0} / Auto-verified {sweepSummary.auto_verified ?? 0}
                      </span>
                    </>
                  )}
                </div>
              )}

              {verificationQueue.length === 0 ? (
                <div className="py-24 text-center glass-warm rounded-[3rem] border border-stone-800/50 flex flex-col items-center justify-center space-y-6 amber-glow">
                  <div className="w-20 h-20 glass rounded-[2rem] flex items-center justify-center text-stone-700">
                    <ShieldCheck className="w-10 h-10" />
                  </div>
                  <div>
                    <p className="text-stone-50 font-black text-2xl tracking-tighter">Integrity Verified</p>
                    <p className="text-stone-500 font-medium text-sm mt-2">All field tasks have been human-audited or cleared by automation.</p>
                  </div>
                </div>
              ) : (
                verificationQueue.map((t) => (
                <motion.div 
                  key={t.id} 
                  whileHover={{ y: -10 }}
                  className="glass-card p-10 rounded-[3.5rem] border border-stone-800 shadow-2xl flex flex-col h-full relative overflow-hidden group"
                >
                  <div className="flex items-center justify-between mb-8 relative z-10">
                    <div>
                      <h4 className="font-black text-stone-50 text-2xl tracking-tighter">Fix Review #{t.id}</h4>
                      <p className="text-[10px] font-black text-stone-500 uppercase tracking-[0.3em] mt-1 truncate max-w-[150px]">{t.location.address}</p>
                    </div>
                    <span className="px-4 py-2 bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase rounded-xl border border-emerald-500/20 tracking-widest">
                      {t.type}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-6 mb-10 flex-1 relative z-10">
                    <div className="space-y-4">
                      <p className="text-[10px] font-black text-stone-600 uppercase tracking-[0.4em] text-center">Reference</p>
                      <div className="aspect-[3/4] glass rounded-3xl overflow-hidden border border-white/5 relative group/img">
                        <img src={`${IMG_BASE_URL}/${t.images.original}`} alt="Original" className="w-full h-full object-cover grayscale opacity-40 group-hover/img:grayscale-0 group-hover/img:opacity-100 transition-all duration-700" />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <p className="text-[10px] font-black text-stone-600 uppercase tracking-[0.4em] text-center">Field Proof</p>
                      <div className="aspect-[3/4] glass rounded-3xl overflow-hidden border border-amber-500/30 relative group/img">
                        <img src={`${IMG_BASE_URL}/${t.images.resolved}`} alt="Resolved" className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-700" />
                        <div className="absolute inset-0 bg-amber-900/10 mix-blend-overlay"></div>
                      </div>
                    </div>
                  </div>

                  {/* Damage & Repair Estimate */}
                  {(() => {
                    const estimate = damageEstimates[t.id];
                    const costRange = estimate?.repair?.cost_range;
                    const hasEstimate = estimate && !estimate.loading && !estimate.error;

                    return (
                      <div className="mb-8 glass-warm rounded-2xl border border-amber-500/30 px-6 py-4 flex items-start justify-between gap-4 relative z-10 bg-amber-500/5">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-300 mb-1 flex items-center gap-2">
                            <Database className="w-3 h-3" />
                            Damage &amp; Repair Estimate
                          </p>
                          {estimate?.loading && (
                            <p className="text-[11px] text-amber-100 font-medium">Running damage model…</p>
                          )}
                          {estimate?.error && !estimate.loading && (
                            <p className="text-[11px] text-red-400 font-medium">{estimate.error}</p>
                          )}
                          {hasEstimate && (
                            <div className="space-y-1">
                              {estimate.summary && (
                                <p className="text-[11px] text-amber-50 font-medium leading-relaxed">
                                  {estimate.summary}
                                </p>
                              )}
                              {costRange && (
                                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-200 mt-1">
                                  Estimated Repair Window: ₹
                                  {typeof costRange.min === 'number' ? costRange.min.toLocaleString('en-IN') : '?'}
                                  {' - '}
                                  {typeof costRange.max === 'number' ? costRange.max.toLocaleString('en-IN') : '?'}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => runDamageEstimate(t)}
                            disabled={estimate?.loading}
                            className="px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] bg-amber-600 text-white shadow-lg shadow-amber-900/40 hover:bg-amber-500 disabled:opacity-60"
                          >
                            {estimate?.loading ? 'Running…' : hasEstimate ? 'Re-run Estimate' : 'Run Estimate'}
                          </motion.button>
                          {hasEstimate && estimate.issue_type && (
                            <span className="text-[9px] text-amber-300 font-black uppercase tracking-[0.3em] opacity-80">
                              Mode: {estimate.issue_type}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex gap-4 relative z-10">
                    <button
                      onClick={() => handleVerify(t.id, t.type, 'approve')}
                      className="flex-1 py-5 bg-amber-600 text-white font-black rounded-2xl hover:bg-amber-500 transition-all shadow-xl shadow-amber-900/40 uppercase text-[10px] tracking-widest"
                    >
                      Audit Approve
                    </button>
                    <button
                      onClick={() => handleVerify(t.id, t.type, 'reject')}
                      className="w-16 h-16 glass rounded-2xl flex items-center justify-center text-stone-500 hover:text-red-400 hover:bg-red-400/5 transition-all border border-stone-800"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </motion.div>
              ))
              )}
            </div>

            <div className="space-y-8">
              <div className="glass-warm rounded-[3rem] border border-stone-800 shadow-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-stone-800/60 flex items-center justify-between bg-stone-950/60">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400">Verification Logs</span>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-stone-900/60">
                  {verifyLogs.map((log) => (
                    <div key={log.id} className="px-6 py-3 text-[11px] flex items-center justify-between">
                      <div>
                        <p className="font-black text-stone-100">#{log.report_id} · {log.report_type}</p>
                        <p className="text-[10px] text-stone-500 uppercase tracking-[0.25em]">{log.channel}</p>
                      </div>
                      <div className="text-right text-[10px] font-black uppercase tracking-[0.25em]">
                        <p className={log.decision === 'verified' ? 'text-emerald-400' : 'text-orange-400'}>{log.decision}</p>
                        <p className="text-stone-500">{log.worker_id || '—'}</p>
                      </div>
                    </div>
                  ))}
                  {verifyLogs.length === 0 && (
                    <div className="px-6 py-4 text-[11px] text-stone-500">No verification activity recorded yet.</div>
                  )}
                </div>
              </div>

              <div className="glass-warm rounded-[3rem] border border-stone-800 shadow-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-stone-800/60 flex items-center justify-between bg-stone-950/60">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400">Disputes</span>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-stone-900/60">
                  {disputes.map((d) => (
                    <div key={d.id} className="px-6 py-3 text-[11px]">
                      <p className="font-black text-stone-100">Ticket #{d.id} · Log {d.log_id}</p>
                      <p className="text-[10px] text-stone-500 mt-1">{d.message}</p>
                      <p
                        className={
                          `text-[10px] font-black uppercase tracking-[0.25em] mt-1 ` +
                          (d.status === 'open' ? 'text-orange-400' : 'text-emerald-400')
                        }
                      >
                        {d.status}
                      </p>
                    </div>
                  ))}
                  {disputes.length === 0 && (
                    <div className="px-6 py-4 text-[11px] text-stone-500">No disputes raised.</div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AdminView;