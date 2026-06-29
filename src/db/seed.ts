import { User, UserRole, Scholar, Category, Series, MediaItem, MediaStatus, SystemSettings, ActivityLog } from "../types.js";

export const initialUsers: User[] = [
  {
    id: "user-1",
    username: "chief_admin",
    name: "Dr. Yakubu",
    email: "darulkhair6039@gmail.com",
    role: UserRole.CHIEF_ADMIN,
    isActive: true,
    createdAt: "2026-01-15T09:00:00Z"
  },
  {
    id: "user-2",
    username: "media_admin_1",
    name: "Brother Abdul-Basit",
    email: "abdulbasit@darulkhair.org",
    role: UserRole.MEDIA_ADMIN,
    isActive: true,
    createdAt: "2026-02-10T11:30:00Z"
  }
];

export const initialScholars: Scholar[] = [
  {
    id: "scholar-1",
    name: "Dr. Ismail Abdul-Hameed",
    bio: "Chief Imam of Darul Khair Islamic Center. PhD in Islamic Jurisprudence from the Islamic University of Madinah. Specializes in Usul al-Fiqh and Contemporary Fatawa.",
    photoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250",
    language: "Arabic / English",
    isActive: true,
    createdAt: "2026-01-01T12:00:00Z"
  },
  {
    id: "scholar-2",
    name: "Sheikh Muhammad Al-Mansoor",
    bio: "Senior Lecturer in Hadith Sciences and Qur'anic Exegesis (Tafseer). Over 25 years of experience teaching classical Islamic texts across the globe.",
    photoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=250",
    language: "English / Hausa",
    isActive: true,
    createdAt: "2026-01-05T14:20:00Z"
  },
  {
    id: "scholar-3",
    name: "Ustadh Ibrahim Jalo",
    bio: "Graduate of the Faculty of Shariah. Renowned for his engaging presentations on character development, youth guidance, and Islamic history.",
    photoUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=250",
    language: "English",
    isActive: true,
    createdAt: "2026-02-01T10:00:00Z"
  }
];

export const initialCategories: Category[] = [
  {
    id: "cat-1",
    name: "Tafseer (Qur'an Commentary)",
    description: "Detailed verse-by-verse explanation and practical wisdom of the Holy Qur'an.",
    slug: "tafseer",
    createdAt: "2026-01-01T10:00:00Z"
  },
  {
    id: "cat-2",
    name: "Fiqh & Shariah Rules",
    description: "Islamic jurisprudence covering acts of worship (Ibadat) and transactional laws (Muamalat).",
    slug: "fiqh",
    createdAt: "2026-01-02T10:00:00Z"
  },
  {
    id: "cat-3",
    name: "Seerah & History",
    description: "The life of Prophet Muhammad (PBUH) and structural history of the Islamic civilization.",
    slug: "seerah-history",
    createdAt: "2026-01-03T10:00:00Z"
  },
  {
    id: "cat-4",
    name: "Charity & Community Affairs",
    description: "Zakat, Sadaqah, humanitarian assistance, and volunteer guidance for Muslims.",
    slug: "charity-community",
    createdAt: "2026-01-04T10:00:00Z"
  },
  {
    id: "cat-5",
    name: "Character & Purification (Tazkiyah)",
    description: "Nurturing spiritual excellence, manners (Akhlaq), and cleansing the soul from societal vices.",
    slug: "tazkiyah",
    createdAt: "2026-01-05T10:00:00Z"
  }
];

export const initialSeries: Series[] = [
  {
    id: "series-1",
    name: "Ramadan Tafseer 1447 AH",
    description: "Annual intensive Qur'an explanation focusing on Surah Al-An'am and Surah Al-A'raf.",
    scholarId: "scholar-1",
    categoryId: "cat-1",
    createdAt: "2026-03-01T08:00:00Z"
  },
  {
    id: "series-2",
    name: "Friday Khutbah Essentials 2026",
    description: "Compilation of powerful Friday sermons addressing modern socio-economic challenges.",
    scholarId: "scholar-2",
    categoryId: "cat-4",
    createdAt: "2026-01-10T13:00:00Z"
  },
  {
    id: "series-3",
    name: "Fiqh of Worship: Daily Practicals",
    description: "A comprehensive video guide to perfection in purification, prayers, and fasting.",
    scholarId: "scholar-3",
    categoryId: "cat-2",
    createdAt: "2026-02-15T15:00:00Z"
  }
];

