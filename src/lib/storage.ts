import fs from 'fs';
import path from 'path';
import { getConfig } from './config';
import * as googleSheets from './googleSheets';

export interface AppliedJob {
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

export type StorageType = 'sqlite' | 'json' | 'sheets';

const DB_PATH = path.join(process.cwd(), 'cv_blaster.db');
const JSON_STORAGE_PATH = path.join(process.cwd(), 'applied_jobs.json');

// In-memory cache for ultra-fast O(1) duplicate checks and snappy UI response
let memoryCache: {
  storageType: StorageType;
  timestamp: number;
  data: AppliedJob[];
  urlSet: Set<string>;
} | null = null;

// ==========================================
// SQLite & JSON Storage Handlers
// ==========================================
let sqliteDbInstance: any = null;
let isSqliteSupported: boolean | null = null;

function getSqliteDb() {
  if (sqliteDbInstance) return sqliteDbInstance;
  if (isSqliteSupported === false) return null;

  try {
    // Next.js Turbopack / Webpack sometimes cannot bundle experimental 'node:sqlite'
    const dynamicRequire = typeof module !== 'undefined' && module.require ? module.require.bind(module) : eval('require');
    const sqliteModule = dynamicRequire('node:sqlite');
    if (!sqliteModule || !sqliteModule.DatabaseSync) {
      throw new Error('node:sqlite DatabaseSync not available');
    }

    const { DatabaseSync } = sqliteModule;
    const db = new DatabaseSync(DB_PATH);
    
    // Create applied_jobs table and index on jobUrl if not exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS applied_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company TEXT,
        title TEXT,
        platform TEXT,
        jobUrl TEXT UNIQUE,
        date TEXT,
        status TEXT,
        salary TEXT,
        location TEXT,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_applied_jobs_url ON applied_jobs(jobUrl);
    `);

    sqliteDbInstance = db;
    isSqliteSupported = true;
    return db;
  } catch {
    isSqliteSupported = false;
    return null;
  }
}


// Clean and normalize URLs across platforms
export function cleanJobUrl(url: string): string {
  if (!url) return '';
  try {
    const urlObj = new URL(url);

    // Indeed: Unique identifier is in query param 'jk' or 'vjk'
    if (urlObj.hostname.includes('indeed.com')) {
      const jk = urlObj.searchParams.get('jk') || urlObj.searchParams.get('vjk');
      if (jk) {
        return `https://${urlObj.hostname}/viewjob?jk=${jk}`;
      }
      return url.trim();
    }

    // LinkedIn: Unique identifier currentJobId
    if (urlObj.hostname.includes('linkedin.com')) {
      const currentJobId = urlObj.searchParams.get('currentJobId');
      if (currentJobId) {
        return `https://www.linkedin.com/jobs/view/${currentJobId}`;
      }
      return `${urlObj.origin}${urlObj.pathname.replace(/\/+$/, '')}`;
    }

    // Glints, JobStreet, etc: Pathname is unique
    return `${urlObj.origin}${urlObj.pathname.replace(/\/+$/, '')}`;
  } catch (e) {
    return url.trim();
  }
}

// ==========================================
// Main Storage Operations
// ==========================================

export async function getAppliedJobs(forceRefresh = false): Promise<AppliedJob[]> {
  const config = getConfig();
  const storageType: StorageType = config.storageType || 'sqlite';
  const now = Date.now();

  // Return cached result if fresh within 30s and storageType matches
  if (!forceRefresh && memoryCache && memoryCache.storageType === storageType && now - memoryCache.timestamp < 30000) {
    return memoryCache.data;
  }

  let jobs: AppliedJob[] = [];

  if (storageType === 'sqlite') {
    const db = getSqliteDb();
    if (db) {
      try {
        const query = db.prepare('SELECT company, title, platform, jobUrl, date, status, salary, location, details FROM applied_jobs ORDER BY id DESC');
        const rows = query.all() as any[];
        jobs = rows.map(r => ({
          company: r.company,
          title: r.title,
          platform: r.platform,
          jobUrl: r.jobUrl,
          date: r.date,
          status: r.status,
          salary: r.salary || undefined,
          location: r.location || undefined,
          questionsAndAnswers: r.details ? JSON.parse(r.details) : undefined,
        }));
      } catch (err: any) {
        jobs = readFromJsonFile();
      }
    } else {
      // Seamless fallback to JSON storage when native SQLite module is unavailable
      jobs = readFromJsonFile();
    }
  } else if (storageType === 'json') {
    jobs = readFromJsonFile();
  } else if (storageType === 'sheets') {
    jobs = await googleSheets.getAppliedJobs(forceRefresh);
  }

  // Populate in-memory Set for O(1) duplicate checks
  const urlSet = new Set<string>();
  jobs.forEach((j) => {
    const cleaned = cleanJobUrl(j.jobUrl);
    if (cleaned && !cleaned.endsWith('/viewjob') && !cleaned.endsWith('/jobs')) {
      urlSet.add(cleaned);
    }
  });

  memoryCache = {
    storageType,
    timestamp: now,
    data: jobs,
    urlSet,
  };

  return jobs;
}

