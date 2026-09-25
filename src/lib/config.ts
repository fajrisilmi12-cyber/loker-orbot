import fs from 'fs';
import path from 'path';

export interface AiEndpointConfig {
  id: string;
  name: string;
  type: 'gemini' | 'openai_compatible';
  baseUrl: string;
  apiKey: string;
  model: string;
  isActive?: boolean;
}

export interface BrowserProfileAccount {
  id: string;
  name: string; // Misal: "Akun Utama Yoga", "Akun Cadangan 2"
  profileFolder: string; // automation-profile, automation-profile-2
  createdAt: string;
}

export interface AppConfig {
  storageType?: 'sqlite' | 'json' | 'sheets';
  spreadsheetId: string;
  sheetName: string;
  googleCredentialsJson: string;
  searchKeywords: string;
  location: string;
  minSalary: string;
  limitPerDay: number;
  limitMode?: 'shared' | 'per_platform';
  limitGlints?: number;
  limitJobstreet?: number;
  limitLinkedin?: number;
  limitIndeed?: number;
  limitPintarnya?: number;
  enableGlints: boolean;
  enableJobstreet: boolean;
  enableLinkedin: boolean;
  enableIndeed: boolean;
  enablePintarnya: boolean;
  pintarnyaToken?: string;
  pintarnyaKeyword?: string;
  indeedNoJobTitleFilter?: boolean;
  debugTest: boolean;
  concurrency: number;
  useSystemChrome?: boolean;
  customChromePath?: string;
  browserEngine?: 'puppeteer' | 'camoufox';
  noticePeriod: string;
  // Candidate Profile Fields
  fullName: string;
  email?: string;            // Email pelamar
  gender?: string;           // 'Laki-laki' | 'Perempuan'
  maritalStatus?: string;    // 'Single' | 'Menikah'
  dateOfBirth?: string;      // Format YYYY-MM-DD
  postalCode?: string;       // Kode pos domisili
  expectedSalary: number;
  educationLevel: string;
  gpa: string;
  yearsOfExperience: number;
  skills: string;
  portfolioUrl: string;
  githubUrl: string;
  linkedinUrl: string;
  phoneNumber: string;
  domicile: string;
  address?: string;          // Alamat lengkap / jalan / RT RW
  aboutMe?: string;          // Ringkasan profil / deskripsi bio pelamar
  // Uploaded CV Document Information
  cvFileName?: string;
  cvFilePath?: string;
  cvExtractedText?: string;
  cvAnalyzedAt?: string;
  // AI Gateway & Providers
  aiProvider?: 'gemini' | 'custom_router';
  geminiApiKey?: string;
  customAiBaseUrl?: string;
  customAiApiKey?: string;
  customAiModel?: string;
  // Multi-Provider AI Endpoints List (Bisa ditambah tanpa batas)
  aiEndpoints?: AiEndpointConfig[];
  activeAiEndpointId?: string;
  // Multi-Account Browser Profiles (Bisa tambah profil browser akun)
  browserAccounts?: BrowserProfileAccount[];
  activeBrowserAccountId?: string;
  // Enterprise Features
  enableCoverLetterGen?: boolean;
  enableJobMatchFilter?: boolean;
  minMatchScore?: number;
  negativeKeywords?: string;
  blacklistedCompanies?: string;
  autoApplyMode?: 'auto' | 'review';
  enableHumanStealth?: boolean;
  // Advanced Search Filters
  datePosted?: '24h' | 'week' | 'month' | '';
  jobType?: string[];
  workMode?: string[];
  experienceLevel?: string[];
  // Portal Session Cookies (Imported from user's main browser or companion extension)
  portalCookies?: {
    linkedin?: string;
    indeed?: string;
    glints?: string;
    jobstreet?: string;
  };
}

const CONFIG_PATH = path.join(process.cwd(), 'config.json');

const DEFAULT_CONFIG: AppConfig = {
  storageType: 'sqlite',
  spreadsheetId: '',
  sheetName: 'Sheet1',
  googleCredentialsJson: '',
  searchKeywords: '',
  location: '',
  minSalary: '',
  limitPerDay: 200,
  limitMode: 'shared',
  limitGlints: 80,
  limitJobstreet: 75,
  limitLinkedin: 50,
  limitIndeed: 50,
  limitPintarnya: 50,
  enableGlints: true,
  enableJobstreet: true,
  enableLinkedin: true,
  enableIndeed: true,
  enablePintarnya: false,
  pintarnyaToken: '',
  pintarnyaKeyword: '',
  indeedNoJobTitleFilter: false,
  debugTest: false,
  concurrency: 3,
  useSystemChrome: true,
  customChromePath: '',
  browserEngine: 'puppeteer',
  enableCoverLetterGen: true,
  enableJobMatchFilter: false,
  minMatchScore: 60,
  negativeKeywords: 'magang, intern, unpaid, sales lapangan, mandarin',
  blacklistedCompanies: '',
  autoApplyMode: 'auto',
  enableHumanStealth: true,
  datePosted: '',
  jobType: ['full_time', 'part_time'],
  workMode: ['hybrid', 'remote'],
  experienceLevel: ['fresh', '1-3'],
  noticePeriod: 'Immediately',
  fullName: '',
  email: '',
  gender: 'Laki-laki',
  maritalStatus: 'Single',
  dateOfBirth: '',
  postalCode: '',
  expectedSalary: 5000000,
  educationLevel: 'Sarjana (S1)',
  gpa: '',
  yearsOfExperience: 1,
  skills: '',
  portfolioUrl: '',
  githubUrl: '',
  linkedinUrl: '',
  phoneNumber: '',
  domicile: '',
  address: '',
  cvFileName: '',
  cvFilePath: '',
  cvExtractedText: '',
  cvAnalyzedAt: '',
  aiProvider: 'custom_router',
  geminiApiKey: '',
  customAiBaseUrl: 'https://api.9router.com/v1',
  customAiApiKey: '',
  customAiModel: 'google/gemini-2.5-flash',
  activeAiEndpointId: 'mona-agy',
  aiEndpoints: [
    {
      id: 'mona-agy',
      name: 'Mona AGY',
      type: 'openai_compatible',
      baseUrl: 'http://100.84.69.123:8801/v1',
      apiKey: '',
      model: 'AGY',
      isActive: true,
    },
    {
      id: 'ep-gemini',
      name: 'Google Gemini (Official)',
      type: 'gemini',
      baseUrl: '',
      apiKey: '',
      model: 'gemini-2.5-flash',
      isActive: false,
    },
    {
      id: 'ep-9router',
      name: '9Router AI Gateway',
      type: 'openai_compatible',
      baseUrl: 'https://api.9router.com/v1',
      apiKey: '',
      model: 'google/gemini-2.5-flash',
      isActive: false,
    }
  ],
  activeBrowserAccountId: 'account-1',
  browserAccounts: [
    {
      id: 'account-1',
      name: 'Akun Utama',
      profileFolder: 'automation-profile',
      createdAt: '2026-09-19',
    },
  ],
};

export function getConfig(): AppConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('Error reading config:', error);
  }
  return DEFAULT_CONFIG;
}

export function saveConfig(config: Partial<AppConfig>): AppConfig {
  try {
    const current = getConfig();
    const updated = { ...current, ...config };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf8');
    return updated;
  } catch (error) {
    console.error('Error writing config:', error);
    throw new Error('Failed to save configuration');
  }
}