export const initialMediaItems: MediaItem[] = [
  // Videos
  {
    id: "media-1",
    title: "The Purpose of Life: Foundations of Faith",
    description: "An inspiring modern lecture outlining our structural responsibility on earth, aligning faith with actions and volunteerism for global humanitarian support.",
    type: "video",
    mediaUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    coverUrl: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&q=80&w=600",
    scholarId: "scholar-1",
    categoryId: "cat-5",
    seriesId: "series-2",
    year: "2026",
    tags: ["Faith", "Humanitarianism", "Imaan"],
    status: MediaStatus.PUBLISHED,
    views: 1245,
    createdAt: "2026-03-12T14:30:00Z",
    updatedAt: "2026-03-12T14:30:00Z"
  },
  {
    id: "media-2",
    title: "Ramadan Tafseer 1447 - Session 1",
    description: "Deep analytical commentary of the first 20 verses of Surah Al-An'am, exploring creationism and core monotheism.",
    type: "video",
    mediaUrl: "https://www.youtube.com/watch?v=Yp69G6FqWl4",
    coverUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600",
    scholarId: "scholar-1",
    categoryId: "cat-1",
    seriesId: "series-1",
    year: "2026",
    tags: ["Ramadan", "Tafseer", "Surah Al-An'am"],
    status: MediaStatus.PUBLISHED,
    views: 890,
    createdAt: "2026-03-25T16:00:00Z",
    updatedAt: "2026-03-25T16:00:00Z"
  },
  {
    id: "media-3",
    title: "Zakat Rules & Modern Business",
    description: "Practical Shariah seminar clarifying asset valuations, cryptocurrency, stocks, and business inventory taxes.",
    type: "video",
    mediaUrl: "https://www.youtube.com/watch?v=8V7ZfU9mSok",
    coverUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=600",
    scholarId: "scholar-2",
    categoryId: "cat-2",
    year: "2025",
    tags: ["Zakat", "Business", "Fiqh", "Finance"],
    status: MediaStatus.PUBLISHED,
    views: 2400,
    createdAt: "2025-11-05T09:15:00Z",
    updatedAt: "2025-11-05T09:15:00Z"
  },
  // Audio
  {
    id: "media-4",
    title: "The Biography of Prophet Muhammad (PBUH) - Episode 1",
    description: "Understanding the geopolitical landscape of Arabia prior to the birth of the Prophet, and the spiritual darkness that was lifted.",
    type: "audio",
    mediaUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    coverUrl: "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&q=80&w=600",
    scholarId: "scholar-2",
    categoryId: "cat-3",
    year: "2026",
    tags: ["Prophetic Life", "Arabia", "Seerah"],
    status: MediaStatus.PUBLISHED,
    views: 3120,
    downloads: 1450,
    fileSize: "28.4 MB",
    duration: "42:15",
    createdAt: "2026-01-20T18:00:00Z",
    updatedAt: "2026-01-20T18:00:00Z"
  },
  {
    id: "media-5",
    title: "Purification of the Heart from Envy",
    description: "Detailed psycho-spiritual audio lecture discussing the toxic nature of Hasad (envy) and tools from the Qur'an to foster contentment.",
    type: "audio",
    mediaUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    coverUrl: "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?auto=format&fit=crop&q=80&w=600",
    scholarId: "scholar-3",
    categoryId: "cat-5",
    year: "2026",
    tags: ["Spiritual Ethics", "Heart", "Manners"],
    status: MediaStatus.PUBLISHED,
    views: 1560,
    downloads: 620,
    fileSize: "18.1 MB",
    duration: "30:45",
    createdAt: "2026-02-18T10:45:00Z",
    updatedAt: "2026-02-18T10:45:00Z"
  },
  // Books (PDFs)
  {
    id: "media-6",
    title: "Darul Khair Handbook on Zakat Calculation",
    description: "An official step-by-step PDF compilation detailing formulas, thresholds, and categories of modern wealth eligible for charity distributions.",
    type: "book",
    mediaUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    coverUrl: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=600",
    scholarId: "scholar-1",
    categoryId: "cat-4",
    year: "2026",
    tags: ["Zakat", "Charity", "Book", "Guide"],
    status: MediaStatus.PUBLISHED,
    views: 5200,
    downloads: 3240,
    fileSize: "4.2 MB",
    createdAt: "2026-02-28T11:00:00Z",
    updatedAt: "2026-02-28T11:00:00Z"
  },
  {
    id: "media-7",
    title: "Classical Islamic Fiqh Simplified",
    description: "A digital textbook translating fundamental Hanbali and Shafi'i legal summaries regarding Wudu, Salah, Janazah, and social contracts.",
    type: "book",
    mediaUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    coverUrl: "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&q=80&w=600",
    scholarId: "scholar-3",
    categoryId: "cat-2",
    seriesId: "series-3",
    year: "2025",
    tags: ["Fiqh", "Salah", "E-Book"],
    status: MediaStatus.PUBLISHED,
    views: 4120,
    downloads: 1980,
    fileSize: "12.8 MB",
    createdAt: "2025-10-12T15:30:00Z",
    updatedAt: "2025-10-12T15:30:00Z"
  }
];

export const initialSettings: SystemSettings = {
  siteName: "Darul Khair Media Cloud",
  maintenanceMode: false,
  publicUploadAllowed: false,
  autoBackupInterval: "daily",
  geminiEnrichmentEnabled: true,
  apiKeyForClient: "dk_live_key_9281a82e811c"
};

export const initialLogs: ActivityLog[] = [
  {
    id: "log-1",
    userId: "user-1",
    username: "chief_admin",
    userRole: UserRole.CHIEF_ADMIN,
    action: "System Initialization",
    details: "Initialized Darul Khair Cloud Platform backend. Loaded primary repositories and active catalogs.",
    ipAddress: "192.168.1.50",
    timestamp: "2026-06-29T10:00:00Z"
  },
  {
    id: "log-2",
    userId: "user-1",
    username: "chief_admin",
    userRole: UserRole.CHIEF_ADMIN,
    action: "Create Scholar Profile",
    details: "Registered scholar: Dr. Ismail Abdul-Hameed",
    ipAddress: "192.168.1.50",
    timestamp: "2026-06-29T11:15:00Z"
  },
  {
    id: "log-3",
    userId: "user-2",
    username: "media_admin_1",
    userRole: UserRole.MEDIA_ADMIN,
    action: "Publish Video Lecture",
    details: "Uploaded and published 'The Purpose of Life: Foundations of Faith' video.",
    ipAddress: "192.168.1.102",
    timestamp: "2026-06-29T14:30:00Z"
  }
];
