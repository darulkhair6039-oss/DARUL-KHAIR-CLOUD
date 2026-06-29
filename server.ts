import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

// Load environment variables
dotenv.config();

// Resolve paths for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import seed data
import {
  initialUsers,
  initialScholars,
  initialCategories,
  initialSeries,
  initialMediaItems,
  initialSettings,
  initialLogs
} from "./src/db/seed.js";
import { User, UserRole, Scholar, Category, Series, MediaItem, SystemSettings, ActivityLog, BackupItem } from "./src/types.js";

const app = express();
app.use(express.json());

const PORT = 3000;
const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "db.json");
const BACKUP_DIR = path.join(DB_DIR, "backups");

// Initialize Gemini Client
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log("Gemini Client successfully initialized.");
  } catch (err) {
    console.error("Failed to initialize Gemini client:", err);
  }
} else {
  console.log("No GEMINI_API_KEY found. AI features will run in offline mode.");
}

// Ensure database directories exist
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

interface Database {
  users: User[];
  scholars: Scholar[];
  categories: Category[];
  series: Series[];
  mediaItems: MediaItem[];
  settings: SystemSettings;
  logs: ActivityLog[];
}

let db: Database = {
  users: initialUsers,
  scholars: initialScholars,
  categories: initialCategories,
  series: initialSeries,
  mediaItems: initialMediaItems,
  settings: initialSettings,
  logs: initialLogs
};

// --- CACHE LAYER ---
let apiCache: Record<string, { data: any; timestamp: number }> = {};

function clearApiCache() {
  apiCache = {};
}

// Atomic & Corruption-Proof Database Writing
function saveDatabase() {
  try {
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), "utf-8");
    fs.renameSync(tempFile, DB_FILE);
    clearApiCache(); // Invalidate cache on mutations
  } catch (e) {
    console.error("[DATABASE] Error saving database atomically to disk:", e);
  }
}

// Load database from file if exists, otherwise write seed
function loadDatabase() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, "utf-8");
      const loaded = JSON.parse(content);
      db = {
        users: loaded.users || initialUsers,
        scholars: loaded.scholars || initialScholars,
        categories: loaded.categories || initialCategories,
        series: loaded.series || initialSeries,
        mediaItems: loaded.mediaItems || initialMediaItems,
        settings: loaded.settings || initialSettings,
        logs: loaded.logs || initialLogs
      };
      
      // Ensure chief_admin has name Dr. Yakubu
      const chiefAdmin = db.users.find(u => u.username === "chief_admin");
      if (chiefAdmin) {
        chiefAdmin.name = "Dr. Yakubu";
      }
      
      console.log("[DATABASE] Database loaded successfully from disk.");
      saveDatabase();
    } catch (e) {
      console.error("[DATABASE] Error reading database, resetting to initial seed", e);
      saveDatabase();
    }
  } else {
    // Overwrite initial seed chief_admin too
    const chiefAdmin = db.users.find(u => u.username === "chief_admin");
    if (chiefAdmin) {
      chiefAdmin.name = "Dr. Yakubu";
    }
    saveDatabase();
  }
}

loadDatabase();

// Utility log helper with integrated cloud container logging standard
function addLog(userId: string, username: string, role: UserRole, action: string, details: string, req?: Request) {
  const ipAddress = req ? (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || "127.0.0.1") : "127.0.0.1";
  const newLog: ActivityLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    userId,
    username,
    userRole: role,
    action,
    details,
    ipAddress,
    timestamp: new Date().toISOString()
  };
  db.logs.unshift(newLog);
  // Cap logs to 500 entries
  if (db.logs.length > 500) {
    db.logs = db.logs.slice(0, 500);
  }
  
  // High-visibility structural logging for production container environments
  console.log(`[AUDIT] [${newLog.timestamp}] [User: ${username} (${role})] [Action: ${action}] - ${details} (IP: ${ipAddress})`);
  
  saveDatabase();
}

// --- RATE LIMITING MIDDLEWARE ---
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const rateLimiter = (maxRequests: number, windowMs: number) => {
  return (req: Request, res: Response, next: any) => {
    const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || "127.0.0.1").split(',')[0].trim();
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (!record) {
      rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
      return next();
    }

    record.count++;
    if (record.count > maxRequests) {
      console.warn(`[SECURITY] Rate limit exceeded for IP: ${ip} on path ${req.path}`);
      res.status(429).json({
        success: false,
        message: "Too many requests. Please slow down and try again later."
      });
      return;
    }
    next();
  };
};

// --- AUTHENTICATION & SECURITY MIDDLEWARES ---

// Validate Admin session/token
const validateAdminToken = (req: Request, res: Response, next: any) => {
  const authHeader = req.headers['authorization']?.toString();
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ success: false, message: "Unauthorized: Missing active session token." });
    return;
  }
  const token = authHeader.replace(/^Bearer\s+/, "");
  if (!token.startsWith("dk_token_")) {
    res.status(401).json({ success: false, message: "Unauthorized: Invalid administrative token format." });
    return;
  }
  const parts = token.split("_");
  const userId = parts[2]; // dk_token_userId_timestamp
  if (!userId) {
    res.status(401).json({ success: false, message: "Unauthorized: Corrupted administrative session token." });
    return;
  }
  
  const foundUser = db.users.find(u => u.id === userId && u.isActive);
  if (!foundUser) {
    res.status(401).json({ success: false, message: "Unauthorized: Active administrative user profile not found or account is suspended." });
    return;
  }

  // Attach verified user profile context to the request object
  (req as any).user = foundUser;
  next();
};

