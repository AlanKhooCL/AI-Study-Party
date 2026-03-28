import React, { useState, useEffect, useRef } from 'react';
import { 
  Heart, Zap, BookOpen, Skull, Send, Shield, 
  Swords, ArrowLeft, Loader2, Sparkles, GraduationCap,
  Crown, Map as MapIcon, User, ChevronRight, Crosshair
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, onSnapshot, addDoc } from 'firebase/firestore';

// --- API Setup ---
// Uses your .env file. If it can't find it, it will trigger the crash screen safely.
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const TEXT_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
const IMAGE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`;

// --- Firebase Setup ---
const firebaseConfig = {
  apiKey: "AIzaSyB80OS8Lh0xDHhWl95PphjN1B1WiOoK33M",
  authDomain: "ai-study-party.firebaseapp.com",
  projectId: "ai-study-party",
  storageBucket: "ai-study-party.firebasestorage.app",
  messagingSenderId: "583546365173",
  appId: "1:583546365173:web:dd2fbec4ec4d20380951bc",
  measurementId: "G-SFDQ0QELTE"
};

const appId = "ai-study-party-v1";

// --- SAFE INITIALIZATION (Prevents the Blank Screen of Death) ---
let app, auth, db, fatalInitError = null;

try {
  if (!apiKey) {
    throw new Error("Gemini API Key is missing! Make sure your .env file is created and Vite has been restarted.");
  }
  
  // These are the lines that went missing!
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  fatalInitError = error.message;
}

// --- Constants ---
const STAGES = [
  { level: 0, name: 'Baby', title: 'Novice Dreamer' },
  { level: 1, name: 'Student', title: 'Apprentice Scholar' },
  { level: 2, name: 'Uni', title: 'Arcane Undergrad' },
  { level: 3, name: 'Office Slave', title: 'Corporate Warrior' },
  { level: 4, name: 'Pawrent', title: 'Beast Tamer' },
  { level: 5, name: 'Old Person', title: 'Grandmaster' }
];

const SKILL_POOL = [
  { name: "Gum-Gum Pistol", type: "attack", power: 25, color: "text-orange-400" },
  { name: "Oni Giri", type: "attack", power: 30, color: "text-green-400" },
  { name: "Diable Jambe", type: "attack", power: 28, color: "text-red-500" },
  { name: "Room: Shambles", type: "utility", power: 0, color: "text-blue-400" },
  { name: "Fire Fist", type: "attack", power: 35, color: "text-orange-500" },
  { name: "Ice Age", type: "attack", power: 32, color: "text-cyan-400" },
  { name: "Desert Spada", type: "attack", power: 26, color: "text-yellow-600" }
];

// --- Utilities ---
const fetchWithBackoff = async (url, options, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(res => setTimeout(res, delay));
      delay *= 2;
    }
  }
};

const generateImage = async (prompt) => {
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
  };
  const result = await fetchWithBackoff(IMAGE_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return result.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
};

const generateJSON = async (prompt, schema) => {
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: schema }
  };
  const result = await fetchWithBackoff(TEXT_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return JSON.parse(result.candidates[0].content.parts[0].text);
};

// --- Custom CSS ---
const aaaStyles = `
  @keyframes screenShake {
    0% { transform: translate(1px, 1px) rotate(0deg); }
    10% { transform: translate(-1px, -2px) rotate(-1deg); }
    20% { transform: translate(-3px, 0px) rotate(1deg); }
    30% { transform: translate(3px, 2px) rotate(0deg); }
    40% { transform: translate(1px, -1px) rotate(1deg); }
    50% { transform: translate(-1px, 2px) rotate(-1deg); }
    60% { transform: translate(-3px, 1px) rotate(0deg); }
    70% { transform: translate(3px, 1px) rotate(-1deg); }
    80% { transform: translate(-1px, -1px) rotate(1deg); }
    90% { transform: translate(1px, 2px) rotate(0deg); }
    100% { transform: translate(1px, -2px) rotate(-1deg); }
  }
  .animate-shake { animation: screenShake 0.3s cubic-bezier(.36,.07,.19,.97) both; }
  @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
  .animate-float { animation: float 4s ease-in-out infinite; }
  .glass-panel {
    background: rgba(15, 23, 42, 0.7);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  }
  .text-glow { text-shadow: 0 0 10px rgba(96, 165, 250, 0.8); }
