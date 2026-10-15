import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import {
  MessageSquare,
  BookOpen,
  Upload,
  Send,
  FileText,
  CheckCircle2,
  Sparkles,
  Loader2,
  ChevronRight,
  RotateCcw,
  Check,
  GraduationCap,
  Settings,
  Trash2,
  History,
  MessageCircle,
  Pin,
  MoreHorizontal,
  MoreVertical,
  Download,
  Share2,
  User,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  ShieldCheck,
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function App() {
  const [appMode, setAppMode] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [flashcards, setFlashcards] = useState([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredCount, setMasteredCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [selectedDocFilter, setSelectedDocFilter] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);   // chat-history 3-dot
  const [showTopMenu, setShowTopMenu] = useState(false); // top-right 3-dot

  // Authentication state
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('studyrag_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [authMode, setAuthMode] = useState('signup'); // 'signup' or 'login'
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authStatus, setAuthStatus] = useState({ supabase_connected: false, provider: 'Local Storage' });

  const [chatHistory, setChatHistory] = useState([
    {
      id: 'session-1',
      title: 'Neural Networks & Deep Learning',
      timestamp: 'Today',
      pinned: false,
      messages: [
        { role: 'user', content: 'What is backpropagation in neural networks?' },
        { role: 'assistant', content: 'Backpropagation is an algorithm used in machine learning to calculate the gradient of the loss function with respect to network weights using the chain rule of calculus.\n\n📌 SOURCES\n- ML_Foundations.pdf (Page 14)' },
      ],
    },
    {
      id: 'session-2',
      title: 'Data Structures Quick Review',
      timestamp: 'Yesterday',
      pinned: false,
      messages: [
        { role: 'user', content: 'Difference between B-Trees and Binary Trees?' },
        { role: 'assistant', content: 'A Binary Tree has at most 2 children per node. A B-Tree is a self-balancing tree optimised for disk storage.\n\n📌 SOURCES\n- DSA_Handbook.pdf (Page 88)' },
      ],
    },
  ]);
  const [currentSessionId, setCurrentSessionId] = useState(null);

  const chatEndRef = useRef(null);

  useEffect(() => {
    if (messages.length > 0) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Close all pop-up menus when clicking outside
  useEffect(() => {
    const close = () => { setOpenMenuId(null); setShowTopMenu(false); };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  // Check auth and database status on mount
  useEffect(() => {
    axios.get(`${API_BASE_URL}/auth/status`)
      .then(res => setAuthStatus(res.data))
      .catch(() => {});
  }, []);

  // Fetch saved documents from Pinecone on mount / user login
  const fetchUploadedFiles = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/documents`);
      if (res.data?.documents) {
        setUploadedFiles(res.data.documents);
      }
    } catch (err) {
      console.log('Error fetching documents from Pinecone:', err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchUploadedFiles();
    }
  }, [currentUser]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');

    const u = authUsername.trim();
    const p = authPassword.trim();

    if (!u) {
      setAuthError('Please enter a username.');
      return;
    }
    if (u.length < 3) {
      setAuthError('Username must be at least 3 characters.');
      return;
    }
    if (!p) {
      setAuthError('Please enter a password.');
      return;
    }
    if (p.length < 4) {
      setAuthError('Password must be at least 4 characters.');
      return;
    }

    if (authMode === 'signup') {
      if (p !== authConfirmPassword.trim()) {
        setAuthError('Passwords do not match. Please re-enter.');
        return;
      }
    }

    setAuthLoading(true);
    try {
      const endpoint = authMode === 'signup' ? '/auth/signup' : '/auth/login';
      const res = await axios.post(`${API_BASE_URL}${endpoint}`, {
        username: u,
        password: p,
      });

      if (res.data?.user) {
        const userObj = {
          name: res.data.user.username,
          username: res.data.user.username,
          role: res.data.user.role || 'Student Plan',
          id: res.data.user.id
        };
        localStorage.setItem('studyrag_user', JSON.stringify(userObj));
        setCurrentUser(userObj);
        setAuthUsername('');
        setAuthPassword('');
        setAuthConfirmPassword('');
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Authentication failed. Please try again.';
      setAuthError(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('studyrag_user');
    setCurrentUser(null);
    setAuthMode('login');
    setAuthError('');
  };

  /* ─── Helpers ─── */
  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      try {
        await axios.post(`${API_BASE_URL}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } catch { alert(`Failed to upload ${file.name}. Is the backend running?`); }
    }
    await fetchUploadedFiles();
    setUploading(false);
  };

  const handleDeleteDocument = async (e, filename) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${filename}" and its vectors from Pinecone?`)) return;
    try {
      await axios.delete(`${API_BASE_URL}/documents/${encodeURIComponent(filename)}`);
      setUploadedFiles((p) => p.filter((f) => f.name !== filename));
      if (selectedDocFilter === filename) setSelectedDocFilter('');
    } catch {
      alert(`Failed to delete "${filename}".`);
    }
  };

  const handleSendMessage = async (textToSend) => {
    const query = (typeof textToSend === 'string' ? textToSend : input).trim();
    if (!query) return;
    const newMsgs = [...messages, { role: 'user', content: query }];
    setMessages(newMsgs);
    setInput('');
    setLoading(true);

    let sid = currentSessionId;
    if (!sid) {
      sid = 'session-' + Date.now();
      setCurrentSessionId(sid);
      setChatHistory((p) => [{ id: sid, title: query.slice(0, 36) + (query.length > 36 ? '…' : ''), timestamp: 'Just now', pinned: false, messages: newMsgs }, ...p]);
    } else {
      setChatHistory((p) => p.map((s) => s.id === sid ? { ...s, messages: newMsgs } : s));
    }

    try {
      const res = await axios.post(`${API_BASE_URL}/chat`, { message: query, history: messages, selected_docs: selectedDocFilter ? [selectedDocFilter] : [] });
      const updated = [...newMsgs, { role: 'assistant', content: res.data.response }];
      setMessages(updated);
      setChatHistory((p) => p.map((s) => s.id === sid ? { ...s, messages: updated } : s));
    } catch {
      setMessages([...newMsgs, { role: 'assistant', content: 'Unable to reach backend. Check FastAPI is running on http://localhost:8000.' }]);
    } finally { setLoading(false); }
  };

  const loadChatSession = (s) => { setCurrentSessionId(s.id); setMessages(s.messages || []); setAppMode('chat'); };

  const deleteChatSession = (e, sid) => {
    e.stopPropagation();
    setChatHistory((p) => p.filter((s) => s.id !== sid));
    if (currentSessionId === sid) startNewChat();
    setOpenMenuId(null);
  };

  const pinChatSession = (e, sid) => {
    e.stopPropagation();
    setChatHistory((p) => p.map((s) => s.id === sid ? { ...s, pinned: !s.pinned } : s));
    setOpenMenuId(null);
  };

  const generateFlashcards = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/flashcards`, { params: selectedDocFilter ? { source: selectedDocFilter } : {} });
      if (res.data.cards?.length) {
        setFlashcards((p) => { const all = [...p, ...res.data.cards]; return all.filter((v, i, a) => a.findIndex((t) => t.front === v.front) === i); });
        setCardIndex(0); setIsFlipped(false); setAppMode('flashcards');
      } else alert(res.data.message || 'Vector DB empty — upload a PDF first.');
    } catch { alert('Error generating flashcards. Backend running?'); }
    finally { setLoading(false); }
  };

  const saveCustomFlashcard = (front, back) => {
    if (front.trim()) setFlashcards((p) => [{ front: front.trim(), back: back.trim() }, ...p]);
  };

  const startNewChat = () => { setMessages([]); setCurrentSessionId(null); setInput(''); setAppMode('chat'); };

  const downloadConversation = () => {
    const txt = messages.map((m) => `${m.role === 'user' ? 'You' : 'StudyRAG'}: ${m.content}`).join('\n\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
    a.download = 'StudyRAG_conversation.txt'; a.click();
    setShowTopMenu(false);
  };

  const shareConversation = () => {
    const txt = messages.map((m) => `${m.role === 'user' ? 'You' : 'StudyRAG'}: ${m.content}`).join('\n\n');
    navigator.clipboard?.writeText(txt).then(() => alert('Conversation copied to clipboard!')).catch(() => alert('Copy not supported in this browser.'));
    setShowTopMenu(false);
  };

  const sortedHistory = [...chatHistory].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  /* ════════════════════════════ AUTHENTICATION SCREEN ════════════════════════════ */
  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#090b10] text-slate-100 font-sans relative overflow-hidden select-none p-4">
        {/* Glowing background nebula effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-cyan-600/20 via-blue-600/15 to-purple-600/20 rounded-full blur-[130px] pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-10 left-10 w-80 h-80 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-md p-8 rounded-2xl bg-[#10131e]/90 border border-white/10 backdrop-blur-2xl shadow-2xl shadow-black/80">
          {/* Header Brand with Glowing Orb */}
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="relative w-14 h-14 mb-3 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-cyan-500/30 blur-lg animate-pulse" />
              <div className="relative w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 p-[1.5px] shadow-lg shadow-cyan-500/20">
                <div className="w-full h-full rounded-full bg-[#0d0f18] flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-cyan-400" />
                </div>
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Study<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">RAG</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {authMode === 'signup' ? 'Create your account to start learning' : 'Welcome back! Log in to your study space'}
            </p>
          </div>

          {/* Tab Switcher: Sign Up / Log In */}
          <div className="flex rounded-xl bg-white/[0.04] p-1 mb-6 border border-white/[0.06]">
            <button
              type="button"
              onClick={() => { setAuthMode('signup'); setAuthError(''); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                authMode === 'signup'
                  ? 'bg-gradient-to-r from-cyan-500/30 to-blue-600/30 text-white shadow border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('login'); setAuthError(''); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                authMode === 'login'
                  ? 'bg-gradient-to-r from-cyan-500/30 to-blue-600/30 text-white shadow border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Log In
            </button>
          </div>

          {/* Error Banner */}
          {authError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-2">
              <span className="font-bold">⚠️</span>
              <span className="flex-1">{authError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {/* Username Input */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <div className="relative flex items-center">
                <User className="absolute left-3 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  placeholder={authMode === 'signup' ? 'Create a unique username' : 'Enter your username'}
                  className="w-full pl-9 pr-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-9 pr-10 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password (only on Sign Up) */}
            {authMode === 'signup' && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <div className="relative flex items-center">
                  <ShieldCheck className="absolute left-3 w-4 h-4 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={authConfirmPassword}
                    onChange={(e) => setAuthConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className="w-full pl-9 pr-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={authLoading}
              className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:opacity-95 text-white text-sm font-semibold rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {authLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>{authMode === 'signup' ? 'Create Account & Continue' : 'Log In to StudyRAG'}</span>
              )}
            </button>
          </form>

          {/* Toggle Footnote */}
          <div className="mt-5 text-center">
            {authMode === 'signup' ? (
              <p className="text-xs text-slate-400">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setAuthError(''); }}
                  className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors underline underline-offset-2 ml-1"
                >
                  Log In
                </button>
              </p>
            ) : (
              <p className="text-xs text-slate-400">
                Don't have an account yet?{' '}
                <button
                  type="button"
                  onClick={() => { setAuthMode('signup'); setAuthError(''); }}
                  className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors underline underline-offset-2 ml-1"
                >
                  Sign Up
                </button>
              </p>
            )}
          </div>

          {/* Supabase Connection Status Badge */}
          <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-center gap-2 text-[11px] text-slate-500">
            <span className={`w-2 h-2 rounded-full ${authStatus.supabase_connected ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-cyan-400/70'}`} />
            <span>{authStatus.supabase_connected ? 'Connected to Supabase Cloud' : 'Supabase Auth Ready (Local Secure)'}</span>
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════ MAIN APP RENDER ════════════════════════════ */
  return (
    <div className="flex h-screen bg-[#0d0f18] text-slate-100 font-sans overflow-hidden">

      {/* Ambient glow */}
      <div className="absolute top-0 left-1/3 w-[600px] h-[350px] bg-cyan-600/8 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[350px] bg-purple-700/8 blur-[150px] pointer-events-none rounded-full" />

      {/* ══════════════ SIDEBAR ══════════════ */}
      {/*
        REQUIREMENT 4: The sidebar itself is overflow-hidden; only the
        middle scrollable zone gets overflow-y-auto so the brand row
        and user profile stay fixed at top/bottom.
      */}
      <aside className="w-[260px] flex-shrink-0 bg-[#10131e] flex flex-col z-20 h-full select-none">

        {/* Brand */}
        <div className="px-5 pt-5 pb-4 flex items-center gap-3 cursor-pointer flex-shrink-0" onClick={startNewChat}>
          <div className="orb-mini flex-shrink-0" />
          <span className="font-bold text-[15px] tracking-tight text-white">StudyRAG</span>
        </div>

        {/* New Chat */}
        <div className="px-4 pb-3 flex-shrink-0">
          <button
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-slate-200 hover:text-white text-sm font-medium border border-white/[0.08] transition-all group"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
            + New Chat
          </button>
        </div>

        {/* Chat | Flash Card tabs */}
        <div className="px-4 pb-4 flex-shrink-0">
          <div className="flex rounded-xl overflow-hidden border border-white/[0.08] bg-[#0d0f18]">
            <button
              onClick={() => setAppMode('chat')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-all ${
                appMode === 'chat' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" /> Chat
            </button>
            <div className="w-px bg-white/[0.08]" />
            <button
              onClick={() => setAppMode('flashcards')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-all ${
                appMode === 'flashcards' ? 'bg-purple-500/20 text-purple-300' : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" /> Flash Card
              {flashcards.length > 0 && (
                <span className="text-[10px] px-1 py-0.5 rounded-full bg-purple-500/20 text-purple-300 leading-none">{flashcards.length}</span>
              )}
            </button>
          </div>
        </div>

        {/* ── SCROLLABLE MIDDLE SECTION (requirement 4) ── */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-2 space-y-5 scrollbar-thin">

          {/* Documents */}
          <div>
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Documents</span>
              <span className="text-[10px] text-slate-500 font-mono">{uploadedFiles.length} files</span>
            </div>

            {/* Upload zone */}
            <label className="flex items-center justify-center gap-2 p-2.5 mb-1.5 rounded-xl border border-dashed border-white/10 hover:border-cyan-500/40 bg-white/[0.015] hover:bg-cyan-500/[0.04] cursor-pointer transition-all group">
              {uploading
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" /><span className="text-xs text-slate-400">Processing…</span></>
                : <><Upload className="w-3.5 h-3.5 text-cyan-400 group-hover:-translate-y-0.5 transition-transform" /><span className="text-xs text-slate-400 group-hover:text-slate-200">Upload PDF</span></>
              }
              <input type="file" className="hidden" multiple accept=".pdf" onChange={handleFileUpload} disabled={uploading} />
            </label>
            <p className="text-[10px] text-slate-600 text-center mb-2">Vectorized automatically</p>

            {uploadedFiles.length === 0
              ? <p className="text-xs text-slate-600 italic text-center py-1">No documents yet</p>
              : (
                <div className="space-y-1">
                  {uploadedFiles.map((doc, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedDocFilter(selectedDocFilter === doc.name ? '' : doc.name)}
                      className={`group/doc flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-all border ${
                        selectedDocFilter === doc.name
                          ? 'bg-cyan-500/10 border-cyan-500/25 text-white'
                          : 'bg-white/[0.02] hover:bg-white/[0.04] border-white/[0.05] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0 pr-1">
                        <FileText className="w-3 h-3 text-cyan-400/80 flex-shrink-0" />
                        <span className="truncate" title={doc.name}>{doc.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[10px] text-slate-600">{doc.size}</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <button
                          onClick={(e) => handleDeleteDocument(e, doc.name)}
                          title="Delete from Pinecone"
                          className="opacity-0 group-hover/doc:opacity-100 hover:text-rose-400 p-0.5 rounded transition-opacity text-slate-500"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </div>

          {/* Chat History — requirement 2: label = "Chat History" not "Recents" */}
          <div>
            <div className="flex items-center gap-1.5 px-1 mb-2">
              <History className="w-3 h-3 text-slate-500" />
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Chat History</span>
            </div>

            {sortedHistory.length === 0
              ? <p className="text-xs text-slate-600 italic text-center py-1">No past conversations</p>
              : (
                <div className="space-y-0.5">
                  {sortedHistory.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => loadChatSession(session)}
                      className={`group relative flex items-center justify-between px-2 py-2 rounded-xl text-xs cursor-pointer transition-all ${
                        currentSessionId === session.id && appMode === 'chat'
                          ? 'bg-white/[0.07] text-white'
                          : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                      }`}
                    >
                      {/* Pin stripe */}
                      {session.pinned && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-cyan-400 rounded-full" />}

                      <div className="flex items-center gap-2 overflow-hidden pl-1 flex-1 min-w-0">
                        <MessageCircle className={`w-3.5 h-3.5 flex-shrink-0 ${currentSessionId === session.id ? 'text-cyan-400' : 'text-slate-500'}`} />
                        <span className="truncate">{session.title}</span>
                        {session.pinned && <Pin className="w-2.5 h-2.5 text-cyan-400 flex-shrink-0" />}
                      </div>

                      {/* 3-dot button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === session.id ? null : session.id); }}
                        className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10 text-slate-500 hover:text-white"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>

                      {/* Dropdown */}
                      {openMenuId === session.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-1 top-8 z-50 min-w-[140px] bg-[#1a1f30] border border-white/10 rounded-xl shadow-2xl py-1 text-xs overflow-hidden"
                        >
                          <button onClick={(e) => pinChatSession(e, session.id)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.07] text-slate-200 transition-colors">
                            <Pin className="w-3.5 h-3.5 text-cyan-400" />
                            {session.pinned ? 'Unpin' : 'Pin'}
                          </button>
                          <button onClick={(e) => deleteChatSession(e, session.id)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-500/10 text-red-400 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        </div>

        {/* ── User profile — dynamic name, initials, and logout ── */}
        <div className="px-4 pb-5 pt-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 via-blue-600 to-purple-600 flex items-center justify-center text-sm font-bold text-white shadow-lg uppercase">
                  {(currentUser?.name || 'U').slice(0, 2)}
                </div>
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#10131e]" />
              </div>
              {/* Name & status */}
              <div className="truncate">
                <div className="text-sm font-semibold text-white truncate">{currentUser?.name || 'User'}</div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  Online · {currentUser?.role || 'Student Plan'}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Log Out"
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ══════════════ MAIN VIEWPORT ══════════════ */}
      <main className="flex-1 flex flex-col relative z-10 overflow-hidden bg-[#0d0f18]">

        {/*
          REQUIREMENT 5: Top-right has Chat / Flash Card tabs removed from here;
          instead a 3-dot (⋮) menu offers Download PDF & Share Conversation.
          Left side keeps the document-filter pill.
        */}
        <header className="px-8 py-3.5 flex items-center justify-between flex-shrink-0 select-none">
          {/* Left: filter info */}
          <span className="text-[11px] font-mono text-slate-600">
            {selectedDocFilter ? `Filtered: ${selectedDocFilter}` : 'All Documents Active'}
          </span>

          {/* Right: Chat + Flash Card labels + 3-dot menu */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAppMode('chat')}
              className={`text-xs font-medium transition-colors ${appMode === 'chat' ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-200'}`}
            >
              Chat
            </button>
            <button
              onClick={() => setAppMode('flashcards')}
              className={`text-xs font-medium transition-colors ${appMode === 'flashcards' ? 'text-purple-400' : 'text-slate-500 hover:text-slate-200'}`}
            >
              Flash Card
            </button>

            {/* Three-dot menu */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowTopMenu((p) => !p); }}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showTopMenu && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-8 z-50 min-w-[190px] bg-[#1a1f30] border border-white/10 rounded-xl shadow-2xl py-1 text-xs overflow-hidden"
                >
                  <button
                    onClick={downloadConversation}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-white/[0.07] text-slate-200 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                    Download Conversation
                  </button>
                  <button
                    onClick={shareConversation}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-white/[0.07] text-slate-200 transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5 text-purple-400" />
                    Share Conversation
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ════ VIEW 1: CHAT ════ */}
        {appMode === 'chat' && (
          <div className="flex-1 flex flex-col overflow-hidden relative">
            {messages.length === 0 ? (
              /* Hero / empty state */
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto w-full -mt-6">
                <div className="orb-sphere mb-6" />
                <span className="text-[11px] tracking-[0.25em] font-medium uppercase text-cyan-400/80 mb-1">DOCUMENT INTELLIGENCE</span>
                <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-2">StudyRAG</h1>
                <p className="text-sm text-slate-500 mb-8 max-w-md">
                  Upload PDF study material, ask questions with instant citations, and generate smart flash cards.
                </p>

                {/* Input box — NO divider line above the action row */}
                <div className="w-full">
                  <div className="w-full bg-[#151928] border border-white/[0.08] hover:border-cyan-500/30 focus-within:border-cyan-500/40 rounded-2xl p-4 shadow-2xl transition-all">
                    <div className="flex items-start gap-3">
                      <Sparkles className="w-4 h-4 text-cyan-400 mt-1 flex-shrink-0" />
                      <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                        placeholder="Ask me anything about your PDF…"
                        rows={2}
                        className="w-full bg-transparent text-sm text-white placeholder-slate-600 resize-none focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500 hover:text-slate-200 cursor-pointer flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-colors">
                          <Upload className="w-3 h-3 text-cyan-400" /><span>Attach PDF</span>
                          <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
                        </label>
                        <button onClick={generateFlashcards} className="text-xs text-slate-500 hover:text-purple-300 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.03] hover:bg-purple-500/10 border border-white/[0.06] transition-colors">
                          <BookOpen className="w-3 h-3 text-purple-400" /><span>Generate Deck</span>
                        </button>
                      </div>
                      <button
                        onClick={() => handleSendMessage()}
                        disabled={loading || !input.trim()}
                        className="w-9 h-9 rounded-xl bg-white hover:bg-white/90 flex items-center justify-center shadow-lg transition-transform active:scale-95 disabled:opacity-25 disabled:pointer-events-none"
                      >
                        <Send className="w-4 h-4 text-black" />
                      </button>
                    </div>
                  </div>

                  {/* Suggestion chips */}
                  <div className="grid grid-cols-3 gap-3 mt-5">
                    {[
                      ['Summarize Notes', 'Summarize the main concepts in these notes.'],
                      ['Key Definitions', 'What are the key formulas or definitions mentioned?'],
                      ['Practice Quiz',   'Create a quick practice quiz with 3 multiple choice questions.'],
                    ].map(([label, prompt]) => (
                      <button
                        key={label}
                        onClick={() => handleSendMessage(prompt)}
                        className="p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] hover:border-white/[0.08] text-left transition-all group"
                      >
                        <div className="text-xs font-medium text-slate-300 group-hover:text-cyan-400 flex items-center justify-between mb-1">
                          <span>{label}</span><ChevronRight className="w-3 h-3 text-slate-600" />
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">{prompt.slice(0, 50)}…</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Active chat */
              <>
                <div className="flex-1 overflow-y-auto px-6 lg:px-24 py-6 space-y-6 max-w-5xl mx-auto w-full">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'user' ? (
                        <div className="max-w-[78%] bg-cyan-500/[0.13] text-cyan-100 rounded-2xl px-5 py-3 text-sm leading-relaxed border border-cyan-500/[0.18] backdrop-blur-md shadow-sm">
                          {msg.content}
                        </div>
                      ) : (
                        <div className="w-full text-sm leading-relaxed py-1">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="orb-mini scale-75" />
                            <span className="text-xs font-semibold text-cyan-300/80">StudyRAG</span>
                          </div>
                          <div className="whitespace-pre-wrap text-slate-200 leading-relaxed">{msg.content}</div>

                          {/* Save as flashcard */}
                          <details className="text-xs mt-4 group">
                            <summary className="cursor-pointer text-slate-600 hover:text-cyan-400 font-medium inline-flex items-center gap-1.5 transition-colors list-none">
                              <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Save as Flash Card
                            </summary>
                            <form
                              className="mt-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-2.5 max-w-md"
                              onSubmit={(e) => { e.preventDefault(); saveCustomFlashcard(e.target.front.value, msg.content); e.target.reset(); alert('Flash card saved!'); }}
                            >
                              <input name="front" placeholder="Card Question / Concept…" className="w-full bg-[#0d0f18] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" required />
                              <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">Save Card</button>
                            </form>
                          </details>
                        </div>
                      )}
                    </div>
                  ))}

                  {loading && (
                    <div className="flex justify-start w-full">
                      <div className="flex items-center gap-3 py-2 text-xs text-slate-500">
                        <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                        <span className="animate-pulse">Synthesizing answer from your documents…</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/70 animate-ping" />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Docked input — REQUIREMENT 1: no rogue white box, bg matches page */}
                <div className="px-6 lg:px-24 py-4 flex-shrink-0">
                  <div className="max-w-4xl mx-auto flex items-center gap-3 bg-[#151928] border border-white/[0.08] focus-within:border-cyan-500/30 rounded-2xl px-4 py-2.5 transition-all shadow-xl">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Ask a question about your documents…"
                      className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 focus:outline-none"
                    />
                    <button
                      onClick={() => handleSendMessage()}
                      disabled={loading || !input.trim()}
                      className="w-8 h-8 rounded-xl bg-white hover:bg-white/90 flex items-center justify-center transition-all disabled:opacity-25 disabled:pointer-events-none flex-shrink-0"
                    >
                      <Send className="w-3.5 h-3.5 text-black" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ════ VIEW 2: FLASH CARD ════ */}
        {appMode === 'flashcards' && (
          <div className="flex-1 flex flex-col overflow-hidden p-6 lg:p-12">
            <div className="flex items-center justify-between mb-8 max-w-2xl mx-auto w-full">
              <div>
                <h2 className="text-xl font-semibold text-white">Flash Card Deck</h2>
                <p className="text-xs text-slate-500 mt-1">Memorize concepts extracted from your documents.</p>
              </div>
              <button onClick={generateFlashcards} disabled={loading} className="py-2 px-4 rounded-xl bg-purple-600/25 hover:bg-purple-600/35 text-purple-200 border border-purple-500/25 text-xs font-medium transition-all flex items-center gap-2">
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Auto-Generate Cards
              </button>
            </div>

            <div className="flex-1 flex items-center justify-center">
              {flashcards.length === 0 ? (
                <div className="text-center max-w-sm">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-700" />
                  <p className="text-sm font-medium text-slate-400">Your deck is empty</p>
                  <p className="text-xs text-slate-600 mt-1">Save cards from chat or click "Auto-Generate Cards" above.</p>
                </div>
              ) : (
                <div className="w-full max-w-xl">
                  <div className="flex justify-between items-center text-xs text-slate-500 mb-4 px-1">
                    <span className="font-mono bg-white/[0.03] px-2.5 py-1 rounded-full border border-white/[0.05]">Card {cardIndex + 1} of {flashcards.length}</span>
                    <span className="text-emerald-400 font-medium flex items-center gap-1.5 bg-emerald-500/[0.08] px-2.5 py-1 rounded-full border border-emerald-500/[0.18]">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Mastered: {masteredCount}
                    </span>
                  </div>

                  <div
                    onClick={() => setIsFlipped(!isFlipped)}
                    className="min-h-[260px] p-8 rounded-3xl bg-[#13162200] bg-[#151928] border border-white/[0.08] hover:border-purple-500/25 shadow-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all relative group select-none"
                  >
                    <span className="absolute top-4 right-4 text-[11px] text-slate-600 uppercase tracking-widest font-mono">{isFlipped ? 'Answer' : 'Question'}</span>
                    <h3 className="text-lg font-normal text-slate-100 leading-relaxed max-w-md">{isFlipped ? flashcards[cardIndex].back : flashcards[cardIndex].front}</h3>
                    <span className="mt-6 text-[11px] text-slate-600 group-hover:text-purple-400 transition-colors flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" /> Click to flip
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-5">
                    <button onClick={() => { if (cardIndex > 0) { setCardIndex(cardIndex - 1); setIsFlipped(false); } }} disabled={cardIndex === 0} className="py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] text-xs text-slate-400 font-medium transition-all disabled:opacity-30 disabled:pointer-events-none">Previous</button>
                    <button onClick={() => setIsFlipped(!isFlipped)} className="py-2.5 rounded-xl bg-purple-500/[0.18] hover:bg-purple-500/25 text-purple-200 border border-purple-500/25 text-xs font-semibold transition-all flex items-center justify-center gap-1.5">
                      <RotateCcw className="w-3 h-3" /> Flip
                    </button>
                    <button onClick={() => { if (cardIndex < flashcards.length - 1) { setCardIndex(cardIndex + 1); setIsFlipped(false); } }} disabled={cardIndex === flashcards.length - 1} className="py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] text-xs text-slate-400 font-medium transition-all disabled:opacity-30 disabled:pointer-events-none">Next</button>
                  </div>

                  <button
                    onClick={() => { setMasteredCount((p) => p + 1); if (cardIndex < flashcards.length - 1) { setCardIndex(cardIndex + 1); setIsFlipped(false); } }}
                    className="w-full mt-3 py-2.5 rounded-xl bg-emerald-600/[0.18] hover:bg-emerald-600/25 text-emerald-300 border border-emerald-500/25 text-xs font-medium transition-all flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" /> I Know This Concept!
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
