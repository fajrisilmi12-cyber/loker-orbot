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
  noticePeriod: 'Immediately',
  fullName: 'Yoga Adi Saputra',
  expectedSalary: 8000000,
  educationLevel: 'Sarjana (S1)',
  gpa: '3.75',
  yearsOfExperience: 3,
  skills: 'JavaScript, TypeScript, Python, Java, C#, C++, PHP, Go, HTML, CSS, React, React.js, Next.js, Angular, Angular.js, Tailwind CSS, Bootstrap, jQuery, Framer Motion, Three.js, React Three Fiber, Drei, Node.js, Express.js, Fiber, GORM, REST API, RESTful API, Redis, RabbitMQ, Celery, Asynq, Message Queue, Kafka, PostgreSQL, MySQL, Supabase, Prisma, SQL, Docker, Nginx, PM2, Git, GitHub, GitHub Actions, Cloudflare, Let\'s Encrypt, Certbot, CI/CD, Postman, VS Code, Full Stack Development, Backend Development, Frontend Development, Web Development, API Development, Database Design, Microservices, Object-Oriented Programming, Asynchronous Programming, Blender, TouchDesigner, MediaPipe, Figma, ClickUp, Jira, Trello, Slack, Notion, Agile, Scrum, Problem Solving, Debugging',
  portfolioUrl: 'https://github.com/yogaadi',
  githubUrl: 'https://github.com/yogaadi',
  linkedinUrl: 'https://www.linkedin.com',
  phoneNumber: '081234567890',
  domicile: 'Jakarta Selatan, DKI Jakarta',
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