export async function addAppliedJob(job: {
  company: string;
  title: string;
  platform: string;
  jobUrl: string;
  status: string;
  salary?: string;
  location?: string;
  questionsAndAnswers?: Array<{
    question: string;
    answer: string;
    type?: string;
  }>;
}): Promise<void> {
  const config = getConfig();
  const storageType: StorageType = config.storageType || 'sqlite';
  const cleanedUrl = cleanJobUrl(job.jobUrl);
  const dateStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

  const record: AppliedJob = {
    company: job.company || '',
    title: job.title || '',
    platform: job.platform || '',
    jobUrl: cleanedUrl,
    date: dateStr,
    status: job.status || 'Success',
    salary: job.salary,
    location: job.location,
    questionsAndAnswers: job.questionsAndAnswers,
  };

  // 1. Immediately update in-memory cache
  if (memoryCache) {
    if (cleanedUrl) memoryCache.urlSet.add(cleanedUrl);
    memoryCache.data.unshift(record);
  }

  // 2. Persist to active storage
  if (storageType === 'sqlite') {
    const db = getSqliteDb();
    if (db) {
      try {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO applied_jobs (company, title, platform, jobUrl, date, status, salary, location, details)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
          record.company,
          record.title,
          record.platform,
          record.jobUrl,
          record.date,
          record.status,
          record.salary || '',
          record.location || '',
          record.questionsAndAnswers ? JSON.stringify(record.questionsAndAnswers) : ''
        );
      } catch (err: any) {
        saveToJsonFile(record);
      }
    } else {
      saveToJsonFile(record);
    }
  } else if (storageType === 'json') {
    saveToJsonFile(record);
  } else if (storageType === 'sheets') {
    await googleSheets.addAppliedJob(job);
  }
}

export async function isJobAlreadyApplied(jobUrl: string): Promise<boolean> {
  if (!jobUrl) return false;
  const targetUrl = cleanJobUrl(jobUrl);

  // Fast path: Check in-memory URL set in 0.001ms
  if (memoryCache && memoryCache.urlSet.has(targetUrl)) {
    return true;
  }

  const config = getConfig();
  const storageType: StorageType = config.storageType || 'sqlite';

  if (storageType === 'sqlite') {
    const db = getSqliteDb();
    if (db) {
      try {
        const stmt = db.prepare('SELECT 1 FROM applied_jobs WHERE jobUrl = ? LIMIT 1');
        const row = stmt.get(targetUrl);
        if (row) {
          if (memoryCache) memoryCache.urlSet.add(targetUrl);
          return true;
        }
        return false;
      } catch {
        // Fallback
      }
    }
  }

  // Fallback: fetch & populate memory
  const all = await getAppliedJobs();
  return all.some((j) => cleanJobUrl(j.jobUrl) === targetUrl);
}

// ==========================================
// JSON File Helpers
// ==========================================

function readFromJsonFile(): AppliedJob[] {
  try {
    if (fs.existsSync(JSON_STORAGE_PATH)) {
      const content = fs.readFileSync(JSON_STORAGE_PATH, 'utf8');
      if (!content.trim()) return [];
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (err: any) {
    console.error('Error reading applied_jobs.json:', err?.message || err);
  }
  return [];
}

function saveToJsonFile(record: AppliedJob) {
  try {
    const list = readFromJsonFile();
    // Prepend new record, deduplicate by jobUrl if exists
    const filtered = list.filter((item) => cleanJobUrl(item.jobUrl) !== record.jobUrl);
    filtered.unshift(record);
    fs.writeFileSync(JSON_STORAGE_PATH, JSON.stringify(filtered, null, 2), 'utf8');
  } catch (err: any) {
    console.error('Error writing applied_jobs.json:', err?.message || err);
  }
}

// ==========================================
// Export Utilities (CSV & JSON)
// ==========================================

export async function exportAppliedJobsCsv(): Promise<string> {
  const jobs = await getAppliedJobs(true);
  const header = ['Perusahaan', 'Posisi', 'Platform', 'Tanggal', 'Status', 'Tautan Lowongan'];

  const rows = jobs.map((j) => [
    `"${(j.company || '').replace(/"/g, '""')}"`,
    `"${(j.title || '').replace(/"/g, '""')}"`,
    `"${(j.platform || '').replace(/"/g, '""')}"`,
    `"${(j.date || '').replace(/"/g, '""')}"`,
    `"${(j.status || '').replace(/"/g, '""')}"`,
    `"${(j.jobUrl || '').replace(/"/g, '""')}"`,
  ]);

  return [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export async function testActiveStorage(): Promise<{ success: boolean; message: string }> {
  const config = getConfig();
  const storageType: StorageType = config.storageType || 'sqlite';

  if (storageType === 'sqlite') {
    const db = getSqliteDb();
    if (db) {
      try {
        const countRow = db.prepare('SELECT COUNT(*) as count FROM applied_jobs').get() as { count: number };
        return {
          success: true,
          message: `Database SQLite aktif (File: cv_blaster.db, Tercatat: ${countRow?.count || 0} lamaran)`,
        };
      } catch (err: any) {
        return {
          success: false,
          message: `Koneksi SQLite gagal: ${err?.message || err}`,
        };
      }
    } else {
      // Automatic fallback to JSON file
      const list = readFromJsonFile();
      return {
        success: true,
        message: `Penyimpanan Lokal Aktif (File: applied_jobs.json, Tercatat: ${list.length} lamaran)`,
      };
    }
  } else if (storageType === 'json') {
    try {
      const list = readFromJsonFile();
      return {
        success: true,
        message: `File JSON aktif (File: applied_jobs.json, Tercatat: ${list.length} lamaran)`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `File JSON gagal: ${err?.message || err}`,
      };
    }
  } else {
    const res = await googleSheets.testSheetsConnection();
    return {
      success: res.success,
      message: res.success ? (res.message || 'Terkoneksi ke Google Sheets') : (res.error || 'Gagal terhubung'),
    };
  }
}
