'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  Database,
  Terminal,
  History,
  Play,
  Square,
  KeyRound,
  ExternalLink,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Edit3,
  Globe,
  FileSpreadsheet,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  ShieldCheck,
  Check,
  Sun,
  Moon,
  Upload,
  FileUp,
  Download,
  FileJson,
  FileText,
  Bot,
  Users,
  UserCheck,
  ShieldAlert,
  FolderOpen,
  Eye,
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  BookmarkPlus,
  Clock,
  X,
  RotateCcw,
  Sliders,
  Settings2,
  Briefcase,
  Filter,
  MapPin,
  Tag,
  Info,
  Lightbulb,
  Search,
  Copy,
  Target
} from 'lucide-react';
import { OnboardingTour } from '@/components/OnboardingTour';
import BatchQuestionModal from '@/components/BatchQuestionModal';
import JobsTab from '@/components/JobsTab';
import TalentScoutTab from '@/components/TalentScoutTab';

export interface BrowserProfileAccount {
  id: string;
  name: string;
  profileFolder: string;
  createdAt: string;
}

interface AiEndpointConfig {
  id: string;
  name: string;
  type: 'gemini' | 'openai_compatible';
  baseUrl: string;
  apiKey: string;
  model: string;
  isActive?: boolean;
}

interface AppConfig {
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
  enableLinkedin?: boolean;
  enableIndeed?: boolean;
  indeedNoJobTitleFilter?: boolean;
  debugTest: boolean;
  concurrency: number;
  useSystemChrome?: boolean;
  customChromePath?: string;
  noticePeriod?: string;
  fullName?: string;
  email?: string;
  gender?: string;
  maritalStatus?: string;
  dateOfBirth?: string;
  postalCode?: string;
  expectedSalary?: number;
  educationLevel?: string;
  gpa?: string;
  yearsOfExperience?: number;
  skills?: string;
  portfolioUrl?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  phoneNumber?: string;
  domicile?: string;
  address?: string;
  cvFileName?: string;
  cvFilePath?: string;
  cvExtractedText?: string;
  cvAnalyzedAt?: string;
  aiProvider?: 'gemini' | 'custom_router';
  geminiApiKey?: string;
  customAiBaseUrl?: string;
  customAiApiKey?: string;
  customAiModel?: string;
  aiEndpoints?: AiEndpointConfig[];
  activeAiEndpointId?: string;
  browserAccounts?: BrowserProfileAccount[];
  activeBrowserAccountId?: string;
  enableCoverLetterGen?: boolean;
  enableJobMatchFilter?: boolean;
  minMatchScore?: number;
  negativeKeywords?: string;
  blacklistedCompanies?: string;
  autoApplyMode?: 'auto' | 'review';
  enableHumanStealth?: boolean;
  portalCookies?: {
    linkedin?: string;
    indeed?: string;
    glints?: string;
    jobstreet?: string;
  };
  // Search Filters
  datePosted?: '' | '24h' | 'week' | 'month';
  jobType?: string[];        // 'full_time' | 'part_time' | 'contract' | 'internship' | 'freelance'
  workMode?: string[];       // 'onsite' | 'hybrid' | 'remote'
  experienceLevel?: string[]; // 'fresh' | '1-3' | '3-5' | '5+'
  // EEO / Work Authorization
  citizenshipStatus?: string;
  visaRequired?: boolean;
  disabilityStatus?: 'yes' | 'no' | 'prefer_not_to_say';
  veteranStatus?: 'yes' | 'no' | 'prefer_not_to_say';
}

interface AppliedJob {
  company: string;
  title: string;
  platform: string;
  jobUrl: string;
  date: string;
  status: string;
  salary?: string;
  location?: string;
  questionsAndAnswers?: Array<{
    question: string;
    answer: string;
    type?: string;
  }>;
}

interface QuestionItem {
  id: string;
  question: string;
  type: string;
  options: string;
  answer: string;
}

interface ConfigPreset {
  id: string;
  name: string;
  savedAt: string; // ISO string
  config: AppConfig;
}

const DRAFT_KEY = 'cv-blaster-draft';
const PRESETS_KEY = 'cv-blaster-presets';

type NavTab = 'wizard' | 'questions' | 'logs' | 'history' | 'jobs' | 'talent';
type WizardStep = 1 | 2 | 3;

