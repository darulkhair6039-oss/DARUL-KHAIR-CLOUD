/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Video,
  Music,
  BookOpen,
  Users,
  GraduationCap,
  FolderTree,
  Tag,
  History,
  Settings,
  Database,
  ShieldAlert,
  Search,
  Sparkles,
  Plus,
  Trash2,
  Edit,
  Check,
  X,
  LogOut,
  RefreshCw,
  AlertCircle,
  Eye,
  Download,
  Send,
  Cpu,
  HardDrive,
  Activity,
  Clock,
  Copy,
  Lock,
  User as UserIcon,
  Save,
  Archive,
  CheckCircle2,
  Menu,
  ChevronRight,
  Filter,
  FileSpreadsheet
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  User,
  UserRole,
  Scholar,
  Category,
  Series,
  MediaItem,
  MediaStatus,
  SystemSettings,
  ActivityLog,
  BackupItem,
  SystemHealth
} from "./types.js";

export default function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [loginPassword, setLoginPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Layout & Navigation
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Core Data State (Synced from Server)
  const [users, setUsers] = useState<User[]>([]);
  const [scholars, setScholars] = useState<Scholar[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dataError, setDataError] = useState("");

  // Search, Filters & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterScholar, setFilterScholar] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Selection states for Modals / Editing
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [editingMedia, setEditingMedia] = useState<Partial<MediaItem> | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);

  const [isScholarModalOpen, setIsScholarModalOpen] = useState(false);
  const [editingScholar, setEditingScholar] = useState<Partial<Scholar> | null>(null);

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);

  const [isSeriesModalOpen, setIsSeriesModalOpen] = useState(false);
  const [editingSeries, setEditingSeries] = useState<Partial<Series> | null>(null);

  // Developer Hub States
  const [snippetTab, setSnippetTab] = useState<"curl" | "js" | "node">("curl");
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);

  // Notifications State
  const [notifications, setNotifications] = useState<{ id: string; text: string; type: "success" | "info" | "warning" }[]>([]);

  // AI Assistant Chat State
  const [assistantMessages, setAssistantMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: "As-salamu alaykum! I am your Darul Khair Cloud Assistant. Ask me to outline topics, suggest tags, compile descriptions, or organize your lecture catalog." }
  ]);
  const [assistantInput, setAssistantInput] = useState("");
  const [isAssistantTyping, setIsAssistantTyping] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Load state on mount / login
  useEffect(() => {
    // Check localStorage for active session
    const savedToken = localStorage.getItem("dk_auth_token");
    const savedUser = localStorage.getItem("dk_user");
    if (savedToken && savedUser) {
      setAuthToken(savedToken);
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  useEffect(() => {
    if (authToken) {
      fetchDatabase();
      fetchHealth();
      fetchBackups();
      // Periodically poll health metrics
      const interval = setInterval(() => {
        fetchHealth();
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [authToken]);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [assistantMessages, isAssistantTyping, isAssistantOpen]);

  // Helper notification trigger
  const showToast = (text: string, type: "success" | "info" | "warning" = "success") => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  // --- API CALLS ---

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setAuthError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: loginPassword })
      });
      const data = await response.json();
      if (data.success) {
        setAuthToken(data.token);
        setCurrentUser(data.user);
        localStorage.setItem("dk_auth_token", data.token);
        localStorage.setItem("dk_user", JSON.stringify(data.user));
        showToast(`Welcome back, ${data.user.name}!`, "success");
      } else {
        setAuthError(data.message || "Failed to log in.");
      }
    } catch (err) {
      setAuthError("Could not connect to full-stack backend. Please retry.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("dk_auth_token");
    localStorage.removeItem("dk_user");
    setAuthToken(null);
    setCurrentUser(null);
    showToast("Logged out successfully.", "info");
  };

  const fetchDatabase = async () => {
    try {
      const headers: Record<string, string> = {};
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      const response = await fetch("/api/db", { headers });
      if (!response.ok) throw new Error("Backend response error");
      const data = await response.json();
      setUsers(data.users || []);
      setScholars(data.scholars || []);
      setCategories(data.categories || []);
      setSeriesList(data.series || []);
      setMediaItems(data.mediaItems || []);
      setSettings(data.settings || null);
      setLogs(data.logs || []);
      setIsLoading(false);
    } catch (err) {
      setDataError("Failed to fetch administrative records.");
      setIsLoading(false);
    }
  };

  const fetchHealth = async () => {
    try {
      const headers: Record<string, string> = {};
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      const response = await fetch("/api/health", { headers });
      if (response.ok) {
        const data = await response.json();
        setHealth(data);
      }
    } catch (err) {}
  };

  const fetchBackups = async () => {
    try {
      const headers: Record<string, string> = {};
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      const response = await fetch("/api/backups", { headers });
      if (response.ok) {
        const data = await response.json();
        setBackups(data);
      }
    } catch (err) {}
  };

  const triggerBackup = async () => {
    try {
      const headers: Record<string, string> = {};
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      const response = await fetch("/api/backups", { method: "POST", headers });
      if (response.ok) {
        showToast("Database backup snapshotted successfully.", "success");
        fetchBackups();
        fetchDatabase(); // reload logs
      } else {
        showToast("Could not initiate backup.", "warning");
      }
    } catch (err) {
      showToast("Backup error.", "warning");
    }
  };

  const triggerRestore = async (backupId: string) => {
    if (!confirm("Are you sure you want to restore the database to this point? Current un-backupped changes will be lost.")) {
      return;
    }
    try {
      const headers: Record<string, string> = {};
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      const response = await fetch(`/api/backups/${backupId}/restore`, { method: "POST", headers });
      if (response.ok) {
        showToast("Database restore successful. Refreshing catalog.", "success");
        fetchDatabase();
        fetchBackups();
      } else {
        showToast("Failed to restore state.", "warning");
      }
    } catch (err) {
      showToast("Restore failed.", "warning");
    }
  };

  // Generic Create / Update / Delete helper
  const submitEntity = async (endpoint: string, method: "POST" | "PUT" | "DELETE", body: any, successMsg: string) => {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      const response = await fetch(endpoint, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
      if (response.ok) {
        showToast(successMsg, "success");
        fetchDatabase();
        return true;
      } else {
        const errData = await response.json();
        showToast(errData.message || "Operation failed", "warning");
        return false;
      }
    } catch (err) {
      showToast("Network operation failed.", "warning");
      return false;
    }
  };

  // --- GEMINI AI INTEGRATIONS ---

  const enrichMediaWithAI = async () => {
    if (!editingMedia?.title) {
      showToast("Please provide a Title first to allow AI enrichment.", "warning");
      return;
    }
    setIsEnriching(true);
    try {
      const catName = categories.find(c => c.id === editingMedia.categoryId)?.name || "";
      const scholarName = scholars.find(s => s.id === editingMedia.scholarId)?.name || "";
      
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      const response = await fetch("/api/gemini/enrich", {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: editingMedia.title,
          type: editingMedia.type || "video",
          categoryName: catName,
          scholarName: scholarName
        })
      });
      const data = await response.json();
      
      setEditingMedia(prev => ({
        ...prev,
        description: data.description || prev?.description,
        tags: data.tags || prev?.tags || []
      }));
      
      showToast("AI details auto-enriched successfully!", "success");
    } catch (err) {
      showToast("AI enrichment error. Offline baseline used.", "info");
    } finally {
      setIsEnriching(false);
    }
  };

  const handleAssistantSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assistantInput.trim()) return;

    const userMsg = assistantInput;
    setAssistantInput("");
    setAssistantMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsAssistantTyping(true);

    try {
      const conversation = [...assistantMessages, { role: "user", content: userMsg }].slice(-10); // last 10 messages for context
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      const response = await fetch("/api/gemini/assistant", {
        method: "POST",
        headers,
        body: JSON.stringify({ messages: conversation })
      });
      const data = await response.json();
      setAssistantMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setAssistantMessages(prev => [...prev, { role: "assistant", content: "I encountered a transmission error. Please ensure your API keys and connection are healthy." }]);
    } finally {
      setIsAssistantTyping(false);
    }
  };

  // --- RENDERING HELPERS & LOGICS ---

  // Filters calculation
  const filteredMedia = mediaItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = filterType === "all" ? true : item.type === filterType;
    const matchesScholar = filterScholar === "all" ? true : item.scholarId === filterScholar;
    const matchesCategory = filterCategory === "all" ? true : item.categoryId === filterCategory;
    const matchesStatus = filterStatus === "all" ? true : item.status === filterStatus;

    return matchesSearch && matchesType && matchesScholar && matchesCategory && matchesStatus;
  });

  const getScholarName = (id: string) => scholars.find(s => s.id === id)?.name || "Unknown Scholar";
  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || "Uncategorized";
  const getSeriesName = (id: string) => seriesList.find(s => s.id === id)?.name || "None";

  // Counts
  const videoCount = mediaItems.filter(m => m.type === "video").length;
  const audioCount = mediaItems.filter(m => m.type === "audio").length;
  const bookCount = mediaItems.filter(m => m.type === "book").length;

  if (!authToken) {
    // --- LOGIN SCREEN ---
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans select-none relative overflow-hidden" id="auth_container">
        {/* Aesthetic Islamic patterns / circles background */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-emerald-50 rounded-full mix-blend-multiply filter blur-3xl opacity-70"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-teal-50 rounded-full mix-blend-multiply filter blur-3xl opacity-70"></div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white border border-emerald-100/80 rounded-2xl shadow-xl overflow-hidden z-10"
        >
          <div className="bg-gradient-to-br from-emerald-800 to-emerald-950 p-8 text-center text-white relative">
            <div className="mx-auto w-16 h-16 bg-white/10 rounded-full flex items-center justify-center border border-white/20 mb-3 backdrop-blur-sm">
              <Database className="w-8 h-8 text-emerald-300" />
            </div>
            <h1 className="font-display font-semibold text-2xl tracking-tight">DARUL KHAIR</h1>
            <p className="text-emerald-200/80 text-xs mt-1 font-mono tracking-widest uppercase">Cloud Management Platform</p>
          </div>

          <form onSubmit={handleLogin} className="p-8 space-y-6">
            {authError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <div className="space-y-1.5 relative">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider" htmlFor="password">Security Access Key</label>
                <span className="text-[10px] text-emerald-600 font-mono font-medium">Required for Access</span>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type="password"
                  required
                  placeholder="Enter access key"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg pl-10 pr-3 py-2.5 text-sm bg-slate-50 hover:bg-slate-100/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isAuthenticating}
              id="login_btn"
              className="w-full py-3 bg-emerald-800 text-white font-medium rounded-lg text-sm hover:bg-emerald-900 shadow-lg shadow-emerald-800/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {isAuthenticating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Authenticate Cloud Credentials</span>
                </>
              )}
            </button>

            <div className="border-t border-slate-100 pt-4 text-center">
              <p className="text-[11px] text-slate-500 leading-relaxed font-mono">
                DARUL KHAIR MEDIA AND CHARITY FOUNDATION
                <br />
                <span className="text-emerald-700 font-sans font-medium">Secured Cloud Environment</span>
              </p>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  // --- MAIN ADMIN SYSTEM WORKSPACE ---
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col md:flex-row relative">
      
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full">
        <AnimatePresence>
          {notifications.map(n => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 50, y: -10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className={`p-4 rounded-xl shadow-lg border text-xs font-medium pointer-events-auto flex items-center gap-3 ${
                n.type === "success"
                  ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                  : n.type === "warning"
                  ? "bg-amber-50 border-amber-100 text-amber-800"
                  : "bg-blue-50 border-blue-100 text-blue-800"
              }`}
            >
              {n.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>{n.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* --- SIDEBAR --- */}
      <aside className={`${sidebarOpen ? "w-64" : "w-16"} shrink-0 bg-[#1B3022] text-white flex flex-col transition-all duration-300 relative border-r border-white/10 z-30 shadow-xl`}>
        {/* Brand Banner */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 bg-emerald-500 border border-emerald-400 rounded-lg flex items-center justify-center shrink-0 shadow-md">
              <Database className="w-4 h-4 text-white" />
            </div>
            {sidebarOpen && (
              <div className="leading-none">
                <span className="font-display font-bold text-sm tracking-wide text-white">DARUL KHAIR</span>
                <span className="block text-[9px] text-emerald-400 font-mono tracking-widest mt-0.5 font-semibold">CLOUD PLATFORM</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-white/70 hover:text-white p-1 rounded hover:bg-white/5"
            title="Toggle Sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        {/* Current Active User Profile Banner */}
        {sidebarOpen && currentUser && (
          <div className="p-4 bg-white/5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-semibold text-white border border-emerald-400 font-display">
                {currentUser.name.charAt(0)}
              </div>
              <div>
                <span className="block text-xs font-semibold text-white leading-tight">{currentUser.name}</span>
                <span className="inline-block mt-1 px-1.5 py-0.5 bg-emerald-600/30 text-[9px] font-bold text-emerald-400 rounded font-mono uppercase tracking-wide border border-emerald-500/20">
                  {currentUser.role.replace("_", " ")}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Menus */}
        <nav className="p-3 flex-1 space-y-1 overflow-y-auto">
          {[
            { id: "dashboard", label: "Overview Dashboard", icon: LayoutDashboard },
            { id: "media", label: "Media Library", icon: Video },
            { id: "scholars", label: "Scholars Manager", icon: GraduationCap },
            { id: "catalogs", label: "Categories & Series", icon: FolderTree },
            ...(currentUser?.role === UserRole.CHIEF_ADMIN
              ? [
                  { id: "users", label: "User Accounts", icon: Users },
                  { id: "backups", label: "Backup & Recovery", icon: Database }
                ]
              : []),
            { id: "settings", label: "API & System Settings", icon: Settings }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === item.id
                  ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 shadow-sm"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Assistant toggle */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={() => setIsAssistantOpen(true)}
            className="w-full flex items-center justify-center gap-2 bg-[#1B3022] hover:bg-[#2D4A36] text-white py-2.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider border border-white/10 shadow transition-all active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
            {sidebarOpen && <span>AI Assistant</span>}
          </button>
        </div>

        {/* Logout Footer */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-white/50 hover:text-red-300 hover:bg-white/5 transition-all"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {sidebarOpen && <span>Log Out Session</span>}
          </button>
        </div>
      </aside>

      {/* --- MAIN PAGE VIEW CONTENT --- */}
      <main className="flex-1 overflow-y-auto flex flex-col relative min-h-screen">
        
        {/* Top Header */}
        <header className="bg-white border-b border-slate-100 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 z-20 shrink-0">
          <div>
            <h2 className="font-display font-semibold text-lg text-slate-900 tracking-tight flex items-center gap-2">
              <span>{activeTab.toUpperCase().replace("_", " ")}</span>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 font-mono px-2 py-0.5 rounded-full uppercase tracking-wider">
                Active Zone
              </span>
            </h2>
            <p className="text-slate-500 text-xs mt-0.5">DARUL KHAIR MEDIA AND CHARITY FOUNDATION • Secure Administration Console</p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Quick Live Clock */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 text-xs text-slate-500 font-mono">
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              <span>2026-06-29</span>
            </div>

            {/* Connection Indicator */}
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5 text-xs text-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
              <span className="font-medium font-mono">DK_CLOUD_LIVE</span>
            </div>
          </div>
        </header>

        {/* Content Box */}
        <div className="flex-1 p-6 space-y-6">
          {isLoading ? (
            <div className="h-96 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-emerald-700 animate-spin" />
              <p className="text-sm font-medium text-slate-500 font-mono">Fetching full cloud repository...</p>
            </div>
          ) : (
            <>
              {/* --- 1. OVERVIEW DASHBOARD TAB --- */}
              {activeTab === "dashboard" && (
                <div className="space-y-6">
                  {/* Top Analytics Metrics */}
                  <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                    {[
                      { label: "Total Videos", val: videoCount, icon: Video, color: "text-blue-600 bg-blue-50 border-blue-100" },
                      { label: "Audio Lectures", val: audioCount, icon: Music, color: "text-purple-600 bg-purple-50 border-purple-100" },
                      { label: "Islamic Books", val: bookCount, icon: BookOpen, color: "text-amber-600 bg-amber-50 border-amber-100" },
                      { label: "Active Scholars", val: scholars.length, icon: GraduationCap, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
                      { label: "Categories", val: categories.length, icon: FolderTree, color: "text-teal-600 bg-teal-50 border-teal-100" },
                      { label: "Media Indexing", val: `${mediaItems.length} items`, icon: Database, color: "text-pink-600 bg-pink-50 border-pink-100" }
                    ].map((stat, i) => (
                      <div key={i} className="bg-white border border-slate-100 p-4 rounded-xl flex items-center justify-between shadow-sm hover:shadow transition-shadow">
                        <div className="space-y-1">
                          <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</span>
                          <span className="block font-display font-bold text-lg text-slate-900 leading-none">{stat.val}</span>
                        </div>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${stat.color}`}>
                          <stat.icon className="w-5 h-5" />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Dynamic System Health & Interactive Spark Metrics */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Live System Health Panel */}
                    <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h3 className="font-display font-semibold text-sm text-slate-800 flex items-center gap-2">
                          <Activity className="w-4 h-4 text-emerald-600" />
                          <span>Real-Time System Health</span>
                        </h3>
                        <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-100 rounded px-1.5 font-mono">STATUS: ONLINE</span>
                      </div>

                      {health ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 space-y-1">
                              <span className="text-[10px] text-slate-500 font-mono uppercase">CPU CORE LOAD</span>
                              <div className="flex items-baseline gap-1">
                                <span className="font-display font-bold text-xl text-slate-900">{health.cpuUsage}%</span>
                                <span className="text-[10px] text-emerald-600 font-mono">√ Optimal</span>
                              </div>
                            </div>
                            <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 space-y-1">
                              <span className="text-[10px] text-slate-500 font-mono uppercase">VIRTUAL RAM USED</span>
                              <div className="flex items-baseline gap-1">
                                <span className="font-display font-bold text-xl text-slate-900">{health.memoryUsage} MB</span>
                                <span className="text-[10px] text-emerald-600 font-mono">/ 512MB limit</span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between text-xs font-mono">
                              <span className="text-slate-500">DATABASE STORAGE SIZE</span>
                              <span className="font-semibold text-slate-900">{health.databaseSize}</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div className="bg-emerald-600 h-full rounded-full" style={{ width: "12%" }}></div>
                            </div>
                            <p className="text-[10px] text-slate-400 font-mono">Database backups snapshotted: {backups.length} snapshots total</p>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-xs font-mono pt-2 border-t border-slate-100">
                            <div>
                              <span className="text-slate-500 block">API LATENCY</span>
                              <span className="text-emerald-700 font-semibold">{health.apiLatency}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">SYSTEM UPTIME</span>
                              <span className="text-slate-900 font-semibold">{health.uptime}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 font-mono">Retrieving metrics stream...</p>
                      )}
                    </div>

                    {/* Quick Media Upload Hub */}
                    <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <h3 className="font-display font-semibold text-sm text-slate-800 flex items-center gap-2">
                            <Plus className="w-4 h-4 text-emerald-600" />
                            <span>Quick Upload Entry</span>
                          </h3>
                        </div>
                        <p className="text-slate-500 text-xs leading-relaxed">
                          Launch the unified media wizard to publish catalog resources (Video link, Audio sermon MP3, or Book PDF) under categories and scholar portfolios instantly.
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-4">
                        <button
                          onClick={() => { setEditingMedia({ type: "video" }); setIsMediaModalOpen(true); }}
                          className="flex flex-col items-center justify-center p-3 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg text-blue-800 gap-1.5 transition-colors"
                        >
                          <Video className="w-4 h-4" />
                          <span className="text-[10px] font-semibold font-mono">ADD VIDEO</span>
                        </button>
                        <button
                          onClick={() => { setEditingMedia({ type: "audio" }); setIsMediaModalOpen(true); }}
                          className="flex flex-col items-center justify-center p-3 bg-purple-50 hover:bg-purple-100 border border-purple-100 rounded-lg text-purple-800 gap-1.5 transition-colors"
                        >
                          <Music className="w-4 h-4" />
                          <span className="text-[10px] font-semibold font-mono">ADD AUDIO</span>
                        </button>
                        <button
                          onClick={() => { setEditingMedia({ type: "book" }); setIsMediaModalOpen(true); }}
                          className="flex flex-col items-center justify-center p-3 bg-amber-50 hover:bg-amber-100 border border-amber-100 rounded-lg text-amber-800 gap-1.5 transition-colors"
                        >
                          <BookOpen className="w-4 h-4" />
                          <span className="text-[10px] font-semibold font-mono">ADD BOOK</span>
                        </button>
                      </div>
                    </div>

                    {/* Backup Status Panel */}
                    <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <h3 className="font-display font-semibold text-sm text-slate-800 flex items-center gap-2">
                            <Database className="w-4 h-4 text-emerald-600" />
                            <span>Backup & Disaster Recovery</span>
                          </h3>
                        </div>
                        <p className="text-slate-500 text-xs leading-relaxed">
                          Secure database backups with automatic tracking. Restores database schemas, scholars profiles, catalogs, and media indexes instantaneously.
                        </p>
                        <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg text-xs font-mono text-slate-600 flex items-center justify-between">
                          <span>Latest Backup Snapshot:</span>
                          <span className="font-semibold text-emerald-800">{backups[0]?.filename || "None"}</span>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={triggerBackup}
                          className="flex-1 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-medium font-mono flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>BACKUP SNAPSHOT NOW</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Recent Media catalog entries table */}
                  <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="font-display font-semibold text-sm text-slate-800 flex items-center gap-2">
                        <Video className="w-4 h-4 text-emerald-600" />
                        <span>Recently Uploaded Media Index</span>
                      </h3>
                      <button
                        onClick={() => setActiveTab("media")}
                        className="text-emerald-700 hover:text-emerald-800 text-xs font-semibold flex items-center gap-1"
                      >
                        <span>View Media Catalog</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 font-mono uppercase tracking-wider border-b border-slate-100">
                            <th className="p-4">Title / Topic</th>
                            <th className="p-4">Media Type</th>
                            <th className="p-4">Scholar</th>
                            <th className="p-4">Category</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Date Uploaded</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-sans">
                          {mediaItems.slice(0, 5).map(item => (
                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-4">
                                <div className="font-semibold text-slate-900">{item.title}</div>
                                <div className="text-[10px] text-slate-500 mt-0.5 max-w-xs truncate">{item.description}</div>
                              </td>
                              <td className="p-4">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono ${
                                  item.type === "video" ? "bg-blue-50 text-blue-700 border border-blue-100" :
                                  item.type === "audio" ? "bg-purple-50 text-purple-700 border border-purple-100" :
                                  "bg-amber-50 text-amber-700 border border-amber-100"
                                }`}>
                                  {item.type}
                                </span>
                              </td>
                              <td className="p-4 text-slate-700 font-medium">{getScholarName(item.scholarId)}</td>
                              <td className="p-4 text-slate-500">{getCategoryName(item.categoryId)}</td>
                              <td className="p-4">
                                <span className={`inline-block px-2 py-0.5 rounded font-mono text-[9px] font-bold ${
                                  item.status === MediaStatus.PUBLISHED ? "bg-emerald-50 text-emerald-700" :
                                  item.status === MediaStatus.ARCHIVED ? "bg-slate-100 text-slate-600" :
                                  "bg-amber-50 text-amber-700"
                                }`}>
                                  {item.status}
                                </span>
                              </td>
                              <td className="p-4 text-slate-500 font-mono">{new Date(item.createdAt).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Audit Timeline / Action Logs */}
                  <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="font-display font-semibold text-sm text-slate-800 flex items-center gap-2">
                        <History className="w-4 h-4 text-emerald-600" />
                        <span>Security & Audit Trails (System Timeline)</span>
                      </h3>
                      <span className="text-[10px] text-slate-500 font-mono">Tracks all administrative state mutations</span>
                    </div>

                    <div className="p-5 space-y-4 max-h-80 overflow-y-auto">
                      {logs.map((log, i) => (
                        <div key={log.id} className="flex gap-4 items-start border-l-2 border-emerald-100 pl-4 relative ml-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 absolute left-[-6px] top-1.5 ring-4 ring-emerald-50 shrink-0"></div>
                          <div className="flex-1 space-y-1">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[11px]">
                              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                <span>{log.action}</span>
                                <span className="px-1 bg-slate-100 text-slate-600 text-[9px] font-mono rounded">BY: {log.username}</span>
                              </div>
                              <span className="text-slate-400 font-mono">{new Date(log.timestamp).toLocaleString()}</span>
                            </div>
                            <p className="text-slate-600 text-xs">{log.details}</p>
                            <span className="text-[10px] text-slate-400 font-mono">Logged IP placeholder: {log.ipAddress}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* --- 2. MEDIA LIBRARY CATALOG TAB --- */}
              {activeTab === "media" && (
                <div className="space-y-6">
                  {/* Search, filters, controls */}
                  <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row gap-3">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder="Search keyword or search tag in repository..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs bg-slate-50 focus:bg-white focus:border-emerald-600 transition-colors"
                        />
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {/* Type filter */}
                        <div className="flex items-center gap-1 border border-slate-200 bg-slate-50 rounded-lg px-2 text-xs">
                          <Filter className="w-3.5 h-3.5 text-slate-500" />
                          <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="bg-transparent py-1.5 text-xs font-semibold cursor-pointer text-slate-700"
                          >
                            <option value="all">All Formats</option>
                            <option value="video">Videos</option>
                            <option value="audio">Audios</option>
                            <option value="book">Books</option>
                          </select>
                        </div>

                        {/* Scholar filter */}
                        <div className="flex items-center gap-1 border border-slate-200 bg-slate-50 rounded-lg px-2 text-xs">
                          <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
                          <select
                            value={filterScholar}
                            onChange={(e) => setFilterScholar(e.target.value)}
                            className="bg-transparent py-1.5 text-xs font-semibold cursor-pointer text-slate-700 max-w-[150px]"
                          >
                            <option value="all">All Scholars</option>
                            {scholars.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Category filter */}
                        <div className="flex items-center gap-1 border border-slate-200 bg-slate-50 rounded-lg px-2 text-xs">
                          <FolderTree className="w-3.5 h-3.5 text-slate-500" />
                          <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="bg-transparent py-1.5 text-xs font-semibold cursor-pointer text-slate-700 max-w-[150px]"
                          >
                            <option value="all">All Categories</option>
                            {categories.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Status filter */}
                        <div className="flex items-center gap-1 border border-slate-200 bg-slate-50 rounded-lg px-2 text-xs">
                          <Settings className="w-3.5 h-3.5 text-slate-500" />
                          <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="bg-transparent py-1.5 text-xs font-semibold cursor-pointer text-slate-700"
                          >
                            <option value="all">All Status</option>
                            <option value="PUBLISHED">Published</option>
                            <option value="ARCHIVED">Archived</option>
                            <option value="DRAFT">Draft</option>
                          </select>
                        </div>

                        <button
                          onClick={() => {
                            setEditingMedia({
                              type: "video",
                              status: MediaStatus.PUBLISHED,
                              categoryId: categories[0]?.id || "",
                              scholarId: scholars[0]?.id || "",
                              year: "2026",
                              tags: []
                            });
                            setIsMediaModalOpen(true);
                          }}
                          className="bg-emerald-800 hover:bg-emerald-900 text-white py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add Media Asset</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Main Catalog Tables */}
                  <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 font-mono uppercase tracking-wider border-b border-slate-100">
                            <th className="p-4">Cover / ID</th>
                            <th className="p-4">Title / Description</th>
                            <th className="p-4">Format</th>
                            <th className="p-4">Scholar Portfolio</th>
                            <th className="p-4">Cat / Series</th>
                            <th className="p-4">Year</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredMedia.length > 0 ? (
                            filteredMedia.map(item => (
                              <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-4">
                                  <div className="relative w-14 h-10 rounded overflow-hidden border border-slate-200">
                                    <img src={item.coverUrl} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                                    <div className="absolute bottom-0 right-0 bg-black/60 text-white font-mono text-[8px] px-0.5 rounded">
                                      {item.type.toUpperCase()}
                                    </div>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <div className="font-semibold text-slate-900">{item.title}</div>
                                  <p className="text-[11px] text-slate-500 mt-0.5 max-w-xs">{item.description}</p>
                                  <div className="flex gap-1 mt-1.5 flex-wrap">
                                    {item.tags.map((t, i) => (
                                      <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-[9px] text-slate-600 rounded font-mono border border-slate-200">
                                        #{t}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="p-4">
                                  <span className="font-mono text-slate-500 font-bold uppercase">{item.type}</span>
                                  {item.fileSize && <span className="block text-[9px] text-slate-400 font-mono mt-0.5">{item.fileSize}</span>}
                                  {item.duration && <span className="block text-[9px] text-slate-400 font-mono">{item.duration}</span>}
                                </td>
                                <td className="p-4 font-semibold text-slate-700">{getScholarName(item.scholarId)}</td>
                                <td className="p-4">
                                  <span className="block text-slate-600 font-medium">{getCategoryName(item.categoryId)}</span>
                                  <span className="block text-[9px] text-slate-400 font-mono mt-0.5">SERIES: {getSeriesName(item.seriesId || "")}</span>
                                </td>
                                <td className="p-4 text-slate-500 font-mono">{item.year}</td>
                                <td className="p-4">
                                  <select
                                    value={item.status}
                                    onChange={(e) => submitEntity(`/api/media/${item.id}`, "PUT", { status: e.target.value as MediaStatus }, `Status updated for: ${item.title}`)}
                                    className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-mono cursor-pointer"
                                  >
                                    <option value="PUBLISHED">Published</option>
                                    <option value="ARCHIVED">Archived</option>
                                    <option value="DRAFT">Draft</option>
                                  </select>
                                </td>
                                <td className="p-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => { setEditingMedia(item); setIsMediaModalOpen(true); }}
                                      className="p-1 hover:bg-slate-100 text-slate-600 rounded"
                                      title="Edit Details"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (confirm(`Remove and delete permanent index for: ${item.title}?`)) {
                                          submitEntity(`/api/media/${item.id}`, "DELETE", null, `Purged media item: ${item.title}`);
                                        }
                                      }}
                                      className="p-1 hover:bg-red-50 text-red-600 rounded"
                                      title="Delete Media"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={8} className="p-8 text-center text-slate-400 font-mono">No matching media records cataloged.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* --- 3. SCHOLARS TAB --- */}
              {activeTab === "scholars" && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-white border border-slate-100 p-4 rounded-xl shadow-sm">
                    <p className="text-slate-500 text-xs">Scholars, Imams, and Guest Lecturers delivering content across the platform.</p>
                    <button
                      onClick={() => { setEditingScholar({ name: "", bio: "", photoUrl: "", language: "English" }); setIsScholarModalOpen(true); }}
                      className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold py-1.5 px-3 rounded-lg flex items-center gap-1 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Register Scholar</span>
                    </button>
                  </div>

                  {/* Scholar Grid Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {scholars.map(scholar => {
                      const count = mediaItems.filter(m => m.scholarId === scholar.id).length;
                      return (
                        <div key={scholar.id} className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between hover:shadow transition-shadow">
                          <div className="space-y-3">
                            <div className="flex gap-4 items-center">
                              <img src={scholar.photoUrl} className="w-14 h-14 rounded-full border border-slate-200 object-cover" alt="" referrerPolicy="no-referrer" />
                              <div>
                                <h3 className="font-display font-semibold text-sm text-slate-900 leading-tight">{scholar.name}</h3>
                                <span className="text-[10px] text-slate-400 font-mono uppercase">LANGUAGES: {scholar.language}</span>
                              </div>
                            </div>
                            <p className="text-slate-600 text-xs leading-relaxed line-clamp-3">{scholar.bio}</p>
                          </div>

                          <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                            <div className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-semibold font-mono">
                              {count} catalog items
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => { setEditingScholar(scholar); setIsScholarModalOpen(true); }}
                                className="p-1 hover:bg-slate-100 text-slate-600 rounded text-xs flex items-center gap-1 font-medium"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Unregister scholar: ${scholar.name}? This will orphan catalog media associated with them.`)) {
                                    submitEntity(`/api/scholars/${scholar.id}`, "DELETE", null, `Purged scholar: ${scholar.name}`);
                                  }
                                }}
                                className="p-1 hover:bg-red-50 text-red-600 rounded text-xs flex items-center gap-1 font-medium"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remove</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* --- 4. CATEGORIES & SERIES TAB --- */}
              {activeTab === "catalogs" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column: Categories */}
                  <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h3 className="font-display font-semibold text-sm text-slate-800">Media Categories</h3>
                      <button
                        onClick={() => { setEditingCategory({ name: "", description: "" }); setIsCategoryModalOpen(true); }}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-1 rounded"
                      >
                        + Create Category
                      </button>
                    </div>

                    <div className="space-y-3">
                      {categories.map(cat => {
                        const count = mediaItems.filter(m => m.categoryId === cat.id).length;
                        return (
                          <div key={cat.id} className="bg-slate-50 border border-slate-100 p-3.5 rounded-lg flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold text-xs text-slate-900 flex items-center gap-2">
                                <span>{cat.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">/{cat.slug}</span>
                              </h4>
                              <p className="text-[11px] text-slate-500 mt-1 max-w-xs">{cat.description}</p>
                              <span className="inline-block mt-1.5 text-[9px] font-bold text-emerald-800 font-mono uppercase bg-emerald-50 px-1 rounded">
                                {count} Items indexed
                              </span>
                            </div>

                            <div className="flex gap-1 shrink-0">
                              <button onClick={() => { setEditingCategory(cat); setIsCategoryModalOpen(true); }} className="p-1 hover:bg-slate-200 text-slate-600 rounded"><Edit className="w-3.5 h-3.5" /></button>
                              <button onClick={() => { if (confirm(`Delete category: ${cat.name}?`)) submitEntity(`/api/categories/${cat.id}`, "DELETE", null, "Purged category"); }} className="p-1 hover:bg-red-100 text-red-600 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Column: Lecture Series */}
                  <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h3 className="font-display font-semibold text-sm text-slate-800">Lecture Series</h3>
                      <button
                        onClick={() => { setEditingSeries({ name: "", description: "", scholarId: scholars[0]?.id || "", categoryId: categories[0]?.id || "" }); setIsSeriesModalOpen(true); }}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-1 rounded"
                      >
                        + Create Series
                      </button>
                    </div>

                    <div className="space-y-3">
                      {seriesList.map(series => {
                        const count = mediaItems.filter(m => m.seriesId === series.id).length;
                        return (
                          <div key={series.id} className="bg-slate-50 border border-slate-100 p-3.5 rounded-lg flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold text-xs text-slate-900">{series.name}</h4>
                              <p className="text-[11px] text-slate-500 mt-0.5">{series.description}</p>
                              <div className="flex gap-1.5 items-center mt-2 text-[10px] text-slate-500">
                                <span className="font-semibold text-slate-700">Imam: {getScholarName(series.scholarId)}</span>
                                <span>•</span>
                                <span>Category: {getCategoryName(series.categoryId)}</span>
                              </div>
                              <span className="inline-block mt-2 text-[9px] font-bold text-emerald-800 font-mono uppercase bg-emerald-50 px-1 rounded">
                                {count} Lectures indexed
                              </span>
                            </div>

                            <div className="flex gap-1 shrink-0">
                              <button onClick={() => { setEditingSeries(series); setIsSeriesModalOpen(true); }} className="p-1 hover:bg-slate-200 text-slate-600 rounded"><Edit className="w-3.5 h-3.5" /></button>
                              <button onClick={() => { if (confirm(`Delete lecture series: ${series.name}?`)) submitEntity(`/api/series/${series.id}`, "DELETE", null, "Purged lecture series"); }} className="p-1 hover:bg-red-100 text-red-600 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* --- 5. USER ACCOUNTS TAB --- */}
              {activeTab === "users" && currentUser?.role === UserRole.CHIEF_ADMIN && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-white border border-slate-100 p-4 rounded-xl shadow-sm">
                    <p className="text-slate-500 text-xs">Manage administrative staff and sub-admins with access credentials.</p>
                    <button
                      onClick={() => { setEditingUser({ name: "", username: "", email: "", role: UserRole.MEDIA_ADMIN }); setIsUserModalOpen(true); }}
                      className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold py-1.5 px-3 rounded-lg flex items-center gap-1 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create Staff Member</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {users.map(user => (
                      <div key={user.id} className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold font-display">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-semibold text-xs text-slate-950 flex items-center gap-1.5">
                              <span>{user.name}</span>
                              {!user.isActive && <span className="bg-red-100 text-red-700 px-1 text-[9px] rounded font-mono">SUSPENDED</span>}
                            </h3>
                            <span className="block text-[10px] font-mono text-slate-400">@{user.username} • {user.email}</span>
                          </div>
                        </div>

                        <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider ${
                            user.role === UserRole.CHIEF_ADMIN ? "bg-emerald-50 text-emerald-800 border border-emerald-100" : "bg-blue-50 text-blue-800 border border-blue-100"
                          }`}>
                            {user.role}
                          </span>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => { setEditingUser(user); setIsUserModalOpen(true); }}
                              className="text-slate-500 hover:text-slate-800 text-xs font-semibold flex items-center gap-1"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            {user.id !== "user-1" && (
                              <button
                                onClick={() => {
                                  if (confirm(`Permanently purge administrative access for: ${user.name}?`)) {
                                    submitEntity(`/api/users/${user.id}`, "DELETE", null, "Purged admin account");
                                  }
                                }}
                                className="text-red-500 hover:text-red-700 text-xs font-semibold flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* --- 6. BACKUP & DISASTER RECOVERY TAB --- */}
              {activeTab === "backups" && currentUser?.role === UserRole.CHIEF_ADMIN && (
                <div className="space-y-6">
                  {/* Trigger Box */}
                  <div className="bg-white border border-emerald-100 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="font-display font-semibold text-sm text-slate-900 flex items-center gap-2">
                        <Database className="w-5 h-5 text-emerald-700" />
                        <span>Manual Snapshot Trigger</span>
                      </h3>
                      <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
                        Creates an absolute timestamped structural backup of all users, catalogs, scholars, media links, and log tables on the system. All snapshots are saved locally inside the cloud storage partition.
                      </p>
                    </div>

                    <button
                      onClick={triggerBackup}
                      className="bg-emerald-800 hover:bg-emerald-900 text-white font-semibold font-mono text-xs py-2.5 px-4 rounded-lg flex items-center gap-1.5 shadow transition-all active:scale-95 shrink-0"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>TRIGGER DATABASE SNAPSHOT</span>
                    </button>
                  </div>

                  {/* Backups List */}
                  <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100">
                      <h4 className="font-display font-semibold text-sm text-slate-800">Historical Snapshot Registries</h4>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {backups.length > 0 ? (
                        backups.map(bk => (
                          <div key={bk.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-slate-50/30 transition-colors">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs text-slate-900">{bk.filename}</span>
                                <span className="px-1.5 py-0.5 bg-slate-100 text-[9px] text-slate-500 font-mono rounded border border-slate-200">SIZE: {bk.fileSize}</span>
                              </div>
                              <span className="block text-[10px] text-slate-400 font-mono">SNAPSHOT TIMELINE: {new Date(bk.createdAt).toLocaleString()}</span>
                              <div className="flex gap-2 text-[10px] text-slate-500 font-mono pt-1">
                                <span>Videos: <strong className="text-slate-800">{bk.itemCounts?.videos}</strong></span>
                                <span>Audios: <strong className="text-slate-800">{bk.itemCounts?.audio}</strong></span>
                                <span>Books: <strong className="text-slate-800">{bk.itemCounts?.books}</strong></span>
                                <span>Scholars: <strong className="text-slate-800">{bk.itemCounts?.scholars}</strong></span>
                              </div>
                            </div>

                            <button
                              onClick={() => triggerRestore(bk.id)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold font-mono text-xs py-1.5 px-3 rounded-lg flex items-center gap-1 transition-all active:scale-95 shrink-0"
                            >
                              <ShieldAlert className="w-3.5 h-3.5 text-emerald-800 animate-pulse" />
                              <span>RESTORE SYSTEM STATE</span>
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="p-8 text-center text-slate-400 font-mono text-xs">No snapshots archived yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* --- 7. SYSTEM SETTINGS & APIS TAB --- */}
              {activeTab === "settings" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column: API documentation and Code Generators (8 cols) */}
                  <div className="lg:col-span-7 bg-white border border-slate-100 rounded-xl shadow-sm p-6 space-y-6">
                    <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
                      <div className="space-y-1">
                        <h3 className="font-display font-semibold text-sm text-slate-800 flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                          <span>DARUL KHAIR Website API Synchronizer</span>
                        </h3>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Securely synchronize Videos, Audio Lectures, Islamic Books, and Scholars with the public foundation website in real time.
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-100 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                        Active
                      </span>
                    </div>

                    {/* Backend Connection Credentials */}
                    <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-3.5">
                      <h4 className="text-[11px] font-bold text-slate-700 tracking-wider uppercase">Cloud Integration Credentials</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Base URL */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-semibold text-slate-500 block">Backend Base URL</span>
                          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800 shadow-sm">
                            <span className="flex-1 overflow-x-auto whitespace-nowrap select-all">{window.location.origin}</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(window.location.origin);
                                showToast("Backend Base URL copied.", "success");
                              }}
                              className="p-1 hover:bg-slate-100 text-slate-500 rounded"
                              title="Copy Base URL"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Secret Access Key */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-semibold text-slate-500 block">Bearer Token / X-API-Key</span>
                          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800 shadow-sm">
                            <input
                              type={isApiKeyVisible ? "text" : "password"}
                              value={settings?.apiKeyForClient || "dk_live_key_9281a82e811c"}
                              readOnly
                              className="flex-1 bg-transparent border-none outline-none text-xs text-slate-800 tracking-wide"
                            />
                            <button
                              onClick={() => setIsApiKeyVisible(!isApiKeyVisible)}
                              className="p-1 hover:bg-slate-100 text-slate-500 rounded"
                              title={isApiKeyVisible ? "Hide Key" : "Show Key"}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(settings?.apiKeyForClient || "dk_live_key_9281a82e811c");
                                showToast("API Secret Token copied.", "success");
                              }}
                              className="p-1 hover:bg-slate-100 text-slate-500 rounded"
                              title="Copy Key"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Interactive Code Snippets Tab */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 tracking-wider uppercase">Live Code Snippets Generator</span>
                        <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                          <button
                            onClick={() => setSnippetTab("curl")}
                            className={`px-2 py-1 rounded text-[10px] font-mono transition-all ${
                              snippetTab === "curl" ? "bg-white text-slate-800 shadow-sm font-semibold" : "text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            cURL
                          </button>
                          <button
                            onClick={() => setSnippetTab("js")}
                            className={`px-2 py-1 rounded text-[10px] font-mono transition-all ${
                              snippetTab === "js" ? "bg-white text-slate-800 shadow-sm font-semibold" : "text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            JavaScript (Fetch)
                          </button>
                          <button
                            onClick={() => setSnippetTab("node")}
                            className={`px-2 py-1 rounded text-[10px] font-mono transition-all ${
                              snippetTab === "node" ? "bg-white text-slate-800 shadow-sm font-semibold" : "text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            Node.js
                          </button>
                        </div>
                      </div>

                      <div className="bg-slate-900 rounded-xl p-4 font-mono text-[11px] text-slate-200 overflow-x-auto relative group shadow-inner">
                        <button
                          onClick={() => {
                            const baseUrl = window.location.origin;
                            const key = settings?.apiKeyForClient || "dk_live_key_9281a82e811c";
                            let code = "";
                            if (snippetTab === "curl") {
                              code = `curl -X GET "${baseUrl}/api/v1/media?type=video"\n  -H "X-API-Key: ${key}"`;
                            } else if (snippetTab === "js") {
                              code = `fetch("${baseUrl}/api/v1/media?type=video", {\n  headers: {\n    "X-API-Key": "${key}"\n  }\n})\n  .then(res => res.json())\n  .then(data => console.log(data));`;
                            } else {
                              code = `const fetch = require('node-fetch');\n\nfetch("${baseUrl}/api/v1/system-data", {\n  headers: {\n    "X-API-Key": "${key}"\n  }\n})\n  .then(res => res.json())\n  .then(json => console.log("Catalog Stats:", json.statistics));`;
                            }
                            navigator.clipboard.writeText(code);
                            showToast("Code snippet copied to clipboard.", "success");
                          }}
                          className="absolute right-3 top-3 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md transition-all shadow border border-slate-700 opacity-0 group-hover:opacity-100"
                          title="Copy Code Block"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        
                        {snippetTab === "curl" && (
                          <pre className="whitespace-pre">
                            <span className="text-emerald-400">curl</span> -X GET <span className="text-amber-300">"{window.location.origin}/api/v1/media?type=video"</span> \<br />
                            &nbsp;&nbsp;-H <span className="text-amber-300">"X-API-Key: {settings?.apiKeyForClient || "dk_live_key_9281a82e811c"}"</span>
                          </pre>
                        )}

                        {snippetTab === "js" && (
                          <pre className="whitespace-pre text-slate-300">
                            <span className="text-purple-400">fetch</span>(<span className="text-amber-300">"{window.location.origin}/api/v1/media?type=video"</span>, &#123;<br />
                            &nbsp;&nbsp;headers: &#125;<br />
                            &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-sky-300">"X-API-Key"</span>: <span className="text-amber-300">"{settings?.apiKeyForClient || "dk_live_key_9281a82e811c"}"</span><br />
                            &nbsp;&nbsp;&#125;<br />
                            &#125;)<br />
                            &nbsp;&nbsp;.<span className="text-purple-400">then</span>(res =&gt; res.<span className="text-sky-300">json</span>())<br />
                            &nbsp;&nbsp;.<span className="text-purple-400">then</span>(data =&gt; console.<span className="text-sky-300">log</span>(data));
                          </pre>
                        )}

                        {snippetTab === "node" && (
                          <pre className="whitespace-pre text-slate-300">
                            <span className="text-purple-400">const</span> fetch = <span className="text-purple-400">require</span>(<span className="text-amber-300">'node-fetch'</span>);<br /><br />
                            <span className="text-purple-400">fetch</span>(<span className="text-amber-300">"{window.location.origin}/api/v1/system-data"</span>, &#123;<br />
                            &nbsp;&nbsp;headers: &#123;<br />
                            &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-sky-300">"X-API-Key"</span>: <span className="text-amber-300">"{settings?.apiKeyForClient || "dk_live_key_9281a82e811c"}"</span><br />
                            &nbsp;&nbsp;&#125;<br />
                            &#125;)<br />
                            &nbsp;&nbsp;.<span className="text-purple-400">then</span>(res =&gt; res.<span className="text-sky-300">json</span>())<br />
                            &nbsp;&nbsp;.<span className="text-purple-400">then</span>(json =&gt; console.<span className="text-sky-300">log</span>(<span className="text-amber-300">"Catalog Stats:"</span>, json.statistics));
                          </pre>
                        )}
                      </div>
                    </div>

                    {/* Full REST API Routes catalog */}
                    <div className="space-y-3">
                      <span className="text-[11px] font-bold text-slate-700 tracking-wider uppercase block">Secure REST API Endpoints Catalog</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                        
                        {/* Route 1 */}
                        <div className="border border-slate-100 p-3 rounded-lg hover:border-slate-200 hover:shadow-sm transition-all bg-white flex flex-col justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded text-[9px] font-bold">GET</span>
                            <span className="text-slate-800 font-mono font-semibold text-[10px]">/api/v1/ping</span>
                          </div>
                          <span className="text-[10px] text-slate-500 mt-2 block">Connection Handshake: Verify key status and database sync route.</span>
                        </div>

                        {/* Route 2 */}
                        <div className="border border-slate-100 p-3 rounded-lg hover:border-slate-200 hover:shadow-sm transition-all bg-white flex flex-col justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 bg-sky-50 text-sky-800 border border-sky-100 rounded text-[9px] font-bold">GET</span>
                            <span className="text-slate-800 font-mono font-semibold text-[10px]">/api/v1/media</span>
                          </div>
                          <span className="text-[10px] text-slate-500 mt-2 block">Retrieve items. Supports filter: ?type=video|audio|book</span>
                        </div>

                        {/* Route 3 */}
                        <div className="border border-slate-100 p-3 rounded-lg hover:border-slate-200 hover:shadow-sm transition-all bg-white flex flex-col justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 bg-emerald-700 text-white rounded text-[9px] font-bold">POST</span>
                            <span className="text-slate-800 font-mono font-semibold text-[10px]">/api/v1/media</span>
                          </div>
                          <span className="text-[10px] text-slate-500 mt-2 block">Single Source Truth Upload: Real-time media item upload from website.</span>
                        </div>

                        {/* Route 4 */}
                        <div className="border border-slate-100 p-3 rounded-lg hover:border-slate-200 hover:shadow-sm transition-all bg-white flex flex-col justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 bg-sky-50 text-sky-800 border border-sky-100 rounded text-[9px] font-bold">GET</span>
                            <span className="text-slate-800 font-mono font-semibold text-[10px]">/api/v1/scholars</span>
                          </div>
                          <span className="text-[10px] text-slate-500 mt-2 block">Synchronize scholars bio details and photo profiles directly.</span>
                        </div>

                        {/* Route 5 */}
                        <div className="border border-slate-100 p-3 rounded-lg hover:border-slate-200 hover:shadow-sm transition-all bg-white flex flex-col justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-100 rounded text-[9px] font-bold">PUT</span>
                            <span className="text-slate-800 font-mono font-semibold text-[10px]">/api/v1/media/:id</span>
                          </div>
                          <span className="text-[10px] text-slate-500 mt-2 block">Edit/Update specific catalog statistics or streaming sources.</span>
                        </div>

                        {/* Route 6 */}
                        <div className="border border-slate-100 p-3 rounded-lg hover:border-slate-200 hover:shadow-sm transition-all bg-white flex flex-col justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 bg-sky-50 text-sky-800 border border-sky-100 rounded text-[9px] font-bold">GET</span>
                            <span className="text-slate-800 font-mono font-semibold text-[10px]">/api/v1/system-data</span>
                          </div>
                          <span className="text-[10px] text-slate-500 mt-2 block">Dynamic dashboard metrics, server load stats, and log history.</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Global system controls & API Key Manager (5 cols) */}
                  <div className="lg:col-span-5 space-y-6">
                    {/* Panel 1: Settings Configs */}
                    <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-6 space-y-5">
                      <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
                        <Settings className="w-4 h-4 text-emerald-800 animate-spin-slow" />
                        <h3 className="font-display font-semibold text-sm text-slate-800">Global Configuration Console</h3>
                      </div>

                      {settings ? (
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-700" htmlFor="siteName">Foundation Platform Title</label>
                            <input
                              id="siteName"
                              type="text"
                              value={settings.siteName}
                              onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:border-emerald-600 transition-colors outline-none"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-700" htmlFor="autoBackupInterval">Automated Backup Frequency</label>
                            <select
                              id="autoBackupInterval"
                              value={settings.autoBackupInterval}
                              onChange={(e) => setSettings({ ...settings, autoBackupInterval: e.target.value })}
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 focus:bg-white transition-colors cursor-pointer outline-none"
                            >
                              <option value="daily">Daily Cron Backup</option>
                              <option value="weekly">Weekly Cron Backup</option>
                              <option value="none">Disabled</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <div className="space-y-0.5">
                              <span className="block text-xs font-semibold text-slate-900">Gemini AI Enrichment</span>
                              <span className="block text-[10px] text-slate-500">Auto-enrich summaries and search tags using Google GenAI.</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={settings.geminiEnrichmentEnabled}
                              onChange={(e) => setSettings({ ...settings, geminiEnrichmentEnabled: e.target.checked })}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                          </div>

                          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <div className="space-y-0.5">
                              <span className="block text-xs font-semibold text-slate-900">Maintenance Mode</span>
                              <span className="block text-[10px] text-slate-500">Restrict public viewers and take down downstream apps.</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={settings.maintenanceMode}
                              onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 font-mono">Accessing configurations...</p>
                      )}
                    </div>

                    {/* Panel 2: Credentials and Token Rotation */}
                    <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-6 space-y-4">
                      <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
                        <Lock className="w-4 h-4 text-amber-600" />
                        <h3 className="font-display font-semibold text-sm text-slate-800">Security Credentials & Rotation</h3>
                      </div>

                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Rotate the API security key to terminate old external configurations immediately. Highly recommended if key is shared publicly.
                      </p>

                      {settings && (
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-700 block uppercase font-mono">Current Live API Key Token</label>
                            <input
                              type="text"
                              value={settings.apiKeyForClient}
                              onChange={(e) => setSettings({ ...settings, apiKeyForClient: e.target.value })}
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:border-amber-500 transition-colors outline-none font-mono text-slate-800"
                            />
                          </div>

                          <div className="flex gap-2.5">
                            <button
                              type="button"
                              onClick={() => {
                                const randomBytes = Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
                                const newKey = `dk_live_${randomBytes}`;
                                setSettings({ ...settings, apiKeyForClient: newKey });
                                showToast("Generated new API token key. Remember to Save changes!", "info");
                              }}
                              className="flex-1 py-2 bg-slate-100 border border-slate-200 text-slate-700 font-semibold rounded-lg text-xs hover:bg-slate-200 transition-all flex items-center justify-center gap-1"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Regenerate Key</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Submit settings Button */}
                    {settings && (
                      <button
                        onClick={() => submitEntity("/api/settings", "PUT", settings, "Successfully updated live credentials & configs.")}
                        className="w-full py-3 bg-emerald-800 text-white font-medium rounded-xl text-xs hover:bg-emerald-900 shadow-md shadow-emerald-800/10 transition-all flex items-center justify-center gap-1.5 font-semibold"
                      >
                        <Save className="w-4 h-4" />
                        <span>Save and Deploy All Configurations</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* --- FLOATING MODALS --- */}

      {/* 1. Add / Edit Media Item Modal */}
      {isMediaModalOpen && editingMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="bg-[#1B3022] p-5 text-white flex justify-between items-center">
              <h3 className="font-display font-semibold text-sm">
                {editingMedia.id ? `Modify Media Record #${editingMedia.id}` : "Publish New Catalog Media"}
              </h3>
              <button onClick={() => setIsMediaModalOpen(false)} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Flex Form */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-mono text-slate-500 uppercase font-bold" htmlFor="media-title">Topic Title</label>
                  <input
                    id="media-title"
                    type="text"
                    value={editingMedia.title || ""}
                    onChange={(e) => setEditingMedia({ ...editingMedia, title: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:border-emerald-600 transition-colors"
                    placeholder="e.g. Purpose of Life Tafseer"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-500 uppercase font-bold" htmlFor="media-type">Format Type</label>
                  <select
                    id="media-type"
                    value={editingMedia.type || "video"}
                    onChange={(e) => setEditingMedia({ ...editingMedia, type: e.target.value as any })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 focus:bg-white transition-colors cursor-pointer"
                  >
                    <option value="video">Video</option>
                    <option value="audio">Audio Lecture</option>
                    <option value="book">Islamic PDF Book</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-500 uppercase font-bold" htmlFor="media-year">Year (AH/CE)</label>
                  <input
                    id="media-year"
                    type="text"
                    value={editingMedia.year || "2026"}
                    onChange={(e) => setEditingMedia({ ...editingMedia, year: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:border-emerald-600 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-500 uppercase font-bold" htmlFor="media-scholar">Scholar Profile</label>
                  <select
                    id="media-scholar"
                    value={editingMedia.scholarId || ""}
                    onChange={(e) => setEditingMedia({ ...editingMedia, scholarId: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 focus:bg-white transition-colors cursor-pointer"
                  >
                    {scholars.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-500 uppercase font-bold" htmlFor="media-category">Catalog Category</label>
                  <select
                    id="media-category"
                    value={editingMedia.categoryId || ""}
                    onChange={(e) => setEditingMedia({ ...editingMedia, categoryId: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 focus:bg-white transition-colors cursor-pointer"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-mono text-slate-500 uppercase font-bold" htmlFor="media-url">Media Stream URL (YouTube, MP3 Link, or PDF Link)</label>
                  <input
                    id="media-url"
                    type="text"
                    value={editingMedia.mediaUrl || ""}
                    onChange={(e) => setEditingMedia({ ...editingMedia, mediaUrl: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:border-emerald-600 transition-colors"
                    placeholder="https://example.com/stream"
                  />
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-mono text-slate-500 uppercase font-bold" htmlFor="media-cover">Catalog Cover Image URL</label>
                  <input
                    id="media-cover"
                    type="text"
                    value={editingMedia.coverUrl || ""}
                    onChange={(e) => setEditingMedia({ ...editingMedia, coverUrl: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:border-emerald-600 transition-colors"
                    placeholder="https://images.unsplash.com/..."
                  />
                </div>

                {/* AI Helper Trigger */}
                <div className="col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-700 animate-pulse" />
                      <span>Gemini AI Content Enrichment</span>
                    </span>
                    <button
                      type="button"
                      onClick={enrichMediaWithAI}
                      disabled={isEnriching}
                      className="bg-emerald-800 hover:bg-emerald-900 text-white font-mono text-[10px] py-1 px-2.5 rounded flex items-center gap-1 transition-all"
                    >
                      {isEnriching ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      <span>Auto-Generate details</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">Uses Gemini 3.5 to intelligently generate summary explanations and keywords/tags based on the Title provided.</p>
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-mono text-slate-500 uppercase font-bold" htmlFor="media-desc">Summary Explanation</label>
                  <textarea
                    id="media-desc"
                    rows={3}
                    value={editingMedia.description || ""}
                    onChange={(e) => setEditingMedia({ ...editingMedia, description: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:border-emerald-600 transition-colors"
                  />
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-mono text-slate-500 uppercase font-bold" htmlFor="media-tags">Search Keywords / Tags (Comma separated)</label>
                  <input
                    id="media-tags"
                    type="text"
                    value={editingMedia.tags?.join(", ") || ""}
                    onChange={(e) => setEditingMedia({ ...editingMedia, tags: e.target.value.split(",").map(t => t.trim()) })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:border-emerald-600 transition-colors"
                    placeholder="e.g. Ramadan, Tafseer, Islam"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsMediaModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const endpoint = editingMedia.id ? `/api/media/${editingMedia.id}` : "/api/media";
                  const method = editingMedia.id ? "PUT" : "POST";
                  submitEntity(endpoint, method, editingMedia, "Media portfolio saved.").then((ok) => {
                    if (ok) setIsMediaModalOpen(false);
                  });
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 transition-all"
              >
                Save Catalog Resource
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 2. Scholar Modal */}
      {isScholarModalOpen && editingScholar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="bg-[#1B3022] p-5 text-white flex justify-between items-center">
              <h3 className="font-display font-semibold text-sm">Scholar Profile Registry</h3>
              <button onClick={() => setIsScholarModalOpen(false)} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-500 uppercase font-bold" htmlFor="sch-name">Scholar Full Name</label>
                <input
                  id="sch-name"
                  type="text"
                  value={editingScholar.name || ""}
                  onChange={(e) => setEditingScholar({ ...editingScholar, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:border-emerald-600 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-500 uppercase font-bold" htmlFor="sch-lang">Languages spoken (Comma separated)</label>
                <input
                  id="sch-lang"
                  type="text"
                  value={editingScholar.language || ""}
                  onChange={(e) => setEditingScholar({ ...editingScholar, language: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:border-emerald-600 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-500 uppercase font-bold" htmlFor="sch-photo">Photo URL</label>
                <input
                  id="sch-photo"
                  type="text"
                  value={editingScholar.photoUrl || ""}
                  onChange={(e) => setEditingScholar({ ...editingScholar, photoUrl: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:border-emerald-600 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-500 uppercase font-bold" htmlFor="sch-bio">Scholar Biography</label>
                <textarea
                  id="sch-bio"
                  rows={4}
                  value={editingScholar.bio || ""}
                  onChange={(e) => setEditingScholar({ ...editingScholar, bio: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:border-emerald-600 transition-colors"
                />
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-2 border-t border-slate-100">
              <button onClick={() => setIsScholarModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all">Cancel</button>
              <button
                onClick={() => {
                  const endpoint = editingScholar.id ? `/api/scholars/${editingScholar.id}` : "/api/scholars";
                  const method = editingScholar.id ? "PUT" : "POST";
                  submitEntity(endpoint, method, editingScholar, "Scholar profile archived.").then((ok) => {
                    if (ok) setIsScholarModalOpen(false);
                  });
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 transition-all"
              >
                Save Profile
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 3. User Accounts Modal */}
      {isUserModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="bg-[#1B3022] p-5 text-white flex justify-between items-center">
              <h3 className="font-display font-semibold text-sm">Administrative Account Port</h3>
              <button onClick={() => setIsUserModalOpen(false)} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-500 uppercase font-bold" htmlFor="usr-name">Full Name</label>
                <input
                  id="usr-name"
                  type="text"
                  value={editingUser.name || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:border-emerald-600 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-500 uppercase font-bold" htmlFor="usr-uname">Console Username</label>
                <input
                  id="usr-uname"
                  type="text"
                  value={editingUser.username || ""}
                  disabled={!!editingUser.id}
                  onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:border-emerald-600 transition-colors disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-500 uppercase font-bold" htmlFor="usr-email">Email Address</label>
                <input
                  id="usr-email"
                  type="email"
                  value={editingUser.email || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:border-emerald-600 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-500 uppercase font-bold" htmlFor="usr-role">Access Authorization Role</label>
                <select
                  id="usr-role"
                  value={editingUser.role || UserRole.MEDIA_ADMIN}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 focus:bg-white transition-colors cursor-pointer"
                >
                  <option value="CHIEF_ADMIN">Chief Admin (Full Access)</option>
                  <option value="MEDIA_ADMIN">Media Admin (Media management only)</option>
                </select>
              </div>

              {editingUser.id && (
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="space-y-0.5">
                    <span className="block text-xs font-semibold text-slate-900">Active Account Status</span>
                    <span className="block text-[10px] text-slate-500">Enable or suspend console access completely.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editingUser.isActive !== false}
                    onChange={(e) => setEditingUser({ ...editingUser, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
              )}
            </div>

            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-2 border-t border-slate-100">
              <button onClick={() => setIsUserModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all">Cancel</button>
              <button
                onClick={() => {
                  const endpoint = editingUser.id ? `/api/users/${editingUser.id}` : "/api/users";
                  const method = editingUser.id ? "PUT" : "POST";
                  submitEntity(endpoint, method, editingUser, "Staff security profiles updated.").then((ok) => {
                    if (ok) setIsUserModalOpen(false);
                  });
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 transition-all"
              >
                Save Profile
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 4. Category Modal */}
      {isCategoryModalOpen && editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="bg-[#1B3022] p-5 text-white flex justify-between items-center">
              <h3 className="font-display font-semibold text-sm">Media Category Shell</h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-500 uppercase font-bold" htmlFor="cat-name">Category Title</label>
                <input
                  id="cat-name"
                  type="text"
                  value={editingCategory.name || ""}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:border-emerald-600 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-500 uppercase font-bold" htmlFor="cat-desc">Explanation Overview</label>
                <textarea
                  id="cat-desc"
                  rows={3}
                  value={editingCategory.description || ""}
                  onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:border-emerald-600 transition-colors"
                />
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-2 border-t border-slate-100">
              <button onClick={() => setIsCategoryModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all">Cancel</button>
              <button
                onClick={() => {
                  const endpoint = editingCategory.id ? `/api/categories/${editingCategory.id}` : "/api/categories";
                  const method = editingCategory.id ? "PUT" : "POST";
                  submitEntity(endpoint, method, editingCategory, "Catalog categories processed.").then((ok) => {
                    if (ok) setIsCategoryModalOpen(false);
                  });
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 transition-all"
              >
                Save Category
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 5. Lecture Series Modal */}
      {isSeriesModalOpen && editingSeries && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="bg-[#1B3022] p-5 text-white flex justify-between items-center">
              <h3 className="font-display font-semibold text-sm">Lecture Series Shell</h3>
              <button onClick={() => setIsSeriesModalOpen(false)} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-500 uppercase font-bold" htmlFor="ser-name">Series Title Name</label>
                <input
                  id="ser-name"
                  type="text"
                  value={editingSeries.name || ""}
                  onChange={(e) => setEditingSeries({ ...editingSeries, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:border-emerald-600 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-500 uppercase font-bold" htmlFor="ser-scholar">Assigned Principal Scholar</label>
                <select
                  id="ser-scholar"
                  value={editingSeries.scholarId || ""}
                  onChange={(e) => setEditingSeries({ ...editingSeries, scholarId: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 focus:bg-white transition-colors cursor-pointer"
                >
                  {scholars.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-500 uppercase font-bold" htmlFor="ser-category">Category Shell</label>
                <select
                  id="ser-category"
                  value={editingSeries.categoryId || ""}
                  onChange={(e) => setEditingSeries({ ...editingSeries, categoryId: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 focus:bg-white transition-colors cursor-pointer"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-500 uppercase font-bold" htmlFor="ser-desc">Narrative Summary</label>
                <textarea
                  id="ser-desc"
                  rows={3}
                  value={editingSeries.description || ""}
                  onChange={(e) => setEditingSeries({ ...editingSeries, description: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:border-emerald-600 transition-colors"
                />
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-2 border-t border-slate-100">
              <button onClick={() => setIsSeriesModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all">Cancel</button>
              <button
                onClick={() => {
                  const endpoint = editingSeries.id ? `/api/series/${editingSeries.id}` : "/api/series";
                  const method = editingSeries.id ? "PUT" : "POST";
                  submitEntity(endpoint, method, editingSeries, "Lecture series cataloged.").then((ok) => {
                    if (ok) setIsSeriesModalOpen(false);
                  });
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 transition-all"
              >
                Save Series
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* --- FLOATING CHAT DRAWER: AI ASSISTANT --- */}
      <AnimatePresence>
        {isAssistantOpen && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="fixed top-0 right-0 h-screen w-full sm:w-96 bg-white shadow-2xl z-50 flex flex-col border-l border-slate-100"
          >
            {/* Header */}
            <div className="bg-[#1B3022] p-4 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <div>
                  <h4 className="font-display font-semibold text-xs leading-none">Darul Khair AI Assistant</h4>
                  <span className="text-[9px] text-emerald-400 font-mono mt-0.5 block">Gemini 3.5 Active</span>
                </div>
              </div>
              <button onClick={() => setIsAssistantOpen(false)} className="text-white/80 hover:text-white p-1 rounded hover:bg-white/5">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages body */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50">
              {assistantMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`p-3 rounded-2xl max-w-[85%] text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#1B3022] text-white rounded-br-none"
                      : "bg-white text-slate-800 rounded-bl-none border border-slate-200"
                  }`}>
                    <p className="whitespace-pre-line">{msg.content}</p>
                  </div>
                </div>
              ))}

              {isAssistantTyping && (
                <div className="flex justify-start">
                  <div className="bg-white p-3 rounded-2xl border border-slate-200 flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-emerald-700 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-emerald-700 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 bg-emerald-700 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Form footer */}
            <form onSubmit={handleAssistantSend} className="p-3 bg-white border-t border-slate-100 flex gap-2 shrink-0">
              <input
                type="text"
                value={assistantInput}
                onChange={(e) => setAssistantInput(e.target.value)}
                placeholder="Ask Darul Khair AI..."
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:border-emerald-600 transition-colors"
              />
              <button
                type="submit"
                className="p-2 bg-emerald-800 text-white rounded-lg hover:bg-emerald-900 transition-colors"
                title="Send Message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