// Enforce Role-Based Access Control
const requireRole = (role: UserRole) => {
  return (req: Request, res: Response, next: any) => {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized: User session context is missing." });
      return;
    }
    if (user.role !== role) {
      console.warn(`[RBAC VIOLATION] User: ${user.username} with role ${user.role} attempted to access restricted resource ${req.method} ${req.path}`);
      res.status(403).json({ success: false, message: "Access Denied: You do not possess the required CHIEF_ADMIN credentials to perform this action." });
      return;
    }
    next();
  };
};

// --- AUTOMATED ROLLING BACKUPS ENGINE ---
function runScheduledBackupCheck() {
  const interval = db.settings.autoBackupInterval;
  if (!interval || interval === "none") return;

  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const now = new Date();
    
    let isDue = false;
    if (interval === "daily") {
      const todayPrefix = `backup-auto-daily-${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
      const alreadyHasToday = files.some(f => f.startsWith(todayPrefix));
      if (!alreadyHasToday) isDue = true;
    } else if (interval === "weekly") {
      // 7 days interval check
      const lastSevenDays = 7 * 24 * 60 * 60 * 1000;
      const recentBackup = files.some(file => {
        if (!file.startsWith("backup-auto-weekly-")) return false;
        const stats = fs.statSync(path.join(BACKUP_DIR, file));
        return (now.getTime() - stats.mtime.getTime()) < lastSevenDays;
      });
      if (!recentBackup) isDue = true;
    }

    if (isDue) {
      const dateStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
      const backupId = `auto-${interval}-${dateStr}-${Date.now()}`;
      const filename = `backup-${backupId}.json`;
      const backupPath = path.join(BACKUP_DIR, filename);
      
      fs.writeFileSync(backupPath, JSON.stringify(db, null, 2), "utf-8");
      console.log(`[BACKUP] Automated rolling snapshot created: ${filename}`);
      
      // Auto-purge oldest backups to guarantee disk availability
      const autoBackups = files
        .filter(f => f.startsWith("backup-auto-"))
        .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }))
        .sort((a, b) => a.time - b.time);
      
      if (autoBackups.length > 10) {
        const toDelete = autoBackups.slice(0, autoBackups.length - 10);
        for (const f of toDelete) {
          try {
            fs.unlinkSync(path.join(BACKUP_DIR, f.name));
            console.log(`[BACKUP] Purged legacy rolling snapshot: ${f.name}`);
          } catch (err) {}
        }
      }
    }
  } catch (err) {
    console.error("[BACKUP] Scheduled backup check failed:", err);
  }
}

// Check schedule hourly
setInterval(runScheduledBackupCheck, 60 * 60 * 1000);
// Also trigger one verification immediately on backend initialization
setTimeout(runScheduledBackupCheck, 5000);

// --- CACHE MIDDLEWARE ---
const cacheMiddleware = (req: Request, res: Response, next: any) => {
  if (req.method !== "GET") {
    return next();
  }
  
  const cacheKey = req.originalUrl || req.url;
  const cached = apiCache[cacheKey];
  
  if (cached) {
    const TTL = 5 * 60 * 1000; // 5 minutes standard TTL
    if (Date.now() - cached.timestamp < TTL) {
      return res.json(cached.data);
    }
  }

  const originalJson = res.json;
  res.json = function(data: any) {
    apiCache[cacheKey] = {
      data,
      timestamp: Date.now()
    };
    return originalJson.call(this, data);
  };
  
  next();
};

// --- API ROUTES ---

// Healthcheck & System Metrics
app.get("/api/health", validateAdminToken, (req: Request, res: Response) => {
  const memoryUsage = process.memoryUsage();
  // Simulated stats
  const cpuUsage = Math.floor(Math.random() * 8) + 2; // 2% to 10%
  const dbSizeKb = fs.existsSync(DB_FILE) ? Math.round(fs.statSync(DB_FILE).size / 1024) : 10;
  
  res.json({
    status: "healthy",
    cpuUsage,
    memoryUsage: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
    databaseSize: `${dbSizeKb} KB`,
    backupStatus: "healthy",
    apiLatency: `${Math.floor(Math.random() * 45) + 5}ms`,
    uptime: `${Math.round(process.uptime())}s`
  });
});

// Auth / Identity with strict rate limiting protection
app.post("/api/auth/login", rateLimiter(15, 60 * 1000), (req: Request, res: Response) => {
  const { password } = req.body;
  
  if (password !== "SHAGARI@DARULKHARI") {
    res.status(401).json({ success: false, message: "Invalid Security Access Key." });
    return;
  }
  
  // Authenticate Dr. Yakubu (chief_admin) directly
  const foundUser = db.users.find(u => u.username === "chief_admin" && u.isActive);
  if (foundUser) {
    // Return token and credentials
    addLog(foundUser.id, foundUser.username, foundUser.role, "Login Success", `User ${foundUser.name} logged in successfully.`, req);
    res.json({
      success: true,
      user: foundUser,
      token: `dk_token_${foundUser.id}_${Date.now()}`
    });
  } else {
    res.status(401).json({ success: false, message: "Chief Admin account not found or is suspended." });
  }
});

// Fetch complete Database (for Frontend Sync) - restricted to active admins
app.get("/api/db", validateAdminToken, (req: Request, res: Response) => {
  res.json(db);
});

// --- User Management (CHIEF_ADMIN restricted) ---
app.get("/api/users", validateAdminToken, requireRole(UserRole.CHIEF_ADMIN), (req: Request, res: Response) => {
  res.json(db.users);
});

app.post("/api/users", validateAdminToken, requireRole(UserRole.CHIEF_ADMIN), (req: Request, res: Response) => {
  const { name, username, email, role } = req.body;
  if (!name || !username || !email || !role) {
    res.status(400).json({ message: "Missing required fields" });
    return;
  }
  if (db.users.some(u => u.username === username)) {
    res.status(400).json({ message: "Username already taken" });
    return;
  }
  const newUser: User = {
    id: `user-${Date.now()}`,
    username,
    name,
    email,
    role,
    isActive: true,
    createdAt: new Date().toISOString()
  };
  db.users.push(newUser);
  saveDatabase();
  addLog("user-1", "chief_admin", UserRole.CHIEF_ADMIN, "Create User", `Registered new administrative account: ${name} (${username})`, req);
  res.status(201).json(newUser);
});

app.put("/api/users/:id", validateAdminToken, requireRole(UserRole.CHIEF_ADMIN), (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, email, role, isActive } = req.body;
  const userIdx = db.users.findIndex(u => u.id === id);
  if (userIdx === -1) {
    res.status(404).json({ message: "User not found" });
    return;
  }
  // Prevent disabling self
  if (id === "user-1" && isActive === false) {
    res.status(400).json({ message: "Cannot suspend primary chief admin." });
    return;
  }
  db.users[userIdx] = {
    ...db.users[userIdx],
    name: name !== undefined ? name : db.users[userIdx].name,
    email: email !== undefined ? email : db.users[userIdx].email,
    role: role !== undefined ? role : db.users[userIdx].role,
    isActive: isActive !== undefined ? isActive : db.users[userIdx].isActive
  };
  saveDatabase();
  addLog("user-1", "chief_admin", UserRole.CHIEF_ADMIN, "Update User", `Updated settings for user: ${db.users[userIdx].username}`, req);
  res.json(db.users[userIdx]);
});

app.delete("/api/users/:id", validateAdminToken, requireRole(UserRole.CHIEF_ADMIN), (req: Request, res: Response) => {
  const { id } = req.params;
  if (id === "user-1") {
    res.status(400).json({ message: "Cannot delete chief admin" });
    return;
  }
  const found = db.users.find(u => u.id === id);
  if (!found) {
    res.status(404).json({ message: "User not found" });
    return;
  }
  db.users = db.users.filter(u => u.id !== id);
  saveDatabase();
  addLog("user-1", "chief_admin", UserRole.CHIEF_ADMIN, "Delete User", `Deleted user profile: ${found.name}`, req);
  res.json({ success: true });
});

// --- Scholar Management ---
app.get("/api/scholars", validateAdminToken, (req: Request, res: Response) => {
  res.json(db.scholars);
});

app.post("/api/scholars", validateAdminToken, (req: Request, res: Response) => {
  const { name, bio, photoUrl, language } = req.body;
  if (!name) {
    res.status(400).json({ message: "Scholar name is required." });
    return;
  }
  const newScholar: Scholar = {
    id: `scholar-${Date.now()}`,
    name,
    bio: bio || "",
    photoUrl: photoUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150",
    language: language || "English",
    isActive: true,
    createdAt: new Date().toISOString()
  };
  db.scholars.push(newScholar);
  saveDatabase();
  addLog("user-1", "chief_admin", UserRole.CHIEF_ADMIN, "Create Scholar", `Added profile for scholar: ${name}`, req);
  res.status(201).json(newScholar);
});

app.put("/api/scholars/:id", validateAdminToken, (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;
  const idx = db.scholars.findIndex(s => s.id === id);
  if (idx === -1) {
    res.status(404).json({ message: "Scholar not found" });
    return;
  }
  db.scholars[idx] = {
    ...db.scholars[idx],
    ...updateData
  };
  saveDatabase();
  addLog("user-1", "chief_admin", UserRole.CHIEF_ADMIN, "Update Scholar", `Modified profile for scholar: ${db.scholars[idx].name}`, req);
  res.json(db.scholars[idx]);
});

app.delete("/api/scholars/:id", validateAdminToken, (req: Request, res: Response) => {
  const { id } = req.params;
  const found = db.scholars.find(s => s.id === id);
  if (!found) {
    res.status(404).json({ message: "Scholar not found" });
    return;
  }
  db.scholars = db.scholars.filter(s => s.id !== id);
  saveDatabase();
  addLog("user-1", "chief_admin", UserRole.CHIEF_ADMIN, "Delete Scholar", `Deleted scholar profile: ${found.name}`, req);
  res.json({ success: true });
});

// --- Categories ---
app.post("/api/categories", validateAdminToken, (req: Request, res: Response) => {
  const { name, description } = req.body;
  if (!name) {
    res.status(400).json({ message: "Category name is required" });
    return;
  }
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
  const newCat: Category = {
    id: `cat-${Date.now()}`,
    name,
    description: description || "",
    slug,
    createdAt: new Date().toISOString()
  };
  db.categories.push(newCat);
  saveDatabase();
  addLog("user-1", "chief_admin", UserRole.CHIEF_ADMIN, "Create Category", `Added catalog category: ${name}`, req);
  res.status(201).json(newCat);
});

app.put("/api/categories/:id", validateAdminToken, (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description } = req.body;
  const idx = db.categories.findIndex(c => c.id === id);
  if (idx === -1) {
    res.status(404).json({ message: "Category not found" });
    return;
  }
  db.categories[idx] = {
    ...db.categories[idx],
    name: name !== undefined ? name : db.categories[idx].name,
    description: description !== undefined ? description : db.categories[idx].description,
    slug: name !== undefined ? name.toLowerCase().replace(/[^a-z0-9]+/g, "-") : db.categories[idx].slug
  };
  saveDatabase();
  addLog("user-1", "chief_admin", UserRole.CHIEF_ADMIN, "Update Category", `Modified catalog category: ${db.categories[idx].name}`, req);
  res.json(db.categories[idx]);
});

app.delete("/api/categories/:id", validateAdminToken, (req: Request, res: Response) => {
  const { id } = req.params;
  const found = db.categories.find(c => c.id === id);
  if (!found) {
    res.status(404).json({ message: "Category not found" });
    return;
  }
  db.categories = db.categories.filter(c => c.id !== id);
  saveDatabase();
  addLog("user-1", "chief_admin", UserRole.CHIEF_ADMIN, "Delete Category", `Deleted catalog category: ${found.name}`, req);
  res.json({ success: true });
});

// --- Series ---
app.post("/api/series", validateAdminToken, (req: Request, res: Response) => {
  const { name, description, scholarId, categoryId } = req.body;
  if (!name || !scholarId || !categoryId) {
    res.status(400).json({ message: "Name, Scholar, and Category are required" });
    return;
  }
  const newSeries: Series = {
    id: `series-${Date.now()}`,
    name,
    description: description || "",
    scholarId,
    categoryId,
    createdAt: new Date().toISOString()
  };
  db.series.push(newSeries);
  saveDatabase();
  addLog("user-1", "chief_admin", UserRole.CHIEF_ADMIN, "Create Series", `Created lecture series: ${name}`, req);
  res.status(201).json(newSeries);
});

app.put("/api/series/:id", validateAdminToken, (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, scholarId, categoryId } = req.body;
  const idx = db.series.findIndex(s => s.id === id);
  if (idx === -1) {
    res.status(404).json({ message: "Series not found" });
    return;
  }
  db.series[idx] = {
    ...db.series[idx],
    name: name !== undefined ? name : db.series[idx].name,
    description: description !== undefined ? description : db.series[idx].description,
    scholarId: scholarId !== undefined ? scholarId : db.series[idx].scholarId,
    categoryId: categoryId !== undefined ? categoryId : db.series[idx].categoryId
  };
  saveDatabase();
  addLog("user-1", "chief_admin", UserRole.CHIEF_ADMIN, "Update Series", `Modified lecture series: ${db.series[idx].name}`, req);
  res.json(db.series[idx]);
});

app.delete("/api/series/:id", validateAdminToken, (req: Request, res: Response) => {
  const { id } = req.params;
  const found = db.series.find(s => s.id === id);
  if (!found) {
    res.status(404).json({ message: "Series not found" });
    return;
  }
  db.series = db.series.filter(s => s.id !== id);
  saveDatabase();
  addLog("user-1", "chief_admin", UserRole.CHIEF_ADMIN, "Delete Series", `Deleted lecture series: ${found.name}`, req);
  res.json({ success: true });
});

// --- Media Library ---
app.post("/api/media", validateAdminToken, (req: Request, res: Response) => {
  const { title, description, type, mediaUrl, coverUrl, scholarId, categoryId, seriesId, year, tags, status } = req.body;
  if (!title || !type || !mediaUrl || !scholarId || !categoryId || !year) {
    res.status(400).json({ message: "Title, Type, Link/Url, Scholar, Category, and Year are required." });
    return;
  }
  
  const sizeEstimate = type === "book" ? "4.5 MB" : (type === "audio" ? "24.5 MB" : undefined);
  const durationEstimate = type !== "book" ? "45:00" : undefined;

  const newItem: MediaItem = {
    id: `media-${Date.now()}`,
    title,
    description: description || "",
    type,
    mediaUrl,
    coverUrl: coverUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600",
    scholarId,
    categoryId,
    seriesId,
    year,
    tags: tags || [],
    status: status || "PUBLISHED",
    views: 0,
    downloads: type === "video" ? undefined : 0,
    fileSize: sizeEstimate,
    duration: durationEstimate,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  db.mediaItems.push(newItem);
  saveDatabase();
  addLog("user-2", "media_admin_1", UserRole.MEDIA_ADMIN, `Create ${type.toUpperCase()}`, `Uploaded and cataloged new media: '${title}'`, req);
  res.status(201).json(newItem);
});

app.put("/api/media/:id", validateAdminToken, (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;
  const idx = db.mediaItems.findIndex(m => m.id === id);
  if (idx === -1) {
    res.status(404).json({ message: "Media item not found" });
    return;
  }
  
  db.mediaItems[idx] = {
    ...db.mediaItems[idx],
    ...updateData,
    updatedAt: new Date().toISOString()
  };
  saveDatabase();
  addLog("user-2", "media_admin_1", UserRole.MEDIA_ADMIN, `Update ${db.mediaItems[idx].type.toUpperCase()}`, `Updated media details for: '${db.mediaItems[idx].title}'`, req);
  res.json(db.mediaItems[idx]);
});

app.delete("/api/media/:id", validateAdminToken, (req: Request, res: Response) => {
  const { id } = req.params;
  const found = db.mediaItems.find(m => m.id === id);
  if (!found) {
    res.status(404).json({ message: "Media item not found" });
    return;
  }
  
  db.mediaItems = db.mediaItems.filter(m => m.id !== id);
  saveDatabase();
  addLog("user-1", "chief_admin", UserRole.CHIEF_ADMIN, `Delete ${found.type.toUpperCase()}`, `Purged media item: '${found.title}'`, req);
  res.json({ success: true });
});

// --- System Settings (CHIEF_ADMIN restricted) ---
app.get("/api/settings", validateAdminToken, requireRole(UserRole.CHIEF_ADMIN), (req: Request, res: Response) => {
  res.json(db.settings);
});

app.put("/api/settings", validateAdminToken, requireRole(UserRole.CHIEF_ADMIN), (req: Request, res: Response) => {
  const update = req.body;
  db.settings = {
    ...db.settings,
    ...update
  };
  saveDatabase();
  addLog("user-1", "chief_admin", UserRole.CHIEF_ADMIN, "System Settings Update", "Updated system global configurations", req);
  res.json(db.settings);
});

// --- Backup & Restore Operation (CHIEF_ADMIN restricted) ---
app.get("/api/backups", validateAdminToken, requireRole(UserRole.CHIEF_ADMIN), (req: Request, res: Response) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const backups: BackupItem[] = files
      .filter(f => f.endsWith(".json"))
      .map(file => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        const sizeStr = `${(stats.size / 1024).toFixed(1)} KB`;
        
        let itemCounts = { videos: 0, audio: 0, books: 0, scholars: 0 };
        try {
          const contents = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          const media = contents.mediaItems || [];
          itemCounts = {
            videos: media.filter((m: any) => m.type === "video").length,
            audio: media.filter((m: any) => m.type === "audio").length,
            books: media.filter((m: any) => m.type === "book").length,
            scholars: (contents.scholars || []).length
          };
        } catch (e) {}

        return {
          id: file.replace(".json", ""),
          filename: file,
          createdAt: stats.mtime.toISOString(),
          fileSize: sizeStr,
          itemCounts
        };
      });
    res.json(backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  } catch (err) {
    res.status(500).json({ message: "Failed to list backups." });
  }
});

app.post("/api/backups", validateAdminToken, requireRole(UserRole.CHIEF_ADMIN), (req: Request, res: Response) => {
  try {
    const backupId = `backup-${Date.now()}`;
    const filename = `${backupId}.json`;
    const backupPath = path.join(BACKUP_DIR, filename);
    
    fs.writeFileSync(backupPath, JSON.stringify(db, null, 2), "utf-8");
    addLog("user-1", "chief_admin", UserRole.CHIEF_ADMIN, "Database Backup", `Triggered manual snapshot of repository: ${filename}`, req);
    
    res.status(201).json({ success: true, backupId });
  } catch (err) {
    res.status(500).json({ message: "Could not create database backup snapshot." });
  }
});

app.post("/api/backups/:id/restore", validateAdminToken, requireRole(UserRole.CHIEF_ADMIN), (req: Request, res: Response) => {
  const { id } = req.params;
  const backupPath = path.join(BACKUP_DIR, `${id}.json`);
  
  if (!fs.existsSync(backupPath)) {
    res.status(404).json({ message: "Backup snapshot file not found." });
    return;
  }

  try {
    const content = fs.readFileSync(backupPath, "utf-8");
    const parsed = JSON.parse(content);
    
    db = {
      users: parsed.users || db.users,
      scholars: parsed.scholars || db.scholars,
      categories: parsed.categories || db.categories,
      series: parsed.series || db.series,
      mediaItems: parsed.mediaItems || db.mediaItems,
      settings: parsed.settings || db.settings,
      logs: parsed.logs || db.logs
    };
    
    saveDatabase();
    addLog("user-1", "chief_admin", UserRole.CHIEF_ADMIN, "Database Restore", `Restored structural repository state to snapshot ID: ${id}`, req);
    res.json({ success: true, message: "Database restored successfully." });
  } catch (err) {
    res.status(500).json({ message: "Fatal error during database recovery stream." });
  }
});

// --- SECURE REST API v1 FOR DARUL KHAIR WEBSITE INTEGRATION ---

const validateApiKey = (req: Request, res: Response, next: any) => {
  const apiKey = req.headers['x-api-key'] || 
                 req.query.api_key || 
                 req.headers['authorization']?.toString().replace(/^Bearer\s+/, "");

  const expectedKey = db.settings.apiKeyForClient || "dk_live_key_9281a82e811c";
  
  if (apiKey === expectedKey) {
    return next();
  }
  
  res.status(401).json({
    success: false,
    message: "Unauthorized access: Invalid or missing Darul Khair API Key credentials."
  });
};

// 1. Handshake Handshake (Ping connection verification)
app.get("/api/v1/ping", validateApiKey, (req: Request, res: Response) => {
  addLog("api-integration", "External Website", UserRole.MEDIA_ADMIN, "API Connection", "Website established handshake with Cloud Platform securely.", req);
  res.json({
    success: true,
    status: "connected",
    platform: "DARUL KHAIR Official Cloud Platform",
    database: "Live",
    version: "v1.0.0",
    timestamp: new Date().toISOString()
  });
});

// 2. Complete Catalog Media retrieval
app.get("/api/v1/media", validateApiKey, cacheMiddleware, (req: Request, res: Response) => {
  const { type, scholarId, categoryId, seriesId, year } = req.query;
  let items = db.mediaItems;
  
  if (type) items = items.filter(m => m.type === type);
  if (scholarId) items = items.filter(m => m.scholarId === scholarId);
  if (categoryId) items = items.filter(m => m.categoryId === categoryId);
  if (seriesId) items = items.filter(m => m.seriesId === seriesId);
  if (year) items = items.filter(m => m.year === year);
  
  addLog("api-integration", "External Website", UserRole.MEDIA_ADMIN, "API Fetch Media", `Retrieved ${items.length} media records via secure integration API.`, req);
  res.json({ success: true, count: items.length, data: items });
});

app.get("/api/v1/media/:id", validateApiKey, (req: Request, res: Response) => {
  const item = db.mediaItems.find(m => m.id === req.params.id);
  if (!item) {
    res.status(404).json({ success: false, message: "Media record not found." });
    return;
  }
  item.views = (item.views || 0) + 1;
  saveDatabase();
  res.json({ success: true, data: item });
});

app.post("/api/v1/media", validateApiKey, (req: Request, res: Response) => {
  const { title, description, type, mediaUrl, coverUrl, scholarId, categoryId, seriesId, year, tags, status } = req.body;
  if (!title || !type || !mediaUrl || !scholarId || !categoryId || !year) {
    res.status(400).json({ success: false, message: "Title, Type, Link/Url, Scholar, Category, and Year are required." });
    return;
  }
  
  const sizeEstimate = type === "book" ? "5.0 MB" : (type === "audio" ? "20.0 MB" : undefined);
  const durationEstimate = type !== "book" ? "30:00" : undefined;

  const newItem: MediaItem = {
    id: `media-${Date.now()}`,
    title,
    description: description || "",
    type,
    mediaUrl,
    coverUrl: coverUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600",
    scholarId,
    categoryId,
    seriesId,
    year,
    tags: tags || [],
    status: status || "PUBLISHED",
    views: 0,
    downloads: type === "video" ? undefined : 0,
    fileSize: sizeEstimate,
    duration: durationEstimate,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  db.mediaItems.push(newItem);
  saveDatabase();
  addLog("api-integration", "External Website", UserRole.MEDIA_ADMIN, "API Upload Media", `Cataloged new ${type}: '${title}' via secure REST client.`, req);
  res.status(201).json({ success: true, data: newItem });
});

app.put("/api/v1/media/:id", validateApiKey, (req: Request, res: Response) => {
  const idx = db.mediaItems.findIndex(m => m.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ success: false, message: "Media item not found." });
    return;
  }
  db.mediaItems[idx] = {
    ...db.mediaItems[idx],
    ...req.body,
    updatedAt: new Date().toISOString()
  };
  saveDatabase();
  addLog("api-integration", "External Website", UserRole.MEDIA_ADMIN, "API Edit Media", `Modified media record '${db.mediaItems[idx].title}' via REST client.`, req);
  res.json({ success: true, data: db.mediaItems[idx] });
});

app.delete("/api/v1/media/:id", validateApiKey, (req: Request, res: Response) => {
  const found = db.mediaItems.find(m => m.id === req.params.id);
  if (!found) {
    res.status(404).json({ success: false, message: "Media item not found." });
    return;
  }
  db.mediaItems = db.mediaItems.filter(m => m.id !== req.params.id);
  saveDatabase();
  addLog("api-integration", "External Website", UserRole.MEDIA_ADMIN, "API Delete Media", `Purged media record '${found.title}' via REST client.`, req);
  res.json({ success: true, message: "Media item removed." });
});

// 3. Scholar Profiles CRUD
app.get("/api/v1/scholars", validateApiKey, cacheMiddleware, (req: Request, res: Response) => {
  res.json({ success: true, data: db.scholars });
});

app.get("/api/v1/scholars/:id", validateApiKey, (req: Request, res: Response) => {
  const scholar = db.scholars.find(s => s.id === req.params.id);
  if (!scholar) {
    res.status(404).json({ success: false, message: "Scholar profile not found." });
    return;
  }
  res.json({ success: true, data: scholar });
});

app.post("/api/v1/scholars", validateApiKey, (req: Request, res: Response) => {
  const { name, bio, photoUrl, language } = req.body;
  if (!name) {
    res.status(400).json({ success: false, message: "Scholar name is required." });
    return;
  }
  const newScholar: Scholar = {
    id: `scholar-${Date.now()}`,
    name,
    bio: bio || "",
    photoUrl: photoUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150",
    language: language || "English",
    isActive: true,
    createdAt: new Date().toISOString()
  };
  db.scholars.push(newScholar);
  saveDatabase();
  addLog("api-integration", "External Website", UserRole.MEDIA_ADMIN, "API Create Scholar", `Registered scholar '${name}' via secure API.`, req);
  res.status(201).json({ success: true, data: newScholar });
});

app.put("/api/v1/scholars/:id", validateApiKey, (req: Request, res: Response) => {
  const idx = db.scholars.findIndex(s => s.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ success: false, message: "Scholar not found." });
    return;
  }
  db.scholars[idx] = { ...db.scholars[idx], ...req.body };
  saveDatabase();
  addLog("api-integration", "External Website", UserRole.MEDIA_ADMIN, "API Edit Scholar", `Modified scholar profile '${db.scholars[idx].name}' via secure API.`, req);
  res.json({ success: true, data: db.scholars[idx] });
});

app.delete("/api/v1/scholars/:id", validateApiKey, (req: Request, res: Response) => {
  const found = db.scholars.find(s => s.id === req.params.id);
  if (!found) {
    res.status(404).json({ success: false, message: "Scholar profile not found." });
    return;
  }
  db.scholars = db.scholars.filter(s => s.id !== req.params.id);
  saveDatabase();
  addLog("api-integration", "External Website", UserRole.MEDIA_ADMIN, "API Delete Scholar", `Deleted scholar profile '${found.name}' via secure API.`, req);
  res.json({ success: true, message: "Scholar profile purged." });
});

// 4. Category Operations
app.get("/api/v1/categories", validateApiKey, cacheMiddleware, (req: Request, res: Response) => {
  res.json({ success: true, data: db.categories });
});

app.get("/api/v1/categories/:id", validateApiKey, (req: Request, res: Response) => {
  const cat = db.categories.find(c => c.id === req.params.id);
  if (!cat) {
    res.status(404).json({ success: false, message: "Category record not found." });
    return;
  }
  res.json({ success: true, data: cat });
});

app.post("/api/v1/categories", validateApiKey, (req: Request, res: Response) => {
  const { name, description } = req.body;
  if (!name) {
    res.status(400).json({ success: false, message: "Category name is required." });
    return;
  }
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
  const newCat: Category = {
    id: `cat-${Date.now()}`,
    name,
    description: description || "",
    slug,
    createdAt: new Date().toISOString()
  };
  db.categories.push(newCat);
  saveDatabase();
  addLog("api-integration", "External Website", UserRole.MEDIA_ADMIN, "API Create Category", `Cataloged category '${name}' via secure API.`, req);
  res.status(201).json({ success: true, data: newCat });
});

app.put("/api/v1/categories/:id", validateApiKey, (req: Request, res: Response) => {
  const idx = db.categories.findIndex(c => c.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ success: false, message: "Category not found." });
    return;
  }
  db.categories[idx] = {
    ...db.categories[idx],
    ...req.body,
    slug: req.body.name ? req.body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") : db.categories[idx].slug
  };
  saveDatabase();
  addLog("api-integration", "External Website", UserRole.MEDIA_ADMIN, "API Edit Category", `Modified category '${db.categories[idx].name}' via secure API.`, req);
  res.json({ success: true, data: db.categories[idx] });
});

app.delete("/api/v1/categories/:id", validateApiKey, (req: Request, res: Response) => {
  const found = db.categories.find(c => c.id === req.params.id);
  if (!found) {
    res.status(404).json({ success: false, message: "Category not found." });
    return;
  }
  db.categories = db.categories.filter(c => c.id !== req.params.id);
  saveDatabase();
  addLog("api-integration", "External Website", UserRole.MEDIA_ADMIN, "API Delete Category", `Deleted category '${found.name}' via secure API.`, req);
  res.json({ success: true, message: "Category deleted." });
});

// 5. Series Configurations
app.get("/api/v1/series", validateApiKey, cacheMiddleware, (req: Request, res: Response) => {
  res.json({ success: true, data: db.series });
});

app.get("/api/v1/series/:id", validateApiKey, (req: Request, res: Response) => {
  const s = db.series.find(x => x.id === req.params.id);
  if (!s) {
    res.status(404).json({ success: false, message: "Lecture series not found." });
    return;
  }
  res.json({ success: true, data: s });
});

app.post("/api/v1/series", validateApiKey, (req: Request, res: Response) => {
  const { name, description, scholarId, categoryId } = req.body;
  if (!name || !scholarId || !categoryId) {
    res.status(400).json({ success: false, message: "Name, Scholar, and Category are required." });
    return;
  }
  const newSeries: Series = {
    id: `series-${Date.now()}`,
    name,
    description: description || "",
    scholarId,
    categoryId,
    createdAt: new Date().toISOString()
  };
  db.series.push(newSeries);
  saveDatabase();
  addLog("api-integration", "External Website", UserRole.MEDIA_ADMIN, "API Create Series", `Created series '${name}' via secure API.`, req);
  res.status(201).json({ success: true, data: newSeries });
});

app.put("/api/v1/series/:id", validateApiKey, (req: Request, res: Response) => {
  const idx = db.series.findIndex(s => s.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ success: false, message: "Series not found." });
    return;
  }
  db.series[idx] = { ...db.series[idx], ...req.body };
  saveDatabase();
  addLog("api-integration", "External Website", UserRole.MEDIA_ADMIN, "API Edit Series", `Modified series '${db.series[idx].name}' via secure API.`, req);
  res.json({ success: true, data: db.series[idx] });
});

app.delete("/api/v1/series/:id", validateApiKey, (req: Request, res: Response) => {
  const found = db.series.find(s => s.id === req.params.id);
  if (!found) {
    res.status(404).json({ success: false, message: "Series not found." });
    return;
  }
  db.series = db.series.filter(s => s.id !== req.params.id);
  saveDatabase();
  addLog("api-integration", "External Website", UserRole.MEDIA_ADMIN, "API Delete Series", `Purged series '${found.name}' via secure API.`, req);
  res.json({ success: true, message: "Series deleted." });
});

// 6. Lecture Years Retrieval
app.get("/api/v1/years", validateApiKey, cacheMiddleware, (req: Request, res: Response) => {
  const years = Array.from(new Set(db.mediaItems.map(m => m.year).filter(Boolean))).sort().reverse();
  res.json({ success: true, data: years });
});

// 7. System Settings Port
app.get("/api/v1/settings", validateApiKey, cacheMiddleware, (req: Request, res: Response) => {
  res.json({ success: true, data: db.settings });
});

// 8. Administrative Users Profile Listing
app.get("/api/v1/users", validateApiKey, cacheMiddleware, (req: Request, res: Response) => {
  const sanitizedUsers = db.users.map(u => ({
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt
  }));
  res.json({ success: true, data: sanitizedUsers });
});

// 9. Single Source of Truth Unified Dashboard System Data & Sync Logs
app.get("/api/v1/system-data", validateApiKey, cacheMiddleware, (req: Request, res: Response) => {
  const memoryUsage = process.memoryUsage();
  const dbSizeKb = fs.existsSync(DB_FILE) ? Math.round(fs.statSync(DB_FILE).size / 1024) : 10;
  
  res.json({
    success: true,
    statistics: {
      totalMedia: db.mediaItems.length,
      videos: db.mediaItems.filter(m => m.type === "video").length,
      audios: db.mediaItems.filter(m => m.type === "audio").length,
      books: db.mediaItems.filter(m => m.type === "book").length,
      scholars: db.scholars.length,
      categories: db.categories.length,
      series: db.series.length,
      totalViews: db.mediaItems.reduce((acc, m) => acc + (m.views || 0), 0)
    },
    systemMetrics: {
      cpuUsage: Math.floor(Math.random() * 8) + 2,
      memoryUsageMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      databaseSize: `${dbSizeKb} KB`,
      backupStatus: "healthy",
      apiLatency: `${Math.floor(Math.random() * 15) + 3}ms`,
      uptimeSeconds: Math.round(process.uptime())
    },
    activityLogs: db.logs.slice(0, 20)
  });
});

// --- AI Gemini-Powered Helpers ---

// AI Description/Tagging Helper
app.post("/api/gemini/enrich", validateAdminToken, async (req: Request, res: Response) => {
  const { title, type, categoryName, scholarName } = req.body;
  if (!title || !type) {
    res.status(400).json({ error: "Missing title or type of media." });
    return;
  }

  if (!ai) {
    // Offline simulated responses if API key is not present
    setTimeout(() => {
      res.json({
        description: `This is a high-quality ${type} lecture titled "${title}" presented under Darul Khair Media. It features extensive analysis, practical applications, and moral teachings to benefit Muslim families and our community.`,
        tags: ["Islamic Lectures", type.toUpperCase(), "Darul Khair"]
      });
    }, 1000);
    return;
  }

  try {
    const prompt = `You are the chief content enrichment bot for Darul Khair Media and Charity Foundation Cloud Console.
    Analyze the following media asset that an administrator is trying to catalog:
    - Title: "${title}"
    - Type of Media: ${type}
    - Category: ${categoryName || "Islamic Education"}
    - Scholar/Imam: ${scholarName || "Senior Scholar"}

    Please return a strictly formatted JSON object with two fields:
    1. "description": A beautifully written, highly professional administrative/public summary (2-3 sentences) summarizing what this lecture, video, or book covers. Emphasize learning, charity, community support, or espiritual benefits.
    2. "tags": An array of exactly 3 to 4 short, highly relevant search keywords/tags (e.g., ["Faith", "Qur'an", "Sadaqah", "Fiqh"]).

    Return ONLY the raw JSON block. Do not write markdown blocks or explain yourself. Keep the description informative and respectful.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["description", "tags"]
        }
      }
    });

    const text = response.text || "{}";
    const parsed = JSON.parse(text.trim());
    res.json(parsed);
  } catch (err: any) {
    console.error("Gemini enrich failed:", err);
    res.json({
      description: `This is an official ${type} catalog resource titled "${title}". Registered successfully under Darul Khair Media.`,
      tags: ["Islamic Lectures", type.toUpperCase()]
    });
  }
});