export default function Home() {
  const [config, setConfig] = useState<AppConfig>({
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
    blacklistedCompanies: '',
    negativeKeywords: 'magang, intern, unpaid, sales lapangan, mandarin',
    autoApplyMode: 'auto',
    debugTest: true,
    concurrency: 3,
    useSystemChrome: true,
    customChromePath: '',
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
      },
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
    datePosted: '',
    jobType: [],
    workMode: [],
    experienceLevel: [],
    citizenshipStatus: 'WNI',
    visaRequired: false,
    disabilityStatus: 'prefer_not_to_say',
    veteranStatus: 'prefer_not_to_say',
  });

  const [activeTab, setActiveTab] = useState<NavTab>('wizard');
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);

  const [logs, setLogs] = useState<string[]>([]);
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [isSyncingProfile, setIsSyncingProfile] = useState(false);
  const [isSetupBrowserRunning, setIsSetupBrowserRunning] = useState(false);
  const [appliedJobs, setAppliedJobs] = useState<AppliedJob[]>([]);
  const [selectedJobDetail, setSelectedJobDetail] = useState<AppliedJob | null>(null);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Question CSV state
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [rawCsvText, setRawCsvText] = useState('');
  const [csvViewMode, setCsvViewMode] = useState<'table' | 'raw'>('table');
  const [questionSearch, setQuestionSearch] = useState('');
  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null);
  const [isNewQuestionModalOpen, setIsNewQuestionModalOpen] = useState(false);
  const [isBatchAiModalOpen, setIsBatchAiModalOpen] = useState(false);
  const [newQuestionData, setNewQuestionData] = useState<Omit<QuestionItem, 'id'>>({
    question: '',
    type: 'radiobutton',
    options: '',
    answer: '',
  });

  const filteredQuestions = useMemo(() => {
    if (!questionSearch.trim()) return questions;
    const term = questionSearch.toLowerCase();
    return questions.filter((q) =>
      q.question.toLowerCase().includes(term) ||
      q.answer.toLowerCase().includes(term) ||
      q.type.toLowerCase().includes(term) ||
      (q.options && q.options.toLowerCase().includes(term))
    );
  }, [questions, questionSearch]);

  // Multi-Account & Session Status State
  const [isCheckingSessions, setIsCheckingSessions] = useState(false);
  const [sessionStatuses, setSessionStatuses] = useState<Record<string, {
    glints: { loggedIn: boolean; details?: string };
    jobstreet: { loggedIn: boolean; details?: string };
    linkedin: { loggedIn: boolean; details?: string };
    indeed: { loggedIn: boolean; details?: string };
  }>>({});
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [isCookieModalOpen, setIsCookieModalOpen] = useState(false);
  const [cookieTargetPlatform, setCookieTargetPlatform] = useState<'linkedin' | 'indeed' | 'glints' | 'jobstreet'>('linkedin');
  const [rawCookieInput, setRawCookieInput] = useState('');

  // CV Upload & Dynamic Diff Tracking States
  const [shouldUpdateProfileWithCv, setShouldUpdateProfileWithCv] = useState(true);
  const [updatedCvFields, setUpdatedCvFields] = useState<string[]>([]);
  const [unchangedCvFields, setUnchangedCvFields] = useState<string[]>([]);
  const [cvAnalysisSummary, setCvAnalysisSummary] = useState<string>('');
  const [isCvPreviewOpen, setIsCvPreviewOpen] = useState(false);
  const [cvPreviewTab, setCvPreviewTab] = useState<'diff' | 'raw'>('diff');
  const [pendingParsedCv, setPendingParsedCv] = useState<any>(null);
  const [pendingDiffList, setPendingDiffList] = useState<Array<{ field: string; label: string; oldVal: string; newVal: string; willChange: boolean }>>([]);
  const [selectedDiffFields, setSelectedDiffFields] = useState<Set<string>>(new Set());

  // Web Profile Two-Way Sync Import State
  const [detectedWebProfile, setDetectedWebProfile] = useState<any>(null);
  const [isProfileImportModalOpen, setIsProfileImportModalOpen] = useState(false);
  const [isProfileSyncDropdownOpen, setIsProfileSyncDropdownOpen] = useState(false);
  const [selectedWebProfileFields, setSelectedWebProfileFields] = useState<Set<string>>(new Set(['fullName', 'phoneNumber', 'email', 'domicile', 'educationLevel', 'skills']));

  const [themeMode, setThemeMode] = useState<'system' | 'dark' | 'light'>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark');
  const [isMounted, setIsMounted] = useState(false);

  // Preset history state
  const [configPresets, setConfigPresets] = useState<ConfigPreset[]>([]);
  const [isPresetsModalOpen, setIsPresetsModalOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [showSavePresetInput, setShowSavePresetInput] = useState(false);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synchronize theme changes with media query and DOM after mount
  useEffect(() => {
    setIsMounted(true);
    const stored = (localStorage.getItem('theme') as 'system' | 'dark' | 'light') || 'system';
    setThemeMode(stored);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const updateResolvedTheme = (mode: 'system' | 'dark' | 'light') => {
      const isDark = mode === 'system' ? mediaQuery.matches : mode === 'dark';
      setResolvedTheme(isDark ? 'dark' : 'light');
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    updateResolvedTheme(stored);

    const handleChange = () => {
      const currentStored = (localStorage.getItem('theme') as 'system' | 'dark' | 'light') || 'system';
      if (currentStored === 'system') {
        updateResolvedTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Load presets from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRESETS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ConfigPreset[];
        if (Array.isArray(parsed)) setConfigPresets(parsed);
      }
    } catch {}
  }, []);

  // Auto-save draft to localStorage (debounced 800ms)
  useEffect(() => {
    if (!isMounted) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(config));
      } catch {}
    }, 800);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [config, isMounted]);

  // Preset helpers
  const persistPresets = useCallback((list: ConfigPreset[]) => {
    setConfigPresets(list);
    try { localStorage.setItem(PRESETS_KEY, JSON.stringify(list)); } catch {}
  }, []);

  const handleSavePreset = useCallback(() => {
    const name = newPresetName.trim();
    if (!name) { toast.error('Nama preset tidak boleh kosong'); return; }
    setIsSavingPreset(true);
    const preset: ConfigPreset = {
      id: `preset-${Date.now()}`,
      name,
      savedAt: new Date().toISOString(),
      config: { ...config },
    };
    const updated = [preset, ...configPresets];
    persistPresets(updated);
    setNewPresetName('');
    setShowSavePresetInput(false);
    setIsSavingPreset(false);
    toast.success(`Preset "${name}" berhasil disimpan!`);
  }, [newPresetName, config, configPresets, persistPresets]);

  const handleLoadPreset = useCallback(async (preset: ConfigPreset) => {
    const merged = { ...config, ...preset.config };
    setConfig(merged);
    setIsPresetsModalOpen(false);
    toast.success(`Preset "${preset.name}" berhasil dimuat!`);
    
    // Auto sync to backend immediately so refresh won't lose it
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      });
      fetchAppliedHistory();
    } catch {}
  }, [config]);

  const handleOverwritePreset = useCallback((preset: ConfigPreset) => {
    const updated = configPresets.map(p =>
      p.id === preset.id ? { ...p, config: { ...config }, savedAt: new Date().toISOString() } : p
    );
    persistPresets(updated);
    toast.success(`Preset "${preset.name}" berhasil diperbarui!`);
  }, [configPresets, config, persistPresets]);

  const handleDeletePreset = useCallback((preset: ConfigPreset) => {
    if (!confirm(`Hapus preset "${preset.name}"?`)) return;
    persistPresets(configPresets.filter(p => p.id !== preset.id));
    toast.info(`Preset "${preset.name}" dihapus`);
  }, [configPresets, persistPresets]);

  const handleRestoreDraft = useCallback(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) { toast.info('Tidak ada draft tersimpan'); return; }
      const draft = JSON.parse(raw) as AppConfig;
      setConfig(prev => ({ ...prev, ...draft }));
      toast.success('Draft terakhir berhasil dipulihkan!');
    } catch { toast.error('Gagal memuat draft'); }
  }, []);

  const handleToggleTheme = () => {
    let nextMode: 'system' | 'dark' | 'light' = 'system';
    if (themeMode === 'system') {
      nextMode = resolvedTheme === 'dark' ? 'light' : 'dark';
    } else if (themeMode === 'light') {
      nextMode = 'dark';
    } else {
      nextMode = 'system';
    }

    setThemeMode(nextMode);
    localStorage.setItem('theme', nextMode);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const isDark = nextMode === 'system' ? mediaQuery.matches : nextMode === 'dark';
    setResolvedTheme(isDark ? 'dark' : 'light');

    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    const label = nextMode === 'system' ? 'Sistem Browser' : nextMode === 'dark' ? 'Mode Gelap' : 'Mode Terang';
    toast.info(`Tema diubah ke ${label}`);
  };

  const eventSourceRef = useRef<EventSource | null>(null);
  const logTerminalRef = useRef<HTMLDivElement>(null);

  // Calculate setup completion score and granular per-step input progress
  const readinessMetrics = useMemo(() => {
    let completedSteps = 0;
    
    // Step 1: Profil Wajib (Nama, No Telp, Skills)
    const step1Complete = Boolean(
      config.fullName?.trim() &&
      config.skills?.trim() &&
      config.phoneNumber?.trim()
    );

    // Step 1 Detailed Field Progress (15 fields total)
    const step1Fields = [
      { id: 'field-profile-fullname', label: 'Nama Lengkap', isFilled: Boolean(config.fullName?.trim()) },
      { id: 'field-profile-phone', label: 'Nomor Telepon / WhatsApp', isFilled: Boolean(config.phoneNumber?.trim()) },
      { id: 'field-profile-email', label: 'Email Pelamar', isFilled: Boolean((config as any).email?.trim()) },
      { id: 'field-profile-gender', label: 'Jenis Kelamin', isFilled: Boolean((config as any).gender) },
      { id: 'field-profile-marital', label: 'Status Pernikahan', isFilled: Boolean((config as any).maritalStatus) },
      { id: 'field-profile-dob', label: 'Tanggal Lahir', isFilled: Boolean((config as any).dateOfBirth?.trim()) },
      { id: 'field-profile-postal', label: 'Kode Pos Domisili', isFilled: Boolean((config as any).postalCode?.trim()) },
      { id: 'field-profile-salary', label: 'Gaji Bulanan yang Diharapkan', isFilled: Boolean(config.expectedSalary && Number(config.expectedSalary) > 0) },
      { id: 'field-profile-experience', label: 'Pengalaman Kerja', isFilled: Boolean(config.yearsOfExperience !== undefined && config.yearsOfExperience !== null && Number(config.yearsOfExperience) >= 0) },
      { id: 'field-profile-education', label: 'Pendidikan Terakhir', isFilled: Boolean(config.educationLevel?.trim()) },
      { id: 'field-profile-domicile', label: 'Domisili / Kota', isFilled: Boolean(config.domicile?.trim()) },
      { id: 'field-profile-portfolio', label: 'Link Portofolio', isFilled: Boolean(config.portfolioUrl?.trim()) },
      { id: 'field-profile-linkedin', label: 'Link LinkedIn', isFilled: Boolean(config.linkedinUrl?.trim()) },
      { id: 'field-profile-skills', label: 'Daftar Keahlian & Skills', isFilled: Boolean(config.skills?.trim()) },
      { id: 'tour-cv-upload', label: 'Dokumen CV Pelamar', isFilled: Boolean(config.cvFileName?.trim()) },
    ];
    const step1Filled = step1Fields.filter(f => f.isFilled).length;
    const step1Total = step1Fields.length;
    const step1Percent = Math.round((step1Filled / step1Total) * 100);

    // Step 2: Kriteria Target (Kata Kunci + Minimal 1 Platform)
    const hasPlatform = Boolean(config.enableGlints || config.enableJobstreet || config.enableLinkedin || config.enableIndeed);
    const hasKeywords = Boolean(config.searchKeywords?.trim() || config.indeedNoJobTitleFilter);
    const step2Complete = hasKeywords && hasPlatform;

    // Step 2 Detailed Criteria Progress (8 items total)
    const step2Fields = [
      { id: 'tour-criteria-platform', label: 'Platform Loker Aktif', isFilled: hasPlatform },
      { id: 'field-criteria-keywords', label: 'Kata Kunci Lowongan', isFilled: hasKeywords },
      { id: 'field-criteria-location', label: 'Lokasi Kerja', isFilled: Boolean(config.location?.trim()) },
      { id: 'field-criteria-salary', label: 'Filter Gaji Minimal', isFilled: Boolean(config.minSalary?.trim()) },
      { id: 'field-criteria-limit', label: 'Batasan Kuota Harian', isFilled: Boolean(config.limitPerDay && config.limitPerDay > 0) },
      { id: 'field-criteria-autoapplymode', label: 'Mode Eksekusi Lamaran', isFilled: Boolean(config.autoApplyMode) },
      { id: 'tour-smart-features', label: 'Surat Motivasi & Ketik Alami', isFilled: Boolean(config.enableHumanStealth !== undefined || config.enableCoverLetterGen !== undefined) },
      { id: 'field-criteria-blacklist', label: 'Penyaringan & Blacklist Loker', isFilled: Boolean(config.blacklistedCompanies?.trim() || config.negativeKeywords?.trim()) },
    ];
    const step2Filled = step2Fields.filter(f => f.isFilled).length;
    const step2Total = step2Fields.length;
    const step2Percent = Math.round((step2Filled / step2Total) * 100);

    // Step 3: Mesin Siap (Storage Ready + AI Config Ready)
    const hasStorage = Boolean(
      config.storageType === 'sqlite' ||
      config.storageType === 'json' ||
      (config.storageType === 'sheets' && config.spreadsheetId?.trim())
    );
    const hasAiFromEndpoints = Array.isArray(config.aiEndpoints) && config.aiEndpoints.some(ep => ep.apiKey && ep.apiKey.trim());
    const hasAi = Boolean(
      hasAiFromEndpoints ||
      (config.geminiApiKey && config.geminiApiKey.trim()) ||
      (config.customAiApiKey && config.customAiApiKey.trim())
    );
    const step3Complete = hasStorage && hasAi;

    // Step 3 Detailed Engine Progress (4 modules total)
    const step3Fields = [
      { id: 'field-step3-browser', label: 'Pilihan Mesin Browser', isFilled: Boolean(config.useSystemChrome !== undefined) },
      { id: 'field-step3-storage', label: 'Media Penyimpanan Riwayat', isFilled: hasStorage },
      { id: 'field-step3-ai', label: 'Endpoint & Model AI', isFilled: hasAi },
      { id: 'tour-cookie-sync', label: 'Sesi & Akun Job Portal', isFilled: Boolean(config.activeBrowserAccountId || (config.browserAccounts && config.browserAccounts.length > 0)) },
    ];
    const step3Filled = step3Fields.filter(f => f.isFilled).length;
    const step3Total = step3Fields.length;
    const step3Percent = Math.round((step3Filled / step3Total) * 100);

    if (step1Complete) completedSteps++;
    if (step2Complete) completedSteps++;
    if (step3Complete) completedSteps++;

    const percent = Math.round((completedSteps / 3) * 100);
    const isReady100 = completedSteps === 3;

    return {
      step1Complete,
      step1Filled,
      step1Total,
      step1Percent,
      step1Fields,
      step2Complete,
      step2Filled,
      step2Total,
      step2Percent,
      step2Fields,
      step3Complete,
      step3Filled,
      step3Total,
      step3Percent,
      step3Fields,
      completedSteps,
      percent,
      isReady100,
      hasStorage,
      hasAi,
      hasPlatform,
      hasKeywords,
    };
  }, [config]);

  // Lompat dan highlight border otomatis ke input yang belum terisi pada langkah tertentu
  const handleJumpToUnfilledField = useCallback((stepNum: 1 | 2 | 3) => {
    setWizardStep(stepNum);

    const fields = stepNum === 1
      ? readinessMetrics.step1Fields
      : stepNum === 2
      ? readinessMetrics.step2Fields
      : readinessMetrics.step3Fields;

    const firstUnfilled = fields.find(f => !f.isFilled);

    if (!firstUnfilled) {
      toast.success(`Semua input pada Langkah ${stepNum} sudah lengkap! 🎉`, {
        description: 'Semua kolom yang dibutuhkan telah terisi.',
      });
      return;
    }

    toast.info(`Mengarahkan ke: ${firstUnfilled.label}`, {
      description: 'Kolom ini belum terisi. Lengkapi untuk menyempurnakan kesiapan.',
      icon: '🎯',
    });

    setTimeout(() => {
      const el = document.getElementById(firstUnfilled.id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });

        const highlightClasses = [
          'ring-4',
          'ring-orange-500',
          'border-orange-500',
          'bg-orange-500/10',
          'shadow-xl',
          'shadow-orange-500/25',
          'transition-all',
          'duration-500',
          'rounded-2xl',
        ];
        el.classList.add(...highlightClasses);

        const inputEl = el.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
          'input:not([type="hidden"]), select, textarea'
        );
        if (inputEl) {
          inputEl.focus({ preventScroll: true });
        }

        setTimeout(() => {
          el.classList.remove(...highlightClasses);
        }, 2800);
      }
    }, 120);
  }, [readinessMetrics]);

  // Auto scroll logs
  useEffect(() => {
    if (logTerminalRef.current) {
      logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
    }
  }, [logs]);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      if (!res.ok) return;
      const data = await res.json();
      const loaded = data.config || data;
      if (loaded && typeof loaded === 'object') {
        setConfig((prev) => ({ ...prev, ...loaded }));
      }
    } catch {}
  };

  const [activeStorageInfo, setActiveStorageInfo] = useState<string>('');

  const fetchAppliedHistory = async () => {
    try {
      const res = await fetch('/api/applied?refresh=true');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setAppliedJobs(data.data || []);
        if (data.storageInfo) {
          setActiveStorageInfo(data.storageInfo);
        }
      }
    } catch {}
  };

  const handleExportCsv = () => {
    window.open('/api/applied?export=csv', '_blank');
    toast.success('Mengunduh file CSV riwayat lamaran...');
  };

  const handleExportJson = () => {
    if (!appliedJobs.length) {
      toast.error('Belum ada data untuk diekspor');
      return;
    }
    const blob = new Blob([JSON.stringify(appliedJobs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cv-blaster-applied-jobs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('File JSON berhasil diunduh!');
  };

  const checkSetupBrowserStatus = async () => {
    try {
      const res = await fetch('/api/setup-login');
      if (!res.ok) return;
      const data = await res.json();
      setIsSetupBrowserRunning(Boolean(data.isRunning));
    } catch {}
  };

  const fetchQuestions = async () => {
    try {
      const res = await fetch('/api/questions');
      const data = await res.json();
      if (data.success) {
        setQuestions(data.questions || []);
        setRawCsvText(data.rawCsv || '');
      }
    } catch {
      toast.error('Gagal memuat database pertanyaan');
    }
  };

  // Initial load
  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      if (!isMounted) return;
      await fetchConfig();
      await fetchAppliedHistory();
      await fetchQuestions();
      await checkSetupBrowserStatus();
    };
    loadInitialData();

    // Re-check browser status only when user returns to window tab
    const handleFocus = () => {
      checkSetupBrowserStatus();
    };
    window.addEventListener('focus', handleFocus);

    // Light background poll every 15s (only if browser is active or page is visible)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        checkSetupBrowserStatus();
      }
    }, 15000);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, []);

  const handleSaveConfig = async (e?: React.FormEvent, silent = false, validateUpToStep: number = 3): Promise<boolean> => {
    if (e) e.preventDefault();

    // Frontend Validations: Step 1 (Profil Pelamar)
    if (validateUpToStep >= 1) {
      if (!config.fullName?.trim()) {
        toast.error('Validasi Gagal: Nama Lengkap wajib diisi!');
        setWizardStep(1);
        return false;
      }

      if (!config.phoneNumber?.trim()) {
        toast.error('Validasi Gagal: Nomor Telepon wajib diisi!');
        setWizardStep(1);
        return false;
      }

      if (!config.skills?.trim()) {
        toast.error('Validasi Gagal: Daftar Keahlian & Alat Kerja wajib diisi!');
        setWizardStep(1);
        return false;
      }
    }

    // Frontend Validations: Step 2 (Target & Kriteria)
    if (validateUpToStep >= 2) {
      if (config.concurrency < 1 || config.concurrency > 8) {
        toast.error('Validasi Gagal: Worker Konkuren harus antara 1 dan 8 tab!');
        setWizardStep(2);
        return false;
      }

      if (!config.searchKeywords?.trim() && !config.indeedNoJobTitleFilter) {
        toast.error('Validasi Gagal: Kata Kunci Lowongan wajib diisi di Langkah 2!');
        setWizardStep(2);
        return false;
      }
    }

    // Frontend Validations: Step 3 (Kredensial / Engine)
    if (validateUpToStep >= 3) {
      if (config.googleCredentialsJson?.trim()) {
        try {
          JSON.parse(config.googleCredentialsJson);
        } catch {
          toast.error('Format Tidak Valid: Google Credentials JSON harus berupa JSON valid!');
          setWizardStep(3);
          return false;
        }
      }
    }

    setIsSavingConfig(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success) {
        if (!silent) toast.success('Konfigurasi berhasil disimpan');
        fetchAppliedHistory();
        return true;
      } else {
        toast.error(data.error || 'Gagal menyimpan konfigurasi');
        return false;
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat menyimpan';
      toast.error(errorMsg);
      return false;
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleToggleSetupBrowser = async (profileFolder?: string) => {
    try {
      const action = isSetupBrowserRunning ? 'stop' : 'start';
      const res = await fetch('/api/setup-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          profileFolderOverride: profileFolder || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsSetupBrowserRunning(!isSetupBrowserRunning);
        if (action === 'start') {
          toast.success('Jendela Chrome dibuka. Silakan masuk ke akun Anda lalu tutup browser jika selesai.');
        } else {
          toast.info('Jendela browser setup telah ditutup');
        }
      } else {
        toast.error(data.error || 'Gagal memproses jendela browser setup');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Kesalahan jaringan';
      toast.error(msg);
    }
  };

  // Check login sessions for a specific account or the active one
  const handleCheckAccountSessions = async (accountId?: string) => {
    const targetAccId = accountId || config.activeBrowserAccountId || 'account-1';
    const acc = config.browserAccounts?.find(a => a.id === targetAccId) || config.browserAccounts?.[0];
    const folder = acc?.profileFolder || 'automation-profile';

    setIsCheckingSessions(true);
    toast.info(`Memeriksa sesi login untuk "${acc?.name || 'Akun'}"...`);

    try {
      const res = await fetch('/api/check-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileFolder: folder }),
      });
      const data = await res.json();
      if (data.success && data.sessions) {
        setSessionStatuses(prev => ({
          ...prev,
          [targetAccId]: data.sessions,
        }));
        toast.success(`Pengecekan sesi selesai untuk "${acc?.name || 'Akun'}"`);
      } else {
        toast.error(data.error || 'Gagal memeriksa sesi portal');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghubungi server';
      toast.error(msg);
    } finally {
      setIsCheckingSessions(false);
    }
  };

  // Add new browser profile account
  const handleAddNewAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountName.trim()) {
      toast.error('Nama akun tidak boleh kosong');
      return;
    }

    const currentAccounts = config.browserAccounts || [
      { id: 'account-1', name: 'Akun Utama', profileFolder: 'automation-profile', createdAt: '2026-09-19' }
    ];

    const newId = `account-${Date.now()}`;
    const safeFolderName = `automation-profile-${newAccountName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;

    const newAccount: BrowserProfileAccount = {
      id: newId,
      name: newAccountName.trim(),
      profileFolder: safeFolderName,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    const updatedAccounts = [...currentAccounts, newAccount];
    const updatedConfig: AppConfig = {
      ...config,
      browserAccounts: updatedAccounts,
      activeBrowserAccountId: newId, // otomatis aktifkan akun baru
    };

    setConfig(updatedConfig);
    setNewAccountName('');
    setIsAddAccountModalOpen(false);

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedConfig),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Akun "${newAccount.name}" berhasil dibuat & diaktifkan!`);
      }
    } catch {
      toast.error('Gagal menyimpan profil akun baru');
    }
  };

  // Switch active browser account
  const handleSelectActiveAccount = async (accountId: string) => {
    if (config.activeBrowserAccountId === accountId) return;

    const targetAccount = config.browserAccounts?.find(a => a.id === accountId);
    const updatedConfig: AppConfig = {
      ...config,
      activeBrowserAccountId: accountId,
    };

    setConfig(updatedConfig);
    toast.info(`Beralih ke akun "${targetAccount?.name || accountId}"`);

    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedConfig),
      });
    } catch {}
  };

  // Delete an account profile
  const handleDeleteAccount = async (accountId: string) => {
    const currentAccounts = config.browserAccounts || [];
    if (currentAccounts.length <= 1) {
      toast.error('Minimal harus ada satu profil akun');
      return;
    }

    const target = currentAccounts.find(a => a.id === accountId);
    if (!window.confirm(`Hapus akun "${target?.name || accountId}"? Folder sesi tidak akan dihapus dari disk.`)) {
      return;
    }

    const remaining = currentAccounts.filter(a => a.id !== accountId);
    const nextActiveId = config.activeBrowserAccountId === accountId ? remaining[0].id : config.activeBrowserAccountId;

    const updatedConfig: AppConfig = {
      ...config,
      browserAccounts: remaining,
      activeBrowserAccountId: nextActiveId,
    };

    setConfig(updatedConfig);
    toast.success(`Akun "${target?.name}" dihapus`);

    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedConfig),
      });
    } catch {}
  };

  const executeStartBot = (
    mode: 'headless' | 'headful' = 'headless',
    platform: 'all' | 'glints' | 'linkedin' | 'jobstreet' | 'indeed' = 'all',
    customLimit?: number
  ) => {
    if (isBotRunning) return;

    const platText = platform !== 'all' ? platform.toUpperCase() : 'SEMUA PLATFORM';
    setLogs([`[${new Date().toLocaleTimeString()}] Menghubungkan ke Automation Engine (${mode.toUpperCase()} - Target: ${platText})...`]);
    setIsBotRunning(true);
    setActiveTab('logs');
    toast.info(`Memulai bot untuk ${platText} (${mode.toUpperCase()})`);

    let url = `/api/run-bot?mode=${mode}&platform=${platform}`;
    if (customLimit) url += `&limit=${customLimit}`;

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLogs((prev) => [...prev, `[${new Date(data.timestamp).toLocaleTimeString()}] ${data.message}`]);
      } catch (e) {
        console.error(e);
      }
    };

    eventSource.onerror = () => {
      setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Sesi eksekusi selesai.`]);
      setIsBotRunning(false);
      eventSource.close();
      fetchAppliedHistory();
      toast.info('Sesi bot selesai dijalankan');
    };
  };

  const handleStopBot = async () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsBotRunning(false);
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Menghentikan bot...`]);
    try {
      await fetch('/api/run-bot', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Bot berhasil dihentikan.`]);
    fetchAppliedHistory();
    toast.warning('Bot telah dihentikan secara manual');
  };

  const handleSyncProfile = (platform: 'glints' | 'indeed' | 'linkedin' | 'jobstreet' = 'glints') => {
    if (isSyncingProfile || isBotRunning) return;

    const portalNames: Record<string, string> = {
      glints: 'Glints',
      indeed: 'Indeed',
      linkedin: 'LinkedIn',
      jobstreet: 'JobStreet',
    };
    const pName = portalNames[platform] || 'Portal';

    setLogs([`[${new Date().toLocaleTimeString()}] 🚀 Memulai pemeriksaan & sinkronisasi profil akun ${pName}...`]);
    setIsSyncingProfile(true);
    setActiveTab('logs');
    toast.info(`Memulai sinkronisasi profil ${pName} secara otomatis...`);

    const eventSource = new EventSource(`/api/sync-profile?platform=${platform}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'profile_detected' && data.data) {
          setDetectedWebProfile(data.data);
          setIsProfileImportModalOpen(true);
        } else if (data.message) {
          setLogs((prev) => [...prev, `[${new Date(data.timestamp).toLocaleTimeString()}] ${data.message}`]);
        }
      } catch (e) {
        console.error(e);
      }
    };

    eventSource.onerror = () => {
      setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Selesai sinkronisasi profil ${pName}.`]);
      setIsSyncingProfile(false);
      eventSource.close();
      toast.success(`Pemeriksaan profil ${pName} selesai!`);
    };
  };

  const handleApplyWebProfileImport = async () => {
    if (!detectedWebProfile) return;

    const updated = { ...config };
    let importCount = 0;

    if (selectedWebProfileFields.has('fullName') && detectedWebProfile.name) {
      updated.fullName = detectedWebProfile.name;
      importCount++;
    }
    if (selectedWebProfileFields.has('phoneNumber') && detectedWebProfile.phone) {
      updated.phoneNumber = detectedWebProfile.phone;
      importCount++;
    }
    if (selectedWebProfileFields.has('email') && detectedWebProfile.email) {
      updated.email = detectedWebProfile.email;
      importCount++;
    }
    if (selectedWebProfileFields.has('domicile') && detectedWebProfile.location) {
      updated.domicile = detectedWebProfile.location;
      importCount++;
    }
    if (selectedWebProfileFields.has('educationLevel') && detectedWebProfile.education) {
      updated.educationLevel = detectedWebProfile.education;
      importCount++;
    }
    if (selectedWebProfileFields.has('skills') && detectedWebProfile.skills) {
      updated.skills = detectedWebProfile.skills;
      importCount++;
    }

    const portalLabels: Record<string, string> = {
      glints: 'Glints',
      indeed: 'Indeed',
      linkedin: 'LinkedIn',
      jobstreet: 'JobStreet',
    };
    const pLabel = portalLabels[detectedWebProfile.sourcePortal || 'glints'] || 'Portal';

    setConfig(updated);
    setIsProfileImportModalOpen(false);
    toast.success(`Berhasil mengimpor ${importCount} data profil dari akun ${pLabel} ke lemparjaring!`);

    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch {}
  };

  const handleSaveQuestionsList = async (updatedList: QuestionItem[]) => {
    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_all', questions: updatedList }),
      });
      const data = await res.json();
      if (data.success) {
        setQuestions(updatedList);
        toast.success('Database pertanyaan diperbarui');
        fetchQuestions();
      } else {
        toast.error(data.error || 'Gagal menyimpan pertanyaan');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal menyimpan';
      toast.error(msg);
    }
  };

  const handleSaveRawCsv = async () => {
    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_raw', rawCsv: rawCsvText }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('File CSV berhasil diperbarui');
        fetchQuestions();
      } else {
        toast.error(data.error || 'Gagal memperbarui CSV');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal memperbarui';
      toast.error(msg);
    }
  };

  const handleAddNewQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionData.question.trim()) return;

    const newItem: QuestionItem = {
      id: `q-${Date.now()}`,
      question: newQuestionData.question.trim(),
      type: newQuestionData.type,
      options: newQuestionData.options.trim(),
      answer: newQuestionData.answer.trim(),
    };

    const updated = [newItem, ...questions];
    await handleSaveQuestionsList(updated);
    setIsNewQuestionModalOpen(false);
    setNewQuestionData({ question: '', type: 'radiobutton', options: '', answer: '' });
  };

  const handleUpdateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion) return;
    const updated = questions.map((q) => (q.id === editingQuestion.id ? editingQuestion : q));
    await handleSaveQuestionsList(updated);
    setEditingQuestion(null);
  };

  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);

  const handleCsvFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so same file can be re-uploaded if needed
    e.target.value = '';

    // Validasi Frontend: Ekstensi
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Format salah: Hanya file berekstensi .csv yang diizinkan!');
      return;
    }

    // Validasi Frontend: Ukuran Maksimal 5MB
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error(`Ukuran file terlalu besar! Maksimal 5 MB (Ukuran: ${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
      return;
    }

    setIsUploadingCsv(true);
    const toastId = toast.loading(`Mengunggah ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/questions', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'File CSV berhasil diunggah!', { id: toastId });
        fetchQuestions();
      } else {
        toast.error(data.error || 'Gagal mengunggah file CSV', { id: toastId });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi gangguan jaringan saat mengunggah';
      toast.error(msg, { id: toastId });
    } finally {
      setIsUploadingCsv(false);
    }
  };

  const cvFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingCv, setIsUploadingCv] = useState(false);

  const handleCvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';

    const ext = file.name.toLowerCase();
    if (!ext.endsWith('.pdf') && !ext.endsWith('.docx') && !ext.endsWith('.doc')) {
      toast.error('Format tidak didukung: Harap pilih file .pdf atau .docx!');
      return;
    }

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error(`Ukuran file terlalu besar! Maksimal 10 MB (Ukuran: ${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
      return;
    }

    setIsUploadingCv(true);
    const toastId = toast.loading(`Menganalisis dokumen CV "${file.name}" dengan AI...`);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('updateProfile', shouldUpdateProfileWithCv ? 'true' : 'false');

      const res = await fetch('/api/upload-cv', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'File CV berhasil dibaca & dianalisis!', { id: toastId });
        if (data.config) {
          setConfig((prev) => ({ ...prev, ...data.config }));
        }
        if (data.updatedFields) {
          setUpdatedCvFields(data.updatedFields);
        }
        if (data.unchangedFields) {
          setUnchangedCvFields(data.unchangedFields);
        }

        if (data.aiParsed) {
          setPendingParsedCv(data.aiParsed);
          setCvAnalysisSummary(`AI mendeteksi profil: ${data.aiParsed.fullName || ''} (${data.aiParsed.educationLevel || ''}, ${data.aiParsed.yearsOfExperience || 0} thn exp)`);

          // Siapkan perbandingan sebelum vs sesudah
          const diffs = [
            { field: 'fullName', label: 'Nama Lengkap', oldVal: config.fullName || '', newVal: data.aiParsed.fullName || '', willChange: Boolean(data.aiParsed.fullName && data.aiParsed.fullName !== config.fullName) },
            { field: 'email', label: 'Email Pelamar', oldVal: config.email || '', newVal: data.aiParsed.email || '', willChange: Boolean(data.aiParsed.email && data.aiParsed.email !== config.email) },
            { field: 'phoneNumber', label: 'Nomor HP / WhatsApp', oldVal: config.phoneNumber || '', newVal: data.aiParsed.phoneNumber || '', willChange: Boolean(data.aiParsed.phoneNumber && data.aiParsed.phoneNumber !== config.phoneNumber) },
            { field: 'gender', label: 'Jenis Kelamin', oldVal: config.gender || '', newVal: data.aiParsed.gender || '', willChange: Boolean(data.aiParsed.gender && data.aiParsed.gender !== config.gender) },
            { field: 'maritalStatus', label: 'Status Pernikahan', oldVal: config.maritalStatus || '', newVal: data.aiParsed.maritalStatus || '', willChange: Boolean(data.aiParsed.maritalStatus && data.aiParsed.maritalStatus !== config.maritalStatus) },
            { field: 'dateOfBirth', label: 'Tanggal Lahir', oldVal: config.dateOfBirth || '', newVal: data.aiParsed.dateOfBirth || '', willChange: Boolean(data.aiParsed.dateOfBirth && data.aiParsed.dateOfBirth !== config.dateOfBirth) },
            { field: 'domicile', label: 'Domisili', oldVal: config.domicile || '', newVal: data.aiParsed.domicile || '', willChange: Boolean(data.aiParsed.domicile && data.aiParsed.domicile !== config.domicile) },
            { field: 'address', label: 'Alamat Lengkap', oldVal: config.address || '', newVal: data.aiParsed.address || '', willChange: Boolean(data.aiParsed.address && data.aiParsed.address !== config.address) },
            { field: 'educationLevel', label: 'Pendidikan Terakhir', oldVal: config.educationLevel || '', newVal: data.aiParsed.educationLevel || '', willChange: Boolean(data.aiParsed.educationLevel && data.aiParsed.educationLevel !== config.educationLevel) },
            { field: 'gpa', label: 'IPK Terakhir', oldVal: config.gpa || '', newVal: String(data.aiParsed.gpa || ''), willChange: Boolean(data.aiParsed.gpa && String(data.aiParsed.gpa) !== config.gpa) },
            { field: 'yearsOfExperience', label: 'Pengalaman (Tahun)', oldVal: String(config.yearsOfExperience || 0), newVal: String(data.aiParsed.yearsOfExperience ?? ''), willChange: Boolean(data.aiParsed.yearsOfExperience !== undefined && Number(data.aiParsed.yearsOfExperience) !== config.yearsOfExperience) },
            { field: 'skills', label: 'Keahlian / Skills', oldVal: config.skills || '', newVal: data.aiParsed.skills || '', willChange: Boolean(data.aiParsed.skills && data.aiParsed.skills !== config.skills) },
            { field: 'linkedinUrl', label: 'Link LinkedIn', oldVal: config.linkedinUrl || '', newVal: data.aiParsed.linkedinUrl || '', willChange: Boolean(data.aiParsed.linkedinUrl && data.aiParsed.linkedinUrl !== config.linkedinUrl) },
            { field: 'githubUrl', label: 'Link GitHub', oldVal: config.githubUrl || '', newVal: data.aiParsed.githubUrl || '', willChange: Boolean(data.aiParsed.githubUrl && data.aiParsed.githubUrl !== config.githubUrl) },
            { field: 'portfolioUrl', label: 'Link Portofolio', oldVal: config.portfolioUrl || '', newVal: data.aiParsed.portfolioUrl || '', willChange: Boolean(data.aiParsed.portfolioUrl && data.aiParsed.portfolioUrl !== config.portfolioUrl) },
          ];

          setPendingDiffList(diffs);
          // Auto-select fields that will change
          setSelectedDiffFields(new Set(diffs.filter(d => d.willChange).map(d => d.field)));
          setIsCvPreviewOpen(true);
        } else if (!data.aiParsed && data.aiError) {
          toast.warning(`CV terunggah, namun ${data.aiError}. Pastikan API Key di Langkah 3 sudah aktif.`);
        }
      } else {
        toast.error(data.error || 'Gagal mengunggah file CV', { id: toastId });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi gangguan jaringan saat mengunggah CV';
      toast.error(msg, { id: toastId });
    } finally {
      setIsUploadingCv(false);
    }
  };

  // Open existing CV preview modal
  const handleOpenCvPreview = async () => {
    if (!config.cvFileName && !config.cvExtractedText) {
      toast.info('Belum ada file CV yang diunggah.');
      return;
    }

    // Refresh cv info if text is not in state
    if (!config.cvExtractedText) {
      try {
        const res = await fetch('/api/upload-cv');
        const data = await res.json();
        if (data.success && data.cvExtractedText) {
          setConfig(prev => ({ ...prev, cvExtractedText: data.cvExtractedText }));
        }
      } catch {}
    }

    // Siapkan diff jika ada pendingParsedCv atau fallback dari extracted text
    if (pendingParsedCv) {
      const diffs = [
        { field: 'fullName', label: 'Nama Lengkap', oldVal: config.fullName || '', newVal: pendingParsedCv.fullName || '', willChange: Boolean(pendingParsedCv.fullName && pendingParsedCv.fullName !== config.fullName) },
        { field: 'email', label: 'Email Pelamar', oldVal: config.email || '', newVal: pendingParsedCv.email || '', willChange: Boolean(pendingParsedCv.email && pendingParsedCv.email !== config.email) },
        { field: 'phoneNumber', label: 'Nomor HP / WhatsApp', oldVal: config.phoneNumber || '', newVal: pendingParsedCv.phoneNumber || '', willChange: Boolean(pendingParsedCv.phoneNumber && pendingParsedCv.phoneNumber !== config.phoneNumber) },
        { field: 'gender', label: 'Jenis Kelamin', oldVal: config.gender || '', newVal: pendingParsedCv.gender || '', willChange: Boolean(pendingParsedCv.gender && pendingParsedCv.gender !== config.gender) },
        { field: 'maritalStatus', label: 'Status Pernikahan', oldVal: config.maritalStatus || '', newVal: pendingParsedCv.maritalStatus || '', willChange: Boolean(pendingParsedCv.maritalStatus && pendingParsedCv.maritalStatus !== config.maritalStatus) },
        { field: 'dateOfBirth', label: 'Tanggal Lahir', oldVal: config.dateOfBirth || '', newVal: pendingParsedCv.dateOfBirth || '', willChange: Boolean(pendingParsedCv.dateOfBirth && pendingParsedCv.dateOfBirth !== config.dateOfBirth) },
        { field: 'domicile', label: 'Domisili', oldVal: config.domicile || '', newVal: pendingParsedCv.domicile || '', willChange: Boolean(pendingParsedCv.domicile && pendingParsedCv.domicile !== config.domicile) },
        { field: 'address', label: 'Alamat Lengkap', oldVal: config.address || '', newVal: pendingParsedCv.address || '', willChange: Boolean(pendingParsedCv.address && pendingParsedCv.address !== config.address) },
        { field: 'educationLevel', label: 'Pendidikan Terakhir', oldVal: config.educationLevel || '', newVal: pendingParsedCv.educationLevel || '', willChange: Boolean(pendingParsedCv.educationLevel && pendingParsedCv.educationLevel !== config.educationLevel) },
        { field: 'gpa', label: 'IPK Terakhir', oldVal: config.gpa || '', newVal: String(pendingParsedCv.gpa || ''), willChange: Boolean(pendingParsedCv.gpa && String(pendingParsedCv.gpa) !== config.gpa) },
        { field: 'yearsOfExperience', label: 'Pengalaman (Tahun)', oldVal: String(config.yearsOfExperience || 0), newVal: String(pendingParsedCv.yearsOfExperience ?? ''), willChange: Boolean(pendingParsedCv.yearsOfExperience !== undefined && Number(pendingParsedCv.yearsOfExperience) !== config.yearsOfExperience) },
        { field: 'skills', label: 'Keahlian / Skills', oldVal: config.skills || '', newVal: pendingParsedCv.skills || '', willChange: Boolean(pendingParsedCv.skills && pendingParsedCv.skills !== config.skills) },
        { field: 'linkedinUrl', label: 'Link LinkedIn', oldVal: config.linkedinUrl || '', newVal: pendingParsedCv.linkedinUrl || '', willChange: Boolean(pendingParsedCv.linkedinUrl && pendingParsedCv.linkedinUrl !== config.linkedinUrl) },
        { field: 'githubUrl', label: 'Link GitHub', oldVal: config.githubUrl || '', newVal: pendingParsedCv.githubUrl || '', willChange: Boolean(pendingParsedCv.githubUrl && pendingParsedCv.githubUrl !== config.githubUrl) },
        { field: 'portfolioUrl', label: 'Link Portofolio', oldVal: config.portfolioUrl || '', newVal: pendingParsedCv.portfolioUrl || '', willChange: Boolean(pendingParsedCv.portfolioUrl && pendingParsedCv.portfolioUrl !== config.portfolioUrl) },
      ];
      setPendingDiffList(diffs);
      // Auto-select fields that will change
      setSelectedDiffFields(new Set(diffs.filter(d => d.willChange).map(d => d.field)));
    }

    setIsCvPreviewOpen(true);
  };

  // Apply only user-selected fields from CV diff into config state & backend
  const handleApplyPendingCvDiff = async () => {
    if (!pendingParsedCv) {
      toast.info('Tidak ada data baru yang siap diterapkan');
      return;
    }
    if (selectedDiffFields.size === 0) {
      toast.warning('Pilih minimal 1 kolom untuk diterapkan');
      return;
    }

    const appliedUpdates: Partial<AppConfig> = {};
    const newlyUpdated: string[] = [];

    const applyIf = (field: string, value: any, transform?: (v: any) => any) => {
      if (selectedDiffFields.has(field) && value !== undefined && value !== null && value !== '') {
        (appliedUpdates as any)[field] = transform ? transform(value) : value;
        newlyUpdated.push(field);
      }
    };

    applyIf('fullName', pendingParsedCv.fullName);
    applyIf('email', pendingParsedCv.email);
    applyIf('phoneNumber', pendingParsedCv.phoneNumber);
    applyIf('gender', pendingParsedCv.gender);
    applyIf('maritalStatus', pendingParsedCv.maritalStatus);
    applyIf('dateOfBirth', pendingParsedCv.dateOfBirth);
    applyIf('postalCode', pendingParsedCv.postalCode);
    applyIf('domicile', pendingParsedCv.domicile);
    applyIf('address', pendingParsedCv.address);
    applyIf('educationLevel', pendingParsedCv.educationLevel);
    applyIf('gpa', pendingParsedCv.gpa, String);
    applyIf('yearsOfExperience', pendingParsedCv.yearsOfExperience, Number);
    applyIf('skills', pendingParsedCv.skills);
    applyIf('linkedinUrl', pendingParsedCv.linkedinUrl);
    applyIf('githubUrl', pendingParsedCv.githubUrl);
    applyIf('portfolioUrl', pendingParsedCv.portfolioUrl);

    const merged = { ...config, ...appliedUpdates };
    setConfig(merged);
    setUpdatedCvFields(newlyUpdated);
    setIsCvPreviewOpen(false);

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Berhasil menerapkan ${newlyUpdated.length} kolom dari CV ke Formulir!`);
      }
    } catch {
      toast.error('Gagal menyimpan perubahan ke server');
    }
  };

  const [isTestingAi, setIsTestingAi] = useState(false);


  const handleTestAi = async () => {
    setIsTestingAi(true);
    const toastId = toast.loading('Menguji koneksi ke AI...');
    try {
      // Pastikan config tersimpan dulu
      await handleSaveConfig(undefined, true);
      const res = await fetch('/api/test-ai', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(`Berhasil terhubung ke AI! Respon: "${data.reply || data.message}"`, { id: toastId, duration: 4000 });
      } else {
        toast.error(`Gagal: ${data.error || 'AI tidak merespon'}`, { id: toastId, duration: 5000 });
      }
    } catch (err: any) {
      toast.error(`Koneksi error: ${err?.message || err}`, { id: toastId });
    } finally {
      setIsTestingAi(false);
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('Hapus pertanyaan ini dari database CSV?')) return;
    const updated = questions.filter((q) => q.id !== id);
    await handleSaveQuestionsList(updated);
  };

  const handleCleanCsv = async () => {
    try {
      const res = await fetch('/api/clean-csv', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(`${data.message} (${data.count} pertanyaan unik)`);
        fetchQuestions();
      } else {
        toast.error(data.error || data.message);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Gagal membersihkan duplikat';
      toast.error(msg);
    }
  };

  // Helper to check if AI API key or endpoints are actively configured
  const isAiConfigured = () => {
    if (config.geminiApiKey?.trim() && config.geminiApiKey.trim() !== 'your_gemini_api_key_here') return true;
    if (config.customAiApiKey?.trim()) return true;
    if (Array.isArray(config.aiEndpoints) && config.aiEndpoints.some(e => e.apiKey?.trim() && e.apiKey.trim() !== 'your_gemini_api_key_here')) return true;
    return false;
  };

  // Auto-update answers in the CSV database that can be derived from the user's profile
  const handleUpdateQuestionsFromProfile = async (silent = false): Promise<number> => {
    if (questions.length === 0) {
      if (!silent) toast.info('Database kosong');
      return 0;
    }
    const salary = config.expectedSalary || 0;
    const exp = config.yearsOfExperience || 1;
    const name = config.fullName || '';
    const firstName = name.split(' ')[0] || '';
    const cvFile = config.cvFileName || '';

    let updatedCount = 0;
    const updated = questions.map((q) => {
      const qLower = q.question.toLowerCase();
      const opts = q.options ? q.options.split('|').map((o: string) => o.trim()) : [];
      let newAnswer = q.answer;

      // Salary questions
      if (/salary|gaji|expected|diharapkan/i.test(qLower) && opts.length > 0) {
        // Pick closest salary option to user's expected salary
        let closest = opts[0];
        let minDiff = Infinity;
        for (const opt of opts) {
          const nums = opt.match(/[\d.]+/);
          if (nums) {
            const val = parseFloat(nums[0].replace(/\./g, '')) * (/juta|million/i.test(opt) ? 1_000_000 : 1);
            const diff = Math.abs(val - salary);
            if (diff < minDiff) { minDiff = diff; closest = opt; }
          }
        }
        newAnswer = closest;
      }

      // Years of experience questions
      else if (/how many years|berapa tahun|years.*experience|tahun pengalaman/i.test(qLower) && opts.length > 0) {
        let closest = opts[0];
        let minDiff = Infinity;
        for (const opt of opts) {
          const nums = opt.match(/\d+/);
          if (nums) {
            const val = parseInt(nums[0]);
            const diff = Math.abs(val - exp);
            if (diff < minDiff) { minDiff = diff; closest = opt; }
          }
        }
        newAnswer = closest;
      }

      // Resume/CV filename questions — match by user's name
      else if (opts.some((o: string) => /\.pdf|resume|cv/i.test(o))) {
        // Skip "Indeed resume" type
        const indeedOpt = opts.find((o: string) => /use your indeed resume/i.test(o));
        if (indeedOpt) { /* keep as is */ }
        else if (cvFile) {
          const cvMatch = opts.find((o: string) => o.toLowerCase().includes(cvFile.toLowerCase().slice(0, 8)));
          if (cvMatch && !/don't include/i.test(cvMatch)) newAnswer = cvMatch;
        } else if (firstName.length > 2) {
          const nameMatch = opts.find((o: string) => o.toLowerCase().includes(firstName.toLowerCase()) && !/don't include/i.test(o));
          if (nameMatch) newAnswer = nameMatch;
        }
      }

      // Name questions
      else if (/^(your name|nama anda|full name|nama lengkap)/i.test(qLower) && !opts.length && name) {
        newAnswer = name;
      }

      // Domicile / Living questions
      else if (/(?:mana kamu tinggal|tempat tinggal|domisili|dimana kamu tinggal|where do you live|current location)/i.test(qLower) && !opts.length && config.domicile) {
        newAnswer = `Saat ini saya berdomisili di ${config.domicile} (${config.address || config.domicile}) dan siap untuk bekerja baik secara on-site, hybrid, maupun remote.`;
      }

      if (newAnswer !== q.answer) {
        updatedCount++;
        return { ...q, answer: newAnswer };
      }
      return q;
    });

    if (updatedCount === 0) {
      if (!silent) toast.info('Tidak ada jawaban yang perlu diperbarui dari profil saat ini');
      return 0;
    }
    await handleSaveQuestionsList(updated);
    if (!silent) toast.success(`${updatedCount} jawaban berhasil diperbarui dari profil kamu!`);
    return updatedCount;
  };

  // Smart Unified Personalization: Syncs profile data and optionally initiates AI batch answering
  const handleSmartPersonalize = async () => {
    if (questions.length === 0) {
      toast.info('Database soal masih kosong. Silakan upload CSV atau klik Reset Soal Default.');
      return;
    }

    const hasAi = isAiConfigured();

    // 1. Instant regex sync from candidate profile (0 tokens, fast)
    const updatedCount = await handleUpdateQuestionsFromProfile(true);

    if (hasAi) {
      if (updatedCount > 0) {
        toast.success(`${updatedCount} jawaban dasar disinkronkan dari profil. Melanjutkan ke personalisasi esai & AI...`);
      }
      setIsBatchAiModalOpen(true);
    } else {
      if (updatedCount > 0) {
        toast.success(`${updatedCount} jawaban berhasil diperbarui otomatis dari profil!`);
      } else {
        toast.info('Jawaban dasar sudah sesuai profil. Tambahkan API Key AI di Pengaturan jika ingin melengkapi jawaban esai otomatis.');
      }
    }
  };

  // Hapus semua pertanyaan
  const handleClearAllQuestions = async () => {
    if (!confirm(`Hapus SEMUA ${questions.length} pertanyaan dari database? Tindakan ini tidak bisa dibatalkan.`)) return;
    await handleSaveQuestionsList([]);
    toast.success('Database soal dikosongkan');
  };

  return (
    <div className="h-screen overflow-hidden content-bg-theme text-main-theme flex flex-col md:flex-row">
      {/* LEFT SIDEBAR (Sticky, Never scrolls off-screen) */}
      <aside className="w-full md:w-64 h-full sidebar-theme border-r p-5 flex flex-col justify-between shrink-0 transition-colors overflow-y-auto">
        <div className="space-y-6">
          {/* Brand Header */}
          <div className="px-1 py-1 flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Lempar Jaring"
              className="h-9 sm:h-10 w-auto max-w-[200px] object-contain select-none transition-all drop-shadow-sm"
            />
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('wizard')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'wizard'
                  ? 'sidebar-nav-active'
                  : 'sidebar-nav-idle'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-orange-500" />
              <span>Setup &amp; Target</span>
              {activeTab === 'wizard' && <ChevronRight className="w-3.5 h-3.5 ml-auto text-orange-500" />}
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'logs'
                  ? 'sidebar-nav-active'
                  : 'sidebar-nav-idle'
              }`}
            >
              <Terminal className="w-4 h-4 text-emerald-500" />
              <span>Live Monitor</span>
              {isBotRunning && (
                <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab('questions');
                fetchQuestions();
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'questions'
                  ? 'sidebar-nav-active'
                  : 'sidebar-nav-idle'
              }`}
            >
              <Database className="w-4 h-4 text-sky-500" />
              <span>Pertanyaan CSV</span>
              <span className="ml-auto text-[10px] text-muted-theme sidebar-card-theme px-2 py-0.5 rounded-md border">
                {questions.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('history');
                fetchAppliedHistory();
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'history'
                  ? 'sidebar-nav-active'
                  : 'sidebar-nav-idle'
              }`}
            >
              <History className="w-4 h-4 text-purple-500" />
              <span>Riwayat Loker Dilamar</span>
              <span className="ml-auto text-[10px] text-muted-theme sidebar-card-theme px-2 py-0.5 rounded-md border">
                {appliedJobs.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('jobs');
                fetchAppliedHistory();
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'jobs'
                  ? 'sidebar-nav-active'
                  : 'sidebar-nav-idle'
              }`}
            >
              <Briefcase className="w-4 h-4 text-teal-500" />
              <span>Daftar Loker Terjaring</span>
              {appliedJobs.length > 0 && (
                <span className="ml-auto text-[10px] text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-md border border-teal-500/20">
                  {appliedJobs.length}
                </span>
              )}
            </button>

            {/* MODUL OUTSOURCING & TALENT SCOUT */}
            <div className="pt-2 pb-1 px-1">
              <div className="h-[1px] bg-slate-200 dark:bg-slate-800/80 my-1" />
              <div className="flex items-center justify-between px-2 pt-1 pb-0.5">
                <span className="text-[10px] font-bold text-muted-theme uppercase tracking-wider">
                  Outsourcing / HR
                </span>
                <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 rounded border border-emerald-500/20">
                  MODUL 2
                </span>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('talent')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'talent'
                  ? 'sidebar-nav-active'
                  : 'sidebar-nav-idle'
              }`}
            >
              <UserCheck className="w-4 h-4 text-emerald-500" />
              <span>Talent Scout</span>
              <span className="ml-auto text-[9px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 px-1.5 py-0.5 rounded-md">
                OpenToWork
              </span>
            </button>

            {/* Preset Konfigurasi */}
            <button
              onClick={() => setIsPresetsModalOpen(true)}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all sidebar-nav-idle"
            >
              <Bookmark className="w-4 h-4 text-amber-500" />
              <span>Preset Konfigurasi</span>
              {configPresets.length > 0 && (
                <span className="ml-auto text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                  {configPresets.length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* System Status Footprint Card (Fixed pinned at sidebar bottom) */}
        <div className="mt-6 p-4 rounded-2xl sidebar-card-theme border space-y-3 transition-colors shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-theme uppercase tracking-wider">Status Mesin</span>
            <span
              className={`w-2 h-2 rounded-full ${
                isBotRunning ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'
              }`}
            ></span>
          </div>

          <div className="text-xs space-y-1.5">
            <div className="flex justify-between text-muted-theme">
              <span>Automation Bot</span>
              <span className={isBotRunning ? 'text-emerald-500 font-semibold' : 'text-muted-theme'}>
                {isBotRunning ? 'Sedang Aktif' : 'Standby'}
              </span>
            </div>
            <div className="flex justify-between text-muted-theme">
              <span>Setup Browser</span>
              <span className={isSetupBrowserRunning ? 'text-amber-500 font-semibold' : 'text-muted-theme'}>
                {isSetupBrowserRunning ? 'Terbuka' : 'Tertutup'}
              </span>
            </div>
          </div>

          <button
            onClick={() => handleToggleSetupBrowser()}
            className={`w-full mt-2 py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition ${
              isSetupBrowserRunning
                ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30'
                : 'card-theme border text-main-theme hover:opacity-90 shadow-sm'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>{isSetupBrowserRunning ? 'Tutup Browser' : 'Buka Browser Setup'}</span>
          </button>
        </div>
      </aside>

      {/* RIGHT MAIN CONTENT AREA (Scrollable independently, sidebar stays locked) */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto content-bg-theme">
        {/* Top Header Bar */}
        <header className="min-h-[4.75rem] py-3.5 px-6 md:px-8 border-b header-theme flex items-center justify-between transition-colors shrink-0 shadow-sm sticky top-0 z-20 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-main-theme">
              {activeTab === 'wizard' && 'Setup Target Loker & Profil'}
              {activeTab === 'logs' && 'Terminal Pemantau Eksekusi Bot'}
              {activeTab === 'questions' && 'Koleksi Jawaban Kuesioner Loker'}
              {activeTab === 'history' && 'Rekap Loker yang Sudah Dilamar'}
              {activeTab === 'jobs' && 'Daftar Loker Terjaring'}
              {activeTab === 'talent' && 'Talent Scout & Sourcing Engine (Outsourcing & HRIS)'}
            </span>
          </div>

          {/* Main Action Buttons + Theme Toggle */}
          <div className="flex items-center gap-2.5">
            {/* Quick Toggle: Mode Simulasi / Live Submit */}
            <div 
              id="tour-mode-toggle"
              onClick={() => {
                const nextVal = !config.debugTest;
                setConfig({ ...config, debugTest: nextVal });
                // Auto save config perubahan mode debug
                fetch('/api/config', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ...config, debugTest: nextVal })
                }).catch(() => {});
              }}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer select-none transition flex items-center gap-2 shadow-sm ${
                config.debugTest
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
              }`}
              title="Klik untuk mengganti mode Simulasi (Dry-run) atau Live Kirim Lamaran Langsung"
            >
              <div className={`w-2 h-2 rounded-full ${config.debugTest ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
              <div className="flex flex-col text-left">
                <span className="leading-tight font-semibold">
                  {config.debugTest ? 'Mode Simulasi' : 'Mode LIVE Submit'}
                </span>
                <span className="text-[9px] opacity-75 font-normal">
                  {config.debugTest ? 'Lamaran tidak dikirim' : 'Lamaran resmi terkirim'}
                </span>
              </div>
            </div>

            {/* Interactive Onboarding Tour Button & Modal */}
            <OnboardingTour
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              wizardStep={wizardStep}
              setWizardStep={setWizardStep}
            />

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={handleToggleTheme}
              className="p-2 rounded-xl border border-subtle-theme card-theme text-muted-theme hover:text-main-theme transition flex items-center gap-1.5 text-xs shadow-sm"
              title={isMounted ? `Tema saat ini: ${themeMode === 'system' ? 'Sistem' : themeMode === 'dark' ? 'Gelap' : 'Terang'}` : 'Ganti Tema'}
            >
              {isMounted && resolvedTheme === 'dark' ? (
                <Moon className="w-4 h-4 text-sky-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-500" />
              )}
              <span className="hidden sm:inline capitalize">
                {isMounted ? (themeMode === 'system' ? 'Auto' : themeMode) : 'Auto'}
              </span>
            </button>

            {isBotRunning ? (
              <button
                onClick={handleStopBot}
                className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium flex items-center gap-2 transition"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Hentikan Bot</span>
              </button>
            ) : (
              <div id="tour-start-bot" className="flex items-center gap-2">
                <button
                  onClick={() => executeStartBot('headless')}
                  disabled={isSetupBrowserRunning}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
                  title="Jalankan bot di latar belakang (tanpa jendela browser)"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run (Headless)</span>
                </button>
                <button
                  onClick={() => executeStartBot('headful')}
                  disabled={isSetupBrowserRunning}
                  className="px-3.5 py-2 rounded-xl card-theme border text-muted-theme hover:text-main-theme text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50 shadow-sm"
                  title="Jalankan dengan jendela browser terbuka"
                >
                  <Globe className="w-3.5 h-3.5 text-orange-400" />
                  <span>Run (Headful)</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Body Container */}
        <main className="py-8 md:py-10 px-6 md:px-8 max-w-6xl w-full mx-auto space-y-8 flex-1">
          {/* TAB 1: STEP-BY-STEP SETUP WIZARD */}
          {activeTab === 'wizard' && (
            <div className="space-y-6">
              {/* Progress Summary Card (Inspired by reference UI) */}
              <div className="p-6 rounded-3xl card-theme border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 transition-colors">
                <div className="space-y-1">
                  <div className="text-xl md:text-2xl font-semibold tracking-tight text-main-theme">
                    Persiapan Automasi
                  </div>
                  <p className="text-xs text-muted-theme">
                    Selesaikan form bertahap di bawah agar bot dapat bekerja optimal.
                  </p>
                </div>

                <div className="flex items-center gap-4 card-subtle-theme px-5 py-3.5 rounded-2xl border self-start md:self-auto transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500">
                    <ShieldCheck className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-theme">Tingkat Kesiapan</div>
                    <div className="text-sm font-semibold text-main-theme">
                      {readinessMetrics.completedSteps} dari 3 Bagian Lengkap ({readinessMetrics.percent}%)
                    </div>
                  </div>
                </div>
              </div>

              {/* PROVIDER LIVE HEALTH & QUICK CONTROL CENTER */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-orange-500" />
                    <span className="text-xs font-semibold text-main-theme">Portal Status &amp; Pengujian Mandiri</span>
                  </div>
                  <span className="text-[11px] text-muted-theme">Klik tombol untuk menguji portal secara terpisah</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* 1. GLINTS CARD */}
                  <div className="p-4 rounded-2xl card-theme border shadow-sm flex flex-col justify-between space-y-3 hover:border-slate-400/40 dark:hover:border-slate-600 transition">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl card-subtle-theme border border-subtle-theme flex items-center justify-center text-main-theme font-bold text-xs">
                          GL
                        </div>
                        <div>
                          <h3 className="text-xs font-semibold text-main-theme">Glints</h3>
                          <p className="text-[10px] text-muted-theme">In-site Easy Apply</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1.5 ${
                        config.enableGlints
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : 'bg-slate-500/10 text-muted-theme border-subtle-theme'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${config.enableGlints ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <span>{config.enableGlints ? 'Aktif' : 'Nonaktif'}</span>
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px] text-muted-theme">
                      <div className="flex justify-between">
                        <span>Batas Kuota:</span>
                        <span className="font-medium text-main-theme">{config.limitGlints || 80} loker</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Status Profil:</span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">{config.domicile ? 'Lengkap' : 'Perlu Setup'}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 pt-2 border-t border-subtle-theme">
                      <button
                        type="button"
                        onClick={() => handleSyncProfile('glints')}
                        disabled={isSyncingProfile || isBotRunning}
                        className="w-full py-1.5 px-2 rounded-xl card-subtle-theme border border-subtle-theme hover:bg-slate-100 dark:hover:bg-slate-800 text-main-theme text-[11px] font-medium flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                        title="Otomatis isi form domisili, skill, dan upload CV ke akun Glints"
                      >
                        <Sparkles className="w-3 h-3 text-muted-theme" />
                        <span>Auto-Fill Profil</span>
                      </button>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => executeStartBot('headful', 'glints', 5)}
                          disabled={isBotRunning || isSetupBrowserRunning}
                          className="py-1.5 px-1.5 rounded-xl border border-subtle-theme hover:bg-slate-100 dark:hover:bg-slate-800 text-main-theme text-[10px] font-medium flex items-center justify-center gap-1 transition"
                          title="Uji coba Glints 5 loker (Headful)"
                        >
                          <Play className="w-2.5 h-2.5 fill-current text-muted-theme" />
                          <span>Tes 5 Loker</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => executeStartBot('headless', 'glints')}
                          disabled={isBotRunning || isSetupBrowserRunning}
                          className="py-1.5 px-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-[10px] font-semibold flex items-center justify-center gap-1 transition shadow-sm"
                        >
                          <span>Jalankan</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 2. LINKEDIN CARD */}
                  <div className="p-4 rounded-2xl card-theme border shadow-sm flex flex-col justify-between space-y-3 hover:border-slate-400/40 dark:hover:border-slate-600 transition">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl card-subtle-theme border border-subtle-theme flex items-center justify-center text-main-theme font-bold text-xs">
                          IN
                        </div>
                        <div>
                          <h3 className="text-xs font-semibold text-main-theme">LinkedIn</h3>
                          <p className="text-[10px] text-muted-theme">Easy Apply &amp; ATS</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1.5 ${
                        config.enableLinkedin
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : 'bg-slate-500/10 text-muted-theme border-subtle-theme'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${config.enableLinkedin ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <span>{config.enableLinkedin ? 'Aktif' : 'Nonaktif'}</span>
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px] text-muted-theme">
                      <div className="flex justify-between">
                        <span>Batas Kuota:</span>
                        <span className="font-medium text-main-theme">{config.limitLinkedin || 50} loker</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Stealth:</span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">Aktif</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 pt-2 border-t border-subtle-theme">
                      <button
                        type="button"
                        onClick={() => executeStartBot('headful', 'linkedin', 1)}
                        disabled={isBotRunning || isSetupBrowserRunning}
                        className="w-full py-1.5 px-2 rounded-xl card-subtle-theme border border-subtle-theme hover:bg-slate-100 dark:hover:bg-slate-800 text-main-theme text-[11px] font-medium flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                        title="Buka browser untuk verifikasi / login LinkedIn"
                      >
                        <KeyRound className="w-3 h-3 text-muted-theme" />
                        <span>Cek / Login</span>
                      </button>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => executeStartBot('headful', 'linkedin', 5)}
                          disabled={isBotRunning || isSetupBrowserRunning}
                          className="py-1.5 px-1.5 rounded-xl border border-subtle-theme hover:bg-slate-100 dark:hover:bg-slate-800 text-main-theme text-[10px] font-medium flex items-center justify-center gap-1 transition"
                          title="Uji coba LinkedIn 5 loker (Headful)"
                        >
                          <Play className="w-2.5 h-2.5 fill-current text-muted-theme" />
                          <span>Tes 5 Loker</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => executeStartBot('headless', 'linkedin')}
                          disabled={isBotRunning || isSetupBrowserRunning}
                          className="py-1.5 px-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-[10px] font-semibold flex items-center justify-center gap-1 transition shadow-sm"
                        >
                          <span>Jalankan</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 3. JOBSTREET CARD */}
                  <div className="p-4 rounded-2xl card-theme border shadow-sm flex flex-col justify-between space-y-3 hover:border-slate-400/40 dark:hover:border-slate-600 transition">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl card-subtle-theme border border-subtle-theme flex items-center justify-center text-main-theme font-bold text-xs">
                          JS
                        </div>
                        <div>
                          <h3 className="text-xs font-semibold text-main-theme">JobStreet</h3>
                          <p className="text-[10px] text-muted-theme">Seek Platform</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1.5 ${
                        config.enableJobstreet
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : 'bg-slate-500/10 text-muted-theme border-subtle-theme'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${config.enableJobstreet ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <span>{config.enableJobstreet ? 'Aktif' : 'Nonaktif'}</span>
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px] text-muted-theme">
                      <div className="flex justify-between">
                        <span>Batas Kuota:</span>
                        <span className="font-medium text-main-theme">{config.limitJobstreet || 75} loker</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Domain:</span>
                        <span className="font-medium text-main-theme">id.jobstreet.com</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 pt-2 border-t border-subtle-theme">
                      <button
                        type="button"
                        onClick={() => executeStartBot('headful', 'jobstreet', 1)}
                        disabled={isBotRunning || isSetupBrowserRunning}
                        className="w-full py-1.5 px-2 rounded-xl card-subtle-theme border border-subtle-theme hover:bg-slate-100 dark:hover:bg-slate-800 text-main-theme text-[11px] font-medium flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                        title="Buka browser untuk verifikasi / login JobStreet"
                      >
                        <KeyRound className="w-3 h-3 text-muted-theme" />
                        <span>Cek / Login</span>
                      </button>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => executeStartBot('headful', 'jobstreet', 5)}
                          disabled={isBotRunning || isSetupBrowserRunning}
                          className="py-1.5 px-1.5 rounded-xl border border-subtle-theme hover:bg-slate-100 dark:hover:bg-slate-800 text-main-theme text-[10px] font-medium flex items-center justify-center gap-1 transition"
                          title="Uji coba JobStreet 5 loker (Headful)"
                        >
                          <Play className="w-2.5 h-2.5 fill-current text-muted-theme" />
                          <span>Tes 5 Loker</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => executeStartBot('headless', 'jobstreet')}
                          disabled={isBotRunning || isSetupBrowserRunning}
                          className="py-1.5 px-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-[10px] font-semibold flex items-center justify-center gap-1 transition shadow-sm"
                        >
                          <span>Jalankan</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 4. INDEED CARD */}
                  <div className="p-4 rounded-2xl card-theme border shadow-sm flex flex-col justify-between space-y-3 hover:border-slate-400/40 dark:hover:border-slate-600 transition">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl card-subtle-theme border border-subtle-theme flex items-center justify-center text-main-theme font-bold text-xs">
                          ID
                        </div>
                        <div>
                          <h3 className="text-xs font-semibold text-main-theme">Indeed</h3>
                          <p className="text-[10px] text-muted-theme">Smart Apply &amp; Web</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1.5 ${
                        config.enableIndeed
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : 'bg-slate-500/10 text-muted-theme border-subtle-theme'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${config.enableIndeed ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <span>{config.enableIndeed ? 'Aktif' : 'Nonaktif'}</span>
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px] text-muted-theme">
                      <div className="flex justify-between">
                        <span>Batas Kuota:</span>
                        <span className="font-medium text-main-theme">{config.limitIndeed || 50} loker</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Anti-CF Shield:</span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">Auto Resolve</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 pt-2 border-t border-subtle-theme">
                      <button
                        type="button"
                        onClick={() => executeStartBot('headful', 'indeed', 1)}
                        disabled={isBotRunning || isSetupBrowserRunning}
                        className="w-full py-1.5 px-2 rounded-xl card-subtle-theme border border-subtle-theme hover:bg-slate-100 dark:hover:bg-slate-800 text-main-theme text-[11px] font-medium flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                        title="Buka browser untuk verifikasi / login Indeed"
                      >
                        <KeyRound className="w-3 h-3 text-muted-theme" />
                        <span>Cek / Login</span>
                      </button>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => executeStartBot('headful', 'indeed', 5)}
                          disabled={isBotRunning || isSetupBrowserRunning}
                          className="py-1.5 px-1.5 rounded-xl border border-subtle-theme hover:bg-slate-100 dark:hover:bg-slate-800 text-main-theme text-[10px] font-medium flex items-center justify-center gap-1 transition"
                          title="Uji coba Indeed 5 loker (Headful)"
                        >
                          <Play className="w-2.5 h-2.5 fill-current text-muted-theme" />
                          <span>Tes 5 Loker</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => executeStartBot('headless', 'indeed')}
                          disabled={isBotRunning || isSetupBrowserRunning}
                          className="py-1.5 px-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-[10px] font-semibold flex items-center justify-center gap-1 transition shadow-sm"
                        >
                          <span>Jalankan</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Wizard Steps Navigation Bar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setWizardStep(1)}
                  className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3 ${
                    wizardStep === 1
                      ? 'card-subtle-theme border-orange-500 shadow-sm ring-1 ring-orange-500/20'
                      : 'card-theme hover:opacity-90'
                  }`}
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center shrink-0 ${
                          readinessMetrics.step1Complete
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                            : 'bg-slate-200 dark:bg-[#282E37] text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {readinessMetrics.step1Complete ? <Check className="w-3.5 h-3.5" /> : '1'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-main-theme truncate">Langkah 1</div>
                        <div className="text-[11px] text-muted-theme truncate">Profil Pelamar &amp; Skills</div>
                      </div>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJumpToUnfilledField(1);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          handleJumpToUnfilledField(1);
                        }
                      }}
                      title="Klik untuk loncat dan tandai input yang belum terisi di Langkah 1"
                      className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border shrink-0 font-mono flex items-center gap-1.5 cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-sm hover:shadow ${
                        readinessMetrics.step1Percent === 100
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:border-emerald-500/60'
                          : readinessMetrics.step1Complete
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 hover:border-blue-500/50'
                          : 'bg-slate-500/10 text-muted-theme border-subtle-theme hover:border-orange-500/50 hover:text-orange-500'
                      }`}
                    >
                      <span>{readinessMetrics.step1Filled}/{readinessMetrics.step1Total} ({readinessMetrics.step1Percent}%)</span>
                      <Target className="w-3 h-3 opacity-70 hover:opacity-100" />
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 dark:bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        readinessMetrics.step1Percent === 100 ? 'bg-emerald-500' : 'bg-orange-500'
                      }`}
                      style={{ width: `${readinessMetrics.step1Percent}%` }}
                    />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3 ${
                    wizardStep === 2
                      ? 'card-subtle-theme border-orange-500 shadow-sm ring-1 ring-orange-500/20'
                      : 'card-theme hover:opacity-90'
                  }`}
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center shrink-0 ${
                          readinessMetrics.step2Complete
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                            : 'bg-slate-200 dark:bg-[#282E37] text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {readinessMetrics.step2Complete ? <Check className="w-3.5 h-3.5" /> : '2'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-main-theme truncate">Langkah 2</div>
                        <div className="text-[11px] text-muted-theme truncate">Kriteria &amp; Platform</div>
                      </div>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJumpToUnfilledField(2);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          handleJumpToUnfilledField(2);
                        }
                      }}
                      title="Klik untuk loncat dan tandai input yang belum terisi di Langkah 2"
                      className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border shrink-0 font-mono flex items-center gap-1.5 cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-sm hover:shadow ${
                        readinessMetrics.step2Percent === 100
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:border-emerald-500/60'
                          : readinessMetrics.step2Complete
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 hover:border-blue-500/50'
                          : 'bg-slate-500/10 text-muted-theme border-subtle-theme hover:border-orange-500/50 hover:text-orange-500'
                      }`}
                    >
                      <span>{readinessMetrics.step2Filled}/{readinessMetrics.step2Total} ({readinessMetrics.step2Percent}%)</span>
                      <Target className="w-3 h-3 opacity-70 hover:opacity-100" />
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 dark:bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        readinessMetrics.step2Percent === 100 ? 'bg-emerald-500' : 'bg-orange-500'
                      }`}
                      style={{ width: `${readinessMetrics.step2Percent}%` }}
                    />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setWizardStep(3)}
                  className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3 ${
                    wizardStep === 3
                      ? 'card-subtle-theme border-orange-500 shadow-sm ring-1 ring-orange-500/20'
                      : 'card-theme hover:opacity-90'
                  }`}
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center shrink-0 ${
                          readinessMetrics.step3Complete
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                            : 'bg-slate-200 dark:bg-[#282E37] text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {readinessMetrics.step3Complete ? <Check className="w-3.5 h-3.5" /> : '3'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-main-theme truncate">Langkah 3</div>
                        <div className="text-[11px] text-muted-theme truncate">Browser, AI &amp; Storage</div>
                      </div>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJumpToUnfilledField(3);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          handleJumpToUnfilledField(3);
                        }
                      }}
                      title="Klik untuk loncat dan tandai input yang belum terisi di Langkah 3"
                      className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border shrink-0 font-mono flex items-center gap-1.5 cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-sm hover:shadow ${
                        readinessMetrics.step3Percent === 100
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:border-emerald-500/60'
                          : readinessMetrics.step3Complete
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 hover:border-blue-500/50'
                          : 'bg-slate-500/10 text-muted-theme border-subtle-theme hover:border-orange-500/50 hover:text-orange-500'
                      }`}
                    >
                      <span>{readinessMetrics.step3Filled}/{readinessMetrics.step3Total} ({readinessMetrics.step3Percent}%)</span>
                      <Target className="w-3 h-3 opacity-70 hover:opacity-100" />
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 dark:bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        readinessMetrics.step3Percent === 100 ? 'bg-emerald-500' : 'bg-orange-500'
                      }`}
                      style={{ width: `${readinessMetrics.step3Percent}%` }}
                    />
                  </div>
                </button>
              </div>



              {/* Wizard Body Card */}
              <form onSubmit={handleSaveConfig} className="p-6 md:p-8 rounded-3xl card-theme border shadow-sm space-y-6 transition-colors">
                {/* STEP 1: CANDIDATE PROFILE */}
                {wizardStep === 1 && (
                  <div className="space-y-6">
                    <div className="border-b border-subtle-theme pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h2 className="text-base font-semibold text-main-theme">Profil Pelamar &amp; Analisis CV</h2>
                        <p className="text-xs text-muted-theme mt-0.5">
                          Data ini digunakan oleh bot dan AI saat mengisi formulir lowongan kerja secara otomatis.
                        </p>
                      </div>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsProfileSyncDropdownOpen(!isProfileSyncDropdownOpen)}
                          disabled={isSyncingProfile || isBotRunning}
                          className="px-3.5 py-2 rounded-xl card-subtle-theme border border-subtle-theme hover:bg-slate-100 dark:hover:bg-slate-800 text-main-theme font-medium text-xs flex items-center gap-2 shadow-sm transition disabled:opacity-50"
                          title="Tarik data profil otomatis dari akun Glints, Indeed, JobStreet, atau LinkedIn kamu"
                        >
                          <Sparkles className={`w-3.5 h-3.5 text-muted-theme ${isSyncingProfile ? 'animate-spin text-orange-500' : ''}`} />
                          <span>{isSyncingProfile ? 'Menyinkronkan Profil...' : 'Tarik Profil dari Akun'}</span>
                          <ChevronDown className={`w-3.5 h-3.5 text-muted-theme transition-transform ${isProfileSyncDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isProfileSyncDropdownOpen && (
                          <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl card-theme border border-subtle-theme shadow-xl py-1.5 z-30 divide-y divide-subtle-theme text-xs animate-in fade-in zoom-in-95">
                            <div className="px-3 py-1.5 text-[10px] text-muted-theme font-semibold uppercase tracking-wider">
                              Pilih Portal Sumber
                            </div>
                            <div className="py-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsProfileSyncDropdownOpen(false);
                                  handleSyncProfile('glints');
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-slate-500/10 flex items-center justify-between transition text-main-theme"
                              >
                                <span className="font-medium">Glints</span>
                                <span className="text-[10px] text-muted-theme">glints.com/id/profile</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsProfileSyncDropdownOpen(false);
                                  handleSyncProfile('indeed');
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-slate-500/10 flex items-center justify-between transition text-main-theme"
                              >
                                <span className="font-medium">Indeed</span>
                                <span className="text-[10px] text-muted-theme">profile.indeed.com</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsProfileSyncDropdownOpen(false);
                                  handleSyncProfile('jobstreet');
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-slate-500/10 flex items-center justify-between transition text-main-theme"
                              >
                                <span className="font-medium">JobStreet</span>
                                <span className="text-[10px] text-muted-theme">jobstreet.co.id</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsProfileSyncDropdownOpen(false);
                                  handleSyncProfile('linkedin');
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-slate-500/10 flex items-center justify-between transition text-main-theme"
                              >
                                <span className="font-medium">LinkedIn</span>
                                <span className="text-[10px] text-muted-theme">linkedin.com/in/me</span>
                              </button>
                            </div>
                            <div className="p-2.5 bg-slate-500/5 text-[10px] text-muted-theme leading-relaxed">
                              💡 <strong>Tips Cepat:</strong> Bila ekstensi lemparjaring aktif, kamu cukup buka tab profilmu di browser lalu klik <em>&quot;Tarik Profil Ini&quot;</em> di pojok kanan bawah (0.1 detik).
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* NEW: Smart CV Document Upload & AI Reading Banner */}
                    <div id="tour-cv-upload" className="p-4 sm:p-5 rounded-2xl card-theme border border-subtle-theme shadow-sm space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl card-subtle-theme border border-subtle-theme flex items-center justify-center text-main-theme shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-main-theme">Dokumen CV Pelamar (PDF / DOCX)</span>
                              {config.cvFileName ? (
                                <span className="text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Check className="w-3 h-3" />
                                  <span>CV Terpasang</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-theme bg-slate-500/10 px-2 py-0.5 rounded border border-subtle-theme">
                                  Opsional / Rekomendasi
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-theme mt-0.5">
                              {config.cvFileName
                                ? `File aktif: ${config.cvFileName} (Dianalisis: ${config.cvAnalyzedAt || 'Baru saja'})`
                                : 'Unggah CV Anda agar AI dapat membaca riwayat kerja, skill, dan otomatis mengunggah saat lowongan meminta lampiran resume.'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                          {(config.cvFileName || config.cvExtractedText) && (
                            <button
                              type="button"
                              onClick={handleOpenCvPreview}
                              className="px-3 py-2 rounded-xl card-subtle-theme border border-subtle-theme text-main-theme hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition flex items-center gap-1.5 shadow-sm"
                              title="Lihat pratinjau teks CV dan perbandingan data profil"
                            >
                              <Eye className="w-3.5 h-3.5 text-muted-theme" />
                              <span>Lihat Isi &amp; Preview CV</span>
                            </button>
                          )}
                          <input
                            ref={cvFileInputRef}
                            type="file"
                            accept=".pdf,.docx,.doc"
                            className="hidden"
                            onChange={handleCvUpload}
                          />
                          <button
                            type="button"
                            disabled={isUploadingCv}
                            onClick={() => cvFileInputRef.current?.click()}
                            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-xs font-semibold transition flex items-center gap-2 shadow-sm disabled:opacity-50"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{isUploadingCv ? 'Menganalisis...' : config.cvFileName ? 'Ganti File CV' : 'Upload File CV'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Pilihan Sinkronisasi Form Profil Otomatis */}
                      <div className="pt-2 border-t border-subtle-theme flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <label className="flex items-center gap-2.5 cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={shouldUpdateProfileWithCv}
                            onChange={(e) => setShouldUpdateProfileWithCv(e.target.checked)}
                            className="w-4 h-4 rounded input-theme border-subtle-theme text-orange-600 focus:ring-0 cursor-pointer"
                          />
                          <span className="text-main-theme font-medium">
                            Perbarui informasi profil di formulir secara otomatis dari CV ini
                          </span>
                        </label>

                        {updatedCvFields.length > 0 && (
                          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            ✨ {updatedCvFields.length} kolom berhasil diperbarui AI
                          </span>
                        )}
                      </div>

                      {cvAnalysisSummary && (
                        <div className="text-[11px] text-muted-theme flex items-center gap-1.5 pt-1">
                          <Bot className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                          <span className="truncate">{cvAnalysisSummary}</span>
                        </div>
                      )}
                    </div>

                    {/* Notification info of visual mark if updated/unchanged */}
                    {(updatedCvFields.length > 0 || unchangedCvFields.length > 0) && (
                      <div className="p-3 rounded-xl bg-slate-500/5 border border-subtle-theme flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Border Hijau: Diperbarui oleh AI</span>
                          </span>
                          <span className="flex items-center gap-1.5 text-muted-theme">
                            <span className="w-2 h-2 rounded-full bg-slate-400" />
                            <span>Border Netral: Tidak Berubah / Tetap</span>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setUpdatedCvFields([]);
                            setUnchangedCvFields([]);
                          }}
                          className="text-[10px] text-muted-theme hover:text-main-theme underline"
                        >
                          Hapus tanda visual
                        </button>
                      </div>
                    )}

                    <div id="tour-profile-fields" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Nama Lengkap */}
                      <div id="field-profile-fullname" className={`p-2 rounded-xl transition-all ${
                        updatedCvFields.includes('fullName')
                          ? 'bg-emerald-500/5 ring-2 ring-emerald-500/40'
                          : unchangedCvFields.includes('fullName')
                          ? 'ring-1 ring-subtle-theme'
                          : ''
                      }`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <label className="block text-xs font-medium text-main-theme">Nama Lengkap</label>
                            {updatedCvFields.includes('fullName') && (
                              <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                ✨ Baru Diperbarui
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">Wajib</span>
                        </div>
                        <input
                          type="text"
                          required
                          value={config.fullName || ''}
                          onChange={(e) => setConfig({ ...config, fullName: e.target.value })}
                          className={`w-full input-theme border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-orange-500 transition ${
                            updatedCvFields.includes('fullName') ? 'border-emerald-500 shadow-sm' : ''
                          }`}
                          placeholder="Misal: Budi Santoso"
                        />
                      </div>

                      {/* Nomor Telepon / WhatsApp */}
                      <div id="field-profile-phone" className={`p-2 rounded-xl transition-all ${
                        updatedCvFields.includes('phoneNumber')
                          ? 'bg-emerald-500/5 ring-2 ring-emerald-500/40'
                          : unchangedCvFields.includes('phoneNumber')
                          ? 'ring-1 ring-subtle-theme'
                          : ''
                      }`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <label className="block text-xs font-medium text-main-theme">Nomor Telepon / WhatsApp</label>
                            {updatedCvFields.includes('phoneNumber') && (
                              <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                ✨ Baru Diperbarui
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">Wajib</span>
                        </div>
                        <input
                          type="text"
                          required
                          value={config.phoneNumber || ''}
                          onChange={(e) => setConfig({ ...config, phoneNumber: e.target.value })}
                          className={`w-full input-theme border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-orange-500 transition ${
                            updatedCvFields.includes('phoneNumber') ? 'border-emerald-500 shadow-sm' : ''
                          }`}
                          placeholder="081234567890"
                        />
                      </div>

                      {/* Email Pelamar */}
                      <div id="field-profile-email" className="p-2 rounded-xl transition-all">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-medium text-main-theme">Email Pelamar</label>
                          <span className="text-[10px] text-muted-theme bg-slate-500/10 px-1.5 py-0.5 rounded border border-subtle-theme">Opsional</span>
                        </div>
                        <input
                          type="email"
                          value={(config as any).email || ''}
                          onChange={(e) => setConfig({ ...config, email: e.target.value } as any)}
                          className="w-full input-theme border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-orange-500 transition"
                          placeholder="emailkamu@gmail.com"
                        />
                        <p className="text-[10px] text-muted-theme mt-1">Digunakan untuk mengisi form email di platform lamaran</p>
                      </div>

                      {/* Gender & Status Pernikahan — side by side */}
                      <div className="grid grid-cols-2 gap-3">
                        <div id="field-profile-gender" className="p-2 rounded-xl transition-all">
                          <label className="block text-xs font-medium text-main-theme mb-1.5">Jenis Kelamin</label>
                          <select
                            value={(config as any).gender || 'Laki-laki'}
                            onChange={(e) => setConfig({ ...config, gender: e.target.value } as any)}
                            className="w-full input-theme border rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-orange-500 transition"
                          >
                            <option value="Laki-laki">Laki-laki</option>
                            <option value="Perempuan">Perempuan</option>
                          </select>
                        </div>
                        <div id="field-profile-marital" className="p-2 rounded-xl transition-all">
                          <label className="block text-xs font-medium text-main-theme mb-1.5">Status Pernikahan</label>
                          <select
                            value={(config as any).maritalStatus || 'Single'}
                            onChange={(e) => setConfig({ ...config, maritalStatus: e.target.value } as any)}
                            className="w-full input-theme border rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-orange-500 transition"
                          >
                            <option value="Single">Single / Belum Menikah</option>
                            <option value="Menikah">Menikah</option>
                          </select>
                        </div>
                      </div>

                      {/* Tanggal Lahir & Kode Pos — side by side */}
                      <div className="grid grid-cols-2 gap-3">
                        <div id="field-profile-dob" className="p-2 rounded-xl transition-all">
                          <label className="block text-xs font-medium text-main-theme mb-1.5">Tanggal Lahir</label>
                          <input
                            type="date"
                            value={(config as any).dateOfBirth || ''}
                            onChange={(e) => setConfig({ ...config, dateOfBirth: e.target.value } as any)}
                            className="w-full input-theme border rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-orange-500 transition"
                          />
                          <p className="text-[10px] text-muted-theme mt-1">Untuk pertanyaan umur/DOB</p>
                        </div>
                        <div id="field-profile-postal" className="p-2 rounded-xl transition-all">
                          <label className="block text-xs font-medium text-main-theme mb-1.5">Kode Pos Domisili</label>
                          <input
                            type="text"
                            value={(config as any).postalCode || ''}
                            onChange={(e) => setConfig({ ...config, postalCode: e.target.value } as any)}
                            className="w-full input-theme border rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-orange-500 transition"
                            placeholder="60235"
                            maxLength={10}
                          />
                          <p className="text-[10px] text-muted-theme mt-1">Untuk pertanyaan zip/postal code</p>
                        </div>
                      </div>

                      {/* Gaji Bulanan */}
                      <div id="field-profile-salary" className={`p-2 rounded-xl transition-all ${
                        updatedCvFields.includes('expectedSalary')
                          ? 'bg-emerald-500/5 ring-2 ring-emerald-500/40'
                          : unchangedCvFields.includes('expectedSalary')
                          ? 'ring-1 ring-subtle-theme'
                          : ''
                      }`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <label className="block text-xs font-medium text-main-theme">Gaji Bulanan yang Diharapkan (IDR)</label>
                            {updatedCvFields.includes('expectedSalary') && (
                              <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                ✨ Baru Diperbarui
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-theme bg-slate-500/10 px-1.5 py-0.5 rounded border border-subtle-theme">Opsional</span>
                        </div>
                        <input
                          type="number"
                          value={config.expectedSalary || ''}
                          onChange={(e) => setConfig({ ...config, expectedSalary: Number(e.target.value) })}
                          className={`w-full input-theme border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-orange-500 transition ${
                            updatedCvFields.includes('expectedSalary') ? 'border-emerald-500 shadow-sm' : ''
                          }`}
                          placeholder="8000000"
                        />
                      </div>

                      {/* Pengalaman Kerja */}
                      <div id="field-profile-experience" className={`p-2 rounded-xl transition-all ${
                        updatedCvFields.includes('yearsOfExperience')
                          ? 'bg-emerald-500/5 ring-2 ring-emerald-500/40'
                          : unchangedCvFields.includes('yearsOfExperience')
                          ? 'ring-1 ring-subtle-theme'
                          : ''
                      }`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <label className="block text-xs font-medium text-main-theme">Pengalaman Kerja (Tahun)</label>
                            {updatedCvFields.includes('yearsOfExperience') && (
                              <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                ✨ Baru Diperbarui
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-theme bg-slate-500/10 px-1.5 py-0.5 rounded border border-subtle-theme">Opsional</span>
                        </div>
                        <input
                          type="number"
                          value={config.yearsOfExperience || 0}
                          onChange={(e) => setConfig({ ...config, yearsOfExperience: Number(e.target.value) })}
                          className={`w-full input-theme border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-orange-500 transition ${
                            updatedCvFields.includes('yearsOfExperience') ? 'border-emerald-500 shadow-sm' : ''
                          }`}
                        />
                      </div>

                      {/* Pendidikan Terakhir */}
                      <div id="field-profile-education" className={`p-2 rounded-xl transition-all ${
                        updatedCvFields.includes('educationLevel')
                          ? 'bg-emerald-500/5 ring-2 ring-emerald-500/40'
                          : unchangedCvFields.includes('educationLevel')
                          ? 'ring-1 ring-subtle-theme'
                          : ''
                      }`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <label className="block text-xs font-medium text-main-theme">Pendidikan Terakhir</label>
                            {updatedCvFields.includes('educationLevel') && (
                              <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                ✨ Baru Diperbarui
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-theme bg-slate-500/10 px-1.5 py-0.5 rounded border border-subtle-theme">Opsional</span>
                        </div>
                        <select
                          value={config.educationLevel || 'Sarjana (S1)'}
                          onChange={(e) => setConfig({ ...config, educationLevel: e.target.value })}
                          className={`w-full input-theme border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-orange-500 transition ${
                            updatedCvFields.includes('educationLevel') ? 'border-emerald-500 shadow-sm' : ''
                          }`}
                        >
                          <option value="SMA / SMK">SMA / SMK</option>
                          <option value="Diploma (D3)">Diploma (D3)</option>
                          <option value="Sarjana (S1)">Sarjana (S1)</option>
                          <option value="Magister (S2)">Magister (S2)</option>
                          <option value="Doktor (S3)">Doktor (S3)</option>
                        </select>
                      </div>

                      {/* IPK Terakhir */}
                      <div className={`p-2 rounded-xl transition-all ${
                        updatedCvFields.includes('gpa')
                          ? 'bg-emerald-500/5 ring-2 ring-emerald-500/40'
                          : unchangedCvFields.includes('gpa')
                          ? 'ring-1 ring-subtle-theme'
                          : ''
                      }`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <label className="block text-xs font-medium text-main-theme">IPK Terakhir</label>
                            {updatedCvFields.includes('gpa') && (
                              <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                ✨ Baru Diperbarui
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-theme bg-slate-500/10 px-1.5 py-0.5 rounded border border-subtle-theme">Opsional</span>
                        </div>
                        <input
                          type="text"
                          value={config.gpa || ''}
                          onChange={(e) => setConfig({ ...config, gpa: e.target.value })}
                          className={`w-full input-theme border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-orange-500 transition ${
                            updatedCvFields.includes('gpa') ? 'border-emerald-500 shadow-sm' : ''
                          }`}
                          placeholder="3.75"
                        />
                      </div>

                      {/* Periode Pemberitahuan */}
                      <div className={`p-2 rounded-xl transition-all ${
                        updatedCvFields.includes('noticePeriod')
                          ? 'bg-emerald-500/5 ring-2 ring-emerald-500/40'
                          : unchangedCvFields.includes('noticePeriod')
                          ? 'ring-1 ring-subtle-theme'
                          : ''
                      }`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <label className="block text-xs font-medium text-main-theme">Periode Pemberitahuan (Notice Period)</label>
                            {updatedCvFields.includes('noticePeriod') && (
                              <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                ✨ Baru Diperbarui
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-theme bg-slate-500/10 px-1.5 py-0.5 rounded border border-subtle-theme">Opsional</span>
                        </div>
                        <select
                          value={config.noticePeriod || 'Immediately'}
                          onChange={(e) => setConfig({ ...config, noticePeriod: e.target.value })}
                          className={`w-full input-theme border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-orange-500 transition ${
                            updatedCvFields.includes('noticePeriod') ? 'border-emerald-500 shadow-sm' : ''
                          }`}
                        >
                          <option value="Immediately">Segera (Immediately)</option>
                          <option value="1 week">1 Minggu</option>
                          <option value="2 weeks">2 Minggu</option>
                          <option value="1 month">1 Bulan</option>
                          <option value="2 months">2 Bulan</option>
                        </select>
                      </div>

                      {/* Domisili / Kota */}
                      <div id="field-profile-domicile" className={`p-2 rounded-xl transition-all ${
                        updatedCvFields.includes('domicile')
                          ? 'bg-emerald-500/5 ring-2 ring-emerald-500/40'
                          : unchangedCvFields.includes('domicile')
                          ? 'ring-1 ring-subtle-theme'
                          : ''
                      }`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <label className="block text-xs font-medium text-main-theme">Domisili / Kota</label>
                            {updatedCvFields.includes('domicile') && (
                              <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                ✨ Baru Diperbarui
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-theme bg-slate-500/10 px-1.5 py-0.5 rounded border border-subtle-theme">Opsional</span>
                        </div>
                        <input
                          type="text"
                          value={config.domicile || ''}
                          onChange={(e) => setConfig({ ...config, domicile: e.target.value })}
                          className={`w-full input-theme border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-orange-500 transition ${
                            updatedCvFields.includes('domicile') ? 'border-emerald-500 shadow-sm' : ''
                          }`}
                          placeholder="Gresik, Surabaya, atau Jakarta"
                        />
                      </div>

                      {/* Alamat Lengkap / Street Address */}
                      <div className={`p-2 rounded-xl transition-all ${
                        updatedCvFields.includes('address')
                          ? 'bg-emerald-500/5 ring-2 ring-emerald-500/40'
                          : unchangedCvFields.includes('address')
                          ? 'ring-1 ring-subtle-theme'
                          : ''
                      }`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <label className="block text-xs font-medium text-main-theme">Alamat Lengkap / Jalan</label>
                            {updatedCvFields.includes('address') && (
                              <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                ✨ Baru Diperbarui
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-theme bg-slate-500/10 px-1.5 py-0.5 rounded border border-subtle-theme">Opsional</span>
                        </div>
                        <input
                          type="text"
                          value={config.address || ''}
                          onChange={(e) => setConfig({ ...config, address: e.target.value })}
                          className={`w-full input-theme border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-orange-500 transition ${
                            updatedCvFields.includes('address') ? 'border-emerald-500 shadow-sm' : ''
                          }`}
                          placeholder="Desa Banjaran RT 03 RW 03, Wringinanom, Gresik"
                        />
                      </div>

                      {/* Link Portofolio */}
                      <div id="field-profile-portfolio" className={`p-2 rounded-xl transition-all ${
                        updatedCvFields.includes('portfolioUrl')
                          ? 'bg-emerald-500/5 ring-2 ring-emerald-500/40'
                          : unchangedCvFields.includes('portfolioUrl')
                          ? 'ring-1 ring-subtle-theme'
                          : ''
                      }`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <label className="block text-xs font-medium text-main-theme">Link Portofolio</label>
                            {updatedCvFields.includes('portfolioUrl') && (
                              <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                ✨ Baru Diperbarui
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-theme bg-slate-500/10 px-1.5 py-0.5 rounded border border-subtle-theme">Opsional</span>
                        </div>
                        <input
                          type="text"
                          value={config.portfolioUrl || ''}
                          onChange={(e) => setConfig({ ...config, portfolioUrl: e.target.value })}
                          className={`w-full input-theme border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-orange-500 transition ${
                            updatedCvFields.includes('portfolioUrl') ? 'border-emerald-500 shadow-sm' : ''
                          }`}
                          placeholder="https://..."
                        />
                      </div>

                      {/* Link LinkedIn */}
                      <div id="field-profile-linkedin" className={`p-2 rounded-xl transition-all ${
                        updatedCvFields.includes('linkedinUrl')
                          ? 'bg-emerald-500/5 ring-2 ring-emerald-500/40'
                          : unchangedCvFields.includes('linkedinUrl')
                          ? 'ring-1 ring-subtle-theme'
                          : ''
                      }`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <label className="block text-xs font-medium text-main-theme">Link LinkedIn</label>
                            {updatedCvFields.includes('linkedinUrl') && (
                              <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                ✨ Baru Diperbarui
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-theme bg-slate-500/10 px-1.5 py-0.5 rounded border border-subtle-theme">Opsional</span>
                        </div>
                        <input
                          type="text"
                          value={config.linkedinUrl || ''}
                          onChange={(e) => setConfig({ ...config, linkedinUrl: e.target.value })}
                          className={`w-full input-theme border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-orange-500 transition ${
                            updatedCvFields.includes('linkedinUrl') ? 'border-emerald-500 shadow-sm' : ''
                          }`}
                          placeholder="https://linkedin.com/in/..."
                        />
                      </div>
                    </div>

                    {/* Daftar Keahlian / Skills */}
                    <div id="field-profile-skills" className={`p-2 rounded-xl transition-all ${
                      updatedCvFields.includes('skills')
                        ? 'bg-emerald-500/5 ring-2 ring-emerald-500/40'
                        : unchangedCvFields.includes('skills')
                        ? 'ring-1 ring-subtle-theme'
                        : ''
                    }`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <label className="block text-xs font-medium text-main-theme">
                            Daftar Keahlian &amp; Alat Kerja (Pisahkan dengan koma)
                          </label>
                          {updatedCvFields.includes('skills') && (
                            <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                              ✨ Baru Diperbarui oleh AI
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">Wajib</span>
                      </div>
                      <textarea
                        rows={4}
                        required
                        value={config.skills || ''}
                        onChange={(e) => setConfig({ ...config, skills: e.target.value })}
                        className={`w-full input-theme border rounded-xl p-3 text-xs focus:outline-none focus:border-orange-500 transition leading-relaxed font-mono ${
                          updatedCvFields.includes('skills') ? 'border-emerald-500 shadow-sm' : ''
                        }`}
                        placeholder="React, TypeScript, Next.js, Node.js, Express, PostgreSQL, Git"
                      />
                    </div>

                    {/* EEO & Otorisasi Kerja */}
                    <div className="p-5 rounded-2xl border border-subtle-theme card-subtle-theme space-y-4">
                      <div className="flex items-center gap-2 border-b border-subtle-theme pb-3">
                        <ShieldCheck className="w-4 h-4 text-sky-500" />
                        <div>
                          <div className="text-xs font-semibold text-main-theme">Otorisasi Kerja &amp; EEO</div>
                          <p className="text-[11px] text-muted-theme">Pertanyaan standar yang sering muncul di form lamaran LinkedIn/Indeed.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Citizenship */}
                        <div>
                          <label className="block text-[11px] font-medium text-main-theme mb-1.5">Status Kewarganegaraan</label>
                          <select
                            value={config.citizenshipStatus || 'WNI'}
                            onChange={(e) => setConfig({...config, citizenshipStatus: e.target.value})}
                            className="w-full input-theme border border-subtle-theme rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-orange-500 transition"
                          >
                            <option value="WNI">WNI (Warga Negara Indonesia)</option>
                            <option value="permanent_resident">Penduduk Tetap / PR</option>
                            <option value="work_visa">Visa Kerja Aktif</option>
                            <option value="other">Lainnya</option>
                          </select>
                        </div>

                        {/* Visa Required */}
                        <div>
                          <label className="block text-[11px] font-medium text-main-theme mb-1.5">Butuh Sponsor Visa?</label>
                          <div className="flex items-center gap-3 p-2.5 rounded-xl border border-subtle-theme card-theme">
                            <input
                              type="checkbox"
                              id="visaRequired"
                              checked={config.visaRequired ?? false}
                              onChange={(e) => setConfig({...config, visaRequired: e.target.checked})}
                              className="w-4 h-4 rounded text-orange-600 cursor-pointer"
                            />
                            <label htmlFor="visaRequired" className="text-xs text-muted-theme cursor-pointer">
                              Ya, saya membutuhkan sponsorship visa
                            </label>
                          </div>
                        </div>

                        {/* Disability */}
                        <div>
                          <label className="block text-[11px] font-medium text-main-theme mb-1.5">Status Disabilitas</label>
                          <select
                            value={config.disabilityStatus || 'prefer_not_to_say'}
                            onChange={(e) => setConfig({...config, disabilityStatus: e.target.value as any})}
                            className="w-full input-theme border border-subtle-theme rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-orange-500 transition"
                          >
                            <option value="prefer_not_to_say">Tidak Ingin Menjawab</option>
                            <option value="no">Tidak memiliki disabilitas</option>
                            <option value="yes">Memiliki disabilitas</option>
                          </select>
                        </div>

                        {/* Veteran */}
                        <div>
                          <label className="block text-[11px] font-medium text-main-theme mb-1.5">Status Veteran</label>
                          <select
                            value={config.veteranStatus || 'prefer_not_to_say'}
                            onChange={(e) => setConfig({...config, veteranStatus: e.target.value as any})}
                            className="w-full input-theme border border-subtle-theme rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-orange-500 transition"
                          >
                            <option value="prefer_not_to_say">Tidak Ingin Menjawab</option>
                            <option value="no">Bukan Veteran</option>
                            <option value="yes">Veteran / TNI/Polri Purnawirawan</option>
                          </select>
                        </div>
                      </div>

                      <p className="text-[10px] text-muted-theme flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        <span>Data ini digunakan oleh bot untuk menjawab pertanyaan skrining otomatis di <b className="text-main-theme">LinkedIn Easy Apply</b> dan <b className="text-main-theme">Indeed</b>.</span>
                      </p>
                    </div>
                  </div>
                )}

                {/* STEP 2: JOB CRITERIA & PLATFORMS */}
                {wizardStep === 2 && (
                  <div className="space-y-6">
                    <div className="border-b border-subtle-theme pb-4">
                      <h2 className="text-base font-semibold text-main-theme">Target Lowongan &amp; Kuota</h2>
                      <p className="text-xs text-muted-theme mt-0.5">
                        Tentukan kata kunci pekerjaan yang dibidik, lokasi, dan platform yang ingin diikutsertakan.
                      </p>
                    </div>

                    {/* Platform Checkbox Pills */}
                    <div id="tour-criteria-platform">
                      <label className="block text-xs font-medium text-muted-theme mb-2">Platform Aktif</label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <label
                          className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center gap-3 ${
                            config.enableGlints
                              ? 'bg-blue-500/10 border-blue-500/40 text-blue-600 dark:text-blue-300'
                              : 'card-subtle-theme border-subtle-theme text-muted-theme'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={config.enableGlints}
                            onChange={(e) => setConfig({ ...config, enableGlints: e.target.checked })}
                            className="hidden"
                          />
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center ${
                              config.enableGlints ? 'bg-blue-600 border-blue-500 text-white' : 'border-subtle-theme'
                            }`}
                          >
                            {config.enableGlints && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="text-xs font-medium">Glints</span>
                        </label>

                        <label
                          className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center gap-3 ${
                            config.enableJobstreet
                              ? 'bg-purple-500/10 border-purple-500/40 text-purple-600 dark:text-purple-300'
                              : 'card-subtle-theme border-subtle-theme text-muted-theme'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={config.enableJobstreet}
                            onChange={(e) => setConfig({ ...config, enableJobstreet: e.target.checked })}
                            className="hidden"
                          />
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center ${
                              config.enableJobstreet ? 'bg-purple-600 border-purple-500 text-white' : 'border-subtle-theme'
                            }`}
                          >
                            {config.enableJobstreet && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="text-xs font-medium">Jobstreet</span>
                        </label>

                        <label
                          className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center gap-3 ${
                            config.enableLinkedin
                              ? 'bg-sky-500/10 border-sky-500/40 text-sky-600 dark:text-sky-300'
                              : 'card-subtle-theme border-subtle-theme text-muted-theme'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={config.enableLinkedin}
                            onChange={(e) => setConfig({ ...config, enableLinkedin: e.target.checked })}
                            className="hidden"
                          />
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center ${
                              config.enableLinkedin ? 'bg-sky-600 border-sky-500 text-white' : 'border-subtle-theme'
                            }`}
                          >
                            {config.enableLinkedin && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="text-xs font-medium">LinkedIn</span>
                        </label>

                        <label
                          className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center gap-3 ${
                            config.enableIndeed
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-300'
                              : 'card-subtle-theme border-subtle-theme text-muted-theme'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={config.enableIndeed}
                            onChange={(e) => setConfig({ ...config, enableIndeed: e.target.checked })}
                            className="hidden"
                          />
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center ${
                              config.enableIndeed ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-subtle-theme'
                            }`}
                          >
                            {config.enableIndeed && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="text-xs font-medium">Indeed</span>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div id="field-criteria-keywords" className="p-2 rounded-xl transition-all">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-medium text-main-theme">Kata Kunci Lowongan</label>
                          <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">Wajib</span>
                        </div>
                        <input
                          type="text"
                          required={!config.indeedNoJobTitleFilter}
                          value={config.searchKeywords || ''}
                          onChange={(e) => setConfig({ ...config, searchKeywords: e.target.value })}
                          className="w-full input-theme border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-orange-500 transition"
                          placeholder="Frontend Developer, React"
                        />
                      </div>

                      <div id="field-criteria-location" className="p-2 rounded-xl transition-all">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-medium text-main-theme">Lokasi Kerja</label>
                          <span className="text-[10px] text-muted-theme bg-slate-500/10 px-1.5 py-0.5 rounded border border-subtle-theme">Opsional</span>
                        </div>
                        <input
                          type="text"
                          value={config.location || ''}
                          onChange={(e) => setConfig({ ...config, location: e.target.value })}
                          className="w-full input-theme border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-orange-500 transition"
                          placeholder="Jakarta, Remote"
                        />
                      </div>

                      <div id="field-criteria-salary" className="p-2 rounded-xl transition-all">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-medium text-main-theme">Filter Gaji Minimal</label>
                          <span className="text-[10px] text-muted-theme bg-slate-500/10 px-1.5 py-0.5 rounded border border-subtle-theme">Opsional</span>
                        </div>
                        <input
                          type="text"
                          value={config.minSalary || ''}
                          onChange={(e) => setConfig({ ...config, minSalary: e.target.value })}
                          className="w-full input-theme border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-orange-500 transition"
                          placeholder="Misal: 8000000"
                        />
                      </div>

                      <div id="field-criteria-concurrency" className="p-2 rounded-xl transition-all">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-medium text-main-theme">Worker Konkuren (Tab)</label>
                          <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">Wajib</span>
                        </div>
                        <input
                          type="number"
                          min={1}
                          max={8}
                          value={config.concurrency || 3}
                          onChange={(e) => setConfig({ ...config, concurrency: parseInt(e.target.value) || 3 })}
                          className="w-full input-theme border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-orange-500 transition"
                        />
                      </div>
                    </div>

                    {/* Limit Schema */}
                    <div id="field-criteria-limit" className="p-5 rounded-2xl card-subtle-theme border space-y-4 transition-all">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-subtle-theme pb-3">
                        <div>
                          <div className="text-xs font-semibold text-main-theme">Mode Pembagian Batasan Harian</div>
                          <div className="text-[11px] text-muted-theme">Atur batasan maksimal pengiriman lamaran per hari</div>
                        </div>

                        <div className="flex card-theme p-1 rounded-xl border border-subtle-theme self-start md:self-auto">
                          <button
                            type="button"
                            onClick={() => setConfig({ ...config, limitMode: 'shared' })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                              (config.limitMode || 'shared') === 'shared'
                                ? 'bg-orange-600 text-white'
                                : 'text-muted-theme hover:text-main-theme'
                            }`}
                          >
                            Batas Gabungan (Shared)
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfig({ ...config, limitMode: 'per_platform' })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                              config.limitMode === 'per_platform'
                                ? 'bg-orange-600 text-white'
                                : 'text-muted-theme hover:text-main-theme'
                            }`}
                          >
                            Batas Terpisah
                          </button>
                        </div>
                      </div>

                      {(config.limitMode || 'shared') === 'shared' ? (
                        <div className="flex items-center gap-4">
                          <div className="w-48">
                            <label className="block text-[11px] font-medium text-muted-theme mb-1">Total Kuota Bersama</label>
                            <input
                              type="number"
                              min={1}
                              value={config.limitPerDay}
                              onChange={(e) => setConfig({ ...config, limitPerDay: parseInt(e.target.value) || 0 })}
                              className="w-full input-theme border rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:border-orange-500"
                            />
                          </div>
                          <div className="text-xs text-muted-theme pt-3">
                            Bot akan berhenti otomatis jika total gabungan seluruh platform mencapai kuota ini.
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                          <div>
                            <label className="block text-[11px] font-medium text-muted-theme mb-1">Glints</label>
                            <input
                              type="number"
                              value={config.limitGlints || 80}
                              onChange={(e) => setConfig({ ...config, limitGlints: parseInt(e.target.value) || 0 })}
                              className="w-full input-theme border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-orange-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-muted-theme mb-1">Jobstreet</label>
                            <input
                              type="number"
                              value={config.limitJobstreet || 75}
                              onChange={(e) => setConfig({ ...config, limitJobstreet: parseInt(e.target.value) || 0 })}
                              className="w-full input-theme border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-orange-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-muted-theme mb-1">LinkedIn</label>
                            <input
                              type="number"
                              value={config.limitLinkedin || 50}
                              onChange={(e) => setConfig({ ...config, limitLinkedin: parseInt(e.target.value) || 0 })}
                              className="w-full input-theme border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-orange-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-muted-theme mb-1">Indeed</label>
                            <input
                              type="number"
                              value={config.limitIndeed || 50}
                              onChange={(e) => setConfig({ ...config, limitIndeed: parseInt(e.target.value) || 0 })}
                              className="w-full input-theme border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-orange-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Mode Simulasi Debug */}
                    <div className="flex items-center justify-between p-4 rounded-2xl card-subtle-theme border">
                      <div>
                        <div className="text-xs font-semibold text-main-theme">Mode Simulasi (Debug)</div>
                        <div className="text-[11px] text-muted-theme">
                          Navigasi lowongan tanpa menekan tombol kirim akhir untuk uji coba alur bot.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={config.debugTest}
                        onChange={(e) => setConfig({ ...config, debugTest: e.target.checked })}
                        className="w-4 h-4 rounded input-theme border-subtle-theme text-orange-600 focus:ring-0 cursor-pointer"
                      />
                    </div>

                    {/* FITUR OTOMASI PENDUKUNG */}
                    <div id="tour-smart-features" className="p-5 sm:p-6 rounded-2xl border border-subtle-theme card-subtle-theme space-y-4">
                      <div className="flex items-center gap-2.5 border-b border-subtle-theme pb-3">
                        <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                          <Sliders className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-main-theme">
                            Otomasi Formulir &amp; Filter Relevansi
                          </div>
                          <p className="text-[11px] text-muted-theme mt-0.5">
                            Opsi tambahan untuk pengisian esai motivasi, jeda waktu alami, dan filter syarat kualifikasi.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* 1. Dynamic Cover Letter */}
                        <div className="p-4 rounded-xl border border-subtle-theme card-theme space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-main-theme">Generator Surat Motivasi</span>
                            <input
                              type="checkbox"
                              checked={config.enableCoverLetterGen ?? true}
                              onChange={(e) => setConfig({ ...config, enableCoverLetterGen: e.target.checked })}
                              className="w-4 h-4 rounded text-orange-600 cursor-pointer"
                            />
                          </div>
                          <p className="text-[11px] text-muted-theme">
                            Menyusun respon motivasi yang relevan sesuai posisi dan profil saat form pertanyaan memintanya.
                          </p>
                        </div>

                        {/* 2. Human Stealth Emulation */}
                        <div className="p-4 rounded-xl border border-subtle-theme card-theme space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-main-theme">Simulasi Jeda Ketik Alami</span>
                            <input
                              type="checkbox"
                              checked={config.enableHumanStealth ?? true}
                              onChange={(e) => setConfig({ ...config, enableHumanStealth: e.target.checked })}
                              className="w-4 h-4 rounded text-orange-600 cursor-pointer"
                            />
                          </div>
                          <p className="text-[11px] text-muted-theme">
                            Menambahkan variasi jeda pengetikan (40-120ms) dan jeda klik untuk mensimulasikan interaksi pengguna.
                          </p>
                        </div>
                      </div>

                      {/* 3. Negative Keywords & Company Blacklist (Always Active & Transparent) */}
                      <div id="field-criteria-blacklist" className="p-4 rounded-xl border border-subtle-theme card-theme space-y-3 transition-all">
                        <div>
                          <span className="text-xs font-semibold text-main-theme">Penyaringan &amp; Blacklist Loker</span>
                          <p className="text-[11px] text-muted-theme">
                            Mencegah bot melamar kantor sendiri, agensi yang dihindari, atau loker magang dan kata kunci yang tidak diinginkan.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-subtle-theme">
                          <div>
                            <label className="block text-[11px] font-medium text-main-theme mb-1">
                              Blacklist Perusahaan (Dipisahkan Koma)
                            </label>
                            <input
                              type="text"
                              value={config.blacklistedCompanies || ''}
                              onChange={(e) => setConfig({ ...config, blacklistedCompanies: e.target.value })}
                              placeholder="Kantor Sekarang, PT ABC, Agensi XYZ..."
                              className="w-full text-xs px-3 py-2 rounded-xl border border-subtle-theme input-theme font-sans"
                            />
                            <p className="text-[10px] text-muted-theme mt-1">
                              Jika nama perusahaan cocok, bot langsung melewatinya (0 kuota).
                            </p>
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-main-theme mb-1">
                              Kata Kunci Terlarang (Negative Keywords)
                            </label>
                            <input
                              type="text"
                              value={config.negativeKeywords || ''}
                              onChange={(e) => setConfig({ ...config, negativeKeywords: e.target.value })}
                              placeholder="magang, intern, unpaid, sales lapangan, mandarin..."
                              className="w-full text-xs px-3 py-2 rounded-xl border border-subtle-theme input-theme font-sans"
                            />
                            <p className="text-[10px] text-muted-theme mt-1">
                              Loker dengan judul/deskripsi berisi kata ini otomatis dilewati.
                            </p>
                          </div>
                        </div>

                        {/* Optional Match Scoring Threshold */}
                        <div className="pt-2 border-t border-subtle-theme flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="enableJobMatchFilterCheck"
                              checked={config.enableJobMatchFilter ?? false}
                              onChange={(e) => setConfig({ ...config, enableJobMatchFilter: e.target.checked })}
                              className="w-4 h-4 rounded text-orange-600 cursor-pointer"
                            />
                            <label htmlFor="enableJobMatchFilterCheck" className="text-xs font-medium text-main-theme cursor-pointer">
                              Aktifkan Skor Relevansi Minimal ({config.minMatchScore || 60}%)
                            </label>
                          </div>
                          {config.enableJobMatchFilter && (
                            <input
                              type="range"
                              min="40"
                              max="90"
                              step="5"
                              value={config.minMatchScore || 60}
                              onChange={(e) => setConfig({ ...config, minMatchScore: Number(e.target.value) })}
                              className="w-32 cursor-pointer accent-orange-500"
                            />
                          )}
                        </div>
                      </div>

                      {/* 4. Execution Mode: Full Auto vs Copilot (Review Before Submit) */}
                      <div id="field-criteria-autoapplymode" className="p-4 rounded-xl border border-subtle-theme card-theme space-y-2 transition-all">
                        <div>
                          <span className="text-xs font-semibold text-main-theme">Mode Eksekusi Lamaran</span>
                          <p className="text-[11px] text-muted-theme">
                            Pilih apakah bot langsung mengirim lamaran atau berhenti di tombol akhir untuk Anda tinjau.
                          </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <button
                            type="button"
                            onClick={() => setConfig({ ...config, autoApplyMode: 'auto' })}
                            className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                              (config.autoApplyMode || 'auto') === 'auto'
                                ? 'bg-orange-500/10 border-orange-500/40 text-orange-600 dark:text-orange-400 font-semibold shadow-sm'
                                : 'card-subtle-theme border-subtle-theme text-muted-theme hover:opacity-90'
                            }`}
                          >
                            <div>
                              <div className="text-xs font-semibold text-main-theme">Otomatis Penuh (Full Auto)</div>
                              <div className="text-[10px] text-muted-theme mt-0.5">Langsung kirim formulir dan lanjut ke lowongan berikutnya.</div>
                            </div>
                            {(config.autoApplyMode || 'auto') === 'auto' && <Check className="w-4 h-4 text-orange-500 shrink-0 ml-2" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => setConfig({ ...config, autoApplyMode: 'review' })}
                            className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                              config.autoApplyMode === 'review'
                                ? 'bg-blue-500/10 border-blue-500/40 text-blue-600 dark:text-blue-400 font-semibold shadow-sm'
                                : 'card-subtle-theme border-subtle-theme text-muted-theme hover:opacity-90'
                            }`}
                          >
                            <div>
                              <div className="text-xs font-semibold text-main-theme">Mode Copilot (Tinjau Dulu)</div>
                              <div className="text-[10px] text-muted-theme mt-0.5">Isi semua form, lalu jeda di tombol kirim agar Anda bisa cek ulang.</div>
                            </div>
                            {config.autoApplyMode === 'review' && <Check className="w-4 h-4 text-blue-500 shrink-0 ml-2" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* FILTER PENCARIAN LANJUTAN */}
                    <div className="p-5 sm:p-6 rounded-2xl border border-subtle-theme card-subtle-theme space-y-5">
                      <div className="flex items-center gap-2.5 border-b border-subtle-theme pb-4">
                        <div className="w-8 h-8 rounded-xl bg-teal-500/15 text-teal-500 flex items-center justify-center">
                          <Filter className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-main-theme">Filter Pencarian Lanjutan</div>
                          <p className="text-[11px] text-muted-theme mt-0.5">
                            Menyaring hasil pencarian di setiap platform agar lebih relevan dan sesuai target.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                        {/* Tanggal Posting */}
                        <div className="space-y-2">
                          <label className="block text-[11px] font-semibold text-muted-theme uppercase tracking-wider">Tanggal Diposting</label>
                          <div className="flex flex-wrap gap-1.5">
                            {[{v:'',l:'Semua'},{v:'24h',l:'24 Jam'},{v:'week',l:'7 Hari'},{v:'month',l:'30 Hari'}].map(opt => (
                              <button
                                key={opt.v}
                                type="button"
                                onClick={() => setConfig({...config, datePosted: opt.v as any})}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition ${
                                  (config.datePosted ?? '') === opt.v
                                    ? 'bg-teal-500 text-white border-teal-500 shadow-sm'
                                    : 'card-subtle-theme border-subtle-theme text-muted-theme hover:text-main-theme'
                                }`}
                              >
                                {opt.l}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Tipe Pekerjaan */}
                        <div className="space-y-2">
                          <label className="block text-[11px] font-semibold text-muted-theme uppercase tracking-wider">Tipe Pekerjaan</label>
                          <div className="flex flex-wrap gap-1.5">
                            {[{v:'full_time',l:'Full-time'},{v:'part_time',l:'Part-time'},{v:'contract',l:'Kontrak'},{v:'internship',l:'Magang'},{v:'freelance',l:'Freelance'}].map(opt => {
                              const active = (config.jobType || []).includes(opt.v);
                              return (
                                <button
                                  key={opt.v}
                                  type="button"
                                  onClick={() => {
                                    const cur = config.jobType || [];
                                    setConfig({...config, jobType: active ? cur.filter(x=>x!==opt.v) : [...cur, opt.v]});
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition ${
                                    active
                                      ? 'bg-teal-500 text-white border-teal-500 shadow-sm'
                                      : 'card-subtle-theme border-subtle-theme text-muted-theme hover:text-main-theme'
                                  }`}
                                >
                                  {opt.l}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Mode Kerja */}
                        <div className="space-y-2">
                          <label className="block text-[11px] font-semibold text-muted-theme uppercase tracking-wider">Mode Kerja</label>
                          <div className="flex flex-wrap gap-1.5">
                            {[{v:'onsite',l:'On-site'},{v:'hybrid',l:'Hybrid'},{v:'remote',l:'Remote'}].map(opt => {
                              const active = (config.workMode || []).includes(opt.v);
                              return (
                                <button
                                  key={opt.v}
                                  type="button"
                                  onClick={() => {
                                    const cur = config.workMode || [];
                                    setConfig({...config, workMode: active ? cur.filter(x=>x!==opt.v) : [...cur, opt.v]});
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition ${
                                    active
                                      ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                                      : 'card-subtle-theme border-subtle-theme text-muted-theme hover:text-main-theme'
                                  }`}
                                >
                                  {opt.l}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Level Pengalaman */}
                        <div className="space-y-2">
                          <label className="block text-[11px] font-semibold text-muted-theme uppercase tracking-wider">Level Pengalaman</label>
                          <div className="flex flex-wrap gap-1.5">
                            {[{v:'fresh',l:'Fresh Grad'},{v:'1-3',l:'1–3 Tahun'},{v:'3-5',l:'3–5 Tahun'},{v:'5+',l:'5+ Tahun'}].map(opt => {
                              const active = (config.experienceLevel || []).includes(opt.v);
                              return (
                                <button
                                  key={opt.v}
                                  type="button"
                                  onClick={() => {
                                    const cur = config.experienceLevel || [];
                                    setConfig({...config, experienceLevel: active ? cur.filter(x=>x!==opt.v) : [...cur, opt.v]});
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition ${
                                    active
                                      ? 'bg-purple-500 text-white border-purple-500 shadow-sm'
                                      : 'card-subtle-theme border-subtle-theme text-muted-theme hover:text-main-theme'
                                  }`}
                                >
                                  {opt.l}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <p className="text-[10px] text-muted-theme pt-1 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        <span>Filter ini berlaku untuk <b className="text-main-theme">LinkedIn, Indeed, Glints, dan Jobstreet</b>. Tidak semua filter tersedia di setiap platform.</span>
                      </p>
                    </div>

                    {/* MULTI-AKUN & KESIAPAN SESI LOGIN PORTAL KERJA */}
                    <div id="tour-cookie-sync" className="p-5 sm:p-6 rounded-2xl border border-subtle-theme card-subtle-theme space-y-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-subtle-theme pb-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-orange-500/15 text-orange-500 flex items-center justify-center">
                            <Users className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-main-theme flex items-center gap-2">
                              <span>Manajemen Akun &amp; Verifikasi Sesi Portal</span>
                              <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                                Multi-Akun Aktif
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-theme mt-0.5">
                              Dukungan multi-profil browser untuk rotasi akun serta verifikasi apakah akun job portal sudah terotentikasi.
                            </p>
                          </div>
                        </div>

                        {/* Button Actions */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              setRawCookieInput(config.portalCookies?.[cookieTargetPlatform] || '');
                              setIsCookieModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 text-xs font-medium flex items-center gap-1.5 transition shadow-sm"
                            title="Impor cookie sesi dari browser untuk autentikasi langsung"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Impor Cookies</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCheckAccountSessions()}
                            disabled={isCheckingSessions || isSetupBrowserRunning}
                            className="px-3 py-1.5 rounded-xl border border-subtle-theme card-theme hover:text-main-theme text-muted-theme text-xs font-medium flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
                            title="Periksa apakah cookies/sesi masih aktif di browser tanpa membuka jendela"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isCheckingSessions ? 'animate-spin text-orange-500' : 'text-slate-400'}`} />
                            <span>{isCheckingSessions ? 'Memeriksa...' : 'Cek Status Sesi'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const activeAcc = (config.browserAccounts || []).find(a => a.id === config.activeBrowserAccountId);
                              handleToggleSetupBrowser(activeAcc?.profileFolder);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition shadow-sm ${
                              isSetupBrowserRunning
                                ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                                : 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30'
                            }`}
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>{isSetupBrowserRunning ? 'Tutup Login' : 'Buka Browser Login'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setIsAddAccountModalOpen(true)}
                            className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white hover:opacity-90 text-white dark:text-slate-900 text-xs font-medium flex items-center gap-1.5 transition shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Tambah Akun</span>
                          </button>
                        </div>
                      </div>

                      {/* Account Profiles Switcher (Pill / Cards) */}
                      <div className="space-y-2">
                        <label className="block text-[11px] font-semibold text-muted-theme uppercase tracking-wider">
                          Pilih Profil Akun Browser
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                          {(config.browserAccounts || [
                            { id: 'account-1', name: 'Akun Utama', profileFolder: 'automation-profile', createdAt: '2026-09-19' }
                          ]).map((acc) => {
                            const isActive = (config.activeBrowserAccountId || 'account-1') === acc.id;
                            const accSessions = sessionStatuses[acc.id];
                            return (
                              <div
                                key={acc.id}
                                onClick={() => handleSelectActiveAccount(acc.id)}
                                className={`p-3 rounded-xl border text-left transition cursor-pointer relative flex flex-col justify-between ${
                                  isActive
                                    ? 'bg-orange-500/10 border-orange-500 shadow-sm ring-1 ring-orange-500/30'
                                    : 'card-theme border-subtle-theme hover:opacity-95'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                  <div className="flex items-center gap-2 truncate">
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                                      isActive ? 'bg-orange-500 text-white' : 'bg-slate-500/15 text-muted-theme'
                                    }`}>
                                      {acc.name.slice(0, 1).toUpperCase()}
                                    </div>
                                    <span className="text-xs font-semibold text-main-theme truncate">{acc.name}</span>
                                  </div>
                                  {isActive && (
                                    <span className="text-[10px] font-medium bg-orange-500/20 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded border border-orange-500/30 shrink-0">
                                      Aktif
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center justify-between text-[10px] text-muted-theme mt-1 pt-1.5 border-t border-subtle-theme">
                                  <span className="font-mono truncate">{acc.profileFolder}</span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCheckAccountSessions(acc.id);
                                      }}
                                      className="hover:text-orange-500 transition"
                                      title="Cek sesi akun ini"
                                    >
                                      <RefreshCw className="w-3 h-3" />
                                    </button>
                                    {(config.browserAccounts || []).length > 1 && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteAccount(acc.id);
                                        }}
                                        className="hover:text-rose-500 transition"
                                        title="Hapus profil akun ini"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Clean Session Status Table for Currently Active Account */}
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-[11px] font-semibold text-muted-theme uppercase tracking-wider">
                            Status Autentikasi Job Portal (Profil Aktif)
                          </label>
                          <span className="text-[10px] text-muted-theme">
                            {sessionStatuses[config.activeBrowserAccountId || 'account-1']
                              ? 'Terverifikasi langsung dari browser'
                              : 'Klik "Cek Status Sesi" untuk memindai login status terkini'}
                          </span>
                        </div>

                        <div className="rounded-xl border border-subtle-theme overflow-hidden card-theme">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-500/5 border-b border-subtle-theme text-[11px] text-muted-theme font-medium">
                                <tr>
                                  <th className="py-2.5 px-3.5">Platform</th>
                                  <th className="py-2.5 px-3.5">Status Filter</th>
                                  <th className="py-2.5 px-3.5">Sesi Login</th>
                                  <th className="py-2.5 px-3.5">Keterangan</th>
                                  <th className="py-2.5 px-3.5 text-right">Aksi</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-subtle-theme font-normal">
                                {/* Glints */}
                                <tr className="hover:bg-slate-500/5 transition">
                                  <td className="py-2.5 px-3.5 font-medium text-main-theme flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                                    <span>Glints</span>
                                  </td>
                                  <td className="py-2.5 px-3.5">
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                                      config.enableGlints
                                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                        : 'bg-slate-500/10 text-muted-theme'
                                    }`}>
                                      {config.enableGlints ? 'Diikutsertakan' : 'Dinonaktifkan'}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3.5">
                                    {(() => {
                                      const status = sessionStatuses[config.activeBrowserAccountId || 'account-1']?.glints;
                                      if (!status) {
                                        return <span className="text-[11px] text-muted-theme">Belum Diperiksa</span>;
                                      }
                                      return status.loggedIn ? (
                                        <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                          <Check className="w-3 h-3" /> Sudah Login
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                          <ShieldAlert className="w-3 h-3" /> Belum Login
                                        </span>
                                      );
                                    })()}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-muted-theme text-[11px]">
                                    {sessionStatuses[config.activeBrowserAccountId || 'account-1']?.glints?.details || 'Siap digunakan jika sudah login'}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-right">
                                    <a
                                      href="https://glints.com/id"
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-orange-500 hover:underline inline-flex items-center gap-1 text-[11px]"
                                    >
                                      <span>Buka Glints</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </td>
                                </tr>

                                {/* JobStreet */}
                                <tr className="hover:bg-slate-500/5 transition">
                                  <td className="py-2.5 px-3.5 font-medium text-main-theme flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                                    <span>JobStreet</span>
                                  </td>
                                  <td className="py-2.5 px-3.5">
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                                      config.enableJobstreet
                                        ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                                        : 'bg-slate-500/10 text-muted-theme'
                                    }`}>
                                      {config.enableJobstreet ? 'Diikutsertakan' : 'Dinonaktifkan'}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3.5">
                                    {(() => {
                                      const status = sessionStatuses[config.activeBrowserAccountId || 'account-1']?.jobstreet;
                                      if (!status) {
                                        return <span className="text-[11px] text-muted-theme">Belum Diperiksa</span>;
                                      }
                                      return status.loggedIn ? (
                                        <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                          <Check className="w-3 h-3" /> Sudah Login
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                          <ShieldAlert className="w-3 h-3" /> Belum Login
                                        </span>
                                      );
                                    })()}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-muted-theme text-[11px]">
                                    {sessionStatuses[config.activeBrowserAccountId || 'account-1']?.jobstreet?.details || 'Dibutuhkan sesi profil seeker Jobstreet'}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-right">
                                    <a
                                      href="https://id.jobstreet.com"
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-orange-500 hover:underline inline-flex items-center gap-1 text-[11px]"
                                    >
                                      <span>Buka JobStreet</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </td>
                                </tr>

                                {/* LinkedIn */}
                                <tr className="hover:bg-slate-500/5 transition">
                                  <td className="py-2.5 px-3.5 font-medium text-main-theme flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                                    <span>LinkedIn</span>
                                  </td>
                                  <td className="py-2.5 px-3.5">
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                                      config.enableLinkedin
                                        ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20'
                                        : 'bg-slate-500/10 text-muted-theme'
                                    }`}>
                                      {config.enableLinkedin ? 'Diikutsertakan' : 'Dinonaktifkan'}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3.5">
                                    {(() => {
                                      const status = sessionStatuses[config.activeBrowserAccountId || 'account-1']?.linkedin;
                                      if (!status) {
                                        return <span className="text-[11px] text-muted-theme">Belum Diperiksa</span>;
                                      }
                                      return status.loggedIn ? (
                                        <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                          <Check className="w-3 h-3" /> Sudah Login
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                          <ShieldAlert className="w-3 h-3" /> Belum Login
                                        </span>
                                      );
                                    })()}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-muted-theme text-[11px]">
                                    {sessionStatuses[config.activeBrowserAccountId || 'account-1']?.linkedin?.details || 'Membutuhkan akun LinkedIn yang telah login'}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-right">
                                    <a
                                      href="https://www.linkedin.com"
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-orange-500 hover:underline inline-flex items-center gap-1 text-[11px]"
                                    >
                                      <span>Buka LinkedIn</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </td>
                                </tr>

                                {/* Indeed */}
                                <tr className="hover:bg-slate-500/5 transition">
                                  <td className="py-2.5 px-3.5 font-medium text-main-theme flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span>Indeed</span>
                                  </td>
                                  <td className="py-2.5 px-3.5">
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                                      config.enableIndeed
                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                        : 'bg-slate-500/10 text-muted-theme'
                                    }`}>
                                      {config.enableIndeed ? 'Diikutsertakan' : 'Dinonaktifkan'}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3.5">
                                    {(() => {
                                      const status = sessionStatuses[config.activeBrowserAccountId || 'account-1']?.indeed;
                                      if (!status) {
                                        return <span className="text-[11px] text-muted-theme">Belum Diperiksa</span>;
                                      }
                                      return status.loggedIn ? (
                                        <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                          <Check className="w-3 h-3" /> Sudah Login
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                          <ShieldAlert className="w-3 h-3" /> Belum Login
                                        </span>
                                      );
                                    })()}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-muted-theme text-[11px]">
                                    {sessionStatuses[config.activeBrowserAccountId || 'account-1']?.indeed?.details || 'Dibutuhkan sesi akun Indeed'}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-right">
                                    <a
                                      href="https://id.indeed.com"
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-orange-500 hover:underline inline-flex items-center gap-1 text-[11px]"
                                    >
                                      <span>Buka Indeed</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3: ENVIRONMENT & GOOGLE SHEETS */}
                {wizardStep === 3 && (
                  <div id="tour-engine-setup" className="space-y-6">
                    <div className="border-b border-subtle-theme pb-4">
                      <h2 className="text-base font-semibold text-main-theme">Browser &amp; Spreadsheet</h2>
                      <p className="text-xs text-muted-theme mt-0.5">
                        Tentukan executable browser Google Chrome serta konfigurasi sinkronisasi Google Sheets.
                      </p>
                    </div>

                    {/* Browser Engine Selection */}
                    <div id="field-step3-browser" className="space-y-3 transition-all">
                      <div>
                        <label className="block text-xs font-semibold text-main-theme">Pilihan Mesin Browser Otomatisasi</label>
                        <p className="text-[11px] text-muted-theme mt-0.5">
                          Pilih antara Google Chrome asli yang terpasang di komputer Anda (sangat disarankan untuk lolos Cloudflare &amp; proteksi bot) atau Chromium bawaan Puppeteer.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setConfig({ ...config, useSystemChrome: true })}
                          className={`p-4 rounded-2xl border text-left transition flex items-center justify-between ${
                            config.useSystemChrome !== false
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-white shadow-sm ring-1 ring-emerald-500/30'
                              : 'card-subtle-theme border-subtle-theme text-muted-theme hover:opacity-90'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-main-theme">Google Chrome Sistem (Browser Asli)</span>
                              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                Sangat Direkomendasikan
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-theme mt-1 leading-relaxed">
                              Menggunakan instalasi resmi Google Chrome di PC Anda. Memiliki sidik jari browser asli (real browser fingerprint) sehingga terhindar dari pemblokiran Cloudflare &amp; captcha login portal.
                            </div>
                          </div>
                          {config.useSystemChrome !== false && <Check className="w-4 h-4 text-emerald-500 shrink-0 ml-2" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => setConfig({ ...config, useSystemChrome: false })}
                          className={`p-4 rounded-2xl border text-left transition flex items-center justify-between ${
                            config.useSystemChrome === false
                              ? 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-white shadow-sm ring-1 ring-amber-500/30'
                              : 'card-subtle-theme border-subtle-theme text-muted-theme hover:opacity-90'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-main-theme">Chromium Bawaan (Puppeteer Bundled)</span>
                              <span className="text-[10px] text-muted-theme bg-slate-500/10 px-1.5 py-0.5 rounded border border-subtle-theme">
                                Cadangan
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-theme mt-1 leading-relaxed">
                              Executable browser Chromium yang terunduh otomatis oleh Puppeteer. Praktis tanpa perlu instalasi Chrome, namun di beberapa portal seperti LinkedIn terkadang lebih mudah terdeteksi automasi.
                            </div>
                          </div>
                          {config.useSystemChrome === false && <Check className="w-4 h-4 text-amber-500 shrink-0 ml-2" />}
                        </button>
                      </div>

                      {config.useSystemChrome !== false && (
                        <div className="p-3 rounded-xl card-subtle-theme border border-subtle-theme">
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[11px] font-medium text-main-theme">
                              Path Khusus Executable Chrome (Opsional)
                            </label>
                            <span className="text-[10px] text-muted-theme bg-slate-500/10 px-1.5 py-0.5 rounded border border-subtle-theme">Auto-detect Default</span>
                          </div>
                          <input
                            type="text"
                            value={config.customChromePath || ''}
                            onChange={(e) => setConfig({ ...config, customChromePath: e.target.value })}
                            className="w-full input-theme border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-orange-500 font-mono transition"
                            placeholder="C:\Program Files\Google\Chrome\Application\chrome.exe"
                          />
                          <p className="text-[10px] text-muted-theme mt-1">
                            Biarkan kosong jika Chrome terpasang di lokasi standar Windows. Sistem akan otomatis mendeteksi channel &apos;chrome&apos;.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Storage Type Selection */}
                    <div id="field-step3-storage" className="space-y-3 pt-2 border-t border-subtle-theme transition-all">
                      <div>
                        <label className="block text-xs font-semibold text-main-theme">Media Penyimpanan Riwayat Lamaran</label>
                        <p className="text-[11px] text-muted-theme mt-0.5">
                          Pilih lokasi pencatatan hasil lamaran kerja. Database lokal (SQLite) direkomendasikan untuk performa maksimal.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Option 1: SQLite DB (Default) */}
                        <button
                          type="button"
                          onClick={() => setConfig({ ...config, storageType: 'sqlite' })}
                          className={`p-4 rounded-2xl border text-left transition relative flex flex-col justify-between ${
                            (config.storageType || 'sqlite') === 'sqlite'
                              ? 'bg-orange-500/10 border-orange-500 text-main-theme shadow-sm ring-1 ring-orange-500/30'
                              : 'card-subtle-theme border-subtle-theme text-muted-theme hover:opacity-90'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="w-8 h-8 rounded-xl bg-orange-500/15 text-orange-500 flex items-center justify-center font-bold text-xs">
                              <Database className="w-4 h-4" />
                            </div>
                            {(config.storageType || 'sqlite') === 'sqlite' && (
                              <div className="flex items-center gap-1 text-[10px] font-semibold text-orange-600 dark:text-orange-400 bg-orange-500/15 px-2 py-0.5 rounded-full">
                                <Check className="w-3 h-3" />
                                <span>Default</span>
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-main-theme">Database SQLite</div>
                            <div className="text-[11px] text-muted-theme mt-0.5">
                              Paling cepat, zero-latency, pencarian duplikat instan (0.1ms) tanpa kuota.
                            </div>
                          </div>
                        </button>

                        {/* Option 2: JSON File */}
                        <button
                          type="button"
                          onClick={() => setConfig({ ...config, storageType: 'json' })}
                          className={`p-4 rounded-2xl border text-left transition relative flex flex-col justify-between ${
                            config.storageType === 'json'
                              ? 'bg-sky-500/10 border-sky-500 text-main-theme shadow-sm ring-1 ring-sky-500/30'
                              : 'card-subtle-theme border-subtle-theme text-muted-theme hover:opacity-90'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-500 flex items-center justify-center font-bold text-xs">
                              <FileJson className="w-4 h-4" />
                            </div>
                            {config.storageType === 'json' && (
                              <div className="flex items-center gap-1 text-[10px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-500/15 px-2 py-0.5 rounded-full">
                                <Check className="w-3 h-3" />
                                <span>Aktif</span>
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-main-theme">Local JSON File</div>
                            <div className="text-[11px] text-muted-theme mt-0.5">
                              Tersimpan di `applied_jobs.json`. Mudah dibaca manusia & diedit manual.
                            </div>
                          </div>
                        </button>

                        {/* Option 3: Google Sheets */}
                        <button
                          type="button"
                          onClick={() => setConfig({ ...config, storageType: 'sheets' })}
                          className={`p-4 rounded-2xl border text-left transition relative flex flex-col justify-between ${
                            config.storageType === 'sheets'
                              ? 'bg-emerald-500/10 border-emerald-500 text-main-theme shadow-sm ring-1 ring-emerald-500/30'
                              : 'card-subtle-theme border-subtle-theme text-muted-theme hover:opacity-90'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center font-bold text-xs">
                              <FileSpreadsheet className="w-4 h-4" />
                            </div>
                            {config.storageType === 'sheets' && (
                              <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                                <Check className="w-3 h-3" />
                                <span>Aktif</span>
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-main-theme">Google Sheets API</div>
                            <div className="text-[11px] text-muted-theme mt-0.5">
                              Sinkronisasi cloud ke spreadsheet Google Drive secara real-time.
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Google Sheets Settings (Always visible or customizable) */}
                    <div className={`space-y-4 pt-4 border-t border-subtle-theme transition-all ${
                      config.storageType === 'sheets' ? 'opacity-100' : 'opacity-80'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-semibold text-main-theme">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                          <span>Kredensial &amp; Konfigurasi Google Sheets</span>
                        </div>
                        {config.storageType !== 'sheets' && (
                          <span className="text-[11px] text-muted-theme bg-slate-500/10 px-2 py-0.5 rounded border border-subtle-theme">
                            Hanya diperlukan bila storage Google Sheets dipilih
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-xs font-medium text-main-theme">Spreadsheet ID</label>
                            <span className="text-[10px] text-muted-theme bg-slate-500/10 px-1.5 py-0.5 rounded border border-subtle-theme">
                              {config.storageType === 'sheets' ? 'Wajib' : 'Opsional'}
                            </span>
                          </div>
                          <input
                            type="text"
                            value={config.spreadsheetId || ''}
                            onChange={(e) => setConfig({ ...config, spreadsheetId: e.target.value })}
                            className="w-full input-theme border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-orange-500 font-mono transition"
                            placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-xs font-medium text-main-theme">Nama Sheet Tab</label>
                            <span className="text-[10px] text-muted-theme bg-slate-500/10 px-1.5 py-0.5 rounded border border-subtle-theme">Opsional</span>
                          </div>
                          <input
                            type="text"
                            value={config.sheetName || 'Sheet1'}
                            onChange={(e) => setConfig({ ...config, sheetName: e.target.value })}
                            className="w-full input-theme border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-orange-500 transition"
                            placeholder="Sheet1"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-medium text-main-theme">
                            Google Credentials JSON (Service Account)
                          </label>
                          <span className="text-[10px] text-muted-theme bg-slate-500/10 px-1.5 py-0.5 rounded border border-subtle-theme">
                            {config.storageType === 'sheets' ? 'Wajib' : 'Opsional'}
                          </span>
                        </div>
                        <textarea
                          rows={4}
                          value={config.googleCredentialsJson || ''}
                          onChange={(e) => setConfig({ ...config, googleCredentialsJson: e.target.value })}
                          className="w-full input-theme border rounded-xl p-3 text-xs focus:outline-none focus:border-orange-500 font-mono transition"
                          placeholder='{"type": "service_account", "project_id": "...", ...}'
                        />
                      </div>
                    </div>

                    {/* AI Gateway & Multi-Provider Settings */}
                    <div id="field-step3-ai" className="space-y-4 pt-4 border-t border-subtle-theme transition-all">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <Bot className="w-4 h-4 text-orange-500" />
                            <span className="text-xs font-semibold text-main-theme">Pengaturan AI Model &amp; Router Gateway</span>
                            {readinessMetrics.hasAi ? (
                              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                <span>AI Siap</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                                Wajib Diisi
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-theme mt-0.5">
                            Kelola endpoint AI Anda. Anda dapat menambahkan Google Gemini, 9Router, OpenRouter, atau server AI kustom berapapun tanpa batas dengan auto-fallback.
                          </p>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <button
                            type="button"
                            onClick={() => {
                              const newEndpoint: AiEndpointConfig = {
                                id: `ep-${Date.now()}`,
                                name: `Custom Router ${(config.aiEndpoints?.length || 0) + 1}`,
                                type: 'openai_compatible',
                                baseUrl: 'https://api.9router.com/v1',
                                apiKey: '',
                                model: 'google/gemini-2.5-flash',
                                isActive: false,
                              };
                              const list = [...(config.aiEndpoints || []), newEndpoint];
                              setConfig({ ...config, aiEndpoints: list });
                              toast.success('Provider AI baru ditambahkan! Silakan isi Base URL dan API Key.');
                            }}
                            className="px-3 py-1.5 rounded-xl card-subtle-theme border border-subtle-theme text-main-theme hover:opacity-90 text-xs font-medium transition flex items-center gap-1.5 shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5 text-orange-500" />
                            <span>Tambah Provider AI</span>
                          </button>

                          <button
                            type="button"
                            disabled={isTestingAi || !readinessMetrics.hasAi}
                            onClick={handleTestAi}
                            className="px-3.5 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/30 text-xs font-medium transition flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{isTestingAi ? 'Menguji...' : 'Uji Koneksi AI'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Dynamic Provider Cards List */}
                      <div className="space-y-3">
                        {(config.aiEndpoints || []).map((endpoint, index) => {
                          const isEndpointActive = (config.activeAiEndpointId === endpoint.id) || (!config.activeAiEndpointId && index === 0);

                          return (
                            <div
                              key={endpoint.id}
                              className={`p-4 rounded-2xl border transition-all space-y-3 ${
                                isEndpointActive
                                  ? 'card-subtle-theme border-orange-500/60 shadow-sm ring-1 ring-orange-500/20'
                                  : 'card-theme border-subtle-theme'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3 border-b border-subtle-theme pb-2.5">
                                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = (config.aiEndpoints || []).map((e) => ({
                                        ...e,
                                        isActive: e.id === endpoint.id,
                                      }));
                                      setConfig({ ...config, aiEndpoints: updated, activeAiEndpointId: endpoint.id });
                                      toast.info(`Provider utama diubah ke: ${endpoint.name}`);
                                    }}
                                    className={`w-4 h-4 rounded-full border flex items-center justify-center transition shrink-0 ${
                                      isEndpointActive ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-400'
                                    }`}
                                    title={isEndpointActive ? 'Provider Utama (Aktif)' : 'Jadikan Provider Utama'}
                                  >
                                    {isEndpointActive && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                  </button>

                                  <input
                                    type="text"
                                    value={endpoint.name}
                                    onChange={(e) => {
                                      const updated = (config.aiEndpoints || []).map((item) =>
                                        item.id === endpoint.id ? { ...item, name: e.target.value } : item
                                      );
                                      setConfig({ ...config, aiEndpoints: updated });
                                    }}
                                    className="text-xs font-semibold text-main-theme bg-transparent border-b border-transparent hover:border-subtle-theme focus:border-orange-500 focus:outline-none px-1 py-0.5 max-w-[200px]"
                                    placeholder="Nama Provider"
                                  />

                                  <span className="text-[10px] text-muted-theme bg-slate-500/10 px-2 py-0.5 rounded border border-subtle-theme shrink-0">
                                    {endpoint.type === 'gemini' ? 'Google Gemini Native' : 'OpenAI-Compatible (9Router/Custom)'}
                                  </span>

                                  {isEndpointActive && (
                                    <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20 shrink-0">
                                      Prioritas Utama
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    disabled={!endpoint.apiKey?.trim() || isTestingAi}
                                    onClick={async () => {
                                      setIsTestingAi(true);
                                      const toastId = toast.loading(`Menguji koneksi ke ${endpoint.name}...`);
                                      try {
                                        const res = await fetch('/api/test-ai', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ endpoint }),
                                        });
                                        const data = await res.json();
                                        if (data.success) {
                                          toast.success(`Koneksi ${endpoint.name} Berhasil! Respon: "${data.reply || data.message}"`, { id: toastId, duration: 4000 });
                                        } else {
                                          toast.error(`Gagal: ${data.error || 'Provider tidak merespon'}`, { id: toastId, duration: 5000 });
                                        }
                                      } catch (e: any) {
                                        toast.error(`Koneksi error: ${e?.message || e}`, { id: toastId });
                                      } finally {
                                        setIsTestingAi(false);
                                      }
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/30 text-[11px] font-medium transition flex items-center gap-1 disabled:opacity-40"
                                    title="Uji koneksi khusus endpoint ini"
                                  >
                                    <Sparkles className="w-3 h-3" />
                                    <span>Tes Endpoint</span>
                                  </button>

                                  {(config.aiEndpoints || []).length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (confirm(`Hapus provider AI "${endpoint.name}"?`)) {
                                          const filtered = (config.aiEndpoints || []).filter((e) => e.id !== endpoint.id);
                                          const nextActiveId = isEndpointActive ? (filtered[0]?.id || '') : config.activeAiEndpointId;
                                          setConfig({ ...config, aiEndpoints: filtered, activeAiEndpointId: nextActiveId });
                                          toast.success('Provider AI dihapus');
                                        }
                                      }}
                                      className="p-1.5 rounded-lg text-muted-theme hover:text-rose-500 hover:bg-rose-500/10 transition"
                                      title="Hapus Provider"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Form Inputs for this Provider */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                                {endpoint.type === 'openai_compatible' ? (
                                  <>
                                    <div>
                                      <label className="block text-[11px] font-medium text-main-theme mb-1">Base URL Endpoint</label>
                                      <input
                                        type="text"
                                        value={endpoint.baseUrl}
                                        onChange={(e) => {
                                          const updated = (config.aiEndpoints || []).map((item) =>
                                            item.id === endpoint.id ? { ...item, baseUrl: e.target.value } : item
                                          );
                                          setConfig({ ...config, aiEndpoints: updated });
                                        }}
                                        className="w-full input-theme border rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-orange-500"
                                        placeholder="https://api.9router.com/v1"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-[11px] font-medium text-main-theme mb-1">Nama Model</label>
                                      <input
                                        type="text"
                                        value={endpoint.model}
                                        onChange={(e) => {
                                          const updated = (config.aiEndpoints || []).map((item) =>
                                            item.id === endpoint.id ? { ...item, model: e.target.value } : item
                                          );
                                          setConfig({ ...config, aiEndpoints: updated });
                                        }}
                                        className="w-full input-theme border rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-orange-500"
                                        placeholder="google/gemini-2.5-flash atau gpt-4o-mini"
                                      />
                                    </div>

                                    <div>
                                      <div className="flex items-center justify-between mb-1">
                                        <label className="block text-[11px] font-medium text-main-theme">API Key / Token</label>
                                        <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400">Wajib</span>
                                      </div>
                                      <input
                                        type="password"
                                        value={endpoint.apiKey}
                                        onChange={(e) => {
                                          const updated = (config.aiEndpoints || []).map((item) =>
                                            item.id === endpoint.id ? { ...item, apiKey: e.target.value } : item
                                          );
                                          setConfig({ ...config, aiEndpoints: updated, customAiApiKey: e.target.value });
                                        }}
                                        className="w-full input-theme border rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-orange-500"
                                        placeholder="sk-..."
                                      />
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="md:col-span-2">
                                      <div className="flex items-center justify-between mb-1">
                                        <label className="block text-[11px] font-medium text-main-theme">Gemini API Key</label>
                                        <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400">Wajib</span>
                                      </div>
                                      <input
                                        type="password"
                                        value={endpoint.apiKey}
                                        onChange={(e) => {
                                          const updated = (config.aiEndpoints || []).map((item) =>
                                            item.id === endpoint.id ? { ...item, apiKey: e.target.value } : item
                                          );
                                          setConfig({ ...config, aiEndpoints: updated, geminiApiKey: e.target.value });
                                        }}
                                        className="w-full input-theme border rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-orange-500"
                                        placeholder="AIzaSy..."
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-[11px] font-medium text-main-theme mb-1">Model Gemini</label>
                                      <input
                                        type="text"
                                        value={endpoint.model || 'gemini-2.5-flash'}
                                        onChange={(e) => {
                                          const updated = (config.aiEndpoints || []).map((item) =>
                                            item.id === endpoint.id ? { ...item, model: e.target.value } : item
                                          );
                                          setConfig({ ...config, aiEndpoints: updated });
                                        }}
                                        className="w-full input-theme border rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-orange-500"
                                        placeholder="gemini-2.5-flash"
                                      />
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="p-3.5 rounded-xl card-subtle-theme border border-subtle-theme text-[11px] text-muted-theme flex items-center justify-between">
                        <span>
                          ℹ️ <strong>Auto Failover:</strong> Jika provider prioritas utama mengalami limit/gangguan, sistem otomatis beralih ke provider berikutnya dalam daftar.
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Form Footer Action Navigation */}
                <div className="flex items-center justify-between pt-4 border-t border-subtle-theme">
                  <div className="flex items-center gap-2">
                    {wizardStep > 1 && (
                      <button
                        type="button"
                        onClick={() => setWizardStep((prev) => (prev - 1) as WizardStep)}
                        className="px-4 py-2 rounded-xl card-subtle-theme hover:opacity-90 border border-subtle-theme text-muted-theme hover:text-main-theme text-xs font-medium transition"
                      >
                        Kembali
                      </button>
                    )}

                    {/* Save Preset Button */}
                    {!showSavePresetInput ? (
                      <button
                        type="button"
                        onClick={() => setShowSavePresetInput(true)}
                        className="px-3.5 py-2 rounded-xl card-subtle-theme border border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 text-xs font-medium transition flex items-center gap-1.5"
                        title="Simpan konfigurasi saat ini sebagai preset yang bisa dimuat kembali nanti"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Simpan Preset</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2 duration-200">
                        <input
                          type="text"
                          autoFocus
                          value={newPresetName}
                          onChange={e => setNewPresetName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSavePreset(); if (e.key === 'Escape') setShowSavePresetInput(false); }}
                          placeholder="Nama preset..."
                          className="input-theme border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500 w-40 transition"
                        />
                        <button
                          type="button"
                          disabled={isSavingPreset}
                          onClick={handleSavePreset}
                          className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-xs font-medium transition"
                        >
                          Simpan
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowSavePresetInput(false); setNewPresetName(''); }}
                          className="p-2 rounded-xl card-subtle-theme border border-subtle-theme text-muted-theme hover:text-main-theme transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={isSavingConfig}
                      className="px-5 py-2.5 rounded-xl card-subtle-theme hover:opacity-90 border border-subtle-theme text-main-theme text-xs font-medium transition disabled:opacity-50"
                    >
                      {isSavingConfig ? 'Menyimpan...' : 'Simpan Data'}
                    </button>

                    {wizardStep < 3 ? (
                      <button
                        type="button"
                        onClick={async () => {
                          const isValid = await handleSaveConfig(undefined, true, wizardStep);
                          if (isValid) {
                            setWizardStep((prev) => (prev + 1) as WizardStep);
                          }
                        }}
                        className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium flex items-center gap-2 transition shadow-sm"
                      >
                        <span>Lanjut Langkah Berikutnya</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          const isValid = await handleSaveConfig(undefined, false, 3);
                          if (isValid) {
                            setActiveTab('logs');
                            toast.success('Konfigurasi lengkap tersimpan! Siap menjalankan bot.');
                          }
                        }}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-2 transition shadow-sm"
                      >
                        <span>Selesai &amp; Buka Monitor</span>
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: LIVE MONITOR LOGS */}
          {activeTab === 'logs' && (
            <div id="tour-terminal-logs" className="p-6 md:p-8 rounded-3xl card-theme border shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-subtle-theme pb-4">
                <div className="flex items-center gap-2.5">
                  <Terminal className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-semibold text-main-theme">Log Aktivitas Mesin Otomasi</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (logs.length === 0) {
                        toast.info('Belum ada log untuk disalin');
                        return;
                      }
                      navigator.clipboard.writeText(logs.join('\n'));
                      toast.success(`${logs.length} baris log berhasil disalin ke clipboard!`);
                    }}
                    className="px-3 py-1.5 rounded-lg card-subtle-theme border border-subtle-theme text-muted-theme hover:text-main-theme text-xs transition flex items-center gap-1.5 shadow-2xs"
                    title="Salin seluruh log aktivitas ke clipboard"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Log</span>
                  </button>
                  <button
                    onClick={() => setLogs([])}
                    className="px-3 py-1.5 rounded-lg card-subtle-theme border border-subtle-theme text-muted-theme hover:text-main-theme text-xs transition"
                  >
                    Bersihkan Layar
                  </button>
                </div>
              </div>

              <div
                ref={logTerminalRef}
                className="h-[460px] bg-slate-950 text-slate-200 rounded-2xl border border-slate-800 p-4 font-mono text-xs overflow-y-auto space-y-1.5 shadow-inner"
              >
                {logs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-500 italic">
                    Belum ada riwayat aktivitas. Silakan jalankan bot untuk mulai memantau.
                  </div>
                ) : (
                  logs.map((log, index) => {
                    let textClass = 'text-slate-300';
                    if (log.includes('✅') || log.includes('berhasil') || log.includes('success')) {
                      textClass = 'text-emerald-400';
                    } else if (log.includes('❌') || log.includes('error') || log.includes('gagal')) {
                      textClass = 'text-rose-400';
                    } else if (log.includes('⚠️') || log.includes('warning')) {
                      textClass = 'text-amber-400';
                    } else if (log.includes('🚀') || log.includes('Starting')) {
                      textClass = 'text-orange-400 font-semibold';
                    }

                    return (
                      <div key={index} className={textClass}>
                        {log}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: QUESTIONS CSV DATABASE */}
          {activeTab === 'questions' && (
            <div id="tour-batch-questions" className="p-6 md:p-8 rounded-3xl card-theme border shadow-sm space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-subtle-theme pb-4">
                <div>
                  <h2 className="text-base font-semibold text-main-theme">Database Soal Kuesioner</h2>
                  <p className="text-xs text-muted-theme mt-0.5">
                    Total {questions.length} pertanyaan tersimpan di file internal.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="card-subtle-theme border border-subtle-theme rounded-xl p-1 flex text-xs">
                    <button
                      onClick={() => setCsvViewMode('table')}
                      className={`px-3 py-1.5 rounded-lg transition font-medium ${
                        csvViewMode === 'table' ? 'bg-orange-600 text-white' : 'text-muted-theme hover:text-main-theme'
                      }`}
                    >
                      Tabel Visual
                    </button>
                    <button
                      onClick={() => setCsvViewMode('raw')}
                      className={`px-3 py-1.5 rounded-lg transition font-medium ${
                        csvViewMode === 'raw' ? 'bg-orange-600 text-white' : 'text-muted-theme hover:text-main-theme'
                      }`}
                    >
                      Teks CSV
                    </button>
                  </div>

                  {/* Upload CSV Button with Validation Info */}
                  <div className="relative">
                    <input
                      ref={csvFileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleCsvFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isUploadingCsv}
                      onClick={() => csvFileInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-xl text-xs font-medium card-subtle-theme hover:opacity-90 text-main-theme border border-subtle-theme transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                      title="Upload file CSV (Maks 5 MB, format .csv)"
                    >
                      <Upload className="w-3.5 h-3.5 text-orange-500" />
                      <span>{isUploadingCsv ? 'Mengunggah...' : 'Upload File CSV'}</span>
                    </button>
                  </div>

                  <button
                    onClick={() => setIsNewQuestionModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl text-xs font-medium card-subtle-theme hover:opacity-90 text-main-theme border border-subtle-theme transition flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5 text-muted-theme" />
                    <span>Tambah Soal</span>
                  </button>

                  <button
                    onClick={handleCleanCsv}
                    className="px-3.5 py-2 rounded-xl text-xs font-medium card-subtle-theme hover:opacity-90 text-main-theme border border-subtle-theme transition flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-muted-theme" />
                    <span>Bersihkan Duplikat</span>
                  </button>

                  <button
                    onClick={handleSmartPersonalize}
                    className="px-3.5 py-2 rounded-xl text-xs font-medium bg-orange-600 hover:bg-orange-500 text-white transition flex items-center gap-1.5 shadow-sm"
                    title={isAiConfigured() ? "Sinkronkan jawaban dengan profil pelamar & AI" : "Sinkronkan jawaban otomatis dari profil kamu (0 token)"}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Personalisasi Jawaban</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      isAiConfigured() 
                        ? 'bg-white/25 text-white' 
                        : 'bg-black/25 text-white/90'
                    }`}>
                      {isAiConfigured() ? 'AI + Profil' : 'Profil'}
                    </span>
                  </button>

                  <button
                    onClick={handleClearAllQuestions}
                    className="px-3.5 py-2 rounded-xl text-xs font-medium bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition flex items-center gap-1.5"
                    title="Hapus semua pertanyaan dari database"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Semua</span>
                  </button>
                </div>
              </div>

              {/* Informative Upload Guidelines Banner */}
              <div className="flex items-center justify-between text-[11px] card-subtle-theme px-4 py-2.5 rounded-xl border border-subtle-theme">
                <div className="flex items-center gap-2 text-muted-theme">
                  <FileUp className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                  <span>
                    Upload CSV: Format file wajib <strong className="text-main-theme">.csv</strong> | Ukuran maks <strong className="text-main-theme">5 MB</strong>
                  </span>
                </div>
                <span className="text-[10px] text-muted-theme hidden sm:inline">
                  Struktur kolom: Question, Type, Options, Answer
                </span>
              </div>

              {/* Table or Raw View */}
              {csvViewMode === 'table' ? (
                <div className="space-y-4">
                  {/* Search and Filter */}
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-muted-theme absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Cari pertanyaan..."
                        value={questionSearch}
                        onChange={(e) => setQuestionSearch(e.target.value)}
                        className="w-full input-theme border rounded-xl pl-9 pr-3.5 py-2 text-xs focus:outline-none focus:border-orange-500 transition"
                      />
                    </div>
                    <span className="text-xs text-muted-theme shrink-0">
                      Menampilkan {filteredQuestions.length} dari {questions.length}
                    </span>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto rounded-2xl border border-subtle-theme">
                    <table className="w-full text-left text-xs">
                      <thead className="card-subtle-theme text-muted-theme font-medium border-b border-subtle-theme">
                        <tr>
                          <th className="p-3.5 w-12 text-center">#</th>
                          <th className="p-3.5">Pertanyaan HRD</th>
                          <th className="p-3.5 w-28">Tipe Form</th>
                          <th className="p-3.5 w-48">Jawaban Default / AI</th>
                          <th className="p-3.5 w-24 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y border-subtle-theme font-normal">
                        {filteredQuestions.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-muted-theme italic">
                              Tidak ada pertanyaan yang cocok dengan pencarian Anda.
                            </td>
                          </tr>
                        ) : (
                          filteredQuestions.map((q, idx) => (
                            <tr key={q.id || idx} className="hover:opacity-90 card-theme transition">
                              <td className="p-3.5 text-center text-muted-theme">{idx + 1}</td>
                              <td className="p-3.5 font-medium text-main-theme">{q.question}</td>
                              <td className="p-3.5">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium card-subtle-theme border border-subtle-theme text-muted-theme uppercase">
                                  {q.type}
                                </span>
                              </td>
                              <td className="p-3.5 font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                                {q.answer || <span className="text-muted-theme italic">(Kosong)</span>}
                              </td>
                              <td className="p-3.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => setEditingQuestion(q)}
                                    className="p-1.5 rounded-lg hover:bg-slate-500/10 text-muted-theme hover:text-main-theme transition"
                                    title="Edit Jawaban"
                                  >
                                    <Sliders className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteQuestion(q.id)}
                                    className="p-1.5 rounded-lg hover:bg-rose-500/10 text-muted-theme hover:text-rose-500 transition"
                                    title="Hapus"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea
                    rows={16}
                    value={rawCsvText}
                    onChange={(e) => setRawCsvText(e.target.value)}
                    className="w-full input-theme border rounded-2xl p-4 font-mono text-xs focus:outline-none focus:border-orange-500 transition"
                    placeholder="Question,Type,Options,Answer..."
                  />
                  <button
                    onClick={handleSaveRawCsv}
                    className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium transition shadow-sm"
                  >
                    Simpan Perubahan CSV
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: KARTU LOWONGAN */}
          {activeTab === 'jobs' && (
            <div id="tour-job-history" className="rounded-3xl card-theme border shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-subtle-theme">
                <div className="flex items-center gap-2.5">
                  <Briefcase className="w-4 h-4 text-teal-500" />
                  <h2 className="text-base font-semibold text-main-theme">Kartu Lowongan</h2>
                  <span className="text-[10px] font-medium bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded-full">
                    Visual Mode
                  </span>
                </div>
                <p className="text-xs text-muted-theme hidden sm:block">
                  Tampilan kartu dari semua lowongan yang sudah dilamar bot.
                </p>
              </div>
              <JobsTab
                jobs={appliedJobs}
                onRefresh={fetchAppliedHistory}
                onExportCsv={handleExportCsv}
                onSelectJob={(job: any) => setSelectedJobDetail(job)}
              />
            </div>
          )}

          {/* TAB 4: APPLICATION HISTORY */}
          {activeTab === 'history' && (
            <div className="p-6 md:p-8 rounded-3xl card-theme border shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-subtle-theme pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-main-theme">Riwayat Lamaran Terkirim</h2>
                    <span className="text-[10px] font-medium bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full capitalize flex items-center gap-1">
                      <Database className="w-3 h-3" />
                      <span>{config.storageType === 'sqlite' ? 'SQLite DB' : config.storageType === 'json' ? 'JSON File' : 'Google Sheets'}</span>
                    </span>
                  </div>
                  <p className="text-xs text-muted-theme mt-0.5">
                    {activeStorageInfo || 'Pencatatan data tersinkronisasi dengan media penyimpanan aktif.'}
                  </p>
                </div>
                
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleExportCsv}
                    disabled={appliedJobs.length === 0}
                    className="px-3.5 py-2 rounded-xl card-subtle-theme border border-subtle-theme text-main-theme hover:opacity-90 text-xs font-medium transition flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                    title="Unduh seluruh data lamaran dalam format CSV"
                  >
                    <Download className="w-3.5 h-3.5 text-orange-500" />
                    <span>Export CSV</span>
                  </button>

                  <button
                    onClick={handleExportJson}
                    disabled={appliedJobs.length === 0}
                    className="px-3.5 py-2 rounded-xl card-subtle-theme border border-subtle-theme text-main-theme hover:opacity-90 text-xs font-medium transition flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                    title="Unduh seluruh data lamaran dalam format JSON"
                  >
                    <FileJson className="w-3.5 h-3.5 text-sky-500" />
                    <span>Export JSON</span>
                  </button>

                  <button
                    onClick={fetchAppliedHistory}
                    className="px-3.5 py-2 rounded-xl card-subtle-theme border border-subtle-theme text-muted-theme hover:text-main-theme text-xs font-medium transition flex items-center gap-1.5 shadow-sm"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-muted-theme" />
                    <span>Segarkan</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-subtle-theme">
                <table className="w-full text-left text-xs">
                  <thead className="card-subtle-theme text-muted-theme font-medium border-b border-subtle-theme">
                    <tr>
                      <th className="p-3.5">Perusahaan</th>
                      <th className="p-3.5">Posisi</th>
                      <th className="p-3.5">Platform</th>
                      <th className="p-3.5">Tanggal</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Tautan</th>
                      <th className="p-3.5 text-center">Detail / Q&A</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-subtle-theme">
                    {appliedJobs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-theme italic">
                          Belum ada data lamaran yang tercatat.
                        </td>
                      </tr>
                    ) : (
                      appliedJobs.map((job, idx) => (
                        <tr key={idx} className="hover:opacity-90 card-theme transition">
                          <td className="p-3.5 font-medium text-main-theme">{job.company}</td>
                          <td className="p-3.5 text-muted-theme">{job.title}</td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-medium card-subtle-theme border border-subtle-theme text-muted-theme">
                              {job.platform}
                            </span>
                          </td>
                          <td className="p-3.5 text-muted-theme">{job.date}</td>
                          <td className="p-3.5">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                                job.status === 'Applied' || job.status === 'Success'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                  : job.status === 'External Link'
                                  ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
                                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                              }`}
                            >
                              {job.status === 'External Link' ? '🔗 External Link' : job.status}
                            </span>
                          </td>
                          <td className="p-3.5">
                            {job.jobUrl ? (
                              <a
                                href={job.jobUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1"
                              >
                                <span>Lihat Loker</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => setSelectedJobDetail(job)}
                              className="px-2.5 py-1 rounded-lg card-subtle-theme border border-subtle-theme text-main-theme hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 font-medium text-[11px] transition inline-flex items-center gap-1"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Lihat Q&A</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: TALENT SCOUT & SOURCING ENGINE (OUTSOURCING / HRIS) */}
          {activeTab === 'talent' && (
            <TalentScoutTab />
          )}
        </main>
      </div>

      {/* MODAL: DETAIL LAMARAN & RIWAYAT PERTANYAAN */}
      {selectedJobDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="card-theme border border-subtle-theme rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-subtle-theme flex items-center justify-between card-subtle-theme">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 uppercase">
                    {selectedJobDetail.platform}
                  </span>
                  <span className="text-xs text-muted-theme">{selectedJobDetail.date}</span>
                </div>
                <h3 className="text-base font-bold text-main-theme mt-1">{selectedJobDetail.title}</h3>
                <p className="text-xs text-muted-theme">{selectedJobDetail.company}</p>
              </div>
              <button
                onClick={() => setSelectedJobDetail(null)}
                className="p-1.5 rounded-lg hover:card-subtle-theme text-muted-theme hover:text-main-theme transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Meta Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="card-subtle-theme border border-subtle-theme p-3 rounded-xl">
                  <span className="text-[10px] text-muted-theme block">Status Lamaran</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 block">{selectedJobDetail.status}</span>
                </div>
                <div className="card-subtle-theme border border-subtle-theme p-3 rounded-xl">
                  <span className="text-[10px] text-muted-theme block">Gaji Ditampilkan</span>
                  <span className="font-semibold text-main-theme mt-0.5 block">{selectedJobDetail.salary || 'Tidak Dicantumkan'}</span>
                </div>
                <div className="card-subtle-theme border border-subtle-theme p-3 rounded-xl col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-muted-theme block">Lokasi Kerja</span>
                  <span className="font-semibold text-main-theme mt-0.5 block truncate">{selectedJobDetail.location || '-'}</span>
                </div>
              </div>

              {/* Questions & Answers Section */}
              <div>
                <h4 className="font-semibold text-main-theme mb-2.5 flex items-center gap-1.5 text-xs">
                  <FileText className="w-3.5 h-3.5 text-orange-500" />
                  <span>Pertanyaan & Jawaban yang Dikirim ke HRD:</span>
                </h4>

                {selectedJobDetail.questionsAndAnswers && selectedJobDetail.questionsAndAnswers.length > 0 ? (
                  <div className="space-y-2">
                    {selectedJobDetail.questionsAndAnswers.map((qa, i) => (
                      <div key={i} className="card-subtle-theme border border-subtle-theme p-3 rounded-xl space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-main-theme text-[11px]">{i + 1}. {qa.question}</p>
                          {qa.type && (
                            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500 border border-orange-500/20 shrink-0">
                              {qa.type}
                            </span>
                          )}
                        </div>
                        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 p-2 rounded-lg text-[11px]">
                          <span className="font-semibold text-[10px] uppercase text-emerald-600 dark:text-emerald-400 block mb-0.5">Jawaban Bot:</span>
                          <p className="whitespace-pre-wrap">{qa.answer}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="card-subtle-theme border border-subtle-theme p-4 rounded-xl text-center text-muted-theme italic">
                    Lamaran ini menggunakan format formulir standar (Profil & CV default). Tidak ada kuesioner kustom tambahan yang perlu diisi.
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-subtle-theme flex items-center justify-between card-subtle-theme">
              {selectedJobDetail.jobUrl ? (
                <a
                  href={selectedJobDetail.jobUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs flex items-center gap-1.5 transition shadow-sm"
                >
                  <span>Buka Halaman Loker</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : <div />}
              <button
                onClick={() => setSelectedJobDetail(null)}
                className="px-4 py-2 rounded-xl card-subtle-theme border border-subtle-theme text-main-theme hover:opacity-90 font-medium text-xs transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BATCH AI PERSONALISASI */}
      <BatchQuestionModal
        isOpen={isBatchAiModalOpen}
        onClose={() => setIsBatchAiModalOpen(false)}
        onFinished={() => fetchQuestions()}
      />

      {/* MODAL: TAMBAH PERTANYAAN */}
      {isNewQuestionModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="card-theme border rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-subtle-theme pb-3">
              <h3 className="text-sm font-semibold text-main-theme">Tambah Pertanyaan Baru</h3>
              <button
                onClick={() => setIsNewQuestionModalOpen(false)}
                className="text-muted-theme hover:text-main-theme text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddNewQuestion} className="space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-main-theme font-medium">Pertanyaan</label>
                  <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">Wajib</span>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Berapa IPK terakhir Anda?"
                  value={newQuestionData.question}
                  onChange={(e) => setNewQuestionData({ ...newQuestionData, question: e.target.value })}
                  className="w-full input-theme border rounded-xl px-3 py-2 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-main-theme font-medium">Tipe Input</label>
                    <span className="text-[10px] text-muted-theme bg-slate-500/10 px-1.5 py-0.5 rounded border border-subtle-theme">Opsional</span>
                  </div>
                  <select
                    value={newQuestionData.type}
                    onChange={(e) => setNewQuestionData({ ...newQuestionData, type: e.target.value })}
                    className="w-full input-theme border rounded-xl px-3 py-2 focus:outline-none focus:border-orange-500"
                  >
                    <option value="radiobutton">Radiobutton</option>
                    <option value="text">Text / TextArea</option>
                    <option value="checklist">Checklist</option>
                    <option value="dropdown">Dropdown</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-main-theme font-medium">Jawaban Bot</label>
                    <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">Wajib</span>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="3.75 atau Ahli"
                    value={newQuestionData.answer}
                    onChange={(e) => setNewQuestionData({ ...newQuestionData, answer: e.target.value })}
                    className="w-full input-theme border rounded-xl px-3 py-2 text-emerald-600 dark:text-emerald-400 font-semibold focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-main-theme font-medium">Pilihan Opsi (Pisahkan dengan tanda | )</label>
                  <span className="text-[10px] text-muted-theme bg-slate-500/10 px-1.5 py-0.5 rounded border border-subtle-theme">Opsional</span>
                </div>
                <input
                  type="text"
                  placeholder="Dasar | Menengah | Ahli"
                  value={newQuestionData.options}
                  onChange={(e) => setNewQuestionData({ ...newQuestionData, options: e.target.value })}
                  className="w-full input-theme border rounded-xl px-3 py-2 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-subtle-theme">
                <button
                  type="button"
                  onClick={() => setIsNewQuestionModalOpen(false)}
                  className="px-4 py-2 rounded-xl card-subtle-theme border border-subtle-theme text-muted-theme hover:text-main-theme font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-medium"
                >
                  Simpan Soal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT PERTANYAAN */}
      {editingQuestion && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="card-theme border rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-subtle-theme pb-3">
              <h3 className="text-sm font-semibold text-main-theme">Edit Pertanyaan</h3>
              <button
                onClick={() => setEditingQuestion(null)}
                className="text-muted-theme hover:text-main-theme text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateQuestion} className="space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-main-theme font-medium">Pertanyaan</label>
                  <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">Wajib</span>
                </div>
                <input
                  type="text"
                  required
                  value={editingQuestion.question}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, question: e.target.value })}
                  className="w-full input-theme border rounded-xl px-3 py-2 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-main-theme font-medium">Tipe Input</label>
                    <span className="text-[10px] text-muted-theme bg-slate-500/10 px-1.5 py-0.5 rounded border border-subtle-theme">Opsional</span>
                  </div>
                  <select
                    value={editingQuestion.type}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, type: e.target.value })}
                    className="w-full input-theme border rounded-xl px-3 py-2 focus:outline-none focus:border-orange-500"
                  >
                    <option value="radiobutton">Radiobutton</option>
                    <option value="text">Text / TextArea</option>
                    <option value="checklist">Checklist</option>
                    <option value="dropdown">Dropdown</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-main-theme font-medium">Jawaban Bot</label>
                    <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">Wajib</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={editingQuestion.answer}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, answer: e.target.value })}
                    className="w-full input-theme border rounded-xl px-3 py-2 text-emerald-600 dark:text-emerald-400 font-semibold focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-main-theme font-medium">Pilihan Opsi (Pisahkan dengan tanda | )</label>
                  <span className="text-[10px] text-muted-theme bg-slate-500/10 px-1.5 py-0.5 rounded border border-subtle-theme">Opsional</span>
                </div>
                <input
                  type="text"
                  value={editingQuestion.options}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, options: e.target.value })}
                  className="w-full input-theme border rounded-xl px-3 py-2 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-subtle-theme">
                <button
                  type="button"
                  onClick={() => setEditingQuestion(null)}
                  className="px-4 py-2 rounded-xl card-subtle-theme border border-subtle-theme text-muted-theme hover:text-main-theme font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-medium"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TAMBAH PROFIL AKUN BROWSER BARU */}
      {isAddAccountModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="card-theme border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-subtle-theme pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-semibold text-main-theme">Tambah Profil Akun Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddAccountModalOpen(false)}
                className="text-muted-theme hover:text-main-theme text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddNewAccount} className="space-y-4 text-xs">
              <div>
                <label className="block text-main-theme font-medium mb-1.5">Nama Profil Akun</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Misal: Akun Cadangan 2 / Akun LinkedIn Pro"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  className="w-full input-theme border rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-orange-500"
                />
                <p className="text-[11px] text-muted-theme mt-1.5">
                  Setiap profil akan memiliki folder cookie &amp; session browser tersendiri (terisolasi aman dari akun lain).
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-subtle-theme">
                <button
                  type="button"
                  onClick={() => setIsAddAccountModalOpen(false)}
                  className="px-4 py-2 rounded-xl card-subtle-theme border border-subtle-theme text-muted-theme hover:text-main-theme font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-medium shadow-sm"
                >
                  Simpan &amp; Aktifkan Akun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PRESET KONFIGURASI HISTORY */}
      {isPresetsModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#12161f] border border-subtle-theme w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[88vh]">

            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-subtle-theme shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Bookmark className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-main-theme">Preset Konfigurasi</h3>
                  <p className="text-[11px] text-muted-theme mt-0.5">
                    Simpan dan muat ulang konfigurasi form kapan saja tanpa mengetik ulang.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPresetsModalOpen(false)}
                className="text-muted-theme hover:text-main-theme p-1.5 rounded-lg hover:bg-slate-500/10 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Restore Draft Banner */}
            <div className="px-6 pt-4 shrink-0">
              <div className="p-3.5 rounded-2xl bg-slate-500/5 border border-subtle-theme flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <RotateCcw className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <div className="text-xs font-medium text-main-theme">Draft Terakhir (Auto-Tersimpan)</div>
                    <div className="text-[11px] text-muted-theme">Formulir disimpan otomatis setiap ada perubahan ke browser storage.</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { handleRestoreDraft(); setIsPresetsModalOpen(false); }}
                  className="px-3.5 py-1.5 rounded-xl card-theme border border-subtle-theme text-main-theme text-xs font-medium hover:opacity-90 transition shrink-0 flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Pulihkan Draft</span>
                </button>
              </div>
            </div>

            {/* Save New Preset */}
            <div className="px-6 pt-3 shrink-0">
              <div className="p-4 rounded-2xl border border-amber-500/25 bg-amber-500/5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <BookmarkPlus className="w-4 h-4" />
                  <span>Simpan Konfigurasi Saat Ini sebagai Preset Baru</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPresetName}
                    onChange={e => setNewPresetName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSavePreset(); }}
                    placeholder="Nama preset (mis: Lamaran React Jakarta, Remote Senior Dev...)"
                    className="flex-1 input-theme border rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-amber-500 transition"
                  />
                  <button
                    type="button"
                    disabled={!newPresetName.trim() || isSavingPreset}
                    onClick={handleSavePreset}
                    className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-xs font-semibold transition disabled:opacity-50 shadow-sm flex items-center gap-1.5 shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Simpan</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Preset List */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {configPresets.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-slate-500/10 flex items-center justify-center">
                    <Bookmark className="w-6 h-6 text-slate-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-main-theme">Belum ada preset tersimpan</div>
                    <p className="text-[11px] text-muted-theme mt-1">
                      Simpan konfigurasi form di atas untuk mengakses kembali kapan saja.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-[11px] text-muted-theme font-medium uppercase tracking-wider pb-1">
                    {configPresets.length} Preset Tersimpan
                  </div>
                  {configPresets.map(preset => {
                    const platforms = [
                      preset.config.enableGlints && 'Glints',
                      preset.config.enableJobstreet && 'Jobstreet',
                      preset.config.enableLinkedin && 'LinkedIn',
                      preset.config.enableIndeed && 'Indeed',
                    ].filter(Boolean);
                    const savedDate = new Date(preset.savedAt);
                    const relativeTime = (() => {
                      const diffMs = Date.now() - savedDate.getTime();
                      const diffMins = Math.floor(diffMs / 60000);
                      const diffHours = Math.floor(diffMs / 3600000);
                      const diffDays = Math.floor(diffMs / 86400000);
                      if (diffMins < 1) return 'Baru saja';
                      if (diffMins < 60) return `${diffMins} menit lalu`;
                      if (diffHours < 24) return `${diffHours} jam lalu`;
                      return `${diffDays} hari lalu`;
                    })();

                    return (
                      <div
                        key={preset.id}
                        className="p-4 rounded-2xl border border-subtle-theme card-theme hover:border-amber-500/40 transition-all group space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                              <BookmarkCheck className="w-4 h-4 text-amber-500" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-main-theme truncate">{preset.name}</div>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="text-[11px] text-muted-theme">{relativeTime}</span>
                                <span className="text-[10px] text-muted-theme opacity-60">&bull;</span>
                                <span className="text-[11px] text-muted-theme">{savedDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleOverwritePreset(preset)}
                              className="px-2.5 py-1.5 rounded-lg card-subtle-theme border border-subtle-theme text-muted-theme hover:text-amber-500 hover:border-amber-500/30 text-[11px] font-medium transition flex items-center gap-1"
                              title="Timpa preset ini dengan konfigurasi saat ini"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Timpa</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePreset(preset)}
                              className="p-1.5 rounded-lg text-muted-theme hover:text-rose-500 hover:bg-rose-500/10 transition"
                              title="Hapus preset ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Summary pills */}
                        <div className="flex items-center flex-wrap gap-1.5">
                          {preset.config.searchKeywords && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 font-medium">
                              🔍 {preset.config.searchKeywords.slice(0, 30)}{preset.config.searchKeywords.length > 30 ? '...' : ''}
                            </span>
                          )}
                          {preset.config.location && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/10 text-muted-theme border border-subtle-theme">
                              📍 {preset.config.location}
                            </span>
                          )}
                          {platforms.map(p => (
                            <span key={p as string} className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                              {p as string}
                            </span>
                          ))}
                          {preset.config.fullName && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              👤 {preset.config.fullName}
                            </span>
                          )}
                        </div>

                        {/* Load button - full row on hover */}
                        <button
                          type="button"
                          onClick={() => handleLoadPreset(preset)}
                          className="w-full py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-600 dark:text-amber-400 text-xs font-semibold transition flex items-center justify-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Muat Preset Ini ke Formulir</span>
                        </button>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-subtle-theme flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsPresetsModalOpen(false)}
                className="px-5 py-2.5 rounded-xl card-subtle-theme border border-subtle-theme text-muted-theme hover:text-main-theme text-xs font-medium transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PRATINJAU DOKUMEN CV & TABEL PERBANDINGAN PERUBAHAN */}
      {isCvPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#12161f] border border-subtle-theme w-full max-w-4xl rounded-3xl p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
            {/* Header Modal */}
            <div className="flex items-start justify-between border-b border-subtle-theme pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-main-theme flex items-center gap-2">
                    <span>Pratinjau CV &amp; Rencana Perubahan Profil</span>
                    {config.cvFileName && (
                      <span className="text-[11px] font-normal bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2.5 py-0.5 rounded-full border border-orange-500/20">
                        {config.cvFileName}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-muted-theme mt-0.5">
                    Tinjau teks hasil ekstraksi dokumen CV Anda dan bandingkan data apa saja yang akan diperbarui ke formulir.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCvPreviewOpen(false)}
                className="text-muted-theme hover:text-main-theme p-1.5 rounded-lg hover:bg-slate-500/10 transition"
              >
                ✕
              </button>
            </div>

            {/* Tab Navigasi Modal */}
            <div className="flex items-center gap-2 border-b border-subtle-theme pb-2 shrink-0 text-xs">
              <button
                type="button"
                onClick={() => setCvPreviewTab('diff')}
                className={`px-3.5 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
                  cvPreviewTab === 'diff'
                    ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30'
                    : 'text-muted-theme hover:text-main-theme hover:bg-slate-500/5'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Perbandingan Data Formulir</span>
                {pendingDiffList.filter(d => d.willChange).length > 0 && (
                  <span className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.2 rounded-full font-bold">
                    {pendingDiffList.filter(d => d.willChange).length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setCvPreviewTab('raw')}
                className={`px-3.5 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
                  cvPreviewTab === 'raw'
                    ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30'
                    : 'text-muted-theme hover:text-main-theme hover:bg-slate-500/5'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Teks Mentah Hasil Ekstraksi PDF ({config.cvExtractedText ? config.cvExtractedText.length : 0} karakter)</span>
              </button>
            </div>

            {/* Content Body Modal (Scrollable) */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              {cvPreviewTab === 'diff' ? (
                <div className="space-y-4">
                  {/* Status Banner */}
                  {pendingParsedCv ? (
                    <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-emerald-700 dark:text-emerald-300">
                          Data profil berhasil diekstraksi dari dokumen!
                        </div>
                        <p className="text-[11px] text-muted-theme mt-0.5">
                          Tinjau tabel berikut untuk melihat kolom mana yang akan berubah (hijau) atau tetap sama. Klik <strong>&quot;Terapkan ke Formulir&quot;</strong> di bawah untuk langsung memperbarui profil.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-amber-700 dark:text-amber-300">
                          Ekstraksi AI Belum Berjalan Otomatis
                        </div>
                        <p className="text-[11px] text-muted-theme mt-0.5">
                          Teks mentah PDF sudah berhasil dibaca 100%, namun API Key AI di Langkah 3 belum dikonfigurasi aktif. Anda tetap bisa membaca teks aslinya di tab <strong>&quot;Teks Mentah&quot;</strong> di atas.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Tabel Perbandingan Diffs */}
                  <div className="border border-subtle-theme rounded-2xl overflow-hidden shadow-sm">
                    {/* Select-all toolbar */}
                    {pendingDiffList.length > 0 && pendingParsedCv && (
                      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-500/5 border-b border-subtle-theme">
                        <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-main-theme select-none">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-subtle-theme text-emerald-600 focus:ring-0 cursor-pointer"
                            checked={selectedDiffFields.size === pendingDiffList.filter(d => d.willChange && d.newVal).length && selectedDiffFields.size > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedDiffFields(new Set(pendingDiffList.filter(d => d.willChange && d.newVal).map(d => d.field)));
                              } else {
                                setSelectedDiffFields(new Set());
                              }
                            }}
                          />
                          <span>Pilih semua yang berubah</span>
                        </label>
                        <div className="flex items-center gap-2 text-[11px] text-muted-theme">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{selectedDiffFields.size}</span>
                          <span>/ {pendingDiffList.filter(d => d.willChange && d.newVal).length} kolom dipilih</span>
                          {selectedDiffFields.size > 0 && (
                            <button
                              type="button"
                              onClick={() => setSelectedDiffFields(new Set())}
                              className="ml-2 text-rose-500 hover:underline"
                            >
                              Batal semua
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-500/10 border-b border-subtle-theme text-[11px] font-semibold text-muted-theme uppercase tracking-wider">
                            <th className="p-3 w-8 text-center">
                              <Check className="w-3.5 h-3.5 mx-auto text-emerald-500" />
                            </th>
                            <th className="p-3">Nama Kolom</th>
                            <th className="p-3 w-1/3">Nilai Saat Ini di Formulir</th>
                            <th className="p-3 w-1/3">Nilai Baru dari CV</th>
                            <th className="p-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-subtle-theme">
                          {pendingDiffList.length > 0 ? (
                            pendingDiffList.map((item) => {
                              const isSelected = selectedDiffFields.has(item.field);
                              const canSelect = item.willChange && Boolean(item.newVal);
                              return (
                                <tr
                                  key={item.field}
                                  onClick={() => {
                                    if (!canSelect) return;
                                    setSelectedDiffFields(prev => {
                                      const next = new Set(prev);
                                      next.has(item.field) ? next.delete(item.field) : next.add(item.field);
                                      return next;
                                    });
                                  }}
                                  className={`transition-colors ${
                                    canSelect ? 'cursor-pointer' : ''
                                  } ${
                                    isSelected && canSelect
                                      ? 'bg-emerald-500/8 hover:bg-emerald-500/12'
                                      : item.willChange
                                      ? 'bg-emerald-500/3 hover:bg-emerald-500/8'
                                      : 'hover:bg-slate-500/5 opacity-70'
                                  }`}
                                >
                                  {/* Checkbox column */}
                                  <td className="p-3 text-center align-middle">
                                    {canSelect ? (
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => {}}
                                        onClick={e => e.stopPropagation()}
                                        className="w-4 h-4 rounded border-subtle-theme text-emerald-600 focus:ring-0 cursor-pointer"
                                        onChangeCapture={() => {
                                          setSelectedDiffFields(prev => {
                                            const next = new Set(prev);
                                            next.has(item.field) ? next.delete(item.field) : next.add(item.field);
                                            return next;
                                          });
                                        }}
                                      />
                                    ) : (
                                      <span className="w-4 h-4 rounded border border-subtle-theme bg-slate-500/10 inline-block" />
                                    )}
                                  </td>
                                  <td className="p-3 font-medium text-main-theme align-top">
                                    {item.label}
                                  </td>
                                  <td className="p-3 text-muted-theme font-mono text-[11px] align-top break-all">
                                    {item.oldVal || <span className="italic text-slate-400">(Kosong)</span>}
                                  </td>
                                  <td className="p-3 font-mono text-[11px] align-top break-all">
                                    {item.willChange ? (
                                      <span className={`font-semibold ${
                                        isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 line-through'
                                      }`}>
                                        {item.newVal}
                                      </span>
                                    ) : (
                                      <span className="text-muted-theme">
                                        {item.newVal || <span className="italic text-slate-400">(Sama / Tidak Ditemukan)</span>}
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3 text-center align-middle whitespace-nowrap">
                                    {item.willChange ? (
                                      isSelected ? (
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                          Akan Diterapkan
                                        </span>
                                      ) : (
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] text-muted-theme bg-slate-500/10 border border-subtle-theme line-through">
                                          Dilewati
                                        </span>
                                      )
                                    ) : (
                                      <span className="px-2.5 py-0.5 rounded-full text-[10px] text-muted-theme bg-slate-500/10 border border-subtle-theme">
                                        Tetap Sama
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={5} className="p-6 text-center text-muted-theme">
                                Belum ada komparasi data aktif. Silakan pilih tab &quot;Teks Mentah&quot; untuk memeriksa isi teks CV Anda.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-muted-theme">
                    <span>
                      Seluruh halaman dokumen PDF diekstrak menjadi teks digital di bawah ini:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (config.cvExtractedText) {
                          navigator.clipboard.writeText(config.cvExtractedText);
                          toast.success('Teks CV disalin ke clipboard!');
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg border border-subtle-theme hover:bg-slate-500/10 text-main-theme font-medium"
                    >
                      Salin Teks
                    </button>
                  </div>
                  <pre className="p-4 rounded-2xl bg-slate-950/60 dark:bg-black/80 border border-subtle-theme text-emerald-400 font-mono text-[11px] whitespace-pre-wrap leading-relaxed overflow-x-auto max-h-[420px] select-all">
                    {config.cvExtractedText || 'Teks CV belum dimuat atau kosong.'}
                  </pre>
                </div>
              )}
            </div>

            {/* Footer Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-subtle-theme shrink-0">
              <span className="text-[11px] text-muted-theme">
                {config.cvAnalyzedAt ? `Waktu analisis: ${config.cvAnalyzedAt}` : ''}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCvPreviewOpen(false)}
                  className="px-4 py-2 rounded-xl card-subtle-theme border border-subtle-theme text-muted-theme hover:text-main-theme font-medium text-xs"
                >
                  Tutup
                </button>
                {pendingParsedCv && (
                  <button
                    type="button"
                    onClick={handleApplyPendingCvDiff}
                    disabled={selectedDiffFields.size === 0}
                    className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-xs shadow-sm flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Terapkan {selectedDiffFields.size > 0 ? `${selectedDiffFields.size} Kolom` : ''} ke Formulir</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: IMPORT PORTAL COOKIES (BYPASS CAPTCHA/GOOGLE BLOCK) */}
      {isCookieModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-theme border rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-subtle-theme pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-main-theme">Impor Cookie Sesi Browser</h3>
                  <p className="text-[11px] text-muted-theme">Bypass Cloudflare Turnstile &amp; Google OAuth 100%</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCookieModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-500/10 text-muted-theme"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Platform Selector Tabs */}
            <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl card-subtle-theme border border-subtle-theme text-xs font-medium">
              {(['linkedin', 'indeed', 'glints', 'jobstreet'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setCookieTargetPlatform(p);
                    setRawCookieInput(config.portalCookies?.[p] || '');
                  }}
                  className={`py-1.5 rounded-lg capitalize transition ${
                    cookieTargetPlatform === p
                      ? 'bg-sky-500 text-white shadow-sm'
                      : 'text-muted-theme hover:text-main-theme'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-main-theme">
                  Paste JSON Cookie atau Teks Header ({cookieTargetPlatform.toUpperCase()}):
                </span>
                <span className="text-muted-theme">Dari ekstensi Cookie-Editor</span>
              </div>
              <textarea
                rows={7}
                value={rawCookieInput}
                onChange={(e) => setRawCookieInput(e.target.value)}
                placeholder={`Paste cookie ${cookieTargetPlatform} di sini (format JSON array [...] atau string li_at=...)...`}
                className="w-full text-xs font-mono p-3 rounded-xl border border-subtle-theme input-theme focus:outline-none focus:border-sky-500"
              />
              <p className="text-[11px] text-muted-theme leading-relaxed flex items-start gap-1.5">
                <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span><b>Cara Cepat:</b> Buka {cookieTargetPlatform} di Chrome biasa Anda &gt; Buka ekstensi <i>Cookie-Editor</i> &gt; Klik <i>Export (JSON)</i> &gt; Tempel (Paste) di atas lalu klik Simpan.</span>
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-subtle-theme">
              <button
                type="button"
                onClick={() => setIsCookieModalOpen(false)}
                className="px-4 py-2 rounded-xl card-subtle-theme border border-subtle-theme text-muted-theme text-xs font-medium"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  const updatedCookies = {
                    ...(config.portalCookies || {}),
                    [cookieTargetPlatform]: rawCookieInput.trim()
                  };
                  const nextConfig = { ...config, portalCookies: updatedCookies };
                  setConfig(nextConfig);
                  try {
                    await fetch('/api/config', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(nextConfig)
                    });
                    toast.success(`Cookie ${cookieTargetPlatform.toUpperCase()} berhasil disimpan!`);
                    setIsCookieModalOpen(false);
                  } catch {
                    toast.error('Gagal menyimpan cookie ke server');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium shadow-sm flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Simpan Cookie {cookieTargetPlatform.toUpperCase()}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TWO-WAY WEB PROFILE IMPORT & CONFLICT RESOLUTION */}
      {isProfileImportModalOpen && detectedWebProfile && (() => {
        const portalNames: Record<string, string> = {
          glints: 'Glints',
          indeed: 'Indeed',
          linkedin: 'LinkedIn',
          jobstreet: 'JobStreet',
        };
        const currentPortalName = portalNames[detectedWebProfile.sourcePortal || 'glints'] || 'Portal';

        return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-theme border rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-subtle-theme pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-main-theme">Data Profil Terdeteksi dari Akun {currentPortalName}</h3>
                  <p className="text-[11px] text-muted-theme">Pilih data mana saja yang ingin disinkronkan ke form lemparjaring (Non-Destruktif)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileImportModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-500/10 text-muted-theme"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2.5 shrink-0">
              <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Akun {currentPortalName} Anda sudah memiliki data diri asli.</div>
                <p className="text-[11px] opacity-90 mt-0.5">
                  Centang kolom di bawah jika Anda ingin mengimpor data dari akun {currentPortalName} ke formulir lemparjaring, atau klik <strong>&quot;Pertahankan Data lemparjaring&quot;</strong> jika tidak ingin mengubah data formulir saat ini.
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto border border-subtle-theme rounded-2xl divide-y divide-subtle-theme text-xs pr-1">
              {/* Field 1: Nama Lengkap */}
              {detectedWebProfile.name && (
                <label className="p-3.5 flex items-start gap-3 hover:bg-slate-500/5 cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={selectedWebProfileFields.has('fullName')}
                    onChange={(e) => {
                      const next = new Set(selectedWebProfileFields);
                      if (e.target.checked) next.add('fullName');
                      else next.delete('fullName');
                      setSelectedWebProfileFields(next);
                    }}
                    className="w-4 h-4 rounded text-blue-600 mt-0.5"
                  />
                  <div className="flex-1 space-y-1">
                    <div className="font-semibold text-main-theme">Nama Lengkap</div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-muted-theme">Di Akun {currentPortalName}: </span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">{detectedWebProfile.name}</span>
                      </div>
                      <div>
                        <span className="text-muted-theme">Di lemparjaring: </span>
                        <span className="font-medium text-main-theme">{config.fullName || '(Kosong)'}</span>
                      </div>
                    </div>
                  </div>
                </label>
              )}

              {/* Field 2: No WhatsApp */}
              {detectedWebProfile.phone && (
                <label className="p-3.5 flex items-start gap-3 hover:bg-slate-500/5 cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={selectedWebProfileFields.has('phoneNumber')}
                    onChange={(e) => {
                      const next = new Set(selectedWebProfileFields);
                      if (e.target.checked) next.add('phoneNumber');
                      else next.delete('phoneNumber');
                      setSelectedWebProfileFields(next);
                    }}
                    className="w-4 h-4 rounded text-blue-600 mt-0.5"
                  />
                  <div className="flex-1 space-y-1">
                    <div className="font-semibold text-main-theme">Nomor WhatsApp / HP</div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-muted-theme">Di Akun {currentPortalName}: </span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">{detectedWebProfile.phone}</span>
                      </div>
                      <div>
                        <span className="text-muted-theme">Di lemparjaring: </span>
                        <span className="font-medium text-main-theme">{config.phoneNumber || '(Kosong)'}</span>
                      </div>
                    </div>
                  </div>
                </label>
              )}

              {/* Field 3: Email */}
              {detectedWebProfile.email && (
                <label className="p-3.5 flex items-start gap-3 hover:bg-slate-500/5 cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={selectedWebProfileFields.has('email')}
                    onChange={(e) => {
                      const next = new Set(selectedWebProfileFields);
                      if (e.target.checked) next.add('email');
                      else next.delete('email');
                      setSelectedWebProfileFields(next);
                    }}
                    className="w-4 h-4 rounded text-blue-600 mt-0.5"
                  />
                  <div className="flex-1 space-y-1">
                    <div className="font-semibold text-main-theme">Alamat Email</div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-muted-theme">Di Akun {currentPortalName}: </span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">{detectedWebProfile.email}</span>
                      </div>
                      <div>
                        <span className="text-muted-theme">Di lemparjaring: </span>
                        <span className="font-medium text-main-theme">{config.email || '(Kosong)'}</span>
                      </div>
                    </div>
                  </div>
                </label>
              )}

              {/* Field 4: Domisili / Lokasi */}
              {detectedWebProfile.location && (
                <label className="p-3.5 flex items-start gap-3 hover:bg-slate-500/5 cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={selectedWebProfileFields.has('domicile')}
                    onChange={(e) => {
                      const next = new Set(selectedWebProfileFields);
                      if (e.target.checked) next.add('domicile');
                      else next.delete('domicile');
                      setSelectedWebProfileFields(next);
                    }}
                    className="w-4 h-4 rounded text-blue-600 mt-0.5"
                  />
                  <div className="flex-1 space-y-1">
                    <div className="font-semibold text-main-theme">Lokasi Domisili</div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-muted-theme">Di Akun {currentPortalName}: </span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">{detectedWebProfile.location}</span>
                      </div>
                      <div>
                        <span className="text-muted-theme">Di lemparjaring: </span>
                        <span className="font-medium text-main-theme">{config.domicile || '(Kosong)'}</span>
                      </div>
                    </div>
                  </div>
                </label>
              )}

              {/* Field 5: Pendidikan */}
              {detectedWebProfile.education && (
                <label className="p-3.5 flex items-start gap-3 hover:bg-slate-500/5 cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={selectedWebProfileFields.has('educationLevel')}
                    onChange={(e) => {
                      const next = new Set(selectedWebProfileFields);
                      if (e.target.checked) next.add('educationLevel');
                      else next.delete('educationLevel');
                      setSelectedWebProfileFields(next);
                    }}
                    className="w-4 h-4 rounded text-blue-600 mt-0.5"
                  />
                  <div className="flex-1 space-y-1">
                    <div className="font-semibold text-main-theme">Pendidikan Terakhir</div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-muted-theme">Di Akun {currentPortalName}: </span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">{detectedWebProfile.education}</span>
                      </div>
                      <div>
                        <span className="text-muted-theme">Di lemparjaring: </span>
                        <span className="font-medium text-main-theme">{config.educationLevel || '(Kosong)'}</span>
                      </div>
                    </div>
                  </div>
                </label>
              )}

              {/* Field 6: Keahlian / Skills */}
              {detectedWebProfile.skills && (
                <label className="p-3.5 flex items-start gap-3 hover:bg-slate-500/5 cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={selectedWebProfileFields.has('skills')}
                    onChange={(e) => {
                      const next = new Set(selectedWebProfileFields);
                      if (e.target.checked) next.add('skills');
                      else next.delete('skills');
                      setSelectedWebProfileFields(next);
                    }}
                    className="w-4 h-4 rounded text-blue-600 mt-0.5"
                  />
                  <div className="flex-1 space-y-1">
                    <div className="font-semibold text-main-theme">Keahlian &amp; Skills</div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-muted-theme">Di Akun {currentPortalName}: </span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">{detectedWebProfile.skills}</span>
                      </div>
                      <div>
                        <span className="text-muted-theme">Di lemparjaring: </span>
                        <span className="font-medium text-main-theme truncate block">{config.skills || '(Kosong)'}</span>
                      </div>
                    </div>
                  </div>
                </label>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-subtle-theme shrink-0">
              <button
                type="button"
                onClick={() => setIsProfileImportModalOpen(false)}
                className="px-4 py-2 rounded-xl card-subtle-theme border border-subtle-theme text-muted-theme hover:text-main-theme text-xs font-medium"
              >
                Pertahankan Data lemparjaring (Jangan Timpa)
              </button>

              <button
                type="button"
                onClick={handleApplyWebProfileImport}
                disabled={selectedWebProfileFields.size === 0}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium shadow-sm flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Impor {selectedWebProfileFields.size} Kolom Terpilih ke lemparjaring</span>
              </button>
            </div>
          </div>
        </div>
        );
      })()}
      {/* MODAL: TAMBAH PROFIL AKUN BROWSER BARU */}
      {isAddAccountModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-theme border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-subtle-theme pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-500/15 text-orange-500 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-main-theme">Tambah Profil Akun Browser</h3>
                  <p className="text-[11px] text-muted-theme">Buat profil terisolasi baru untuk rotasi akun</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddAccountModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-500/10 text-muted-theme"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddNewAccount} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-main-theme mb-1">
                  Nama Profil Akun
                </label>
                <input
                  type="text"
                  required
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="Contoh: Akun Alternatif / Akun Kerja 2"
                  className="w-full input-theme border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-orange-500 transition"
                  autoFocus
                />
              </div>

              {newAccountName.trim() && (
                <div className="p-3 rounded-xl card-subtle-theme border border-subtle-theme text-[11px] text-muted-theme">
                  <span className="font-semibold text-main-theme block mb-0.5">Nama Folder Sesi:</span>
                  <span className="font-mono text-[10px] text-orange-600 dark:text-orange-400">
                    automation-profile-{newAccountName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')}
                  </span>
                </div>
              )}

              <p className="text-[11px] text-muted-theme leading-relaxed flex items-start gap-1.5 pt-1">
                <Info className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
                <span>Setiap profil akun memiliki folder penyimpanan sesi, cookies, dan cache browser Chrome mandiri yang tidak saling menimpa.</span>
              </p>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-subtle-theme">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddAccountModalOpen(false);
                    setNewAccountName('');
                  }}
                  className="px-4 py-2 rounded-xl card-subtle-theme border border-subtle-theme text-muted-theme text-xs font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Simpan &amp; Aktifkan Akun</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
