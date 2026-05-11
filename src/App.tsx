/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronRight, 
  ArrowLeft, 
  Target, 
  User, 
  Zap, 
  Clock, 
  Bell, 
  ShieldCheck, 
  Sparkles,
  Trophy,
  Home,
  BarChart2,
  Settings,
  Flame,
  CheckCircle2,
  Brain,
  MinusCircle,
  Smile,
  Quote,
  ArrowRight,
  Shield,
  AlertTriangle,
  RotateCcw,
  MessageSquare,
  Activity
} from 'lucide-react';
import { generateHabitPlan, generateIntervention, generateCoachingResponse } from './lib/gemini';

// --- Types ---

interface UrgeLog {
  id: string;
  habit: string;
  trigger: string;
  feeling: string;
  timestamp: Date;
  resisted: boolean;
  reflection?: string;
}

interface Habit {
  id: string;
  title: string;
  type: 'positive' | 'negative';
  xp: number;
  completed: boolean;
  streak: number;
  time?: string;
  category: string;
}

type LevelBracket = 'Initiate' | 'Seeker' | 'Sentinel' | 'Guardian' | 'Architect of Will';

type OnboardingStep = 
  | 'welcome' 
  | 'goal' 
  | 'identity' 
  | 'obstacle'
  | 'difficulty' 
  | 'generating' 
  | 'plan' 
  | 'notifications' 
  | 'account' 
  | 'setup' 
  | 'celebration' 
  | 'dashboard'
  | 'resistance_center'
  | 'urge_log'
  | 'relapse_recovery'
  | 'ai_coach';

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

interface HabitPlan {
  title: string;
  steps: { day: string; action: string; psychology: string }[];
  motivation: string;
}

// --- Components ---

const ProgressBar = ({ currentStep, totalSteps }: { currentStep: number, totalSteps: number }) => {
  const progress = (currentStep / totalSteps) * 100;
  return (
    <div className="fixed top-0 left-0 w-full px-6 py-8 z-50 pointer-events-none">
      <div className="max-w-md mx-auto h-1.5 bg-slate-200/50 rounded-full overflow-hidden backdrop-blur-sm">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="h-full bg-arctic-navy"
        />
      </div>
    </div>
  );
};

const LevelUpOverlay = ({ level, bracket, onClose }: { level: number, bracket: LevelBracket, onClose: () => void, key?: string }) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-arctic-navy/95 backdrop-blur-2xl flex items-center justify-center p-8 text-center"
    >
      <div className="max-w-xs w-full space-y-8">
        <motion.div 
          initial={{ scale: 0.5, rotate: -20, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="w-32 h-32 bg-arctic-teal rounded-[2rem] mx-auto flex items-center justify-center shadow-[0_0_50px_rgba(79,209,197,0.4)]"
        >
          <Trophy className="w-16 h-16 text-arctic-navy" />
        </motion.div>
        
        <div className="space-y-2">
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-xs font-bold text-arctic-teal uppercase tracking-[0.3em]"
          >
            Evolution Complete
          </motion.p>
          <motion.h2 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-5xl font-black text-white"
          >
            Level {level}
          </motion.h2>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-white/40 font-medium"
          >
            New Title: <span className="text-white font-bold">{bracket}</span>
          </motion.p>
        </div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="p-6 bg-white/5 rounded-card border border-white/10"
        >
          <p className="text-sm text-arctic-teal font-bold mb-1">+200 Arctic Credits</p>
          <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Unlocks Guardian Themes</p>
        </motion.div>

        <motion.button 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1 }}
          onClick={onClose}
          className="w-full bg-white text-arctic-navy font-black py-5 rounded-button shadow-xl"
        >
          CONTINUE ASCENT
        </motion.button>
      </div>
    </motion.div>
  );
};

