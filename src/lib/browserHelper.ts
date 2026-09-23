import fs from 'fs';
import path from 'path';
import { getConfig } from './config';

export interface LaunchBrowserResult {
  browser: any;
  browserType: 'google-chrome' | 'chromium-bundled' | 'custom-chrome' | 'camoufox-stealth';
}

import { execSync } from 'child_process';

/**
 * Launches Camoufox Stealth Browser (Firefox C++ Patched Engine) with Playwright
 * and wraps it to expose a Puppeteer-compatible API for existing bots.
 */
export async function launchCamoufoxBrowser(
  mode: 'headless' | 'headful' = 'headless',
  onLog?: (msg: string) => void,
  profileFolderOverride?: string
): Promise<LaunchBrowserResult> {
  const { Camoufox } = require('camoufox-js');
  const config = getConfig();
  const log = onLog || console.log;

  let folderName = profileFolderOverride;
  if (!folderName) {
    const activeAccount = config.browserAccounts?.find(a => a.id === config.activeBrowserAccountId);
    folderName = activeAccount?.profileFolder ? `${activeAccount.profileFolder}-camoufox` : 'automation-profile-camoufox';
  } else if (!folderName.includes('camoufox')) {
    folderName = `${folderName}-camoufox`;
  }

  const profilePath = path.isAbsolute(folderName) ? folderName : path.join(/*turbopackIgnore: true*/ process.cwd(), folderName);
  const isHeadless = mode !== 'headful';

  if (!fs.existsSync(/*turbopackIgnore: true*/ profilePath)) {
    try {
      fs.mkdirSync(profilePath, { recursive: true });
    } catch {}
  }

  log(`🛡️ Meluncurkan Camoufox Stealth Browser (Firefox C++ Anti-Bot Engine)...`);

  const rawContext = await Camoufox({
    headless: isHeadless,
    os: 'windows',
    humanize: true,
    user_data_dir: profilePath,
  });

  function wrapPage(page: any) {
    if (!page) return page;

    if (!page.setCookie) {
      page.setCookie = async (...cookies: any[]) => {
        const formatted = cookies.map(c => {
          let sameSite = c.sameSite;
          if (sameSite && typeof sameSite === 'string') {
            const lower = sameSite.toLowerCase();
            if (lower === 'lax') sameSite = 'Lax';
            else if (lower === 'strict') sameSite = 'Strict';
            else if (lower === 'none') sameSite = 'None';
            else sameSite = undefined;
          }
          return {
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path || '/',
            expires: typeof c.expires === 'number' ? c.expires : undefined,
            httpOnly: Boolean(c.httpOnly),
            secure: Boolean(c.secure),
            sameSite: sameSite
          };
        });
        return rawContext.addCookies(formatted);
      };
    }

    if (!page.setUserAgent) {
      page.setUserAgent = async () => {};
    }

    if (!page.waitForTimeout) {
      page.waitForTimeout = (ms: number) => new Promise(r => setTimeout(r, ms));
    }

    return page;
  }

  const browserWrapper = {
    _raw: rawContext,
    newPage: async () => {
      const page = await rawContext.newPage();
      return wrapPage(page);
    },
    pages: async () => {
      const pgs = rawContext.pages();
      return pgs.map(wrapPage);
    },
    close: async () => {
      await rawContext.close();
    },
    version: async () => {
      return 'Camoufox-Gecko-Stealth';
    }
  };

  log(`✅ Berhasil membuka Camoufox Stealth Browser [Firefox C++ Gecko Engine]`);
  return {
    browser: browserWrapper,
    browserType: 'camoufox-stealth'
  };
}

/**
 * Removes stale Chromium/Chrome singleton lock symlinks and kills any orphan
 * Chrome/Chromium processes that are still holding locks on the userDataDir.
 * This prevents "The browser is already running for ... Use a different userDataDir" errors.
 */
