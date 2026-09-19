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
  enableGlints: boolean;
  enableJobstreet: boolean;
  enableLinkedin: boolean;
  enableIndeed: boolean;
  indeedNoJobTitleFilter?: boolean;
  debugTest: boolean;
  concurrency: number;
  useSystemChrome?: boolean;
  customChromePath?: string;
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
  enableHumanStealth?: boolean;
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
  enableGlints: true,
  enableJobstreet: true,
  enableLinkedin: true,
  enableIndeed: true,
  indeedNoJobTitleFilter: false,
  debugTest: true,
  concurrency: 3,
  useSystemChrome: true,
  customChromePath: '',
  enableCoverLetterGen: true,
  enableJobMatchFilter: false,
  minMatchScore: 60,
  negativeKeywords: 'mandarin, japanese, 10+ years, sales lapangan',
  enableHumanStealth: true,
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
  aiProvider: 'gemini',
  geminiApiKey: '',
  customAiBaseUrl: 'https://api.9router.com/v1',
  customAiApiKey: '',
  customAiModel: 'google/gemini-2.5-flash',
  activeAiEndpointId: 'ep-gemini',
  aiEndpoints: [
    {
      id: 'ep-gemini',
      name: 'Google Gemini (Official)',
      type: 'gemini',
      baseUrl: '',
      apiKey: '',
      model: 'gemini-2.5-flash',
      isActive: true,
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
