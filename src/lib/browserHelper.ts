import fs from 'fs';
import path from 'path';
import { getConfig } from './config';

export interface LaunchBrowserResult {
  browser: any;
  browserType: 'google-chrome' | 'chromium-bundled' | 'custom-chrome';
}

import { execSync } from 'child_process';

/**
 * Removes stale Chromium/Chrome singleton lock symlinks and kills any orphan
 * Chrome/Chromium processes that are still holding locks on the userDataDir.
 * This prevents "The browser is already running for ... Use a different userDataDir" errors.
 */
export function cleanupStaleProfileLocks(profilePath: string) {
  // 1. On Windows, if Chrome crashed or was left orphan, terminate orphan processes holding the folder
  if (process.platform === 'win32') {
    try {
      // Find and kill processes matching this automation profile directory using PowerShell
      const safeDir = profilePath.replace(/'/g, "''");
      const psCommand = `powershell -NoProfile -NonInteractive -Command "Get-CimInstance Win32_Process -Filter \\"name = 'chrome.exe' or name = 'chromium.exe'\\" | Where-Object { $_.CommandLine -like '*${safeDir}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`;
      execSync(psCommand, { stdio: 'ignore', timeout: 4000 });
    } catch {
      try {
        const normalizedPath = profilePath.replace(/\\/g, '\\\\');
        const cmd = `wmic process where "(name='chrome.exe' or name='chromium.exe') and commandline like '%${normalizedPath}%'" call terminate`;
        execSync(cmd, { stdio: 'ignore', timeout: 3000 });
      } catch {}
    }
  }

  // 2. Remove lock files
  try {
    const lockFiles = [
      'SingletonLock',
      'SingletonCookie',
      'SingletonSocket',
      'DevToolsActivePort',
      'lockfile',
      'parent.lock'
    ];
    for (const file of lockFiles) {
      const fullPath = path.join(/*turbopackIgnore: true*/ profilePath, file);
      try {
        if (fs.existsSync(/*turbopackIgnore: true*/ fullPath) || fs.lstatSync(/*turbopackIgnore: true*/ fullPath).isSymbolicLink()) {
          fs.unlinkSync(fullPath);
        }
      } catch {}
    }
  } catch (e) {
    // ignore
  }
}

/**
 * Launches Puppeteer browser with priority given to official Google Chrome (System Chrome)
 * and automatically falls back to bundled Chromium if Google Chrome fails or is unavailable.
 * Supports multi-account profiles (resolves profile folder from active browser account).
 */
export async function launchBrowserWithFallback(
  mode: 'headless' | 'headful' = 'headless',
  onLog?: (msg: string) => void,
  profileFolderOverride?: string
): Promise<LaunchBrowserResult> {
  const puppeteer = require('puppeteer-extra');
  const StealthPlugin = require('puppeteer-extra-plugin-stealth');
  try {
    puppeteer.use(StealthPlugin());
  } catch (e) {}

  const config = getConfig();

  // Resolve profile folder from override, active browser account, or default
  let folderName = profileFolderOverride;
  if (!folderName) {
    const activeAccount = config.browserAccounts?.find(a => a.id === config.activeBrowserAccountId);
    folderName = activeAccount?.profileFolder || 'automation-profile';
  }

  const profilePath = path.isAbsolute(folderName) ? folderName : path.join(/*turbopackIgnore: true*/ process.cwd(), folderName);
  const isHeadless = mode !== 'headful';

  // Ensure directory exists
  if (!fs.existsSync(/*turbopackIgnore: true*/ profilePath)) {
    try {
      fs.mkdirSync(profilePath, { recursive: true });
    } catch {}
  }

  // Bersihkan stale singleton lock sebelum meluncurkan browser
  cleanupStaleProfileLocks(profilePath);

  const baseArgs = [
    '--no-default-browser-check',
    '--no-first-run',
    '--disable-infobars',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process',
    '--window-size=1280,800',
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  ];

  // Hanya tambahkan sandbox flags khusus Linux jika dijalankan di container/server Linux
  if (process.platform === 'linux') {
    baseArgs.push('--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage');
  }

  const baseOptions: any = {
    headless: isHeadless,
    userDataDir: profilePath,
    ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=IdleDetection'],
    args: baseArgs,
    defaultViewport: isHeadless ? { width: 1280, height: 800 } : null
  };

  const log = onLog || console.log;

  // ----------------------------------------------------
  // ATTEMPT 1: Official Google Chrome (System Chrome)
  // ----------------------------------------------------
  if (config.useSystemChrome !== false) {
    const customPath = config.customChromePath ? config.customChromePath.trim() : '';
    const isCustomPath = customPath.length > 0;
    const chromeOptions = {
      ...baseOptions,
      ...(isCustomPath ? { executablePath: customPath } : { channel: 'chrome' })
    };

    const targetLabel = isCustomPath
      ? `Google Chrome (${customPath})`
      : 'Google Chrome Resmi (System Chrome)';

    try {
      log(`🌐 Mencoba meluncurkan ${targetLabel}...`);
      cleanupStaleProfileLocks(profilePath);
      const browser = await puppeteer.launch(chromeOptions);
      const version = await browser.version().catch(() => 'Unknown');
      log(`✅ Berhasil membuka ${targetLabel} [${version}]`);
      return {
        browser,
        browserType: isCustomPath ? 'custom-chrome' : 'google-chrome'
      };
    } catch (chromeError: any) {
      log(`⚠️ Gagal membuka ${targetLabel}: ${chromeError.message || chromeError}`);
      log(`🔄 Beralih (fallback) menggunakan Chromium bawaan Puppeteer...`);
      cleanupStaleProfileLocks(profilePath);
    }
  }

  // ----------------------------------------------------
  // ATTEMPT 2: Fallback to Bundled Chromium
  // ----------------------------------------------------
  try {
    log(`🌐 Meluncurkan Chromium Bawaan (Bundled Chromium)...`);
    cleanupStaleProfileLocks(profilePath);
    const browser = await puppeteer.launch(baseOptions);
    const version = await browser.version().catch(() => 'Unknown');
    log(`✅ Berhasil membuka Chromium Bawaan [${version}]`);
    return {
      browser,
      browserType: 'chromium-bundled'
    };
  } catch (bundledError: any) {
    log(`🚨 Gagal meluncurkan browser: ${bundledError.message || bundledError}`);
    throw new Error(`Tidak dapat meluncurkan browser: ${bundledError.message || bundledError}`);
  }
}