export function cleanupStaleProfileLocks(profilePath: string) {
  // 1. On Windows, if Chrome crashed or was left orphan, terminate orphan processes holding the folder
  if (process.platform === 'win32') {
    try {
      const safeDir = profilePath.replace(/'/g, "''");
      const psScript = `Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe' or Name = 'chromium.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*${safeDir}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
      const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
      execSync(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, { stdio: 'ignore', timeout: 3000 });
    } catch {
      // Non-blocking fallback
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

  // If user selected Camoufox Stealth Engine, launch Camoufox directly
  if (config.browserEngine === 'camoufox') {
    try {
      return await launchCamoufoxBrowser(mode, onLog, profileFolderOverride);
    } catch (camoufoxErr: any) {
      const log = onLog || console.log;
      log(`⚠️ Gagal membuka Camoufox Stealth: ${camoufoxErr.message || camoufoxErr}`);
      log(`🔄 Beralih ke Google Chrome / Puppeteer fallback...`);
    }
  }

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
  ];

  if (!isHeadless) {
    // Headful mode flags to ensure a visible, focused window on the primary screen
    baseArgs.push(
      '--new-window',
      '--start-maximized',
      '--window-position=50,50',
      '--window-size=1280,900'
    );
  } else {
    baseArgs.push('--window-size=1280,800');
  }

  // Sandbox flags khusus Linux jika dijalankan di container/server Linux
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

      // Ensure window is brought to the front on Windows in headful mode
      if (!isHeadless && process.platform === 'win32') {
        try {
          const { exec } = require('child_process');
          const ps = `(New-Object -ComObject WScript.Shell).AppActivate('Chrome')`;
          const encoded = Buffer.from(ps, 'utf16le').toString('base64');
          exec(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, () => {});
        } catch {}
      }

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

export interface StuckResolutionResult {
  actionTaken: 'dismissed_popup' | 'ai_resolved' | 'skipped_captcha' | 'none';
  shouldSkip: boolean;
  message: string;
}

/**
 * Universal Recovery & Anti-Stuck Handler (Watchdog):
 * Tier 1: Heuristic Auto-Dismiss for annoying modals (0 tokens, instant)
 * Tier 2: Check for blocking CAPTCHA / verification (graceful skip to protect account)
 * Tier 3: AI Form Inspector (if AI active and stuck > 8s)
 */
export async function handleStuckFormAndPopups(
  page: any,
  options: {
    onLog?: (msg: string) => void;
    enableAiInspector?: boolean;
    candidateContext?: string;
    jobTitle?: string;
    company?: string;
  } = {}
): Promise<StuckResolutionResult> {
  const log = options.onLog || (() => {});

  try {
    // 1. TIER 1: HEURISTIC MODAL & POPUP DISMISSAL (0 Token, 0.1s)
    const dismissResult = await page.evaluate(() => {
      // Check for common close / dismiss buttons in active dialogs/modals
      const selectors = [
        'button[aria-label*="close" i]',
        'button[aria-label*="tutup" i]',
        'button[aria-label*="batal" i]',
        'button[data-testid*="close" i]',
        'button[data-automation*="close" i]',
        '.modal-close',
        '.modal__close',
        '[data-modal-close]',
        'button[aria-label="Dismiss"]',
        'button[aria-label="Dismiss alert"]',
      ];

      for (const sel of selectors) {
        const btn = document.querySelector(sel) as HTMLElement;
        if (btn && btn.offsetParent !== null) {
          btn.click();
          return { clicked: true, text: btn.getAttribute('aria-label') || sel };
        }
      }

      // Check for buttons by visible text inside modal dialogs
      const dialogs = document.querySelectorAll('[role="dialog"], .artdeco-modal, [class*="modal"], [class*="Modal"], [class*="dialog"]');
      if (dialogs.length > 0) {
        const lastDialog = dialogs[dialogs.length - 1];
        const buttons = Array.from(lastDialog.querySelectorAll('button, a[role="button"]')) as HTMLElement[];
        
        // Negative / Dismissive actions
        const dismissiveRegex = /^(nanti saja|batal|lewati|tutup|not now|maybe later|skip|dismiss|cancel|close|no thanks)$/i;
        for (const btn of buttons) {
          const txt = (btn.textContent || '').trim();
          if (dismissiveRegex.test(txt) && btn.offsetParent !== null) {
            btn.click();
            return { clicked: true, text: txt };
          }
        }

        // Affirmative Consent / Agree actions (Terms, data privacy consent)
        const consentRegex = /^(saya setuju|setuju & lanjutkan|i agree|agree|agree & continue|accept all|terima semua|lanjutkan)$/i;
        for (const btn of buttons) {
          const txt = (btn.textContent || '').trim();
          if (consentRegex.test(txt) && btn.offsetParent !== null) {
            btn.click();
            return { clicked: true, text: txt };
          }
        }
      }

      return { clicked: false, text: '' };
    });

    if (dismissResult.clicked) {
      log(`🧹 [Watchdog] Berhasil menutup/konfirmasi pop-up interupsi: "${dismissResult.text}"`);
      await new Promise(r => setTimeout(r, 1000));
      return {
        actionTaken: 'dismissed_popup',
        shouldSkip: false,
        message: `Menutup modal: ${dismissResult.text}`,
      };
    }

    // 2. TIER 2: CAPTCHA / SECURITY CHECKPOINT DETECTION
    const hasCaptcha = await page.evaluate(() => {
      const captchaSelectors = [
        'iframe[src*="recaptcha"]',
        'iframe[src*="turnstile"]',
        'iframe[src*="hcaptcha"]',
        '#cf-challenge-running',
        '#challenge-stage',
        '.g-recaptcha',
        '[data-sitekey]'
      ];
      return captchaSelectors.some(sel => !!document.querySelector(sel));
    });

    if (hasCaptcha) {
      log(`🛡️ [Watchdog] Verifikasi keamanan (CAPTCHA/Cloudflare) terdeteksi. Melewati loker ini demi keamanan akun...`);
      return {
        actionTaken: 'skipped_captcha',
        shouldSkip: true,
        message: 'CAPTCHA terdeteksi - loker dilewati untuk keamanan akun',
      };
    }

    // 3. TIER 3: AI FORM INSPECTOR (If enabled & available)
    if (options.enableAiInspector) {
      try {
        const { captureFormDomSnapshot, inspectFormWithAi, applyAiFormActions } = require('./aiFormInspector');
        const snapshot = await captureFormDomSnapshot(page);
        if (snapshot && snapshot.elementMap.length > 0) {
          const plan = await inspectFormWithAi({
            platform: 'Job Portal',
            jobTitle: options.jobTitle || 'Job Application',
            company: options.company || 'Target Company',
            candidateProfileContext: options.candidateContext || '',
            domSnippet: snapshot.htmlSnippet,
            stepHint: 'Stuck Form Recovery',
          });

          if (plan) {
            const applied = await applyAiFormActions(page, plan, log);
            if (applied) {
              return {
                actionTaken: 'ai_resolved',
                shouldSkip: false,
                message: `AI memecahkan form macet: "${plan.formGoal}"`,
              };
            }
          }
        }
      } catch (aiErr: any) {
        log(`⚠️ [Watchdog AI] Gagal menjalankan AI Form Inspector: ${aiErr?.message || aiErr}`);
      }
    }

    return {
      actionTaken: 'none',
      shouldSkip: false,
      message: 'Tidak ada tindakan pemulihan yang diperlukan',
    };
  } catch (err: any) {
    return {
      actionTaken: 'none',
      shouldSkip: false,
      message: err?.message || String(err),
    };
  }
}