export default function App() {
  const [step, setStep] = useState<OnboardingStep>('dashboard');
  const [goal, setGoal] = useState('');
  const [identity, setIdentity] = useState('Disciplined Creator');
  const [obstacle, setObstacle] = useState('');
  const [difficulty, setDifficulty] = useState('Intermediate');
  const [aiPlan, setAiPlan] = useState<HabitPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mood, setMood] = useState<string | null>(null);
  
  // Gamification State
  const [xp, setXp] = useState(480);
  const [level, setLevel] = useState(8);
  const [credits, setCredits] = useState(1250);
  const [consistencyScore, setConsistencyScore] = useState(92);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Resistance System State
  const [urgeHistory, setUrgeHistory] = useState<UrgeLog[]>([]);
  const [currentUrge, setCurrentUrge] = useState<Partial<UrgeLog>>({});
  const [intervention, setIntervention] = useState<string | null>(null);
  const [resistanceStreak, setResistanceStreak] = useState(12);

  // AI Coach State
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', content: "Welcome to the Inner Sanctum. I am Arctic AI. I've been analyzing your recent consistency metrics. You're showing strong stability in your 'Deep Work' sessions. How can I help you sharpen your focus today?" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Mock habits state
  const [habits, setHabits] = useState<Habit[]>([
    { id: '1', title: 'Deep Work Session', type: 'positive', xp: 50, completed: false, streak: 12, time: '09:00 AM', category: 'Focus' },
    { id: '2', title: 'Nature Walk', type: 'positive', xp: 20, completed: true, streak: 4, time: '02:00 PM', category: 'Health' },
    { id: '3', title: 'Avoid Social Media', type: 'negative', xp: 30, completed: false, streak: 8, category: 'Resistance' },
    { id: '4', title: 'Journal Reflection', type: 'positive', xp: 15, completed: false, streak: 21, time: '09:00 PM', category: 'Mindset' },
  ]);

  const XP_FOR_LEVEL_UP = level * 100 + 500;

  const toggleHabit = (id: string) => {
    setHabits(prev => prev.map(h => {
      if (h.id === id) {
        if (!h.completed) {
           const newXp = xp + h.xp;
           setXp(newXp);
           setCredits(c => c + 15);
           
           if (newXp >= XP_FOR_LEVEL_UP) {
              setLevel(l => l + 1);
              setXp(newXp - XP_FOR_LEVEL_UP);
              setShowLevelUp(true);
           }
        }
        return { ...h, completed: !h.completed };
      }
      return h;
    }));
  };

  const bracket = useMemo(() => {
    if (level < 5) return 'Initiate';
    if (level < 15) return 'Seeker';
    if (level < 30) return 'Sentinel';
    if (level < 50) return 'Guardian';
    return 'Architect of Will';
  }, [level]);

  const completedCount = habits.filter(h => h.completed).length;
  const totalSteps = 10;

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isTyping) return;

    const userMessage: ChatMessage = { role: 'user', content: chatInput };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setChatInput('');
    setIsTyping(true);

    const userProfile = {
      identity,
      level,
      bracket,
      resistanceStreak,
      currentHabit: habits.find(h => !h.completed)?.title || 'General Growth'
    };

    const aiResponse = await generateCoachingResponse(newMessages, userProfile);
    if (aiResponse) {
      setMessages([...newMessages, { role: 'model', content: aiResponse }]);
    }
    setIsTyping(false);
  };

  useEffect(() => {
    if (step === 'generating') {
      const fetchPlan = async () => {
        setIsLoading(true);
        const plan = await generateHabitPlan(goal, identity, obstacle, difficulty);
        setAiPlan(plan);
        setIsLoading(false);
        // Artificial delay for UX
        setTimeout(() => {
           setStep('plan');
        }, 1500);
      };
      fetchPlan();
    }
  }, [step]);

  const handleUrgeHit = async (habitName: string) => {
    setCurrentUrge({ habit: habitName, timestamp: new Date() });
    setStep('urge_log');
  };

  const submitUrgeBase = async () => {
    setIsLoading(true);
    const msg = await generateIntervention(
      currentUrge.habit || "habit", 
      currentUrge.trigger || "unknown", 
      currentUrge.feeling || "unease"
    );
    setIntervention(msg);
    setIsLoading(false);
  };

  const completeResistance = () => {
    const newLog: UrgeLog = {
      id: Math.random().toString(36).substr(2, 9),
      habit: currentUrge.habit || "General",
      trigger: currentUrge.trigger || "Unknown",
      feeling: currentUrge.feeling || "Unknown",
      timestamp: new Date(),
      resisted: true
    };
    setUrgeHistory(v => [newLog, ...v]);
    setXp(v => v + 40);
    setResistanceStreak(v => v + 1);
    setShowConfetti(true);
    setStep('dashboard');
    setTimeout(() => setShowConfetti(false), 3000);
  };

  const recordRelapse = () => {
    setResistanceStreak(0);
    setStep('relapse_recovery');
  };

  const stepIndex = useMemo(() => {
    const steps: OnboardingStep[] = ['welcome', 'goal', 'identity', 'obstacle', 'difficulty', 'generating', 'plan', 'notifications', 'account', 'setup', 'celebration', 'dashboard'];
    return steps.indexOf(step);
  }, [step]);

  const nextStep = () => {
    const steps: OnboardingStep[] = ['welcome', 'goal', 'identity', 'obstacle', 'difficulty', 'generating', 'plan', 'notifications', 'account', 'setup', 'celebration', 'dashboard'];
    const nextIdx = steps.indexOf(step) + 1;
    if (nextIdx < steps.length && nextIdx !== -1) setStep(steps[nextIdx]);
  };

  const prevStep = () => {
    const steps: OnboardingStep[] = ['welcome', 'goal', 'identity', 'obstacle', 'difficulty', 'generating', 'plan', 'notifications', 'account', 'setup', 'celebration', 'dashboard'];
    const prevIdx = steps.indexOf(step) - 1;
    if (prevIdx >= 0 && prevIdx !== -1) setStep(steps[prevIdx]);
  };

  // --- Animation Variants ---
  const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
  };

  const stagger = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <div className="min-h-screen selection:bg-arctic-navy selection:text-white overflow-x-hidden">
      {step !== 'dashboard' && step !== 'celebration' && step !== 'resistance_center' && step !== 'urge_log' && step !== 'relapse_recovery' && step !== 'ai_coach' && (
        <ProgressBar currentStep={stepIndex} totalSteps={totalSteps} />
      )}

      <AnimatePresence mode="wait">
        {showLevelUp && (
          <LevelUpOverlay 
            key="levelup" 
            level={level} 
            bracket={bracket} 
            onClose={() => setShowLevelUp(false)} 
          />
        )}
        {step === 'welcome' && (
          <motion.div 
            key="welcome"
            className="flex flex-col items-center justify-center min-h-screen px-6 text-center"
            {...fadeUp}
          >
            <div className="w-24 h-24 mb-12 bg-white rounded-3xl shadow-premium flex items-center justify-center">
              <Sparkles className="w-12 h-12 text-arctic-navy" />
            </div>
            <h1 className="text-4xl font-bold text-arctic-navy mb-4 tracking-tight">
              Reclaim your clarity.
            </h1>
            <p className="text-lg text-slate-500 mb-12 max-w-xs leading-relaxed">
              Arctic helps you build the life you deserve through atmospheric precision and behavioral science.
            </p>
            <button 
              onClick={nextStep}
              className="w-full max-w-xs bg-arctic-navy text-white font-semibold py-5 rounded-button shadow-xl flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
            >
              Begin the journey <ChevronRight className="w-5 h-5" />
            </button>
          </motion.div>
        )}

        {step === 'goal' && (
          <motion.div 
            key="goal"
            className="flex flex-col min-h-screen px-6 pt-32 pb-12"
            variants={stagger}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <motion.button onClick={prevStep} className="mb-8 p-2 -ml-2 text-slate-400">
              <ArrowLeft />
            </motion.button>
            <motion.h2 variants={fadeUp} className="text-3xl font-bold text-arctic-navy mb-3">
              What is your primary focus?
            </motion.h2>
            <motion.p variants={fadeUp} className="text-slate-500 mb-10">
              Select the area of your life you want to transform.
            </motion.p>
            
            <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[60vh] pr-2">
              {[
                { id: 'discipline', label: 'Build unbreakable discipline', icon: ShieldCheck },
                { id: 'fitness', label: 'Improve physical health', icon: Zap },
                { id: 'study', label: 'Consistency in learning', icon: Brain },
                { id: 'social', label: 'Break social media addiction', icon: Clock },
                { id: 'procrastination', label: 'Defeat procrastination', icon: Target },
                { id: 'money', label: 'Optimize financial habits', icon: Target }
              ].map((item) => (
                <motion.div 
                  key={item.id}
                  variants={fadeUp}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setGoal(item.label); nextStep(); }}
                  className={`p-6 rounded-card arctic-glass cursor-pointer flex items-center gap-4 transition-all hover:bg-white hover:shadow-premium ${goal === item.label ? 'ring-2 ring-arctic-navy bg-white shadow-premium' : ''}`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center">
                    <item.icon className="w-6 h-6 text-arctic-navy" />
                  </div>
                  <span className="font-semibold text-arctic-navy">{item.label}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {step === 'identity' && (
          <motion.div 
            key="identity"
            className="flex flex-col min-h-screen px-6 pt-32 pb-12"
            {...fadeUp}
          >
            <button onClick={prevStep} className="mb-8 p-2 -ml-2 text-slate-400">
              <ArrowLeft />
            </button>
            <h2 className="text-3xl font-bold text-arctic-navy mb-3">
              Who do you want to become?
            </h2>
            <p className="text-slate-500 mb-10">
              Habits are not what we do, they are who we are.
            </p>
            
            <textarea 
              autoFocus
              className="w-full bg-white rounded-card p-6 min-h-[160px] text-lg font-medium text-arctic-navy shadow-inner focus:ring-2 focus:ring-arctic-navy outline-none border-none resize-none placeholder:text-slate-300"
              placeholder="e.g. A marathon runner, a disciplined writer, a calm leader..."
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
            />
            
            <button 
              disabled={!identity.trim()}
              onClick={nextStep}
              className="mt-8 w-full bg-arctic-navy text-white font-semibold py-5 rounded-button shadow-xl flex items-center justify-center gap-2 disabled:opacity-30 transition-opacity"
            >
              Continue <ChevronRight className="w-5 h-5" />
            </button>
          </motion.div>
        )}

        {step === 'obstacle' && (
          <motion.div 
            key="obstacle"
            className="flex flex-col min-h-screen px-6 pt-32 pb-12"
            {...fadeUp}
          >
            <button onClick={prevStep} className="mb-8 p-2 -ml-2 text-slate-400">
              <ArrowLeft />
            </button>
            <h2 className="text-3xl font-bold text-arctic-navy mb-3">
              What has hurt your progress most?
            </h2>
            <p className="text-slate-500 mb-10">
              Acknowledging the friction is the first step to removing it.
            </p>
            
            <textarea 
              autoFocus
              className="w-full bg-white rounded-card p-6 min-h-[160px] text-lg font-medium text-arctic-navy shadow-inner focus:ring-2 focus:ring-arctic-navy outline-none border-none resize-none placeholder:text-slate-300"
              placeholder="e.g. Constant phone pick-ups, late night snacking, fear of failure..."
              value={obstacle}
              onChange={(e) => setObstacle(e.target.value)}
            />
            
            <button 
              disabled={!obstacle.trim()}
              onClick={nextStep}
              className="mt-8 w-full bg-arctic-navy text-white font-semibold py-5 rounded-button shadow-xl flex items-center justify-center gap-2 disabled:opacity-30 transition-opacity"
            >
              Design my path <ChevronRight className="w-5 h-5" />
            </button>
          </motion.div>
        )}

        {step === 'difficulty' && (
          <motion.div 
            key="difficulty"
            className="flex flex-col min-h-screen px-6 pt-32 pb-12"
            {...fadeUp}
          >
            <button onClick={prevStep} className="mb-8 p-2 -ml-2 text-slate-400">
              <ArrowLeft />
            </button>
            <h2 className="text-3xl font-bold text-arctic-navy mb-3">
              Current confidence?
            </h2>
            <p className="text-slate-500 mb-10">
              How difficult do you want your starting pace to be?
            </p>
            
            <div className="flex flex-col gap-4">
              {['Gentle', 'Intermediate', 'Intense'].map((level) => (
                <div 
                  key={level}
                  onClick={() => { setDifficulty(level); nextStep(); }}
                  className={`p-6 rounded-card arctic-glass cursor-pointer flex items-center justify-between transition-all hover:bg-white hover:shadow-premium ${difficulty === level ? 'bg-white shadow-premium ring-1 ring-arctic-navy' : ''}`}
                >
                  <span className="font-semibold text-arctic-navy">{level}</span>
                  <div className={`w-3 h-3 rounded-full ${difficulty === level ? 'bg-arctic-navy' : 'bg-slate-200'}`} />
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {step === 'generating' && (
          <motion.div 
            key="generating"
            className="flex flex-col items-center justify-center min-h-screen px-6 text-center"
            {...fadeUp}
          >
            <div className="relative w-32 h-32 mb-12">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border-4 border-dashed border-arctic-navy/10 rounded-full"
              />
              <motion.div 
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <Sparkles className="w-12 h-12 text-arctic-navy" />
              </motion.div>
            </div>
            <h2 className="text-2xl font-bold text-arctic-navy mb-4">
              {isLoading ? "Consulting behavioral logic..." : "Your roadmap is ready."}
            </h2>
            <p className="text-slate-500 max-w-xs">
               Analyzing your goals and identity to create a Frictionless Start.
            </p>
          </motion.div>
        )}

        {step === 'plan' && (
          <motion.div 
            key="plan"
            className="flex flex-col min-h-screen px-6 pt-32 pb-12"
            {...fadeUp}
          >
            <h2 className="text-3xl font-bold text-arctic-navy mb-3">
              {aiPlan?.title || "Your Growth Strategy"}
            </h2>
            <p className="text-slate-500 mb-8 italic">
              "{aiPlan?.motivation || "Small steps lead to great distances."}"
            </p>
            
            <div className="space-y-4 mb-12 flex-1">
              {(aiPlan?.steps || [
                { day: 'Day 1-2', action: 'Commit to the first step', psychology: 'Momentum starts now' },
                { day: 'Day 3-5', action: 'Expand the reach', psychology: 'Escalating effort' },
                { day: 'Day 6-7', action: 'Final Integration', psychology: 'Stabilizing the rhythm' }
              ]).map((s, i) => (
                <div key={i} className="p-6 bg-white rounded-card shadow-sm border border-slate-50">
                   <div className="flex justify-between items-center mb-2">
                     <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{s.day}</span>
                     <Sparkles className="w-4 h-4 text-arctic-teal" />
                   </div>
                   <p className="text-lg font-bold text-arctic-navy mb-1">{s.action}</p>
                   <p className="text-sm text-slate-500">{s.psychology}</p>
                </div>
              ))}
            </div>
            
            <button 
              onClick={nextStep}
              className="w-full bg-arctic-navy text-white font-semibold py-5 rounded-button shadow-xl flex items-center justify-center gap-2"
            >
              Adopt this plan <ChevronRight className="w-5 h-5" />
            </button>
          </motion.div>
        )}

        {step === 'notifications' && (
          <motion.div 
            key="notifications"
            className="flex flex-col items-center justify-center min-h-screen px-6 text-center"
            {...fadeUp}
          >
             <div className="w-24 h-24 mb-12 bg-orange-50 rounded-3xl flex items-center justify-center text-arctic-coral">
              <Bell className="w-12 h-12" />
            </div>
            <h2 className="text-3xl font-bold text-arctic-navy mb-4">
              Stay in the flow.
            </h2>
            <p className="text-slate-500 mb-12 max-w-xs">
              Micro-reminders at the perfect moment help bypass the voice of procrastination.
            </p>
            
            <div className="w-full max-w-xs space-y-4">
              <button 
                onClick={nextStep}
                className="w-full bg-arctic-navy text-white font-semibold py-5 rounded-button shadow-xl"
              >
                Enable reminders
              </button>
              <button 
                onClick={nextStep}
                className="w-full text-slate-400 font-medium py-3"
              >
                Maybe later
              </button>
            </div>
          </motion.div>
        )}

        {step === 'account' && (
          <motion.div 
            key="account"
            className="flex flex-col min-h-screen px-6 pt-32 pb-12"
            {...fadeUp}
          >
            <h2 className="text-3xl font-bold text-arctic-navy mb-3">
              Secure your progress.
            </h2>
            <p className="text-slate-500 mb-10">
              Your data is private, encrypted, and yours alone.
            </p>
            
            <div className="space-y-4">
               <button className="w-full bg-white border border-slate-200 font-semibold py-4 rounded-button flex items-center justify-center gap-3 shadow-sm">
                  <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                  Continue with Google
               </button>
               <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100" /></div>
                  <div className="relative flex justify-center text-xs uppercase tracking-widest text-slate-300 bg-arctic-gray px-4">OR</div>
               </div>
               <input 
                 type="email" 
                 placeholder="Email address"
                 className="w-full bg-white p-5 rounded-button text-arctic-navy shadow-sm focus:ring-1 focus:ring-arctic-navy outline-none border-none"
               />
               <button 
                 onClick={nextStep}
                 className="w-full bg-arctic-navy text-white font-semibold py-5 rounded-button shadow-xl mt-4"
               >
                 Create free account
               </button>
            </div>
          </motion.div>
        )}

        {step === 'setup' && (
          <motion.div 
            key="setup"
            className="flex flex-col min-h-screen px-6 pt-32 pb-12"
            {...fadeUp}
          >
            <h2 className="text-3xl font-bold text-arctic-navy mb-3">
              Your first habit.
            </h2>
            <p className="text-slate-500 mb-10">
              When should we alert you for the first win?
            </p>
            
            <div className="bg-white rounded-card p-8 shadow-premium mb-8">
               <div className="flex items-center gap-4 mb-8">
                 <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-arctic-navy" />
                 </div>
                 <div>
                    <p className="font-bold text-arctic-navy">{aiPlan?.steps[0].action || "Small Starter Habit"}</p>
                    <p className="text-xs text-slate-400 uppercase tracking-widest">Daily Milestone</p>
                 </div>
               </div>
               
               <div className="grid grid-cols-3 gap-2">
                  {['07:00 AM', '08:00 AM', '09:00 AM', '06:00 PM', '08:00 PM', '09:00 PM'].map(t => (
                    <button key={t} className="p-3 bg-slate-50 rounded-xl text-sm font-semibold text-arctic-navy hover:bg-arctic-navy hover:text-white transition-colors">{t}</button>
                  ))}
               </div>
            </div>

            <button 
              onClick={nextStep}
              className="mt-auto w-full bg-arctic-navy text-white font-semibold py-5 rounded-button shadow-xl flex items-center justify-center gap-2"
            >
              Finish Setup <Zap className="w-5 h-5" />
            </button>
          </motion.div>
        )}

        {step === 'celebration' && (
          <motion.div 
            key="celebration"
            className="flex flex-col items-center justify-center min-h-screen px-6 text-center bg-arctic-navy"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="w-32 h-32 mb-8 bg-arctic-teal rounded-full flex items-center justify-center shadow-[0_0_100px_rgba(79,209,197,0.4)]"
            >
              <Trophy className="w-16 h-16 text-arctic-navy" />
            </motion.div>
            <motion.h2 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-4xl font-bold text-white mb-4"
            >
              You're ready, {identity.split(' ')[0] || "Seeker"}.
            </motion.h2>
            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="text-arctic-teal/80 mb-12"
            >
              The path to clarity begins with a single, intentional step.
            </motion.p>
            <motion.button 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1 }}
              onClick={nextStep}
              className="w-full max-w-xs bg-white text-arctic-navy font-bold py-5 rounded-button shadow-xl"
            >
              Enter the Dashboard
            </motion.button>
          </motion.div>
        )}

        {step === 'dashboard' && (
          <motion.div 
            key="dashboard"
            className="flex flex-col min-h-screen bg-arctic-gray pb-24"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* Minimalist Top Bar */}
            <header className="px-6 pt-12 pb-6 flex justify-between items-end bg-transparent">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                <h1 className="text-3xl font-bold text-arctic-navy">Dashboard</h1>
              </div>
              <div className="flex items-center gap-3">
                <a 
                  href="/ARCTIC_OVERVIEW.md" 
                  target="_blank"
                  className="px-3 py-1.5 bg-white shadow-sm rounded-full flex items-center gap-2 border border-slate-50 text-slate-400 hover:text-arctic-teal transition-colors"
                >
                  <Quote className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Docs</span>
                </a>
                <div className="px-3 py-1.5 bg-white shadow-sm rounded-full flex items-center gap-2 border border-slate-50">
                  <Sparkles className="w-4 h-4 text-arctic-teal" />
                  <span className="text-xs font-black text-arctic-navy tracking-tight">{credits}</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-white shadow-sm overflow-hidden p-0.5 border border-slate-100">
                  <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Arctic" className="w-full h-full rounded-full object-cover" alt="Profile" />
                </div>
              </div>
            </header>

            <main className="px-6 space-y-8">
              {/* Identity & Motivation Reflection */}
              <section className="relative overflow-hidden p-8 rounded-card arctic-glass shadow-premium border-l-4 border-l-arctic-teal">
                <div className="relative z-10 space-y-4">
                  <div className="flex items-center gap-2 text-arctic-teal">
                     <Quote className="w-4 h-4 fill-current" />
                     <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Daily Intention</span>
                  </div>
                  <h3 className="text-xl font-medium text-arctic-navy leading-relaxed">
                    "Consistency is the only bridge between who you are and 
                    <span className="font-bold text-arctic-teal italic"> {identity || 'the person you seek to be'}</span>."
                  </h3>
                  <div className="flex items-center gap-6 pt-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Identity Shift</span>
                      <span className="text-sm font-semibold text-arctic-navy">82% Formed</span>
                    </div>
                    <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: '82%' }}
                        className="h-full bg-arctic-teal" 
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Progress Summary Grid */}
              <section className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-arctic-navy rounded-card text-white shadow-premium relative overflow-hidden group">
                  <div className="relative z-10">
                    <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest mb-4">Level {level} {bracket}</p>
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-3xl font-bold">{xp}</span>
                      <span className="text-xs opacity-50">/ {XP_FOR_LEVEL_UP} XP</span>
                    </div>
                    <div className="w-full h-1 bg-white/10 rounded-full">
                      <motion.div 
                        animate={{ width: `${(xp / XP_FOR_LEVEL_UP) * 100}%` }}
                        className="h-full bg-arctic-teal shadow-[0_0_10px_rgba(79,209,197,0.5)]" 
                      />
                    </div>
                  </div>
                  <Zap className="absolute -bottom-4 -right-4 w-20 h-20 text-white/5 rotate-12 group-hover:scale-110 transition-transform duration-700" />
                </div>

                <div className="p-6 bg-white rounded-card shadow-premium flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Consistency</p>
                    <div className="p-1.5 bg-arctic-teal/10 rounded-lg">
                      <BarChart2 className="w-4 h-4 text-arctic-teal" />
                    </div>
                  </div>
                  <div>
                    <span className="text-3xl font-bold text-arctic-navy">{consistencyScore}%</span>
                    <p className="text-xs text-slate-400 mt-1">Stability Rating</p>
                  </div>
                </div>
              </section>

              {/* Habit Completion List */}
              <section className="space-y-4">
                <div className="flex justify-between items-end">
                  <h3 className="text-xl font-bold text-arctic-navy flex items-center gap-2">
                    Daily Rituals
                    <div className="px-2 py-0.5 bg-slate-100 rounded-md text-[10px] font-bold text-slate-500">{completedCount}/{habits.length}</div>
                  </h3>
                  <button className="text-xs font-bold text-arctic-teal flex items-center gap-1">
                    Edit Schedule <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-4">
                  {habits.map((hab, i) => (
                    <motion.div 
                      key={hab.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => toggleHabit(hab.id)}
                      className={`p-5 rounded-card transition-all cursor-pointer flex items-center gap-5 border border-transparent shadow-sm hover:shadow-md
                        ${hab.completed ? 'bg-slate-50/50' : 'bg-white'} 
                        ${!hab.completed && hab.type === 'negative' ? 'border-orange-100' : ''}`}
                    >
                      <div className="relative">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300
                          ${hab.completed ? 'bg-arctic-teal text-white border-transparent' : 'bg-slate-50 text-slate-300 border-slate-100 border'}`}>
                          {hab.completed ? <CheckCircle2 className="w-6 h-6" /> : (hab.type === 'negative' ? <Shield className="w-6 h-6" /> : <Zap className="w-6 h-6" />)}
                        </div>
                        {hab.completed && (
                          <motion.div 
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="absolute -top-2 -right-2 bg-arctic-navy text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-lg"
                          >
                            +{hab.xp}
                          </motion.div>
                        )}
                      </div>

                      <div className="flex-1">
                        <h4 className={`font-bold transition-all duration-300 ${hab.completed ? 'text-slate-400 line-through' : 'text-arctic-navy'}`}>
                          {hab.title}
                        </h4>
                        <div className="flex items-center gap-3 mt-1">
                          {hab.time && <span className="flex items-center gap-1 text-[10px] font-bold text-slate-300 uppercase tracking-widest"><Clock className="w-3 h-3" /> {hab.time}</span>}
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${hab.completed ? 'text-arctic-teal' : 'text-slate-400'}`}>
                            {hab.streak} Day Streak
                          </span>
                        </div>
                      </div>
                      
                      {hab.type === 'negative' && !hab.completed && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleUrgeHit(hab.title); }}
                          className="px-3 py-1.5 bg-arctic-teal rounded-lg text-[10px] font-black text-arctic-navy uppercase tracking-tighter"
                        >
                          Urge Support
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>
              </section>

              {/* Mood & Energy Check */}
              <section className="space-y-4">
                <h3 className="text-xl font-bold text-arctic-navy">Check-in</h3>
                <div className="p-8 bg-white rounded-card shadow-premium flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mb-6 group cursor-pointer hover:bg-arctic-teal/10 hover:text-arctic-teal transition-colors">
                    <Smile className="w-8 h-8" />
                  </div>
                  <h4 className="font-bold text-arctic-navy mb-2">How is your focus flow today?</h4>
                  <p className="text-sm text-slate-400 mb-8 max-w-xs">Logging your emotional state helps us refine your AI difficulty recommendations.</p>
                  
                  <div className="flex gap-4 w-full">
                    {['Calm', 'Balanced', 'Overwhelmed'].map(m => (
                      <button 
                        key={m}
                        onClick={() => setMood(m)}
                        className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-all
                          ${mood === m ? 'bg-arctic-navy text-white border-arctic-navy shadow-lg scale-105' : 'bg-transparent text-slate-400 border-slate-100 hover:border-slate-300'}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* AI Insights Card */}
              <section className="space-y-4">
                 <h3 className="text-xl font-bold text-arctic-navy">Arctic AI Intelligence</h3>
                 <div className="bg-gradient-to-br from-arctic-navy to-slate-800 rounded-card p-8 text-white relative overflow-hidden group">
                    <div className="relative z-10 flex gap-6 items-start">
                       <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                          <Brain className="w-8 h-8 text-arctic-teal" />
                       </div>
                       <div className="space-y-2">
                          <p className="text-xs font-bold uppercase tracking-widest text-arctic-teal">Pattern Recognized</p>
                          <p className="text-lg font-medium leading-relaxed">
                            Your focus dips consistently around <span className="text-arctic-teal font-bold">2:15 PM</span>. 
                            Want to discuss a tailored transition strategy?
                          </p>
                          <button 
                            onClick={() => setStep('ai_coach')}
                            className="flex items-center gap-2 text-xs font-bold pt-4 hover:gap-3 transition-all text-arctic-teal"
                          >
                             ENTER INNER SANCTUM <ArrowRight className="w-4 h-4" />
                          </button>
                       </div>
                    </div>
                    {/* Decorative Background Pattern */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-arctic-teal/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
                 </div>
              </section>

              {/* Bottom Spacer */}
              <div className="h-12" />
            </main>

            {/* Floating SOS / Urge Button */}
            <div className="fixed bottom-32 right-6 z-40">
               <motion.button 
                 whileHover={{ scale: 1.1 }}
                 whileTap={{ scale: 0.9 }}
                 onClick={() => setStep('resistance_center')}
                 className="w-16 h-16 bg-arctic-teal rounded-full shadow-2xl flex items-center justify-center text-arctic-navy relative group overflow-hidden"
               >
                  <Shield className="w-8 h-8 relative z-10" />
                  <motion.div 
                    animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 bg-white rounded-full"
                  />
               </motion.button>
            </div>

            {/* Premium Floating Nav */}
            <div className="fixed bottom-0 left-0 right-0 p-6 z-50 bg-gradient-to-t from-arctic-gray via-arctic-gray/80 to-transparent">
              <nav className="h-18 bg-arctic-navy/95 backdrop-blur-xl rounded-card shadow-2xl flex items-center justify-around px-8 border border-white/5">
                {[
                  { icon: Home, label: 'Home', active: step === 'dashboard', action: () => setStep('dashboard') },
                  { icon: Brain, label: 'Coach', active: step === 'ai_coach', action: () => setStep('ai_coach') },
                  { icon: Shield, label: 'Fortress', active: step === 'resistance_center', action: () => setStep('resistance_center') },
                  { icon: Settings, label: 'Config', active: false, action: () => {} },
                ].map((item, i) => (
                  <button 
                    key={i} 
                    onClick={item.action}
                    className={`flex flex-col items-center gap-1 transition-all ${item.active ? 'text-arctic-teal' : 'text-white/40 hover:text-white/60'}`}
                  >
                    <item.icon className={`w-6 h-6 ${item.active ? 'fill-current' : ''}`} />
                    <span className="text-[8px] font-black uppercase tracking-widest">{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </motion.div>
        )}

        {step === 'resistance_center' && (
          <motion.div 
            key="resistance"
            className="flex flex-col min-h-screen bg-white"
            {...fadeUp}
          >
            <div className="p-6 flex items-center justify-between border-b border-slate-100">
               <button onClick={() => setStep('dashboard')} className="p-2 -ml-2 text-slate-400 font-bold flex items-center gap-2 text-sm uppercase tracking-widest">
                 <ArrowLeft className="w-4 h-4" /> Dashboard
               </button>
               <h2 className="text-xl font-bold text-arctic-navy">Arctic Fortress</h2>
               <div className="w-10" />
            </div>

            <main className="flex-1 p-8 overflow-y-auto pb-12">
               <div className="text-center mb-12">
                  <div className="w-20 h-20 bg-arctic-teal/10 rounded-3xl flex items-center justify-center mx-auto text-arctic-teal mb-6">
                    <Shield className="w-10 h-10" />
                  </div>
                  <h3 className="text-3xl font-bold text-arctic-navy mb-2">The Shield is active.</h3>
                  <p className="text-slate-500">{resistanceStreak} days since your last slip. Your identity is stabilizing.</p>
               </div>

               <div className="grid grid-cols-1 gap-6">
                  <section className="p-6 bg-slate-50 rounded-card border border-slate-100">
                    <h4 className="font-bold text-arctic-navy mb-4 flex items-center gap-2">
                       <MessageSquare className="w-4 h-4 text-arctic-teal" /> Log an active urge
                    </h4>
                    <p className="text-sm text-slate-500 mb-6 font-medium">Feeling the pull? Awareness effectively halves the power of an urge. Let's document it.</p>
                    <button 
                      onClick={() => handleUrgeHit("General")}
                      className="w-full bg-arctic-navy text-white font-bold py-4 rounded-button shadow-lg"
                    >
                      Process Urge Now
                    </button>
                  </section>

                  <section className="p-6 bg-orange-50 rounded-card border border-orange-100">
                    <h4 className="font-bold text-arctic-coral mb-4 flex items-center gap-2">
                       <RotateCcw className="w-4 h-4" /> Record a slip
                    </h4>
                    <p className="text-sm text-slate-500 mb-6 font-medium">No shame. No judgment. Just data. We use this to understand your triggers better.</p>
                    <button 
                      onClick={recordRelapse}
                      className="w-full bg-white border border-arctic-coral text-arctic-coral font-bold py-4 rounded-button"
                    >
                      A slip occurred
                    </button>
                  </section>
                  
                  <section className="space-y-4">
                     <h4 className="font-bold text-arctic-navy flex items-center gap-2">
                        <Activity className="w-4 h-4 text-arctic-teal" /> Resistance History
                     </h4>
                     {urgeHistory.length === 0 ? (
                       <div className="p-6 text-center text-slate-300 italic text-sm">No recent surges logged.</div>
                     ) : (
                       urgeHistory.map(h => (
                         <div key={h.id} className="p-4 bg-white border border-slate-100 rounded-xl flex items-center justify-between">
                            <div>
                               <p className="font-bold text-arctic-navy">{h.habit}</p>
                               <p className="text-[10px] text-slate-400 uppercase tracking-widest">{h.trigger}</p>
                            </div>
                            <div className="text-arctic-teal font-black text-[10px] uppercase tracking-widest bg-arctic-teal/10 px-2 py-1 rounded">RESISTED</div>
                         </div>
                       ))
                     )}
                  </section>
               </div>
            </main>
          </motion.div>
        )}

        {step === 'urge_log' && (
          <motion.div 
            key="urge_log"
            className="flex flex-col min-h-screen bg-arctic-navy text-white overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="p-8 max-w-md mx-auto w-full space-y-12 pb-24">
               {!intervention ? (
                 <>
                   <div className="space-y-4 text-center">
                     <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8 border border-white/10">
                        <Activity className="w-10 h-10 text-arctic-teal" />
                     </div>
                     <h2 className="text-4xl font-bold tracking-tight">The Wave is here.</h2>
                     <p className="text-white/50">Urge surfing is the skill of feeling the crave without becoming it.</p>
                   </div>

                   <div className="space-y-8">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-arctic-teal mb-4">Phase 1: Awareness</p>
                        <h3 className="text-xl font-medium mb-4 italic">"Where did this trigger come from?"</h3>
                        <div className="grid grid-cols-2 gap-3">
                           {['Boredom', 'Stress', 'Loneliness', 'Exhaustion', 'Digital Scroll', 'Hunger'].map(t => (
                             <button 
                               key={t}
                               onClick={() => setCurrentUrge(v => ({ ...v, trigger: t }))}
                               className={`py-3 rounded-lg text-xs font-bold border transition-all 
                                 ${currentUrge.trigger === t ? 'bg-arctic-teal border-arctic-teal text-arctic-navy shadow-lg scale-105' : 'border-white/10 hover:border-white/30'}`}
                             >
                               {t}
                             </button>
                           ))}
                        </div>
                      </div>

                      <button 
                        disabled={!currentUrge.trigger}
                        onClick={submitUrgeBase}
                        className="w-full bg-white text-arctic-navy font-black py-5 rounded-button shadow-[0_0_50px_rgba(255,255,255,0.1)] disabled:opacity-20 translate-y-4 hover:scale-[1.02] transition-all"
                      >
                        CONSULT ARCTIC AI
                      </button>
                   </div>
                 </>
               ) : (
                 <motion.div {...fadeUp} className="space-y-12 text-center pt-12">
                    <div className="p-8 bg-white/5 rounded-card border border-white/10 text-left leading-relaxed relative overflow-hidden">
                       <Sparkles className="w-6 h-6 text-arctic-teal mb-4" />
                       <div className={`${isLoading ? "animate-pulse opacity-50" : ""}`}>
                          <p className="text-xl font-medium text-white/90">
                             {isLoading ? "Consulting behavioral logic..." : intervention}
                          </p>
                       </div>
                       <motion.div 
                        animate={{ opacity: [0.1, 0.2, 0.1] }}
                        transition={{ duration: 3, repeat: Infinity }}
                        className="absolute inset-x-0 bottom-0 h-1 bg-arctic-teal" 
                       />
                    </div>

                    <div className="space-y-4">
                       <button 
                         onClick={completeResistance}
                         className="w-full bg-arctic-teal text-arctic-navy font-black py-5 rounded-button shadow-2xl hover:scale-[1.02] transition-all"
                       >
                         I AM RESISTING
                       </button>
                       <button 
                         onClick={recordRelapse}
                         className="w-full text-white/40 font-bold py-3 text-sm uppercase tracking-widest"
                       >
                         Wave was too high (Log Slip)
                       </button>
                    </div>
                 </motion.div>
               )}
            </div>
          </motion.div>
        )}

        {step === 'relapse_recovery' && (
          <motion.div 
            key="recovery"
            className="flex flex-col min-h-screen bg-slate-50 p-8 text-center"
            {...fadeUp}
          >
             <div className="w-24 h-24 bg-orange-100 text-arctic-coral rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-sm">
                <AlertTriangle className="w-12 h-12" />
             </div>
             <h2 className="text-3xl font-bold text-arctic-navy mb-4">Data, not failure.</h2>
             <p className="text-slate-500 mb-12 leading-relaxed max-w-xs mx-auto font-medium">
                A slip is simply information. Your identity is a path, not a destination. 
                What can we learn from this moment?
             </p>

             <div className="p-8 bg-white border border-slate-100 rounded-card shadow-sm mb-12 text-left">
                <h4 className="font-bold text-arctic-navy mb-4 flex items-center gap-2">
                   <Brain className="w-4 h-4 text-arctic-teal" /> Reflection Journal
                </h4>
                <textarea 
                  autoFocus
                  placeholder="What was the trigger? (e.g. 'I was tired after a long meeting and reached for phone automatically')"
                  className="w-full h-32 p-4 bg-slate-50 border-none rounded-xl text-sm italic focus:ring-1 focus:ring-arctic-navy outline-none resize-none"
                />
             </div>

             <button 
               onClick={() => setStep('dashboard')}
               className="w-full bg-arctic-navy text-white font-bold py-5 rounded-button shadow-xl"
             >
                Resume the Path
             </button>
          </motion.div>
        )}

        {step === 'ai_coach' && (
          <motion.div 
            key="ai_coach"
            className="flex flex-col min-h-screen bg-white"
            {...fadeUp}
          >
            <div className="p-6 flex items-center justify-between border-b border-slate-100 bg-white sticky top-0 z-50">
               <button onClick={() => setStep('dashboard')} className="p-2 -ml-2 text-slate-400 font-bold flex items-center gap-2 text-sm uppercase tracking-widest">
                 <ArrowLeft className="w-4 h-4" /> Exit
               </button>
               <h2 className="text-xl font-bold text-arctic-navy flex items-center gap-2">
                 <Brain className="w-5 h-5 text-arctic-teal" /> Inner Sanctum
               </h2>
               <div className="w-10" />
            </div>

            <main ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8 space-y-6 flex flex-col">
               {messages.map((m, i) => (
                 <motion.div 
                   key={i}
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   className={`max-w-[85%] p-4 rounded-card text-sm leading-relaxed ${
                     m.role === 'user' 
                       ? 'bg-arctic-navy text-white self-end rounded-tr-none' 
                       : 'bg-slate-50 text-arctic-navy self-start rounded-tl-none border border-slate-100 shadow-sm'
                   }`}
                 >
                   {m.content}
                 </motion.div>
               ))}
               {isTyping && (
                 <div className="bg-slate-50 text-arctic-navy self-start p-4 rounded-card rounded-tl-none border border-slate-100 shadow-sm">
                   <div className="flex gap-1">
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-arctic-teal rounded-full" />
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-arctic-teal rounded-full" />
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-arctic-teal rounded-full" />
                   </div>
                 </div>
               )}
               <div className="h-4" />
            </main>

            <div className="p-6 border-t border-slate-100 bg-white">
               <div className="relative flex items-center">
                  <input 
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Inquire about your behavioral metrics..."
                    className="w-full pl-4 pr-14 py-4 bg-slate-50 border-none rounded-xl text-sm focus:ring-1 focus:ring-arctic-teal outline-none"
                  />
                  <button 
                    onClick={handleSendMessage}
                    disabled={!chatInput.trim() || isTyping}
                    className="absolute right-2 p-2 bg-arctic-teal text-arctic-navy rounded-lg disabled:opacity-30 disabled:grayscale transition-all"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
