export enum UserRole {
  CHIEF_ADMIN = "CHIEF_ADMIN",
  MEDIA_ADMIN = "MEDIA_ADMIN"
}

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface Scholar {
  id: string;
  name: string;
  bio: string;
  photoUrl: string;
  language: string;
  isActive: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  slug: string;
  createdAt: string;
}

export interface Series {
  id: string;
  name: string;
  description: string;
  scholarId: string;
  categoryId: string;
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
}

export enum MediaStatus {
  PUBLISHED = "PUBLISHED",
  ARCHIVED = "ARCHIVED",
  DRAFT = "DRAFT"
}

export interface MediaItem {
  id: string;
  title: string;
  description: string;
  type: "video" | "audio" | "book";
  mediaUrl: string; // url to video link (YouTube/Vimeo), audio link (Mp3/Cloud), or PDF URL
  coverUrl: string;
  scholarId: string;
  categoryId: string;
  seriesId?: string;
  year: string;
  tags: string[];
  status: MediaStatus;
  views: number;
  downloads?: number;
  fileSize?: string; // e.g. "15.4 MB" or "124 MB"
  duration?: string; // e.g. "45:12" for audio/video
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  username: string;
  userRole: UserRole;
  action: string; // e.g. "Create Video", "Delete Book", "Backup Restored"
  details: string; // e.g. "Uploaded 'Surah Al-Mulk Tafseer' video"
  ipAddress: string;
  timestamp: string;
}

export interface BackupItem {
  id: string;
  filename: string;
  createdAt: string;
  fileSize: string;
  itemCounts: {
    videos: number;
    audio: number;
    books: number;
    scholars: number;
  };
}

export interface SystemSettings {
  siteName: string;
  maintenanceMode: boolean;
  publicUploadAllowed: boolean;
  autoBackupInterval: string; // "daily", "weekly", "none"
  geminiEnrichmentEnabled: boolean;
  apiKeyForClient: string;
}

export interface SystemHealth {
  cpuUsage: number;
  memoryUsage: number;
  databaseSize: string;
  backupStatus: "healthy" | "warning" | "failing";
  apiLatency: string;
  uptime: string;
}
