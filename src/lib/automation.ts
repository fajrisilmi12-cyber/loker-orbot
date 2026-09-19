import path from 'path';
import { getConfig } from './config';
import { runGlintsBot } from './bots/glints';
import { runJobstreetBot } from './bots/jobstreet';
import { runLinkedinBot } from './bots/linkedin';
import { runIndeedBot } from './bots/indeed';

declare global {
  var isBotRunning: boolean;
}

export async function startBot(
  onLog: (msg: string) => void,
  mode: string = 'headless',
  targetPlatform: string = 'all',
  customLimit?: number
) {
  if (global.isBotRunning) {
    onLog('⚠️ Bot is already running!');
    return;
  }

  global.isBotRunning = true;
  const platformLabel = targetPlatform !== 'all' ? targetPlatform.toUpperCase() : 'SEMUA PLATFORM';
  onLog(`🚀 Starting CV Blaster Engine in ${mode.toUpperCase()} mode [Target: ${platformLabel}]...`);

  let browser: any = null;
  try {
    const config = getConfig();

    // Verify AI Gateway configuration (Config UI key or .env)
    const hasAiConfig = Boolean(
      (config.geminiApiKey && config.geminiApiKey.trim()) ||
      (config.customAiApiKey && config.customAiApiKey.trim()) ||
      (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here')
    );

    if (!hasAiConfig) {
      throw new Error('API Key AI belum diatur. Masukkan Gemini API Key atau Custom AI Router (9Router/OpenRouter) di tab Wizard Langkah 3!');
    }

    if (!config.searchKeywords && !config.indeedNoJobTitleFilter) {
      throw new Error('Search keywords are not configured. Please fill them in first.');
    }

    // Test Storage connection
    const storageType = config.storageType || 'sqlite';
    onLog(`💾 Memeriksa sistem penyimpanan (${storageType.toUpperCase()})...`);
    const { testActiveStorage } = require('./storage');
    const storageTest = await testActiveStorage();
    if (storageTest.success) {
      onLog(`✅ Penyimpanan aktif: ${storageTest.message}`);
    } else {
      onLog(`⚠️ Peringatan: ${storageTest.message}`);
    }

    // Launch browser with Google Chrome priority and Chromium fallback
    const { launchBrowserWithFallback } = require('./browserHelper');
    const launchResult = await launchBrowserWithFallback(mode as any, onLog);
    browser = launchResult.browser;

    let totalSuccess = 0;
    let totalAlreadyApplied = 0;
    let totalErrors = 0;

    const isSinglePlatform = targetPlatform && targetPlatform !== 'all';
    const isSharedMode = !isSinglePlatform && config.limitMode !== 'per_platform';
    const sharedLimitTarget = customLimit || config.limitPerDay || 155;

    if (isSinglePlatform) {
      onLog(`🎯 Mode Single-Platform: Portal "${platformLabel}" Aktif (Batas: ${customLimit || 'Default'} lamaran).`);
    } else if (isSharedMode) {
      onLog(`🎯 Mode Kuota: Kuota Gabungan Aktif (Target Total: ${sharedLimitTarget} lamaran untuk semua platform).`);
    } else {
      onLog(`🎯 Mode Kuota: Kuota Per-Platform Aktif (Glints: ${config.limitGlints || 80}, JobStreet: ${config.limitJobstreet || 75}, LinkedIn: ${config.limitLinkedin || 50}).`);
    }

    const glintsLimiter = {
      getTargetLimit: () => customLimit || (isSharedMode ? sharedLimitTarget : (config.limitGlints || config.limitPerDay || 80)),
      isLimitReached: (currentGlintsSuccess: number) => {
        const target = customLimit || (isSharedMode ? sharedLimitTarget : (config.limitGlints || config.limitPerDay || 80));
        return isSharedMode ? totalSuccess >= target : currentGlintsSuccess >= target;
      },
      onJobSuccess: () => {
        totalSuccess++;
      }
    };

    const jobstreetLimiter = {
      getTargetLimit: () => customLimit || (isSharedMode ? sharedLimitTarget : (config.limitJobstreet || config.limitPerDay || 75)),
      isLimitReached: (currentJobstreetSuccess: number) => {
        const target = customLimit || (isSharedMode ? sharedLimitTarget : (config.limitJobstreet || config.limitPerDay || 75));
        return isSharedMode ? totalSuccess >= target : currentJobstreetSuccess >= target;
      },
      onJobSuccess: () => {
        totalSuccess++;
      }
    };

    const linkedinLimiter = {
      getTargetLimit: () => customLimit || (isSharedMode ? sharedLimitTarget : (config.limitLinkedin || config.limitPerDay || 50)),
      isLimitReached: (currentLinkedinSuccess: number) => {
        const target = customLimit || (isSharedMode ? sharedLimitTarget : (config.limitLinkedin || config.limitPerDay || 50));
        return isSharedMode ? totalSuccess >= target : currentLinkedinSuccess >= target;
      },
      onJobSuccess: () => {
        totalSuccess++;
      }
    };

    const indeedLimiter = {
      getTargetLimit: () => customLimit || (isSharedMode ? sharedLimitTarget : (config.limitIndeed || config.limitPerDay || 50)),
      isLimitReached: (currentIndeedSuccess: number) => {
        const target = customLimit || (isSharedMode ? sharedLimitTarget : (config.limitIndeed || config.limitPerDay || 50));
        return isSharedMode ? totalSuccess >= target : currentIndeedSuccess >= target;
      },
      onJobSuccess: () => {
        totalSuccess++;
      }
    };

    const { applyStealthToPage } = require('./stealthHelper');

    const initialPages = await browser.pages();
    let initialPageUsed = false;

    const getOrNewPage = async () => {
      let page;
      const currentPages = await browser.pages().catch(() => []);
      if (!initialPageUsed && currentPages.length > 0 && currentPages[0]) {
        initialPageUsed = true;
        page = currentPages[0];
      } else {
        page = await browser.newPage();
      }
      await applyStealthToPage(page);
      return page;
    };

    const safeClosePage = async (pageToClose: any) => {
      try {
        const currentPages = await browser.pages().catch(() => []);
        if (currentPages.length > 1) {
          await pageToClose.close();
        } else {
          await pageToClose.goto('about:blank', { waitUntil: 'domcontentloaded' }).catch(() => {});
        }
      } catch {}
    };

    const shouldInclude = (platformName: string, configEnabled: boolean) => {
      if (isSinglePlatform) {
        return targetPlatform.toLowerCase() === platformName.toLowerCase();
      }
      return configEnabled;
    };

    const runPlatformTasks: Array<{ name: string; run: () => Promise<void> }> = [];

    // ----------------------------------------------------
    // TAB 1: GLINTS AUTOMATION
    // ----------------------------------------------------
    if (shouldInclude('glints', !!config.enableGlints)) {
      runPlatformTasks.push({
        name: 'Glints',
        run: async () => {
          const pageGlints = await getOrNewPage();
          const glintsLog = (msg: string) => onLog(`[Glints] ${msg}`);

          glintsLog('🔍 Memulai proses bot Glints...');
          try {
            const metrics = await runGlintsBot(pageGlints, config, glintsLog, glintsLimiter);
            totalAlreadyApplied += metrics.alreadyAppliedCount;
            totalErrors += metrics.errorCount;
          } catch (err: any) {
            glintsLog(`❌ Error: ${err.message || err}`);
            totalErrors++;
          } finally {
            await safeClosePage(pageGlints);
          }
        }
      });
    } else if (!isSinglePlatform) {
      onLog('⏩ Glints dinonaktifkan di pengaturan.');
    }

    // ----------------------------------------------------
    // TAB 2: JOBSTREET AUTOMATION
    // ----------------------------------------------------
    if (shouldInclude('jobstreet', !!config.enableJobstreet)) {
      runPlatformTasks.push({
        name: 'Jobstreet',
        run: async () => {
          const pageJobstreet = await getOrNewPage();
          const jobstreetLog = (msg: string) => onLog(`[Jobstreet] ${msg}`);

          jobstreetLog('🔍 Memulai proses bot Jobstreet...');
          try {
            const metrics = await runJobstreetBot(pageJobstreet, config, jobstreetLog, jobstreetLimiter);
            totalAlreadyApplied += metrics.alreadyAppliedCount;
            totalErrors += metrics.errorCount;
          } catch (err: any) {
            jobstreetLog(`❌ Error: ${err.message || err}`);
            totalErrors++;
          } finally {
            await safeClosePage(pageJobstreet);
          }
        }
      });
    } else if (!isSinglePlatform) {
      onLog('⏩ Jobstreet dinonaktifkan di pengaturan.');
    }

    // ----------------------------------------------------
    // TAB 3: LINKEDIN AUTOMATION
    // ----------------------------------------------------
    if (shouldInclude('linkedin', !!config.enableLinkedin)) {
      runPlatformTasks.push({
        name: 'LinkedIn',
        run: async () => {
          const pageLinkedin = await getOrNewPage();
          const linkedinLog = (msg: string) => onLog(`[LinkedIn] ${msg}`);

          linkedinLog('🔍 Memulai proses bot LinkedIn...');
          try {
            const metrics = await runLinkedinBot(pageLinkedin, config, linkedinLog, linkedinLimiter);
            totalAlreadyApplied += metrics.alreadyAppliedCount;
            totalErrors += metrics.errorCount;
          } catch (err: any) {
            linkedinLog(`❌ Error: ${err.message || err}`);
            totalErrors++;
          } finally {
            await safeClosePage(pageLinkedin);
          }
        }
      });
    } else if (!isSinglePlatform) {
      onLog('⏩ LinkedIn dinonaktifkan di pengaturan.');
    }

    // ----------------------------------------------------
    // TAB 4: INDEED AUTOMATION
    // ----------------------------------------------------
    if (shouldInclude('indeed', !!config.enableIndeed)) {
      runPlatformTasks.push({
        name: 'Indeed',
        run: async () => {
          const pageIndeed = await getOrNewPage();
          const indeedLog = (msg: string) => onLog(`[Indeed] ${msg}`);

          indeedLog('🔍 Memulai proses bot Indeed...');
          try {
            const metrics = await runIndeedBot(pageIndeed, config, indeedLog, indeedLimiter);
            totalAlreadyApplied += metrics.alreadyAppliedCount;
            totalErrors += metrics.errorCount;
          } catch (err: any) {
            indeedLog(`❌ Error: ${err.message || err}`);
            totalErrors++;
          } finally {
            await safeClosePage(pageIndeed);
          }
        }
      });
    } else if (!isSinglePlatform) {
      onLog('⏩ Indeed dinonaktifkan di pengaturan.');
    }

    // Jalankan platform secara berurutan (sequential) untuk stabilitas & anti-deteksi maksimal
    if (runPlatformTasks.length > 0) {
      onLog(`🚀 Menjalankan ${runPlatformTasks.length} platform secara berurutan...`);
      for (const task of runPlatformTasks) {
        if (!global.isBotRunning) break;
        if (isSharedMode && totalSuccess >= sharedLimitTarget && !isSinglePlatform) {
          onLog(`🎯 [Shared Limit] Kuota bersama sesi (${totalSuccess}/${sharedLimitTarget}) telah terpenuhi dari portal sebelumnya. Portal ${task.name} dilewati.`);
          continue;
        }
        onLog(`▶️ Memulai portal: ${task.name}`);
        await task.run();
        onLog(`⏹️ Selesai portal: ${task.name}`);
      }
    } else {
      onLog('⚠️ Tidak ada platform yang diaktifkan (Glints, Jobstreet, LinkedIn & Indeed semuanya nonaktif).');
    }

    onLog('--------------------------------------------------');
    onLog('📊 RINGKASAN SESI (SESSION SUMMARY):');
    onLog(`✅ Total Berhasil Dilamar / Disimulasikan: ${totalSuccess} pekerjaan`);
    onLog(`⏩ Total Dilewati (Sudah Dilamar): ${totalAlreadyApplied} pekerjaan`);
    onLog(`❌ Total Error: ${totalErrors} pekerjaan`);
    onLog('--------------------------------------------------');
    onLog('🏁 Sesi CV Blaster Selesai!');
  } catch (error: any) {
    onLog(`🚨 Fatal Bot Error: ${error.message || error}`);
  } finally {
    if (browser) {
      if (mode === 'headful') {
        onLog('⏳ Menunggu 5 detik sebelum menutup browser headful...');
        await new Promise(r => setTimeout(r, 5000));
      }
      await browser.close();
    }
    global.isBotRunning = false;
  }
}
