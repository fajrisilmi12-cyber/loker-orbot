import fs from 'fs';
import path from 'path';
import { getConfig } from './config';

export interface LaunchBrowserResult {
  browser: any;
  browserType: 'google-chrome' | 'chromium-bundled' | 'custom-chrome';
}

/**
 * Removes stale Chromium/Chrome singleton lock symlinks if left over from a previous crash/close.
 * This prevents the "Failed to launch: Opening in existing browser session" error.
 */
export function cleanupStaleProfileLocks(profilePath: string) {
  try {
    const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'DevToolsActivePort'];
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
    '--test-type',
    '--disable-blink-features=AutomationControlled',
    '--window-size=1280,800'
  ];

  // Hanya tambahkan sandbox flags khusus Linux jika dijalankan di container/server Linux
  if (process.platform === 'linux') {
    baseArgs.push('--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage');
  }

  const baseOptions: any = {
    headless: isHeadless,
    userDataDir: profilePath,
    ignoreDefaultArgs: ['--enable-automation'],
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
