import React, { useState, useEffect, useRef } from 'react';
import { 
  Heart, BookOpen, Skull, Swords, ArrowLeft, Loader2, Sparkles, 
  Crown, User, Crosshair, ChevronDown, XCircle, Scroll, ShieldCheck, Zap
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, updateDoc, onSnapshot, addDoc, deleteDoc } from 'firebase/firestore';

// --- API Setup ---
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const IMAGE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;

const AVAILABLE_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Fast)' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Deep Lore)' },
];

// --- Firebase Setup ---
const firebaseConfig = {
  apiKey: "AIzaSyB80OS8Lh0xDHhWl95PphjN1B1WiOoK33M",
  authDomain: "ai-study-party.firebaseapp.com",
  projectId: "ai-study-party",
  storageBucket: "ai-study-party.firebasestorage.app",
  messagingSenderId: "583546365173",
  appId: "1:583546365173:web:dd2fbec4ec4d20380951bc"
};
const appId = "celestial-archive-v1";

let app, auth, db, fatalInitError = null;
try {
  if (!apiKey) throw new Error("Gemini API Key is missing! Check your .env file.");
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) { fatalInitError = error.message; }

// --- Ascension Stages (Chinese Fantasy Theme) ---
const STAGES = [
  { level: 0, name: 'Commoner', title: 'Mortal Peasant' },
  { level: 1, name: 'Militia', title: 'Village Guard' },
  { level: 2, name: 'Cultivator', title: 'Sect Disciple' },
  { level: 3, name: 'Captain', title: 'Imperial Officer' },
  { level: 4, name: 'General', title: 'Grand Marshal' },
  { level: 5, name: 'Emperor', title: 'Son of Heaven' }
];

// --- Utilities ---
const fetchWithBackoff = async (url, options, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || `HTTP error! status: ${response.status}`);
      return data;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(res => setTimeout(res, delay));
      delay *= 2;
    }
  }
};