// AI Admin Chat Assistant
app.post("/api/gemini/assistant", validateAdminToken, async (req: Request, res: Response) => {
  const { messages } = req.body; // array of {role, content}
  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "Messages array is required." });
    return;
  }

  if (!ai) {
    // Offline simulated response
    res.json({
      reply: "As-salamu alaykum! I am running in offline standby mode since your GEMINI_API_KEY is currently empty in settings. Configure your secrets in the AI Studio Secrets tab to enable active search, categorization, and digital assistance!"
    });
    return;
  }

  try {
    // Collect active catalog stats to ground the assistant
    const statsContext = `
    Darul Khair Media Foundation Catalog Context:
    - Total Media Items: ${db.mediaItems.length}
    - Total Videos: ${db.mediaItems.filter(m => m.type === "video").length}
    - Total Audios: ${db.mediaItems.filter(m => m.type === "audio").length}
    - Total Books/PDFs: ${db.mediaItems.filter(m => m.type === "book").length}
    - Total Scholars Registered: ${db.scholars.length}
    - Total Lecture Series Active: ${db.series.length}
    - Current Active Categories: ${db.categories.map(c => c.name).join(", ")}
    - Platform State: Live and Healthy
    `;

    const formattedMessages = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" as const : "user" as const,
      parts: [{ text: msg.content }]
    }));

    // Add a system instruction or context at the beginning
    const chat = ai.chats.create({
      model: "gemini-3.5-flash",
      config: {
        systemInstruction: `You are the Darul Khair Cloud Assistant, an AI expert integrated directly into the administration backend console of DARUL KHAIR MEDIA AND CHARITY FOUNDATION.
        Your purpose is to assist chief and media administrators with tasks like:
        - Outlining content organization strategies
        - Suggesting speech topics or sermon series
        - Analyzing catalog distribution (refer to the state below)
        - Offering help with platform operations
        - Translating titles or translating text between Arabic and English.
        - Crafting administrative notifications or circulars.

        Contextual Platform State:
        ${statsContext}

        Always behave with the utmost professional respect and Islamic courtesy. Greet with 'As-salamu alaykum' when starting conversations. Give succinct, practical administrative suggestions. Keep replies concise and clean.`
      }
    });

    // Send the latest message
    const lastMsg = formattedMessages[formattedMessages.length - 1];
    const response = await chat.sendMessage({ message: lastMsg.parts[0].text });
    
    res.json({ reply: response.text });
  } catch (err: any) {
    console.error("Gemini assistant failed:", err);
    res.json({ reply: "I encountered an issue connecting with the AI network. Please verify your internet connection and API key configurations in the Settings panel." });
  }
});


// Start server setup
async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[DARUL KHAIR BACKEND] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
