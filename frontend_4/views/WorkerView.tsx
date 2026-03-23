"use client";

import React, { useState, useEffect } from 'react';
import { api, endpoints, IMG_BASE_URL } from '../lib/api';
import { UserSession, IncidentReport } from '../types';
import { Hammer, MapPin, Image as ImageIcon, CheckCircle, RefreshCcw, Loader2, ClipboardCheck, ArrowUpCircle, ChevronRight, LayoutList, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface WorkerViewProps {
  session: UserSession;
}

const WorkerView: React.FC<WorkerViewProps> = ({ session }) => {
  const [tasks, setTasks] = useState<IncidentReport[]>([]);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [proofs, setProofs] = useState<Record<number, File>>({});
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const [tasksRes, profileRes] = await Promise.all([
        api.get(endpoints.workflow.workerTasks(session.username)),
        api.get(endpoints.workflow.workerProfile(session.username)),
      ]);
      setTasks(tasksRes.data);
      setProfile(profileRes.data || null);
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setLoading(false), 800);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleProofChange = (id: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProofs({ ...proofs, [id]: file });
      setPreviews({ ...previews, [id]: URL.createObjectURL(file) });
    }
  };

  const completeTask = async (task: IncidentReport) => {
    const proof = proofs[task.id];
    if (!proof) return;
    setSubmitting(task.id);
    const formData = new FormData();
    formData.append('image', proof, proof.name);
    formData.append('id', task.id.toString());
    formData.append('type', task.type);
    try {
      const res = await api.post(endpoints.workflow.complete, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const msg = (res.data && res.data.message) || 'Resolution proof uploaded and processed.';
      setBanner({ type: 'success', msg });
      fetchTasks();
    } catch (err: any) {
      console.error(err);
      const msg = err?.response?.data?.error || 'Failed to submit resolution proof.';
      setBanner({ type: 'error', msg });
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-12 pb-20">
      {banner && (
        <div
          className={`mt-8 px-4 py-3 rounded-2xl text-sm font-medium flex items-center justify-between ${
            banner.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/40 text-emerald-300'
              : 'bg-red-500/10 border border-red-500/40 text-red-300'
          }`}
        >
          <span>{banner.msg}</span>
          <button
            onClick={() => setBanner(null)}
            className="ml-4 text-xs uppercase tracking-widest opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}
      <div className="flex items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-stone-50 tracking-tighter">My Dispatch</h1>
          <p className="text-stone-500 font-bold uppercase tracking-[0.2em] text-[10px] mt-2">Operator: {session.displayName}</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05, rotate: 180 }}
          whileTap={{ scale: 0.95 }}
          onClick={fetchTasks}
          disabled={loading}
          className="w-16 h-16 glass-warm border border-stone-800 rounded-[1.5rem] shadow-xl flex items-center justify-center text-amber-500 disabled:opacity-50 transition-all"
        >
          <RefreshCcw className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
        </motion.button>
      </div>

      {profile && (
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="glass-warm rounded-2xl px-4 py-3 border border-stone-800 flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-stone-500">Active Tasks</span>
            <span className="text-xl font-black text-stone-50 mt-1">{profile.active_tasks} / {profile.max_tasks}</span>
          </div>
          <div className="glass-warm rounded-2xl px-4 py-3 border border-emerald-700/40 flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-emerald-400">Reward Points</span>
            <span className="text-xl font-black text-emerald-300 mt-1">{profile.reward_points}</span>
          </div>
          <div className="glass-warm rounded-2xl px-4 py-3 border border-red-700/40 flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-red-400">Penalty Count</span>
            <span className="text-xl font-black text-red-300 mt-1">{profile.penalty_points}</span>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {tasks.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-32 text-center glass-warm rounded-[4rem] border border-stone-800/50 px-10 shadow-2xl relative overflow-hidden amber-glow"
          >
             <div className="absolute top-0 right-0 p-8 text-amber-500/10">
               <Sparkles className="w-40 h-40" />
             </div>
             <div className="w-24 h-24 glass rounded-[2rem] flex items-center justify-center mx-auto mb-10 text-emerald-500 border border-emerald-500/20 shadow-xl shadow-emerald-900/20">
               <ClipboardCheck className="w-12 h-12" />
             </div>
             <p className="text-stone-50 font-black text-4xl tracking-tighter mb-4">Shift Synchronized</p>
             <p className="text-stone-400 font-medium text-lg max-w-md mx-auto leading-relaxed">All assigned infrastructure nodes are currently verified. Standby for new spatial anomalies.</p>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-12"
          >
            {tasks.map((task) => (
              <motion.div 
                key={task.id} 
                layout
                whileHover={{ y: -5 }}
                className="glass-warm rounded-[4rem] shadow-2xl border border-stone-800 overflow-hidden group"
              >
                 <div className="p-12 bg-stone-900/40 border-b border-stone-800/50">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-600 rounded-2xl shadow-xl shadow-amber-900/30">
                          <Hammer className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-stone-600">Protocol Node #{task.id}</p>
                          <h4 className="font-black text-4xl tracking-tighter text-stone-50 uppercase mt-1">{task.type}</h4>
                        </div>
                      </div>
                      <div className="px-5 py-2 glass-light text-amber-400 text-[10px] font-black uppercase rounded-full tracking-[0.2em] border border-amber-500/20 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                        Live Dispatch
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-stone-400 glass-light px-6 py-4 rounded-2xl border border-white/5 w-fit">
                      <MapPin className="w-5 h-5 text-amber-500" />
                      <span className="text-sm font-bold tracking-wide">{task.location.address}</span>
                    </div>
                 </div>

                 <div className="p-12 space-y-12">
                    <div className="space-y-6">
                      <label className="text-[10px] font-black text-stone-600 uppercase tracking-[0.4em] flex items-center gap-3">
                        <div className="w-1.5 h-4 bg-amber-500 rounded-full"></div>
                        Anomaly Reference
                      </label>
                      <div className="aspect-video glass rounded-[3rem] overflow-hidden border border-white/5 relative shadow-inner group/ref">
                        {task.images?.resolved ? (
                          <img
                            src={`${IMG_BASE_URL}/${task.images.resolved}`}
                            alt="Resolved (YOLO-verified) Issue"
                            className="w-full h-full object-cover grayscale opacity-50 group-hover/ref:grayscale-0 group-hover/ref:opacity-100 transition-all duration-700"
                          />
                        ) : task.images?.original ? (
                          <img
                            src={`${IMG_BASE_URL}/${task.images.original}`}
                            alt="Issue"
                            className="w-full h-full object-cover grayscale opacity-50 group-hover/ref:grayscale-0 group-hover/ref:opacity-100 transition-all duration-700"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs font-bold text-stone-500">
                            No reference image available
                          </div>
                        )}
                        <div className="absolute top-6 right-6 glass px-4 py-2 rounded-xl text-[10px] font-black text-white uppercase tracking-widest border border-white/10">Reported State</div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <label className="text-[10px] font-black text-stone-600 uppercase tracking-[0.4em] flex items-center gap-3">
                        <div className="w-1.5 h-4 bg-emerald-500 rounded-full"></div>
                        Resolution Capture
                      </label>
                      
                      <div className="grid grid-cols-1 gap-6">
                        <label className="relative flex items-center justify-center w-full h-64 glass-warm border-4 border-dashed border-stone-800 rounded-[3rem] cursor-pointer hover:bg-stone-800 transition-all group overflow-hidden amber-glow">
                          {previews[task.id] ? (
                            <div className="absolute inset-0 w-full h-full">
                              <img src={previews[task.id]} alt="Proof" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                 <RefreshCcw className="w-10 h-10 text-white animate-spin-slow" />
                              </div>
                            </div>
                          ) : (
                            <div className="text-center group-hover:scale-105 transition-transform duration-500">
                              <div className="w-20 h-20 glass rounded-[2rem] flex items-center justify-center mx-auto mb-6 group-hover:bg-amber-600/20 group-hover:text-amber-500 transition-colors">
                                <ImageIcon className="w-10 h-10 text-stone-700 transition-colors" />
                              </div>
                              <p className="text-xs font-black text-stone-500 uppercase tracking-[0.3em]">Deploy Proof Capture</p>
                            </div>
                          )}
                          <input type="file" className="hidden" onChange={(e) => handleProofChange(task.id, e)} accept="image/*" />
                        </label>

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => completeTask(task)}
                          disabled={submitting === task.id || !proofs[task.id]}
                          className="w-full py-7 bg-amber-600 text-white font-black rounded-[2.5rem] shadow-2xl shadow-amber-900/40 hover:bg-amber-500 disabled:bg-stone-800 disabled:text-stone-600 disabled:shadow-none transition-all flex items-center justify-center gap-4 uppercase text-[10px] tracking-[0.3em]"
                        >
                          {submitting === task.id ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                          ) : (
                            <>
                              <ArrowUpCircle className="w-6 h-6" />
                              Transmit Resolution Data
                            </>
                          )}
                        </motion.button>
                      </div>
                    </div>
                 </div>
                 
                 <div className="px-12 pb-12 flex items-center gap-3">
                   <div className="w-1.5 h-1.5 rounded-full bg-stone-800"></div>
                   <div className="w-1.5 h-1.5 rounded-full bg-stone-800"></div>
                   <div className="w-1.5 h-1.5 rounded-full bg-stone-800"></div>
                   <span className="text-[10px] font-black text-stone-700 uppercase tracking-[0.5em] ml-auto">Bhopal Node Feed Active</span>
                 </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className="text-center pt-20">
        <p className="text-[10px] font-black text-stone-700 uppercase tracking-[0.6em] leading-loose">
          Secure Tunnel Protocol v4.20<br/>
          CivicResolve Spatial Mesh
        </p>
      </div>
    </div>
  );
};

export default WorkerView;