const generateImage = async (prompt, fallbackSeed, style = 'adventurer') => {
  try {
    const payload = { instances: [{ prompt: prompt }], parameters: { sampleCount: 1 } };
    const result = await fetchWithBackoff(IMAGE_API_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (result.predictions?.[0]?.bytesBase64Encoded) return result.predictions[0].bytesBase64Encoded;
    throw new Error("Invalid format from Gemini");
  } catch (error) {
    console.warn("Imagen blocked. Using fallback...", error);
    return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(fallbackSeed)}&backgroundColor=transparent`;
  }
};

const generateJSON = async (prompt, schema, modelId) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: schema }
  };
  const result = await fetchWithBackoff(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  return JSON.parse(result.candidates[0].content.parts[0].text);
};

const getImageSrc = (data) => data.startsWith('http') ? data : `data:image/jpeg;base64,${data}`;

const TextRenderer = ({ text }) => (
  <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
    {text.split('\n').map((paragraph, idx) => paragraph.trim() ? <p key={idx}>{paragraph}</p> : null)}
  </div>
);

// --- Custom CSS ---
const aaaStyles = `
  @keyframes screenShake {
    0%, 100% { transform: translate(1px, 1px) rotate(0deg); }
    20% { transform: translate(-5px, 0px) rotate(2deg); }
    40% { transform: translate(3px, -2px) rotate(-2deg); }
    60% { transform: translate(-5px, 2px) rotate(0deg); }
    80% { transform: translate(-2px, -2px) rotate(2deg); }
  }
  .animate-shake { animation: screenShake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
  .animate-heavy-shake { animation: screenShake 0.8s cubic-bezier(.36,.07,.19,.97) infinite; }
  @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
  .animate-float { animation: float 4s ease-in-out infinite; }
  .glass-panel {
    background: rgba(15, 23, 42, 0.8);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  }
  .text-glow { text-shadow: 0 0 10px rgba(96, 165, 250, 0.8); }
`;

export default function App() {
  if (fatalInitError) return <div className="min-h-screen bg-red-950 text-red-200 p-6 text-center">{fatalInitError}</div>;

  const [user, setUser] = useState(null);
  const [view, setView] = useState('loading'); 
  const [loadingText, setLoadingText] = useState('OPENING CELESTIAL GATES...');
  
  const [profile, setProfile] = useState(null);
  const [courses, setCourses] = useState([]);
  
  // Creation Form
  const [courseTopic, setCourseTopic] = useState('');
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id);

  // Active View States
  const [activeCourse, setActiveCourse] = useState(null);
  const [readingChapter, setReadingChapter] = useState(null);
  
  // Quiz Combat State
  const [quizState, setQuizState] = useState(null);

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'main');
    const unsubProfile = onSnapshot(profileRef, async (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data());
        setView(prev => prev === 'loading' ? 'home' : prev);
      } else {
        setLoadingText('MANIFESTING MORTAL VESSEL...');
        try {
          const img = await generateImage("AAA game asset, 2d digital art, cute chibi chinese peasant commoner, ancient china, wuxia fantasy, cinematic lighting, dark background, highly detailed RPG portrait", "Mortal", "adventurer");
          const newProfile = { stage: 0, coursesCompleted: 0, imageBase64: img || "" };
          await setDoc(profileRef, newProfile);
          setProfile(newProfile);
          setView('home');
        } catch (e) { alert("API Error."); }
      }
    });

    const coursesCol = collection(db, 'artifacts', appId, 'users', user.uid, 'campaigns');
    const unsubCourses = onSnapshot(coursesCol, (snap) => {
      setCourses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubProfile(); unsubCourses(); };
  }, [user]);

  // --- Core Game Actions ---
  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    if (!courseTopic.trim()) return;
    setView('loading');
    setLoadingText('WEAVING THE TAPESTRY OF FATE...');

    try {
      const payload = await generateJSON(
        `Create a fantasy RPG campaign based on teaching the user about "${courseTopic}". 
        1. Create a villain (Boss) whose theme matches a misunderstanding or corruption of this topic.
        2. Create 3-4 educational chapters (full detailed paragraphs of actual learning content).
        3. Create a 3-question multiple choice Quiz to act as the final boss fight.`,
        {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            description: { type: "STRING" },
            boss: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                introStory: { type: "STRING" },
                imagePrompt: { type: "STRING" }
              }
            },
            chapters: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: { title: { type: "STRING" }, fullContent: { type: "STRING" } }
              }
            },
            quiz: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  question: { type: "STRING" },
                  options: { type: "ARRAY", items: { type: "STRING" } },
                  correctIndex: { type: "NUMBER" }
                }
              }
            }
          },
          required: ["title", "description", "boss", "chapters", "quiz"]
        },
        selectedModel
      );

      setLoadingText('SUMMONING THE ADVERSARY...');
      const bossImage = await generateImage(`AAA game asset, 2d digital art, Chinese fantasy wuxia monster, ${payload.boss.imagePrompt}, cinematic lighting, dark background`, payload.boss.name, "bottts");
      
      const campaignDoc = {
        ...payload,
        boss: { ...payload.boss, imageBase64: bossImage || "" },
        chapters: payload.chapters.map(c => ({ ...c, completed: false })),
        status: 'active',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'campaigns'), campaignDoc);
      setCourseTopic('');
      setView('home');
    } catch (e) {
      console.error(e);
      alert("The celestial weave failed. Try another topic.");
      setView('create');
    }
  };

  const completeActiveChapter = async () => {
    const updatedChapters = activeCourse.chapters.map((ch, idx) => 
      idx === readingChapter.idx ? { ...ch, completed: true } : ch
    );
    const courseRef = doc(db, 'artifacts', appId, 'users', user.uid, 'campaigns', activeCourse.id);
    await updateDoc(courseRef, { chapters: updatedChapters });
    
    setActiveCourse(prev => ({ ...prev, chapters: updatedChapters }));
    setReadingChapter(null);
  };

  const abandonCampaign = async (id) => {
    if (!window.confirm("Abandon this campaign? The enemy will conquer that realm.")) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'campaigns', id));
    setActiveCourse(null);
    setView('home');
  };

  // --- Quiz Combat Logic ---
  const startBossFight = () => {
    setQuizState({
      currentIndex: 0,
      score: 0,
      bossHp: 100,
      playerHp: 100,
      log: [`${activeCourse.boss.name} challenges your knowledge!`],
      isFinishingBlow: false,
      isHitBoss: false,
      isHitPlayer: false
    });
    setView('combat');
  };

  const answerQuestion = (selectedIndex) => {
    const currentQ = activeCourse.quiz[quizState.currentIndex];
    const isCorrect = selectedIndex === currentQ.correctIndex;
    const dmgPerQuestion = 100 / activeCourse.quiz.length;

    if (isCorrect) {
      setQuizState(prev => ({
        ...prev,
        score: prev.score + 1,
        bossHp: Math.max(0, prev.bossHp - dmgPerQuestion),
        log: [`CORRECT! You strike ${activeCourse.boss.name} with truth!`, ...prev.log],
        isHitBoss: true
      }));
      setTimeout(() => setQuizState(prev => ({ ...prev, isHitBoss: false })), 400);
    } else {
      setQuizState(prev => ({
        ...prev,
        playerHp: Math.max(0, prev.playerHp - 35), // Penalty
        log: [`WRONG! ${activeCourse.boss.name} exploits your ignorance!`, ...prev.log],
        isHitPlayer: true
      }));
      setTimeout(() => setQuizState(prev => ({ ...prev, isHitPlayer: false })), 400);
    }

    // Process next step after short delay for animation
    setTimeout(() => {
      setQuizState(prev => {
        const nextIndex = prev.currentIndex + 1;
        
        // End of Quiz
        if (nextIndex >= activeCourse.quiz.length) {
          if (prev.score + (isCorrect ? 1 : 0) === activeCourse.quiz.length) {
            // Full Marks!
            triggerFinishingBlow();
            return { ...prev, currentIndex: nextIndex };
          } else {
            // Failed
            setTimeout(() => {
              alert(`You scored ${prev.score + (isCorrect ? 1 : 0)}/${activeCourse.quiz.length}. The boss overwhelmed you. Study the scrolls and try again!`);
              setView('campaign');
            }, 1000);
            return { ...prev, currentIndex: nextIndex };
          }
        }
        return { ...prev, currentIndex: nextIndex };
      });
    }, 1500);
  };

  const triggerFinishingBlow = () => {
    setQuizState(prev => ({ ...prev, isFinishingBlow: true, log: ["FULL COMBO! EXECUTING FINISHING BLOW!", ...prev.log] }));
    
    setTimeout(async () => {
      // Victory Logic
      setView('loading');
      setLoadingText('ABSORBING CELESTIAL ENERGY...');
      
      let newStage = profile.stage;
      let newImage = profile.imageBase64;
      const newCompleted = profile.coursesCompleted + 1;

      // Evolve character every 2 courses
      if (newCompleted % 2 === 0 && newStage < STAGES.length - 1) {
        newStage += 1;
        setLoadingText(`ASCENDING TO: ${STAGES[newStage].name.toUpperCase()}...`);
        try {
          const nextPrompt = `AAA game asset, 2d digital art, cute chibi chinese ${STAGES[newStage].name.toLowerCase()}, ancient china emperor progression, wuxia xianxia fantasy, cinematic lighting, dark background, highly detailed RPG portrait`;
          newImage = await generateImage(nextPrompt, `Hero-${STAGES[newStage].name}`, "adventurer") || newImage;
        } catch (e) { console.error(e); }
      }

      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'main'), {
        coursesCompleted: newCompleted, stage: newStage, imageBase64: newImage
      });
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'campaigns', activeCourse.id), { status: 'completed' });

      alert(`VICTORY! You defeated ${activeCourse.boss.name}!`);
      setActiveCourse(null);
      setView('home');
    }, 2500); // 2.5 seconds of finishing blow animation
  };

  // --- UI Layouts ---
  const TopBar = ({ title, onBack }) => (
    <div className="h-16 border-b border-white/10 bg-slate-900/80 backdrop-blur-md flex items-center px-4 sticky top-0 z-40 shrink-0">
      {onBack && (
        <button onClick={onBack} className="p-2 mr-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300">
          <ArrowLeft size={20} />
        </button>
      )}
      <h1 className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 font-black tracking-[0.2em] text-sm flex-1 text-center">
        {title}
      </h1>
      {onBack && <div className="w-9" />} 
    </div>
  );

  const BottomNav = () => (
    <div className="h-20 border-t border-white/10 bg-slate-900/90 backdrop-blur-xl absolute bottom-0 w-full flex justify-around items-center px-6 z-40 pb-6 shrink-0">
      <button onClick={() => { setActiveCourse(null); setView('home'); }} className={`flex flex-col items-center gap-1 ${view === 'home' ? 'text-amber-400' : 'text-slate-500'}`}>
        <Scroll size={24} className={view === 'home' ? 'drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]' : ''} />
        <span className="text-[10px] font-bold tracking-widest">CAMPAIGNS</span>
      </button>
      <button onClick={() => setView('create')} className={`flex flex-col items-center gap-1 ${view === 'create' ? 'text-emerald-400' : 'text-slate-500'}`}>
        <Sparkles size={24} className={view === 'create' ? 'drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]' : ''} />
        <span className="text-[10px] font-bold tracking-widest">THE FORGE</span>
      </button>
    </div>
  );

  // --- Views ---
  const renderLoading = () => (
    <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center text-white">
      <style>{aaaStyles}</style>
      <Loader2 className="w-16 h-16 animate-spin text-amber-500 mb-8" />
      <p className="text-xs font-black tracking-[0.3em] text-amber-400 animate-pulse text-glow px-4 text-center">{loadingText}</p>
    </div>
  );

  const renderHome = () => {
    const activeCampaigns = courses.filter(c => c.status === 'active');
    
    return (
      <div className="flex flex-col h-full bg-slate-950 relative overflow-hidden">
        <TopBar title="THE CELESTIAL PATH" />
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[30%] bg-amber-600/20 blur-[100px] rounded-full" />
        
        <div className="flex-1 overflow-y-auto p-6 pb-28 relative z-10 space-y-8">
          {/* Emperor Profile */}
          <div className="flex items-center gap-5 glass-panel p-4 rounded-3xl border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.1)]">
            <div className="relative w-24 h-24 rounded-full border-2 border-amber-500/50 overflow-hidden bg-slate-900 shrink-0">
              {profile?.imageBase64 && <img src={getImageSrc(profile.imageBase64)} alt="Avatar" className="w-full h-full object-cover" />}
            </div>
            <div>
              <div className="text-[10px] font-black tracking-widest text-amber-400 mb-1 flex items-center gap-1">
                <Crown size={12}/> LEVEL {STAGES[profile?.stage || 0].level}
              </div>
              <h2 className="text-lg font-bold text-white tracking-wide leading-tight">{STAGES[profile?.stage || 0].title}</h2>
              <p className="text-xs text-slate-400 mt-2">Foes Vanquished: <span className="text-white font-bold">{profile?.coursesCompleted}</span></p>
            </div>
          </div>

          {/* Quest Log */}
          <div>
            <h3 className="text-xs font-black tracking-widest text-slate-500 mb-4 flex items-center gap-2">
              <Scroll size={14} /> ACTIVE CAMPAIGNS ({activeCampaigns.length})
            </h3>
            
            {activeCampaigns.length === 0 ? (
              <div className="text-center p-8 border-2 border-dashed border-slate-800 rounded-2xl">
                <p className="text-sm text-slate-500 font-bold tracking-wider">No active threats.</p>
                <button onClick={() => setView('create')} className="mt-4 text-xs font-bold text-amber-500 bg-amber-500/10 px-4 py-2 rounded-lg">Visit The Forge</button>
              </div>
            ) : (
              <div className="space-y-4">
                {activeCampaigns.map(c => (
                  <div key={c.id} onClick={() => { setActiveCourse(c); setView('campaign'); }} className="glass-panel p-4 rounded-2xl flex items-center gap-4 cursor-pointer hover:bg-slate-800/80 transition active:scale-95 group">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-slate-900 border border-slate-700 shrink-0 group-hover:border-amber-500/50 transition">
                       {c.boss?.imageBase64 && <img src={getImageSrc(c.boss.imageBase64)} className="w-full h-full object-cover" alt="boss"/>}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h4 className="text-sm font-bold text-white truncate">{c.title}</h4>
                      <p className="text-xs text-slate-400 truncate mt-1">Target: {c.boss?.name}</p>
                    </div>
                    <ChevronRight size={20} className="text-slate-600 group-hover:text-amber-400 transition" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <BottomNav />
      </div>
    );
  };

  const renderCreate = () => (
    <div className="flex flex-col h-full bg-slate-950 text-white relative overflow-hidden">
      <TopBar title="THE FORGE" />
      <div className="flex-1 overflow-y-auto p-6 flex flex-col justify-center pb-28 relative z-10">
        
        <div className="mb-8 text-center space-y-3">
          <div className="w-20 h-20 bg-emerald-950/50 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20 shadow-[0_0_30px_rgba(52,211,153,0.2)]">
            <Sparkles size={32} className="text-emerald-400" />
          </div>
          <h2 className="text-xl font-black tracking-widest">MANIFEST DESTINY</h2>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
            Name a domain of knowledge. The celestial engine will weave a campaign, a foe, and the scrolls needed to conquer them.
          </p>
        </div>

        <form onSubmit={handleCreateCampaign} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black tracking-widest text-slate-400 ml-1">KNOWLEDGE DOMAIN</label>
            <input 
              type="text" value={courseTopic} onChange={(e) => setCourseTopic(e.target.value)}
              placeholder="e.g. React Hooks, Ancient Rome..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-4 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black tracking-widest text-slate-400 ml-1 flex justify-between">
              AI ARCHITECT MODEL
            </label>
            <select 
              value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-4 text-sm text-white focus:outline-none focus:border-emerald-500 appearance-none"
            >
              {AVAILABLE_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          <button type="submit" className="w-full mt-4 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-black tracking-widest text-xs shadow-[0_0_20px_rgba(52,211,153,0.3)] active:scale-95 transition-all">
            FORGE CAMPAIGN
          </button>
        </form>
      </div>
      <BottomNav />
    </div>
  );

  const renderCampaign = () => {
    if (!activeCourse) return null;
    const allCompleted = activeCourse.chapters.every(c => c.completed);

    return (
      <div className="flex flex-col h-full bg-slate-950 text-white relative">
        <TopBar title="CAMPAIGN SCROLL" onBack={() => { setActiveCourse(null); setView('home'); }} />
        <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-28">
          
          {/* Boss Header */}
          <div className="glass-panel p-5 rounded-3xl border-rose-500/30 relative overflow-hidden shadow-[0_0_30px_rgba(225,29,72,0.1)]">
            <div className="absolute right-0 top-0 w-40 h-40 bg-rose-500/20 blur-3xl rounded-full translate-x-1/3 -translate-y-1/3" />
            <div className="flex flex-col items-center text-center relative z-10">
              <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-rose-500/50 shadow-[0_0_20px_rgba(225,29,72,0.4)] mb-4">
                <img src={getImageSrc(activeCourse.boss.imageBase64)} alt="Boss" className="w-full h-full object-cover" />
              </div>
              <h3 className="text-[10px] font-black tracking-widest text-rose-400 mb-1">THE ADVERSARY</h3>
              <h2 className="text-xl font-bold text-white mb-3">{activeCourse.boss.name}</h2>
              <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                <p className="text-xs text-slate-300 italic leading-relaxed">"{activeCourse.boss.introStory}"</p>
              </div>
            </div>
          </div>

          {/* Chapters List */}
          <div>
            <div className="flex justify-between items-end mb-4 px-1">
               <h3 className="text-xs font-black tracking-widest text-slate-400">THE SCROLLS OF ASCENSION</h3>
               <button onClick={() => abandonCampaign(activeCourse.id)} className="text-[10px] text-red-500 font-bold hover:text-red-400">ABANDON QUEST</button>
            </div>
            
            <div className="space-y-3">
              {activeCourse.chapters.map((chap, idx) => (
                <div 
                  key={idx} onClick={() => !chap.completed && setReadingChapter({ ...chap, idx })}
                  className={`glass-panel p-4 rounded-2xl flex items-center justify-between border-l-4 transition-all cursor-pointer active:scale-95 ${
                    chap.completed ? 'border-l-emerald-500 bg-emerald-950/10' : 'border-l-amber-500 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex-1 pr-4">
                    <h4 className={`text-sm font-bold ${chap.completed ? 'text-emerald-400' : 'text-slate-200'}`}>Chapter {idx + 1}: {chap.title}</h4>
                    {!chap.completed && <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">Tap to read content</p>}
                  </div>
                  {chap.completed ? <ShieldCheck size={24} className="text-emerald-500" /> : <BookOpen size={20} className="text-slate-600" />}
                </div>
              ))}
            </div>
          </div>

          {/* Climax Button */}
          {allCompleted && (
            <button onClick={startBossFight} className="w-full mt-8 py-5 bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-2xl font-black tracking-[0.2em] text-sm shadow-[0_0_40px_rgba(225,29,72,0.6)] animate-pulse active:scale-95 transition-transform flex justify-center items-center gap-3">
              <Swords size={20}/> FACE THE ADVERSARY
            </button>
          )}
        </div>
        
        {/* Chapter Reader Modal Popup */}
        {readingChapter && (
          <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
            <TopBar title={`CHAPTER ${readingChapter.idx + 1}`} onBack={() => setReadingChapter(null)} />
            <div className="flex-1 overflow-y-auto p-6 bg-slate-900">
              <h2 className="text-xl font-bold text-white mb-6 leading-tight">{readingChapter.title}</h2>
              <TextRenderer text={readingChapter.fullContent} />
            </div>
            <div className="p-4 bg-slate-950 border-t border-slate-800 shrink-0 pb-safe">
              <button 
                onClick={completeActiveChapter}
                className="w-full py-4 bg-amber-600 text-white rounded-xl font-black tracking-widest text-xs shadow-[0_0_20px_rgba(245,158,11,0.3)] active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles size={16} /> KNOWLEDGE ASSIMILATED
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCombat = () => {
    if (!quizState || !activeCourse) return null;
    const currentQ = activeCourse.quiz[quizState.currentIndex];

    return (
      <div className={`flex flex-col h-[100dvh] bg-slate-950 text-white relative overflow-hidden ${quizState.isFinishingBlow ? 'animate-heavy-shake' : ''}`}>
        <style>{aaaStyles}</style>
        
        {/* Finishing Blow Overlay */}
        {quizState.isFinishingBlow && (
          <div className="absolute inset-0 z-50 bg-white/90 mix-blend-overlay animate-pulse pointer-events-none flex items-center justify-center">
            <h1 className="text-6xl font-black text-rose-600 italic tracking-tighter drop-shadow-2xl scale-150 transform -rotate-12">FINISHING BLOW!</h1>
          </div>
        )}

        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(225,29,72,0.15)_0,transparent_50%)]" />

        {/* Boss Arena (Top Half) */}
        <div className={`flex-1 flex flex-col items-center justify-center p-6 relative z-10 transition-transform ${quizState.isHitBoss ? 'animate-shake' : ''}`}>
          <div className="relative mb-6">
             <div className={`absolute inset-0 rounded-full blur-2xl transition-all duration-300 ${quizState.isHitBoss ? 'bg-red-600 scale-150 opacity-80' : 'bg-rose-500 opacity-30'}`} />
             <div className={`w-32 h-32 rounded-full border-4 bg-slate-900 overflow-hidden relative z-10 transition-all duration-300 ${quizState.isHitBoss ? 'border-red-500 bg-red-900 scale-95' : 'border-rose-900/50'}`}>
                <img src={getImageSrc(activeCourse.boss.imageBase64)} alt="Boss" className={`w-full h-full object-cover ${quizState.isHitBoss ? 'mix-blend-luminosity opacity-50' : ''}`} />
             </div>
          </div>
          
          <div className="w-full max-w-xs glass-panel rounded-xl p-4 text-center border-rose-500/30">
             <h3 className="text-sm font-black tracking-widest text-rose-400 mb-2">{activeCourse.boss.name}</h3>
             <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden border border-rose-900">
                <div className="h-full bg-rose-500 transition-all duration-500 shadow-[0_0_15px_rgba(244,63,94,0.8)]" style={{ width: `${quizState.bossHp}%` }} />
             </div>
          </div>
        </div>

        {/* Combat Log Divider */}
        <div className="h-16 bg-slate-900/80 backdrop-blur-md border-y border-white/10 flex items-center justify-center px-4 overflow-hidden relative z-20">
          <p className={`text-xs font-black tracking-widest animate-in slide-in-from-bottom-2 ${quizState.log[0]?.startsWith('CORRECT') ? 'text-emerald-400' : quizState.log[0]?.startsWith('WRONG') ? 'text-red-400' : 'text-amber-400'}`}>
            {quizState.log[0]}
          </p>
        </div>

        {/* Quiz UI (Bottom Half) */}
        <div className={`flex-[1.2] bg-slate-900 flex flex-col relative z-20 ${quizState.isHitPlayer ? 'animate-shake bg-red-950/30' : ''}`}>
          {quizState.currentIndex < activeCourse.quiz.length ? (
            <div className="flex-1 flex flex-col p-6 overflow-y-auto">
              <div className="mb-6 flex items-center justify-between">
                <span className="text-[10px] font-black tracking-widest text-slate-500 bg-slate-800 px-3 py-1 rounded-full">
                  STRIKE {quizState.currentIndex + 1} OF {activeCourse.quiz.length}
                </span>
                <div className="flex items-center gap-1 text-red-400 text-[10px] font-bold">
                  <Heart size={12}/> {quizState.playerHp} HP
                </div>
              </div>
              
              <h2 className="text-lg font-bold text-white mb-6 leading-snug">{currentQ.question}</h2>
              
              <div className="space-y-3 mt-auto">
                {currentQ.options.map((opt, idx) => (
                  <button 
                    key={idx} onClick={() => answerQuestion(idx)}
                    disabled={quizState.isHitBoss || quizState.isHitPlayer || quizState.isFinishingBlow}
                    className="w-full p-4 rounded-xl border border-slate-700 bg-slate-800/50 hover:bg-slate-700 text-left text-sm text-slate-200 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <span className="font-bold text-amber-500 mr-3">{String.fromCharCode(65 + idx)}.</span> {opt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 text-center">
               <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-black flex items-center justify-center font-sans selection:bg-amber-500/30">
      <div className="w-full max-w-md h-[100dvh] sm:h-[85vh] sm:rounded-[2.5rem] bg-slate-950 shadow-2xl overflow-hidden relative flex flex-col sm:border-[12px] border-slate-900">
        {view === 'loading' && renderLoading()}
        {view === 'home' && renderHome()}
        {view === 'create' && renderCreate()}
        {view === 'campaign' && renderCampaign()}
        {view === 'combat' && renderCombat()}
      </div>
    </div>
  );
}