`;

export default function App() {
  // --- CRASH SCREEN RENDERER ---
  if (fatalInitError) {
    return (
      <div className="min-h-screen bg-red-950 text-red-200 flex flex-col items-center justify-center p-6 text-center font-mono">
        <Skull size={48} className="text-red-500 mb-4 animate-bounce" />
        <h1 className="text-xl font-bold mb-4 text-white">SYSTEM CRASH PREVENTED</h1>
        <p className="mb-4 text-sm">The app halted before loading because:</p>
        <div className="bg-black/50 p-4 rounded text-xs w-full max-w-md break-words border border-red-500/50 text-red-400">
          {fatalInitError}
        </div>
      </div>
    );
  }

  const [user, setUser] = useState(null);
  const [view, setView] = useState('loading'); 
  const [loadingText, setLoadingText] = useState('INITIALIZING NEURAL LINK...');
  
  // Data
  const [profile, setProfile] = useState(null);
  const [courses, setCourses] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [activeBoss, setActiveBoss] = useState(null);
  const [activeCourseId, setActiveCourseId] = useState(null);
  
  // Combat State
  const [combatState, setCombatState] = useState(null);
  const [combatLog, setCombatLog] = useState([]);
  const [isHitPlayer, setIsHitPlayer] = useState(false);
  const [isHitBoss, setIsHitBoss] = useState(false);

  // Form
  const [courseTopic, setCourseTopic] = useState('');
  const logEndRef = useRef(null);

  // --- Auth & Data Listeners ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) { console.error("Auth Error", e); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'main');
    const unsubProfile = onSnapshot(profileRef, async (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data());
        setView(prev => prev === 'loading' ? 'home' : prev);
      } else {
        setLoadingText('GENERATING AVATAR...');
        try {
          const initialImage = await generateImage("AAA game asset, high resolution, 2d digital art, cute chibi style baby, realistic person theme, cinematic lighting, dark fantasy background, highly detailed RPG portrait");
          const newProfile = {
            stage: 0,
            hp: 100,
            maxHp: 100,
            skills: [{ name: "Basic Strike", type: "attack", power: 15, color: "text-gray-300" }],
            imageBase64: initialImage || "",
            coursesCompleted: 0
          };
          await setDoc(profileRef, newProfile);
          setProfile(newProfile);
          setView('home');
        } catch (error) {
           console.error("Failed to generate avatar.", error);
           alert("Could not connect to Gemini API. Please check your API key!");
        }
      }
    }, console.error);

    const coursesCol = collection(db, 'artifacts', appId, 'users', user.uid, 'courses');
    const chaptersCol = collection(db, 'artifacts', appId, 'users', user.uid, 'chapters');
    
    const unsubCourses = onSnapshot(coursesCol, (snap) => setCourses(snap.docs.map(d => ({ id: d.id, ...d.data() }))), console.error);
    const unsubChapters = onSnapshot(chaptersCol, (snap) => setChapters(snap.docs.map(d => ({ id: d.id, ...d.data() }))), console.error);

    return () => { unsubProfile(); unsubCourses(); unsubChapters(); };
  }, [user]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [combatLog]);

  // --- Actions ---
  const handleGenerateBoss = async () => {
    setView('loading');
    setLoadingText('SCANNING GRAND LINE FOR THREATS...');
    try {
      const bossData = await generateJSON(
        "Generate a random One Piece themed enemy boss for an RPG. Creative name, short description, hp (150-300), attack (15-30), and detailed image generation prompt.",
        {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            description: { type: "STRING" },
            hp: { type: "NUMBER" },
            attack: { type: "NUMBER" },
            imagePrompt: { type: "STRING" }
          },
          required: ["name", "description", "hp", "attack", "imagePrompt"]
        }
      );

      setLoadingText('RENDERING THREAT VISUALS...');
      const bossImage = await generateImage(`AAA game asset, 2d digital art, One piece anime style, ${bossData.imagePrompt}, full body, cinematic dramatic lighting, dark background, highly detailed`);
      
      setActiveBoss({ ...bossData, maxHp: bossData.hp, imageBase64: bossImage || "" });
      setView('study'); 
    } catch (e) {
      console.error(e);
      alert("Radar failed. Try scanning again.");
      setView('map');
    }
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!courseTopic.trim()) return;
    setView('loading');
    setLoadingText('COMPILING KNOWLEDGE MATRIX...');

    try {
      const courseData = await generateJSON(
        `Create a short crash course about "${courseTopic}". Total duration LESS than 60 mins.`,
        {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            description: { type: "STRING" },
            chapters: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: { title: { type: "STRING" }, durationMins: { type: "NUMBER" }, summary: { type: "STRING" } },
                required: ["title", "durationMins", "summary"]
              }
            }
          },
          required: ["title", "description", "chapters"]
        }
      );

      const courseRef = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'courses'), {
        title: courseData.title,
        description: courseData.description,
        topic: courseTopic,
        createdAt: new Date().toISOString(),
        status: 'in_progress'
      });

      for (const ch of courseData.chapters) {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'chapters'), {
          courseId: courseRef.id,
          title: ch.title,
          durationMins: ch.durationMins,
          summary: ch.summary,
          completed: false
        });
      }

      setActiveCourseId(courseRef.id);
      setCourseTopic('');
      setView('study');
    } catch (e) {
      console.error(e);
      alert("Failed to compile knowledge.");
      setView('study');
    }
  };

  const completeChapter = async (chapterId) => {
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'chapters', chapterId), { completed: true });
  };

  const startCombat = () => {
    setCombatState({ playerHp: profile.hp, bossHp: activeBoss.hp, turn: 'player' });
    setCombatLog([{ text: `WARNING: ${activeBoss.name} approaches!`, type: 'system' }]);
    setView('combat');
  };

  const triggerHitEffect = (target) => {
    if (target === 'boss') { setIsHitBoss(true); setTimeout(() => setIsHitBoss(false), 300); }
    if (target === 'player') { setIsHitPlayer(true); setTimeout(() => setIsHitPlayer(false), 300); }
  };

  const executeTurn = async (actionType, skill = null) => {
    if (combatState.turn !== 'player') return;

    let newBossHp = combatState.bossHp;
    let newPlayerHp = combatState.playerHp;
    
    // PLAYER TURN
    if (actionType === 'attack' || actionType === 'skill') {
      const dmg = skill ? skill.power + Math.floor(Math.random()*10) : 15 + Math.floor(Math.random()*5);
      newBossHp = Math.max(0, newBossHp - dmg);
      triggerHitEffect('boss');
      setCombatLog(prev => [...prev, { text: `You used [${skill ? skill.name : 'Strike'}]! Dealt ${dmg} DMG.`, type: 'player' }]);
    } else if (actionType === 'heal') {
      const heal = Math.floor(Math.random() * 30) + 25;
      newPlayerHp = Math.min(profile.maxHp, newPlayerHp + heal);
      setCombatLog(prev => [...prev, { text: `You recovered ${heal} HP!`, type: 'heal' }]);
    }

    setCombatState(prev => ({ ...prev, bossHp: newBossHp, playerHp: newPlayerHp, turn: 'boss' }));

    if (newBossHp <= 0) {
      setTimeout(() => handleVictory(), 1500);
      return;
    }

    // BOSS TURN
    setTimeout(() => {
      const bossDmg = Math.floor(Math.random() * activeBoss.attack) + 8;
      const afterBossHp = Math.max(0, newPlayerHp - bossDmg);
      triggerHitEffect('player');
      
      setCombatLog(prev => [...prev, { text: `${activeBoss.name} strikes! Took ${bossDmg} DMG.`, type: 'boss' }]);
      setCombatState(prev => ({ ...prev, playerHp: afterBossHp, turn: 'player' }));

      if (afterBossHp <= 0) {
        setTimeout(() => handleDefeat(), 1500);
      }
    }, 1500);
  };

  const handleVictory = async () => {
    setView('loading');
    setLoadingText('VICTORY! PROCESSING REWARDS...');
    
    const newSkillRaw = SKILL_POOL[Math.floor(Math.random() * SKILL_POOL.length)];
    const hasSkill = profile.skills.some(s => s.name === newSkillRaw.name);
    const updatedSkills = hasSkill ? profile.skills : [...profile.skills, newSkillRaw];
    
    let newStage = profile.stage;
    let newImageBase64 = profile.imageBase64;
    const newCoursesCompleted = profile.coursesCompleted + 1;

    // Evolve every 2 courses
    if (newCoursesCompleted % 2 === 0 && newStage < STAGES.length - 1) {
      newStage += 1;
      setLoadingText(`EVOLVING TO: ${STAGES[newStage].name.toUpperCase()}...`);
      try {
        const nextPrompt = `AAA game asset, high resolution, 2d digital art, chibi style ${STAGES[newStage].name.toLowerCase()}, realistic person theme, cinematic lighting, dark fantasy background, highly detailed RPG portrait`;
        newImageBase64 = await generateImage(nextPrompt) || newImageBase64;
      } catch (e) { console.error("Evolution visual failed", e); }
    }

    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'main'), {
      skills: updatedSkills,
      coursesCompleted: newCoursesCompleted,
      stage: newStage,
      imageBase64: newImageBase64,
      hp: profile.maxHp 
    });

    if (activeCourseId) {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'courses', activeCourseId), { status: 'completed' });
    }

    alert(`VICTORY! ${hasSkill ? 'You gained EXP.' : `You learned [${newSkillRaw.name}]!`}`);
    setActiveBoss(null);
    setActiveCourseId(null);
    setView('home');
  };

  const handleDefeat = () => {
    alert("CRITICAL FAILURE. You were defeated.");
    setActiveBoss(null);
    setView('home');
  };

  // --- Shared Components ---
  const ProgressBar = ({ current, max, colorClass, label }) => (
    <div className="w-full">
      <div className="flex justify-between text-[10px] font-bold tracking-widest text-slate-400 mb-1">
        <span>{label}</span>
        <span>{current} / {max}</span>
      </div>
      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
        <div 
          className={`h-full ${colorClass} transition-all duration-500 ease-out shadow-[0_0_10px_currentColor]`} 
          style={{ width: `${Math.max(0, Math.min(100, (current / max) * 100))}%` }} 
        />
      </div>
    </div>
  );

  const TopBar = ({ title, showBack = false }) => (
    <div className="h-16 border-b border-white/5 bg-slate-900/80 backdrop-blur-md flex items-center px-4 sticky top-0 z-50">
      {showBack && (
        <button onClick={() => setView('home')} className="p-2 mr-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition">
          <ArrowLeft size={20} />
        </button>
      )}
      <h1 className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 font-black tracking-[0.2em] text-sm flex-1 text-center">
        {title}
      </h1>
      {showBack && <div className="w-9" />} 
    </div>
  );

  const BottomNav = () => (
    <div className="h-20 border-t border-white/10 bg-slate-900/90 backdrop-blur-xl absolute bottom-0 w-full flex justify-around items-center px-6 z-50 pb-6">
      <button onClick={() => setView('home')} className={`flex flex-col items-center gap-1 ${view === 'home' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'} transition`}>
        <User size={24} className={view === 'home' ? 'drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]' : ''} />
        <span className="text-[10px] font-bold tracking-widest">NEXUS</span>
      </button>
      <button onClick={() => setView('map')} className={`flex flex-col items-center gap-1 ${view === 'map' ? 'text-rose-400' : 'text-slate-500 hover:text-slate-300'} transition`}>
        <MapIcon size={24} className={view === 'map' ? 'drop-shadow-[0_0_8px_rgba(251,113,133,0.8)]' : ''} />
        <span className="text-[10px] font-bold tracking-widest">RADAR</span>
      </button>
      <button onClick={() => setView('study')} className={`flex flex-col items-center gap-1 ${view === 'study' ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'} transition`}>
        <BookOpen size={24} className={view === 'study' ? 'drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]' : ''} />
        <span className="text-[10px] font-bold tracking-widest">ARCHIVE</span>
      </button>
    </div>
  );

  // --- Render Views ---
  const renderLoading = () => (
    <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center text-white relative overflow-hidden">
      <style>{aaaStyles}</style>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.1)_0,transparent_50%)] animate-pulse" />
      <Loader2 className="w-16 h-16 animate-spin text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.8)] mb-8 relative z-10" />
      <p className="text-xs font-black tracking-[0.3em] text-blue-400 animate-pulse text-glow relative z-10 text-center px-4">
        {loadingText}
      </p>
    </div>
  );

  const renderHome = () => (
    <div className="flex flex-col h-full bg-slate-950 relative overflow-hidden">
      <TopBar title="NEXUS PROFILE" />
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[30%] bg-blue-600/20 blur-[100px] rounded-full" />
      <div className="absolute bottom-[10%] right-[-10%] w-[50%] h-[30%] bg-emerald-600/10 blur-[100px] rounded-full" />

      <div className="flex-1 overflow-y-auto p-6 pb-28 relative z-10 space-y-6">
        <div className="flex flex-col items-center mt-4">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full blur opacity-50 group-hover:opacity-100 transition duration-1000"></div>
            <div className="relative w-40 h-40 rounded-full border-2 border-slate-700/50 bg-slate-900 overflow-hidden shadow-2xl flex items-center justify-center">
              {profile?.imageBase64 ? (
                <img src={`data:image/jpeg;base64,${profile.imageBase64}`} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={48} className="text-slate-600" />
              )}
            </div>
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 px-4 py-1 rounded-full text-[10px] font-black tracking-widest text-amber-400 shadow-lg whitespace-nowrap">
              LVL {STAGES[profile?.stage || 0].level}: {STAGES[profile?.stage || 0].name}
            </div>
          </div>
          <h2 className="mt-6 text-xl font-bold text-white tracking-wide">{STAGES[profile?.stage || 0].title}</h2>
          <p className="text-xs text-slate-400 mt-1 tracking-widest uppercase">Courses Mastered: <span className="text-emerald-400 font-bold">{profile?.coursesCompleted}</span></p>
        </div>

        <div className="glass-panel rounded-2xl p-5 mt-6">
           <ProgressBar current={profile?.hp} max={profile?.maxHp} colorClass="bg-rose-500" label="VITALITY (HP)" />
        </div>

        <div>
          <h3 className="text-xs font-black tracking-widest text-slate-500 mb-3 ml-2 flex items-center gap-2">
            <Sparkles size={14} /> ACTIVE SKILLS
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {profile?.skills.map((s, i) => (
              <div key={i} className="glass-panel p-3 rounded-xl flex flex-col justify-center border-l-2 border-l-blue-500">
                <span className={`text-xs font-bold ${s.color} truncate`}>{s.name}</span>
                <span className="text-[9px] text-slate-500 tracking-wider mt-1 uppercase">PWR: {s.power || 'SYS'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );

  const renderMap = () => (
    <div className="flex flex-col h-full bg-slate-950 relative overflow-hidden text-white">
      <TopBar title="THREAT RADAR" showBack />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(225,29,72,0.05)_0,transparent_70%)]" />
      
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10 space-y-12 pb-20">
        <div className="relative">
          <div className="absolute inset-0 border border-rose-500/30 rounded-full animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]" />
          <div className="absolute inset-4 border border-rose-500/50 rounded-full animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite_0.5s]" />
          <div className="w-40 h-40 rounded-full border-2 border-rose-500/20 bg-rose-950/30 backdrop-blur-sm flex items-center justify-center animate-float relative z-10">
            <Crosshair size={64} className="text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.8)]" />
          </div>
        </div>

        <div className="space-y-4 max-w-xs">
          <h2 className="text-2xl font-black tracking-widest text-white text-glow">SCAN SECTOR</h2>
          <p className="text-xs text-slate-400 leading-relaxed uppercase tracking-wider">
            Initiate deep scan to locate High-Value Targets. Defeat them to extract new combat routines.
          </p>
        </div>

        <button onClick={handleGenerateBoss} className="relative w-full max-w-[250px] group overflow-hidden rounded-xl bg-rose-600 p-1 active:scale-95 transition-all duration-300 shadow-[0_0_20px_rgba(225,29,72,0.4)]">
          <div className="absolute inset-0 bg-gradient-to-r from-rose-400 to-rose-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative bg-slate-950 px-6 py-4 rounded-lg flex items-center justify-center gap-3">
            <Skull size={20} className="text-rose-500" />
            <span className="font-black tracking-widest text-sm text-rose-50">ENGAGE RADAR</span>
          </div>
        </button>
      </div>
      <BottomNav />
    </div>
  );

  const renderStudy = () => {
    const course = courses.find(c => c.id === activeCourseId);
    const courseChapters = chapters.filter(c => c.courseId === activeCourseId);
    const allCompleted = courseChapters.length > 0 && courseChapters.every(c => c.completed);

    return (
      <div className="flex flex-col h-full bg-slate-950 text-white relative">
        <TopBar title={activeCourseId ? "ACTIVE PROTOCOL" : "ARCHIVE TERMINAL"} showBack />
        <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-28">
          
          {activeBoss && !activeCourseId && (
            <div className="glass-panel p-4 rounded-2xl border-rose-500/30 relative overflow-hidden">
              <div className="absolute right-0 top-0 w-32 h-32 bg-rose-500/10 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2" />
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-rose-500/50 shrink-0 shadow-[0_0_15px_rgba(225,29,72,0.3)]">
                  {activeBoss.imageBase64 ? 
                    <img src={`data:image/jpeg;base64,${activeBoss.imageBase64}`} alt="Target" className="w-full h-full object-cover" /> : 
                    <div className="w-full h-full bg-slate-800" />}
                </div>
                <div>
                  <h3 className="text-[10px] font-black tracking-widest text-rose-400 mb-1">TARGET LOCKED</h3>
                  <p className="font-bold text-sm text-slate-200 truncate">{activeBoss.name}</p>
                  <p className="text-[10px] text-slate-500 mt-1">Acquire knowledge to break shield.</p>
                </div>
              </div>
            </div>
          )}

          {!activeCourseId && (
            <form onSubmit={handleCreateCourse} className="space-y-6 mt-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black tracking-widest text-slate-400 ml-1">KNOWLEDGE QUERY</label>
                <div className="relative">
                  <input 
                    type="text"
                    value={courseTopic}
                    onChange={(e) => setCourseTopic(e.target.value)}
                    placeholder="e.g. Quantum Physics, History of Rome"
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-4 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-slate-600 transition"
                    required
                  />
                  <BookOpen className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600" size={20} />
                </div>
              </div>
              <button type="submit" className="w-full py-4 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white rounded-xl font-black tracking-widest text-xs shadow-[0_0_20px_rgba(59,130,246,0.3)] active:scale-95 transition-all flex items-center justify-center gap-2">
                COMPILE MODULE
              </button>
            </form>
          )}

          {activeCourseId && course && (
            <div className="space-y-4">
              <div className="glass-panel p-5 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                <h2 className="text-lg font-bold text-white mb-2">{course.title}</h2>
                <p className="text-xs text-slate-400 leading-relaxed">{course.description}</p>
              </div>

              <div className="space-y-3">
                {courseChapters.map((chap, idx) => (
                  <div key={chap.id} className={`glass-panel p-4 rounded-xl border-l-2 transition-all duration-300 ${chap.completed ? 'border-l-emerald-500 bg-emerald-950/20' : 'border-l-slate-700'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className={`text-sm font-bold ${chap.completed ? 'text-emerald-400' : 'text-slate-200'}`}>
                        {idx + 1}. {chap.title}
                      </h4>
                      <span className="text-[9px] font-black tracking-widest text-slate-500 bg-slate-900 px-2 py-1 rounded border border-slate-700">
                        {chap.durationMins}M
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-4 line-clamp-2">{chap.summary}</p>
                    <button 
                      onClick={() => completeChapter(chap.id)}
                      disabled={chap.completed}
                      className={`w-full py-3 rounded-lg font-bold text-xs tracking-widest transition-all ${
                        chap.completed ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 opacity-50 cursor-not-allowed' : 'bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 active:scale-95'
                      }`}
                    >
                      {chap.completed ? 'VERIFIED' : 'MARK ASSIMILATED'}
                    </button>
                  </div>
                ))}
              </div>

              {allCompleted && activeBoss && (
                <button onClick={startCombat} className="w-full mt-8 py-5 bg-rose-600 text-white rounded-xl font-black tracking-[0.2em] text-sm shadow-[0_0_30px_rgba(225,29,72,0.6)] animate-pulse active:scale-95 transition-transform">
                  INITIALIZE COMBAT
                </button>
              )}
            </div>
          )}
        </div>
        <BottomNav />
      </div>
    );
  };

  const renderCombat = () => {
    if (!combatState) return null;
    return (
      <div className="flex flex-col h-[100dvh] bg-slate-950 text-white relative overflow-hidden">
        <style>{aaaStyles}</style>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(225,29,72,0.15)_0,transparent_50%),radial-gradient(ellipse_at_bottom,rgba(59,130,246,0.15)_0,transparent_50%)]" />

        <div className={`flex-1 flex flex-col items-end justify-start p-6 pt-12 relative z-10 transition-transform ${isHitBoss ? 'animate-shake' : ''}`}>
          <div className="w-[80%] max-w-sm flex items-start gap-4 flex-row-reverse">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-rose-500 rounded-full blur-md opacity-50" />
              <div className={`w-24 h-24 rounded-full border-2 bg-slate-900 overflow-hidden relative z-10 transition-colors ${isHitBoss ? 'border-rose-400 bg-rose-900' : 'border-rose-900/50'}`}>
                {activeBoss?.imageBase64 && <img src={`data:image/jpeg;base64,${activeBoss.imageBase64}`} alt="Boss" className={`w-full h-full object-cover ${isHitBoss ? 'mix-blend-luminosity' : ''}`} />}
              </div>
              {combatState.turn === 'boss' && <div className="absolute -bottom-2 right-1/2 translate-x-1/2 bg-rose-600 text-white text-[9px] font-black tracking-widest px-2 py-0.5 rounded shadow-[0_0_10px_rgba(225,29,72,0.8)] z-20">ATTACKING</div>}
            </div>
            <div className="flex-1 glass-panel rounded-xl p-3 flex flex-col justify-center">
              <h3 className="text-xs font-black tracking-widest text-rose-400 mb-2 truncate text-right">{activeBoss?.name}</h3>
              <ProgressBar current={combatState.bossHp} max={activeBoss?.maxHp} colorClass="bg-rose-500" label="HP" />
            </div>
          </div>
        </div>

        <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-y-1/2 z-0" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-700/50 font-black text-6xl italic tracking-tighter z-0 pointer-events-none">VS</div>

        <div className={`flex-1 flex flex-col items-start justify-end p-6 pb-4 relative z-10 transition-transform ${isHitPlayer ? 'animate-shake' : ''}`}>
          <div className="w-[80%] max-w-sm flex items-end gap-4">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-blue-500 rounded-full blur-md opacity-50" />
              <div className={`w-24 h-24 rounded-full border-2 bg-slate-900 overflow-hidden relative z-10 transition-colors ${isHitPlayer ? 'border-rose-400 bg-rose-900' : 'border-blue-500/50'}`}>
                {profile?.imageBase64 && <img src={`data:image/jpeg;base64,${profile.imageBase64}`} alt="Player" className={`w-full h-full object-cover ${isHitPlayer ? 'mix-blend-luminosity' : ''}`} />}
              </div>
              {combatState.turn === 'player' && <div className="absolute -top-2 right-1/2 translate-x-1/2 bg-blue-500 text-white text-[9px] font-black tracking-widest px-2 py-0.5 rounded shadow-[0_0_10px_rgba(59,130,246,0.8)] z-20 animate-pulse">YOUR TURN</div>}
            </div>
            <div className="flex-1 glass-panel rounded-xl p-3 flex flex-col justify-center">
              <h3 className="text-xs font-black tracking-widest text-blue-400 mb-2 truncate">NEXUS AVATAR</h3>
              <ProgressBar current={combatState.playerHp} max={profile?.maxHp} colorClass="bg-emerald-400" label="HP" />
            </div>
          </div>
        </div>

        <div className="h-64 bg-slate-900 border-t border-slate-700/50 rounded-t-3xl shadow-[0_-20px_50px_rgba(0,0,0,0.5)] z-20 flex flex-col">
          <div className="h-20 bg-slate-950/50 overflow-y-auto p-3 px-6 space-y-1 text-xs font-mono border-b border-slate-800">
            {combatLog.map((log, i) => (
              <div key={i} className={`opacity-80 ${log.type === 'player' ? 'text-blue-300' : log.type === 'boss' ? 'text-rose-400' : log.type === 'heal' ? 'text-emerald-400' : 'text-slate-500'}`}>
                {'> '} {log.text}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
          <div className="flex-1 p-4 grid grid-cols-2 gap-3 overflow-y-auto">
             <button onClick={() => executeTurn('attack')} disabled={combatState.turn !== 'player'} className="glass-panel py-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center gap-1 active:scale-95 disabled:opacity-30 transition-all hover:bg-slate-800">
                <Swords size={18} className="text-slate-300" /> 
                <span className="text-[10px] font-black tracking-widest text-slate-400">STRIKE</span>
              </button>
              <button onClick={() => executeTurn('heal')} disabled={combatState.turn !== 'player'} className="glass-panel py-3 rounded-xl border border-emerald-900/50 bg-emerald-950/20 flex flex-col items-center justify-center gap-1 active:scale-95 disabled:opacity-30 transition-all hover:bg-emerald-900/40">
                <Heart size={18} className="text-emerald-500" /> 
                <span className="text-[10px] font-black tracking-widest text-emerald-600">RECOVER</span>
              </button>
              {profile?.skills.map((skill, idx) => (
                <button key={idx} onClick={() => executeTurn('skill', skill)} disabled={combatState.turn !== 'player'} className="glass-panel py-3 col-span-2 rounded-xl border border-blue-900/50 bg-blue-950/10 flex flex-row items-center justify-between px-6 active:scale-95 disabled:opacity-30 transition-all hover:bg-blue-900/30">
                  <div className="flex items-center gap-3">
                    <Sparkles size={16} className={skill.color} />
                    <span className={`text-xs font-black tracking-wider ${skill.color}`}>{skill.name.toUpperCase()}</span>
                  </div>
                  <span className="text-[9px] font-black tracking-widest text-slate-500">PWR {skill.power}</span>
                </button>
              ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-black flex items-center justify-center font-sans">
      <div className="w-full max-w-md h-[100dvh] sm:h-[85vh] sm:rounded-[2.5rem] bg-slate-950 shadow-2xl overflow-hidden relative flex flex-col sm:border-[12px] border-slate-900">
        {view === 'loading' && renderLoading()}
        {view === 'home' && renderHome()}
        {view === 'map' && renderMap()}
        {view === 'study' && renderStudy()}
        {view === 'combat' && renderCombat()}
      </div>
    </div>
  );
}
