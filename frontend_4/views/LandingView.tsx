"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useSpring, useInView } from 'framer-motion';
import { 
  Activity, ShieldCheck, MapPin, Trash2, AlertTriangle, 
  ArrowRight, CheckCircle2, Globe, Users, Loader2, 
  X, Database, LayoutList, BarChart3, Filter, Sparkles,
  Zap, Eye, ChevronRight, Star, Cpu, Radio, Shield, Waves
} from 'lucide-react';
import { IncidentReport } from '../types';
import { api, endpoints } from '../lib/api';
import dynamic from 'next/dynamic';

const IncidentMap = dynamic(() => import('../components/IncidentMap'), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-slate-900/50 animate-pulse flex items-center justify-center text-slate-500 font-bold uppercase tracking-widest text-xs">Initializing Neural Map...</div>
});

interface LandingViewProps {
  onEnterPortal: () => void;
  onReportIssue: () => void;
}

const LandingView: React.FC<LandingViewProps> = ({ onEnterPortal, onReportIssue }) => {
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTable, setShowTable] = useState(false);
  const [stats, setStats] = useState({
    garbage: 0,
    potholes: 0,
    resolutionRate: "0",
    totalNodes: 0
  });

  useEffect(() => {
    const fetchPublicData = async () => {
      try {
        const res = await api.get<IncidentReport[]>(endpoints.admin.reports);
        const data = res.data;
        setIncidents(data);

        const garbageCount = data.filter(i => i.type.toLowerCase().includes('garbage')).length;
        const potholeCount = data.filter(i => i.type.toLowerCase().includes('pothole')).length;
        const resolved = data.filter(i => i.status === 'verified' || i.status === 'completed').length;
        const rate = data.length > 0 ? ((resolved / data.length) * 100).toFixed(1) : "0";

        setStats({
          garbage: garbageCount,
          potholes: potholeCount,
          resolutionRate: rate,
          totalNodes: data.length
        });
      } catch (err) {
        console.error("Failed to fetch database records:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPublicData();
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.3 }
    }
  };

  const itemVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1, 
      transition: { type: 'spring', damping: 20, stiffness: 100 } 
    }
  };

  // Scroll-based animations
  const { scrollY } = useScroll();
  const heroRef = useRef<HTMLDivElement>(null);
  const heroInView = useInView(heroRef, { once: true });
  
  const navBackground = useTransform(scrollY, [0, 100], ['rgba(3, 7, 18, 0)', 'rgba(3, 7, 18, 0.95)']);
  const navY = useTransform(scrollY, [0, 100], [0, 0]);
  const springNav = useSpring(navY, { stiffness: 100, damping: 20 });

  // Cursor glow effect
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
  }, []);

  // Floating particles component
  const FloatingParticles = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(30)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-violet-500/30"
          initial={{ 
            x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000), 
            y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800) 
          }}
          animate={{
            y: [null, Math.random() * -500 - 100],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: Math.random() * 10 + 10,
            repeat: Infinity,
            delay: Math.random() * 5,
          }}
        />
      ))}
    </div>
  );

  // Animated counter component
  const AnimatedCounter = ({ value, suffix = '' }: { value: number | string; suffix?: string }) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    const [count, setCount] = useState(0);
    const counterRef = useRef<HTMLSpanElement>(null);
    const inView = useInView(counterRef, { once: true });

    useEffect(() => {
      if (inView) {
        const duration = 2000;
        const steps = 60;
        const increment = numValue / steps;
        let current = 0;
        const timer = setInterval(() => {
          current += increment;
          if (current >= numValue) {
            setCount(numValue);
            clearInterval(timer);
          } else {
            setCount(Math.floor(current));
          }
        }, duration / steps);
        return () => clearInterval(timer);
      }
    }, [inView, numValue]);

    return <span ref={counterRef}>{count}{suffix}</span>;
  };

  // Magnetic button component
  const MagneticButton = ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) => {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e: React.MouseEvent) => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) * 0.2;
      const y = (e.clientY - rect.top - rect.height / 2) * 0.2;
      setPosition({ x, y });
    };

    const handleMouseLeave = () => setPosition({ x: 0, y: 0 });

    return (
      <motion.button
        ref={buttonRef}
        onClick={onClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        animate={{ x: position.x, y: position.y }}
        transition={{ type: 'spring', stiffness: 150, damping: 15 }}
        className={className}
      >
        {children}
      </motion.button>
    );
  };

  // 3D Tilt Card Component
  const TiltCard = ({ children, className }: { children: React.ReactNode; className?: string }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [rotateX, setRotateX] = useState(0);
    const [rotateY, setRotateY] = useState(0);
    const [glarePosition, setGlarePosition] = useState({ x: 50, y: 50 });

    const handleMouseMove = (e: React.MouseEvent) => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const rotateXVal = ((e.clientY - centerY) / (rect.height / 2)) * -10;
      const rotateYVal = ((e.clientX - centerX) / (rect.width / 2)) * 10;
      setRotateX(rotateXVal);
      setRotateY(rotateYVal);
      setGlarePosition({
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100
      });
    };

    const handleMouseLeave = () => {
      setRotateX(0);
      setRotateY(0);
      setGlarePosition({ x: 50, y: 50 });
    };

    return (
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        animate={{ rotateX, rotateY }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{ transformStyle: 'preserve-3d', perspective: 1000 }}
        className={className}
      >
        {children}
        <div 
          className="absolute inset-0 rounded-[inherit] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at ${glarePosition.x}% ${glarePosition.y}%, rgba(255,255,255,0.15) 0%, transparent 50%)`
          }}
        />
      </motion.div>
    );
  };

  // Text reveal animation variants
  const textRevealVariants = {
    hidden: { opacity: 0, y: 50, filter: 'blur(10px)' },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        delay: i * 0.1,
        duration: 0.8,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    })
  };

  // Hover glow effect state
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  // Civic issue resolution workflow steps for roadmap section
  const workflowSteps = [
    {
      id: '01',
      title: 'Issue Captured',
      subtitle: 'Citizen or camera spots a problem',
      description:
        'A resident submits a photo through the portal or a roadside camera node flags an anomaly in real-time.',
      icon: AlertTriangle,
      accent: 'from-amber-500/80 to-orange-500/60',
    },
    {
      id: '02',
      title: 'AI Detection & Labelling',
      subtitle: 'YOLOv8 civic model in action',
      description:
        'Our trained YOLO model detects potholes, garbage, broken signs and more, tagging each frame with precise boxes and classes.',
      icon: Cpu,
      accent: 'from-violet-500/80 to-cyan-400/70',
    },
    {
      id: '03',
      title: 'Validation & De-duplication',
      subtitle: 'Smart checks on reports',
      description:
        'Location-aware validators merge duplicate reports, verify GPS context and ensure only high-quality issues enter the queue.',
      icon: ShieldCheck,
      accent: 'from-emerald-500/80 to-teal-400/70',
    },
    {
      id: '04',
      title: 'Assignment to Worker',
      subtitle: 'Optimised task routing',
      description:
        'The worker workflow engine assigns the incident to the nearest available field worker with the right capabilities.',
      icon: Users,
      accent: 'from-sky-500/80 to-indigo-500/70',
    },
    {
      id: '05',
      title: 'On-ground Fix & Proof',
      subtitle: 'Worker closes the loop',
      description:
        'Workers upload an on-site photo after fixing the issue. The system stores both the original and resolved evidence.',
      icon: CheckCircle2,
      accent: 'from-emerald-500/80 to-lime-400/70',
    },
    {
      id: '06',
      title: 'Dual Verification & Closure',
      subtitle: 'Camera + AI sign-off',
      description:
        'Verification workflows compare the worker upload with latest camera frames and model confidence before marking it resolved.',
      icon: Shield,
      accent: 'from-cyan-500/80 to-violet-500/70',
    },
  ];

  return (
    <div
      className="relative min-h-screen mesh-gradient-cyber selection:bg-violet-500/30 overflow-x-hidden text-slate-100 noise-overlay"
      onMouseMove={handleMouseMove}
    >
      {/* Background video layer (behind content but above body) */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <video
          className="h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
        >
          <source src="/video/civic_city.mp4" type="video/mp4" />
        </video>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-black/90" />
      </div>

      {/* Cursor Glow */}
      <div
        className="fixed w-[500px] h-[500px] rounded-full pointer-events-none z-10 opacity-30 blur-[100px] transition-transform duration-300"
        style={{
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)',
          left: mousePosition.x - 250,
          top: mousePosition.y - 250,
        }}
      />

      {/* Floating Particles */}
      <div className="relative z-10">
        <FloatingParticles />
      </div>
      
      {/* Background Orbs */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity }}
          className="orb top-[5%] left-[10%] w-[600px] h-[600px] bg-violet-600/20"
        />
        <motion.div 
          animate={{ scale: [1.1, 0.9, 1.1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 10, repeat: Infinity, delay: 2 }}
          className="orb bottom-[10%] right-[5%] w-[700px] h-[700px] bg-cyan-500/15"
        />
        <motion.div 
          animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.25, 0.35, 0.25] }}
          transition={{ duration: 12, repeat: Infinity, delay: 4 }}
          className="orb top-[40%] right-[30%] w-[400px] h-[400px] bg-indigo-500/15"
        />
      </div>

      {/* Navigation */}
      <motion.nav 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.2 }}
        style={{ background: navBackground }}
        className="fixed top-0 inset-x-0 h-20 z-50 px-6 border-b border-violet-500/10 backdrop-blur-xl"
      >
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
          <motion.div 
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <motion.div 
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.6 }}
              className="p-2.5 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl shadow-lg shadow-violet-500/30 relative"
            >
              <Activity className="w-5 h-5 text-white relative z-10" />
              <div className="absolute inset-0 bg-gradient-to-br from-violet-400 to-cyan-400 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </motion.div>
            <motion.span 
              className="font-black text-2xl tracking-tighter text-white"
              whileHover={{ letterSpacing: '0.05em' }}
              transition={{ duration: 0.3 }}
            >
              Civic<span className="gradient-text-animated">Resolve</span>
            </motion.span>
          </motion.div>
          
          <div className="flex items-center gap-8">
            <motion.button 
              whileHover={{ scale: 1.05, x: 5 }}
              onClick={() => setShowTable(true)}
              className="hidden md:flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-violet-300 transition-all duration-300 group"
            >
              <Eye className="w-4 h-4 group-hover:text-cyan-400 transition-colors" />
              <span>Live Feed</span>
              <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all -ml-1" />
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.05, x: 5 }}
              onClick={onReportIssue}
              className="hidden md:flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-emerald-300 transition-all duration-300 group"
            >
              <AlertTriangle className="w-4 h-4 group-hover:text-emerald-400 transition-colors" />
              <span>Report Issue</span>
              <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all -ml-1" />
            </motion.button>
            <MagneticButton 
              onClick={onEnterPortal}
              className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-black rounded-xl shadow-xl shadow-violet-500/25 hover:shadow-violet-500/40 transition-all text-sm flex items-center gap-2 group relative overflow-hidden"
            >
              <span className="relative z-10">Control Center</span>
              <ArrowRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform" />
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </MagneticButton>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section ref={heroRef} className="relative pt-48 pb-32 px-6 z-10">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate={heroInView ? "visible" : "hidden"}
          className="max-w-7xl mx-auto text-center"
        >
          <motion.div 
            variants={itemVariants} 
            className="inline-flex items-center gap-3 px-6 py-3 glass-light rounded-full text-violet-300 text-[10px] font-black uppercase tracking-[0.25em] mb-12 shimmer"
          >
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            >
              <Cpu className="w-4 h-4 text-cyan-400" />
            </motion.div>
            <span>Bhopal Smart Infrastructure Node</span>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </motion.div>
          
          <motion.h1 
            variants={itemVariants} 
            className="text-7xl md:text-[10rem] font-black tracking-tighter leading-[0.8] mb-14"
          >
            <motion.span 
              className="text-white text-glow inline-block"
              whileHover={{ scale: 1.05, textShadow: '0 0 60px rgba(139, 92, 246, 0.8)' }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              HARMONIOUS
            </motion.span>
            <br/>
            <motion.span 
              className="gradient-text-animated inline-block"
              animate={{ 
                backgroundPosition: ['0% center', '200% center'],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              whileHover={{ scale: 1.02 }}
            >
              URBAN FLOW
            </motion.span>
          </motion.h1>

          <motion.p 
            variants={itemVariants} 
            className="max-w-2xl mx-auto text-slate-400 text-xl font-medium mb-16 leading-relaxed"
          >
            A gentle yet powerful gaze over Bhopal{' '}
            <motion.span 
              className="text-violet-400 inline-block"
              whileHover={{ 
                color: '#22d3ee',
                textShadow: '0 0 20px rgba(34, 211, 238, 0.5)',
                scale: 1.05
              }}
              transition={{ duration: 0.2 }}
            >
              Our AI
            </motion.span>. 
            nodes identify infrastructure needs with precision, ensuring every street feels like home.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-wrap justify-center gap-6">
            <MagneticButton 
              onClick={() => setShowTable(true)}
              className="magnetic-btn px-12 py-6 bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-600 text-white font-black rounded-3xl shadow-2xl shadow-violet-500/30 flex items-center gap-3 group relative overflow-hidden hover:shadow-violet-500/50 hover:shadow-[0_0_60px_rgba(139,92,246,0.5)] transition-all duration-500"
            >
              {/* Animated background shimmer */}
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
              />
              {/* Ripple effect on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0 bg-white/10 rounded-full group-hover:w-[200%] group-hover:h-[200%] transition-all duration-700" />
              </div>
              {/* Border glow */}
              <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 border-2 border-cyan-400/50 blur-[1px]" />
              <span className="relative z-10 flex items-center gap-3">
                <motion.span
                  className="group-hover:tracking-wider transition-all duration-300"
                  whileHover={{ scale: 1.05 }}
                >
                  Explore Live Data
                </motion.span>
                <motion.div
                  animate={{ x: [0, 5, 0], rotate: [0, 10, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="group-hover:text-cyan-300 transition-colors duration-300"
                >
                  <Zap className="w-5 h-5 group-hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                </motion.div>
              </span>
              {/* Gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/20 to-violet-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl" />
            </MagneticButton>

            {/* Report Issue Button */}
            <MagneticButton 
              onClick={onReportIssue}
              className="magnetic-btn px-12 py-6 bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-600 text-white font-black rounded-3xl shadow-2xl shadow-emerald-500/30 flex items-center gap-3 group relative overflow-hidden hover:shadow-emerald-500/50 hover:shadow-[0_0_60px_rgba(16,185,129,0.5)] transition-all duration-500"
            >
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
              />
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0 bg-white/10 rounded-full group-hover:w-[200%] group-hover:h-[200%] transition-all duration-700" />
              </div>
              <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 border-2 border-emerald-400/50 blur-[1px]" />
              <span className="relative z-10 flex items-center gap-3">
                <motion.span
                  className="group-hover:tracking-wider transition-all duration-300"
                  whileHover={{ scale: 1.05 }}
                >
                  Report an Issue
                </motion.span>
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="group-hover:text-emerald-300 transition-colors duration-300"
                >
                  <AlertTriangle className="w-5 h-5 group-hover:drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                </motion.div>
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/20 to-green-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl" />
            </MagneticButton>
            
            <motion.div 
              whileHover={{ scale: 1.02, borderColor: 'rgba(139, 92, 246, 0.5)' }}
              className="px-10 py-6 glass-cyber rounded-3xl flex items-center gap-5 group border border-violet-500/20 transition-all duration-300"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="relative"
              >
                <Radio className="w-6 h-6 text-cyan-400" />
                <div className="absolute inset-0 bg-cyan-400/30 rounded-full blur-md" />
              </motion.div>
              <div className="text-left">
                <p className="text-3xl font-black leading-none text-white">
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <AnimatedCounter value={stats.totalNodes} />}
                </p>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Live Nodes Active</p>
              </div>
            </motion.div>
          </motion.div>
          
          {/* Scroll Indicator */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5 }}
            whileHover={{ scale: 1.1 }}
            className="mt-24 flex flex-col items-center gap-2 cursor-pointer group"
          >
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-6 h-10 rounded-full border-2 border-violet-500/30 flex items-start justify-center p-2 group-hover:border-violet-500/60 group-hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all duration-300"
            >
              <motion.div 
                animate={{ height: ['20%', '60%', '20%'] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-1 bg-violet-500 rounded-full group-hover:bg-cyan-400 transition-colors"
              />
            </motion.div>
            <motion.span 
              className="text-[10px] font-bold uppercase tracking-widest text-slate-600 group-hover:text-violet-400 transition-colors"
              whileHover={{ letterSpacing: '0.3em' }}
            >
              Scroll to explore
            </motion.span>
          </motion.div>
        </motion.div>
      </section>

      {/* Stats Bento Grid */}
      <section className="py-24 px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-4 gap-6"
          >
            {/* Large Card - Garbage */}
            <motion.div 
              variants={itemVariants}
              whileHover={{ scale: 1.02, rotateY: 5 }}
              className="md:col-span-2 p-10 glass-card rounded-[3rem] flex flex-col justify-between h-80 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="flex justify-between items-start relative z-10">
                <motion.div 
                  whileHover={{ rotate: 15, scale: 1.1 }}
                  className="p-5 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20"
                >
                  <Trash2 className="w-8 h-8" />
                </motion.div>
                <div className="px-4 py-2 glass-light text-emerald-300 rounded-full text-[9px] font-black tracking-widest uppercase flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Sanitation Focus
                </div>
              </div>
              <div className="relative z-10">
                <h3 className="text-7xl font-black tracking-tighter mb-2 text-white">
                  {loading ? <Loader2 className="w-8 h-8 animate-spin inline" /> : <AnimatedCounter value={stats.garbage} />}
                </h3>
                <p className="text-slate-500 font-bold uppercase text-xs tracking-[0.2em]">Garbage Reports in Database</p>
              </div>
            </motion.div>

            {/* Pothole Card */}
            <motion.div 
              variants={itemVariants}
              whileHover={{ scale: 1.02, rotateY: -5 }}
              className="p-10 glass-card rounded-[3rem] flex flex-col justify-between h-80 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-orange-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <motion.div 
                whileHover={{ rotate: -15, scale: 1.1 }}
                className="p-5 bg-orange-500/10 text-orange-400 rounded-2xl border border-orange-500/20 w-fit"
              >
                <AlertTriangle className="w-8 h-8" />
              </motion.div>
              <div className="relative z-10">
                <h3 className="text-7xl font-black tracking-tighter mb-2 text-white">
                  {loading ? '...' : <AnimatedCounter value={stats.potholes} />}
                </h3>
                <p className="text-slate-500 font-bold uppercase text-xs tracking-[0.2em]">Pothole Repairs</p>
              </div>
            </motion.div>

            {/* Resolution Rate Card */}
            <motion.div 
              variants={itemVariants}
              whileHover={{ scale: 1.02 }}
              className="p-10 bg-gradient-to-br from-violet-600 via-indigo-600 to-violet-700 rounded-[3rem] flex flex-col justify-between h-80 shadow-2xl shadow-violet-900/40 relative group overflow-hidden violet-glow"
            >
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNiIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiLz48L2c+PC9zdmc+')] opacity-30" />
              <motion.div 
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.6 }}
                className="p-5 bg-white/20 rounded-2xl border border-white/20 w-fit relative z-10 backdrop-blur-sm"
              >
                <CheckCircle2 className="w-8 h-8 text-white" />
              </motion.div>
              <div className="relative z-10">
                <h3 className="text-7xl font-black tracking-tighter mb-2 text-white">
                  {loading ? '...' : <><AnimatedCounter value={stats.resolutionRate} />%</>}
                </h3>
                <p className="text-violet-200 font-bold uppercase text-xs tracking-[0.2em]">Resolution Score</p>
              </div>
              {/* Animated rings */}
              <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute -bottom-20 -right-20 w-60 h-60 border border-white/10 rounded-full" 
              />
              <motion.div 
                animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
                className="absolute -bottom-10 -right-10 w-40 h-40 border border-white/10 rounded-full" 
              />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Civic Issue Resolution Roadmap */}
      <section className="py-32 px-6 relative z-10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1.2fr,1fr] gap-16 items-start">
          {/* Left: Intro text */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-3 px-4 py-2 glass-light rounded-full text-[10px] font-black uppercase tracking-[0.3em] text-violet-300">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Issue → Insight → Impact</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-white leading-tight">
              A calm, step-by-step
              <br />
              <span className="gradient-text-animated">civic resolution roadmap</span>
            </h2>
            <p className="text-slate-400 text-lg max-w-xl font-medium">
              Follow how every pothole, garbage patch or broken sign moves from raw image to verified resolution through the
              CivicResolve pipeline.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs font-black uppercase tracking-[0.25em] text-slate-500">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.7)]" />
                <span>AI-Assisted Triage</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]" />
                <span>Human-in-the-Loop Verification</span>
              </div>
            </div>
          </motion.div>

          {/* Right: Vertical roadmap timeline */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            className="relative glass-cyber rounded-[2.5rem] border border-violet-500/20 p-8 md:p-10 overflow-hidden"
          >
            {/* Vertical line */}
            <div className="absolute left-8 top-10 bottom-10 w-px bg-gradient-to-b from-violet-500/40 via-slate-700/40 to-emerald-400/40" />

            <div className="space-y-8 relative">
              {workflowSteps.map((step, index) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.08 }}
                  className="relative pl-14"
                >
                  {/* Dot + icon */}
                  <div className="absolute left-4 top-2 flex items-center justify-center">
                    <div className="w-7 h-7 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center relative">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500/40 to-cyan-400/40 blur-md opacity-60" />
                      <step.icon className="w-4 h-4 text-slate-50 relative z-10" />
                    </div>
                  </div>

                  <div className="glass-card rounded-2xl p-4 md:p-5 border border-slate-700/60 bg-slate-900/70">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                        {step.id}
                      </span>
                      <div
                        className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.25em] bg-gradient-to-r ${step.accent} text-slate-50`}
                      >
                        Stage
                      </div>
                    </div>
                    <h3 className="text-sm md:text-base font-black text-slate-50 mb-1">
                      {step.title}
                    </h3>
                    <p className="text-[11px] md:text-xs font-bold text-slate-400 mb-2">
                      {step.subtitle}
                    </p>
                    <p className="text-[11px] md:text-xs text-slate-500 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Interactive Map Section */}
      <section className="py-32 px-6 relative z-10">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-10">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-4"
            >
              <div className="flex items-center gap-3 mb-2">
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                >
                  <Globe className="w-6 h-6 text-cyan-400" />
                </motion.div>
                <span className="text-xs font-black uppercase tracking-widest text-cyan-400">Spatial Intelligence</span>
              </div>
              <h2 className="text-5xl md:text-6xl font-black tracking-tighter text-white">
                <motion.span
                  whileHover={{ textShadow: '0 0 30px rgba(34, 211, 238, 0.5)' }}
                  className="inline-block"
                >
                  Civic
                </motion.span>{' '}
                <motion.span 
                  className="gradient-text-animated inline-block"
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  Cartography
                </motion.span>
              </h2>
              <p className="text-slate-400 text-lg max-w-xl font-medium">
                Visualizing every coordinate and report stored within the civicresolve.db. Centered on Bhopal Metro.
              </p>
            </motion.div>
            <motion.div 
              whileHover={{ scale: 1.02, borderColor: 'rgba(139, 92, 246, 0.5)' }}
              className="flex items-center gap-5 glass-cyber px-8 py-5 rounded-3xl border border-violet-500/20 transition-all duration-300"
            >
              <motion.div 
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-12 h-12 bg-violet-500/20 text-violet-400 rounded-2xl flex items-center justify-center border border-violet-500/20 relative"
              >
                <MapPin className="w-6 h-6" />
                <div className="absolute inset-0 bg-violet-500/20 rounded-2xl blur-lg" />
              </motion.div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Neural Focus Zone</p>
                <p className="font-black text-white uppercase tracking-wider text-sm">Bhopal, MP, India</p>
              </div>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-cyber p-4 rounded-[4rem] overflow-hidden h-[750px] relative border border-violet-500/20 shadow-2xl violet-glow"
          >
            {/* Map Legend */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="absolute top-12 right-12 z-10 glass-cyber px-8 py-8 rounded-[2.5rem] border border-violet-500/20 space-y-6 shadow-2xl"
            >
              <motion.div 
                className="flex items-center gap-4 group cursor-pointer"
                whileHover={{ x: 5, scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <motion.div 
                  whileHover={{ scale: 1.3 }}
                  className="w-5 h-5 rounded-full bg-orange-500 ring-4 ring-orange-500/20 shadow-lg shadow-orange-500/40 pulse-ring"
                />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 group-hover:text-orange-400 transition-colors">Pending Analysis</span>
              </motion.div>
              <motion.div 
                className="flex items-center gap-4 group cursor-pointer"
                whileHover={{ x: 5, scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <motion.div 
                  whileHover={{ scale: 1.3 }}
                  className="w-5 h-5 rounded-full bg-cyan-400 ring-4 ring-cyan-400/20 shadow-lg shadow-cyan-400/40"
                />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 group-hover:text-cyan-400 transition-colors">Active Resolution</span>
              </motion.div>
              <motion.div 
                className="flex items-center gap-4 group cursor-pointer"
                whileHover={{ x: 5, scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <motion.div 
                  whileHover={{ scale: 1.3 }}
                  className="w-5 h-5 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20 shadow-lg shadow-emerald-400/40"
                />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 group-hover:text-emerald-400 transition-colors">Resolved</span>
              </motion.div>
              <div className="pt-6 border-t border-violet-500/20">
                 <MagneticButton 
                  onClick={() => setShowTable(true)}
                  className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-violet-500/30 hover:shadow-xl rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                 >
                   Access Data Matrix
                 </MagneticButton>
              </div>
            </motion.div>
            
            {/* Scanning line effect */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[3.5rem]">
              <motion.div 
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"
              />
            </div>
            
            <IncidentMap incidents={incidents} center={[23.2599, 77.4126]} zoom={13} />
          </motion.div>
        </div>
      </section>

      {/* Dataset Summary Modal */}
      <AnimatePresence>
        {showTable && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-12"
          >
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#030712]/90 backdrop-blur-2xl" 
              onClick={() => setShowTable(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, y: 60, opacity: 0, rotateX: 10 }}
              animate={{ scale: 1, y: 0, opacity: 1, rotateX: 0 }}
              exit={{ scale: 0.9, y: 60, opacity: 0, rotateX: -10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="glass-cyber w-full max-w-6xl h-full max-h-[85vh] rounded-[3.5rem] border border-violet-500/20 relative z-10 flex flex-col overflow-hidden shadow-2xl violet-glow"
            >
              {/* Modal Header */}
              <div className="p-12 border-b border-violet-500/10 flex items-center justify-between bg-slate-900/40 backdrop-blur-xl">
                <div>
                  <div className="flex items-center gap-4 mb-3">
                    <motion.div 
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                      className="p-3 bg-violet-600/20 rounded-2xl border border-violet-500/30"
                    >
                      <Database className="w-8 h-8 text-violet-400" />
                    </motion.div>
                    <h2 className="text-4xl font-black tracking-tighter text-white">
                      Data <span className="gradient-text-animated">Matrix</span>
                    </h2>
                  </div>
                  <p className="text-slate-400 text-lg font-medium">Real-time infrastructure intelligence feed from neural network.</p>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowTable(false)}
                  className="w-16 h-16 glass-cyber rounded-3xl flex items-center justify-center hover:bg-violet-500/20 transition-colors border border-violet-500/20"
                >
                  <X className="w-8 h-8 text-slate-400" />
                </motion.button>
              </div>

              {/* Data Stats */}
              <div className="flex-1 overflow-y-auto p-12 hide-scrollbar bg-[#030712]/40">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                   <motion.div 
                     whileHover={{ scale: 1.02 }}
                     className="p-8 glass-card rounded-3xl border border-violet-500/10"
                   >
                      <BarChart3 className="w-6 h-6 text-cyan-400 mb-4" />
                      <p className="text-3xl font-black text-white">{incidents.length}</p>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Neural Indexed Records</p>
                   </motion.div>
                   <motion.div 
                     whileHover={{ scale: 1.02 }}
                     className="p-8 glass-card rounded-3xl border border-violet-500/10"
                   >
                      <Shield className="w-6 h-6 text-violet-400 mb-4" />
                      <p className="text-3xl font-black text-white">Bhopal Central</p>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Active Scanning Zone</p>
                   </motion.div>
                </div>

                <table className="w-full text-left border-separate border-spacing-y-3">
                  <thead>
                    <tr className="text-[11px] font-black text-slate-600 uppercase tracking-[0.3em]">
                      <th className="px-8 pb-4">Node ID</th>
                      <th className="px-8 pb-4">Classification</th>
                      <th className="px-8 pb-4">Coordinates</th>
                      <th className="px-8 pb-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.map((inc, index) => (
                      <motion.tr 
                        key={inc.id} 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="group cursor-default"
                      >
                        <td className="px-8 py-5 glass-cyber rounded-l-2xl text-violet-400 font-black">
                          <span className="flex items-center gap-2">
                            <Cpu className="w-3 h-3" />
                            #{inc.id.toString().padStart(4, '0')}
                          </span>
                        </td>
                        <td className="px-8 py-5 glass-cyber">
                          <span className="text-sm font-black uppercase tracking-wider text-slate-200 group-hover:text-cyan-300 transition-colors">
                            {inc.type}
                          </span>
                        </td>
                        <td className="px-8 py-5 glass-cyber">
                          <div className="flex items-center gap-2 text-slate-500 group-hover:text-slate-300 transition-colors">
                            <MapPin className="w-3.5 h-3.5 text-violet-400" />
                            <p className="text-xs font-bold truncate max-w-[250px]">{inc.location.address}</p>
                          </div>
                        </td>
                        <td className="px-8 py-5 glass-cyber rounded-r-2xl">
                          <div className="flex items-center gap-3">
                            <motion.div 
                              animate={inc.status === 'verified' || inc.status === 'completed' ? {} : { scale: [1, 1.2, 1] }}
                              transition={{ duration: 1, repeat: Infinity }}
                              className={`w-2.5 h-2.5 rounded-full ${inc.status === 'verified' || inc.status === 'completed' ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]' : 'bg-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.5)]'}`}
                            />
                            <span className={`text-[10px] font-black uppercase tracking-widest ${inc.status === 'verified' || inc.status === 'completed' ? 'text-emerald-400' : 'text-orange-400'}`}>
                              {inc.status}
                            </span>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="p-8 border-t border-violet-500/10 bg-slate-900/40 text-center backdrop-blur-xl">
                 <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-600 flex items-center justify-center gap-3">
                   <motion.div 
                     animate={{ opacity: [0.5, 1, 0.5] }}
                     transition={{ duration: 2, repeat: Infinity }}
                     className="w-2 h-2 rounded-full bg-cyan-400"
                   />
                   Neural Sync Active • Encrypted Channel v5.0
                 </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="py-40 relative z-10 border-t border-violet-500/10 bg-[#030712]/90">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-24">
            <div className="md:col-span-2 space-y-12">
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="flex items-center gap-4 cursor-pointer group"
              >
                <motion.div 
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.6 }}
                  className="p-3 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl shadow-lg shadow-violet-500/30"
                >
                  <Activity className="w-8 h-8 text-white" />
                </motion.div>
                <span className="font-black text-4xl tracking-tighter text-white">
                  Civic<span className="gradient-text-animated">Resolve</span>
                </span>
              </motion.div>
              <motion.p 
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="text-slate-400 text-xl font-medium leading-relaxed max-w-lg"
              >
                Next-generation urban intelligence platform. Empowering{' '}
                <motion.span 
                  className="text-violet-400 inline-block"
                  whileHover={{ 
                    scale: 1.05, 
                    color: '#22d3ee',
                    textShadow: '0 0 20px rgba(34, 211, 238, 0.5)' 
                  }}
                >
                  Bhopal's smart city
                </motion.span>{' '}
                initiative through neural vision and predictive analytics.
              </motion.p>
              <div className="flex gap-10">
                 {[
                   { name: 'Twitter', icon: Waves },
                   { name: 'Journal', icon: Database },
                   { name: 'Network', icon: Globe }
                 ].map((s) => (
                   <motion.a 
                     key={s.name} 
                     href="#" 
                     whileHover={{ y: -5, scale: 1.1 }}
                     whileTap={{ scale: 0.95 }}
                     className="text-xs font-black uppercase tracking-widest text-slate-600 hover:text-violet-400 transition-colors flex items-center gap-2 group relative"
                   >
                     <motion.div
                       whileHover={{ rotate: 360 }}
                       transition={{ duration: 0.5 }}
                     >
                       <s.icon className="w-4 h-4 group-hover:text-cyan-400 transition-colors" />
                     </motion.div>
                     <span className="underline-reveal">{s.name}</span>
                   </motion.a>
                 ))}
              </div>
            </div>
            
            <div>
              <h4 className="font-black uppercase tracking-[0.4em] text-[10px] text-violet-400/60 mb-10 flex items-center gap-2">
                <Cpu className="w-3 h-3" />
                Architecture
              </h4>
              <ul className="space-y-8 text-sm font-bold text-slate-500">
                <motion.li 
                  whileHover={{ x: 10, scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  <a href="#" className="hover:text-violet-400 transition-colors flex items-center gap-2 group">
                    <motion.div whileHover={{ x: 3 }}>
                      <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-cyan-400" />
                    </motion.div>
                    <span className="underline-reveal">Neural Mapping v5</span>
                  </a>
                </motion.li>
                <motion.li 
                  whileHover={{ x: 10, scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  <a href="#" className="hover:text-violet-400 transition-colors flex items-center gap-2 group">
                    <motion.div whileHover={{ x: 3 }}>
                      <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-cyan-400" />
                    </motion.div>
                    <span className="underline-reveal">YOLO Detection Core</span>
                  </a>
                </motion.li>
                <motion.li 
                  whileHover={{ x: 10, scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  <a href="#" className="hover:text-violet-400 transition-colors flex items-center gap-2 group">
                    <motion.div whileHover={{ x: 3 }}>
                      <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-cyan-400" />
                    </motion.div>
                    <span className="underline-reveal">Worker API Mesh</span>
                  </a>
                </motion.li>
              </ul>
            </div>

            <div className="space-y-10">
              <h4 className="font-black uppercase tracking-[0.4em] text-[10px] text-violet-400/60 mb-10 flex items-center gap-2">
                <Radio className="w-3 h-3" />
                System State
              </h4>
              <motion.div 
                whileHover={{ scale: 1.02, borderColor: 'rgba(139, 92, 246, 0.3)' }}
                className="p-10 glass-cyber rounded-[2.5rem] border border-violet-500/10 space-y-8 transition-all duration-300"
              >
                <div>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Neural Core</p>
                  <p className="text-xs font-black text-emerald-400 flex items-center gap-3">
                    <motion.div 
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                    />
                    ALL SYSTEMS NOMINAL
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Latency</p>
                  <p className="text-xs font-black text-cyan-400">OPTIMAL • 8ms Neural Sync</p>
                </div>
              </motion.div>
            </div>
          </div>
          
          <div className="mt-40 pt-16 border-t border-violet-500/10 flex flex-col md:flex-row items-center justify-between gap-10 text-slate-600 text-[10px] font-black uppercase tracking-[0.6em]">
            <span>&copy; {new Date().getFullYear()} Bhopal Smart City Initiative</span>
            <motion.span 
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="text-violet-500/50 flex items-center gap-2"
            >
              <Eye className="w-3 h-3" />
              Neural Vision Active
            </motion.span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingView;