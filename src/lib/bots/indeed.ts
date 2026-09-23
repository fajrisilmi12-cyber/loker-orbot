import fs from 'fs';
import { isJobAlreadyApplied, addAppliedJob } from '../storage';
import { appendQuestionToCsv } from '../csvHelper';
import { answerQuestion } from '../questionAnswer';
import { generateCoverLetter } from '../coverLetterHelper';
import { evaluateJobMatch } from '../jobMatcher';
import { humanClick, humanType } from '../humanStealth';
import { parseCookiesInput, injectCookiesIntoPage } from '../cookieHelper';
import { buildIndeedSearchUrl } from '../searchQueryBuilder';

export interface BotMetrics {
  successCount: number;
  alreadyAppliedCount: number;
  errorCount: number;
}

export interface SharedLimiter {
  isLimitReached: (platformSuccess: number) => boolean;
  onJobSuccess: () => void;
  getTargetLimit: () => number;
}

export async function runIndeedBot(
  page: any,
  config: any,
  onLog: (msg: string) => void,
  sharedLimiter?: SharedLimiter
): Promise<BotMetrics> {
  let successCount = 0;
  let alreadyAppliedCount = 0;
  let errorCount = 0;

  try {
    const { url: searchUrl, displayKeywords } = buildIndeedSearchUrl(config);
    onLog(`🌐 Membuka URL Pencarian Indeed [Keywords: ${displayKeywords || 'Semua'}]: ${searchUrl}`);


    // Injeksi cookies jika tersedia di konfigurasi
    if (config.portalCookies?.indeed) {
      const cookies = parseCookiesInput(config.portalCookies.indeed, '.indeed.com');
      if (cookies.length > 0) {
        const injectedCount = await injectCookiesIntoPage(page, cookies);
        onLog(`🍪 [Cookie Injection] Berhasil menyuntikkan ${injectedCount} cookie sesi Indeed!`);
      }
    }

    // 2. SESSION WARMER: Kunjungi Beranda Indeed untuk aktivasi token Cloudflare & Sesi
    onLog('☕ [Session Warmer] Membuka Beranda Indeed (https://id.indeed.com/) untuk pemanasan sesi...');
    await page.goto('https://id.indeed.com/', { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });
    await sleep(2500);

    // 1b. Deteksi Cloudflare Challenge (Additional Verification Required)
    const checkCloudflare = async (): Promise<boolean> => {
      const isCF = await page.evaluate(() => {
        const bodyText = document.body?.innerText || '';
        return (
          bodyText.includes('Additional Verification Required') ||
          bodyText.includes('Verify you are human') ||
          document.title.includes('Just a moment') ||
          !!document.querySelector('.cf-error-code, #challenge-form, [data-ray-id]')
        );
      });
      return isCF;
    };

    if (await checkCloudflare()) {
      onLog('⚠️ [Indeed] Terdeteksi Cloudflare Challenge! Menunggu 20 detik untuk auto-resolve...');
      // Coba tunggu auto-resolve Cloudflare
      for (let cfWait = 0; cfWait < 4; cfWait++) {
        await sleep(5000);
        if (!(await checkCloudflare())) {
          onLog('✅ [Indeed] Cloudflare berhasil di-bypass! Melanjutkan...');
          break;
        }
        if (cfWait === 3) {
          onLog('❌ [Indeed] Cloudflare masih aktif setelah 20 detik.');
          onLog('💡 Saran: Buka browser login (klik "Buka Browser Login" di Dashboard), selesaikan verifikasi Cloudflare di Indeed secara manual, lalu jalankan bot kembali.');
          return { successCount, alreadyAppliedCount, errorCount };
        }
      }
    }

    // 2. Pengecekan status login di beranda
    let isLoggedIn = await page.evaluate(() => {
      const navAccount = document.querySelector('[data-gnav-element-name="AccountMenu"], #gnav-account-container, .gnav-AccountMenu, a[href*="/account"], button[aria-label*="Account"], button[aria-label*="Akun"]');
      const signInBtn = document.querySelector('a[href*="/account/login"], a[href*="secure.indeed.com/auth"]');
      return !!navAccount || !signInBtn;
    });

    let currentUrl = page.url();
    if (currentUrl.includes('/account/login') || currentUrl.includes('/auth') || !isLoggedIn) {
      onLog('⚠️ Indeed: Sesi login belum aktif. Menunggu 30 detik untuk Anda login langsung di browser...');
      for (let waitSec = 0; waitSec < 6; waitSec++) {
        await sleep(5000);
        isLoggedIn = await page.evaluate(() => {
          const navAccount = document.querySelector('[data-gnav-element-name="AccountMenu"], #gnav-account-container, .gnav-AccountMenu, a[href*="/account"], button[aria-label*="Account"], button[aria-label*="Akun"]');
          const signInBtn = document.querySelector('a[href*="/account/login"], a[href*="secure.indeed.com/auth"]');
          return !!navAccount || !signInBtn;
        });
        if (isLoggedIn) {
          onLog('✅ Login Indeed terverifikasi aktif!');
          break;
        }
        onLog(`⏳ Menunggu login Indeed... (${(waitSec + 1) * 5}s/30s)`);
      }
    }

    if (!isLoggedIn) {
      onLog('⚠️ Indeed: Belum login! Silakan login melalui "Buka Browser (Login Setup)" di Dashboard.');
      return { successCount, alreadyAppliedCount, errorCount };
    }

    onLog('✅ Indeed: Akun terverifikasi dan sesi login aktif.');

    // 3. WARMUP TRANSITION: Navigasi alami dari Beranda ke Hasil Pencarian
    onLog(`🌐 Membuka URL Pencarian Indeed: ${searchUrl}`);
    await page.goto(searchUrl, { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000,
      referer: 'https://id.indeed.com/' 
    });
    await sleep(2500);

    // Tunggu hasil pencarian selesai dimuat
    onLog('⏳ Menunggu hasil pencarian Indeed dimuat...');
    try {
      await page.waitForFunction(() => {
        const cards = document.querySelectorAll('.job_seen_beacon, .cardOutline, a.jcs-JobTitle, [data-jk]');
        return cards.length > 0;
      }, { timeout: 15000 });
    } catch {
      await sleep(3000);
    }
    await sleep(1500);

    const targetLimit = sharedLimiter ? sharedLimiter.getTargetLimit() : (config.limitIndeed || config.limitPerDay || 50);
    const checkLimitReached = () => sharedLimiter ? sharedLimiter.isLimitReached(successCount) : successCount >= targetLimit;

    let currentPage = 1;
    const maxPages = Math.max(30, Math.ceil(targetLimit * 3));
    const processedJobIds = new Set<string>();

    const browser = page.browser();

    while (currentPage <= maxPages && global.isBotRunning !== false && !checkLimitReached()) {
      onLog('==================================================');
      onLog(`📄 Memproses Halaman Pencarian Indeed ke-${currentPage}...`);

      // 3. Scan seluruh Job ID unik pada daftar pencarian
      const jobCards = await page.evaluate(() => {
        const results: { jobId: string; title: string; company: string; location: string; isEasyApply: boolean; isAlreadyApplied: boolean }[] = [];
        const cardElements = Array.from(document.querySelectorAll('.job_seen_beacon, .cardOutline, table.mainContentTable, li.css-1ac2h1w, li.css-5lfssm'));

        for (const el of cardElements) {
          const titleAnchor = el.querySelector('a.jcs-JobTitle, h3.jobTitle a, a[data-jk]') as HTMLAnchorElement;
          const jobId = titleAnchor?.getAttribute('data-jk') || el.closest('[data-jk]')?.getAttribute('data-jk') || el.getAttribute('data-jk') || '';
          if (!jobId) continue;

          // Hindari duplikasi dalam list yang sama
          if (results.some(r => r.jobId === jobId)) continue;

          const title = titleAnchor?.textContent?.trim() || el.querySelector('h3.jobTitle span, h2.jobTitle span')?.textContent?.trim() || 'Lowongan Kerja';
          const companyEl = el.querySelector('[data-testid="company-name"], .companyName, .css-19eicqx');
          const company = companyEl?.textContent?.trim() || 'Perusahaan';

          const locEl = el.querySelector('[data-testid="text-location"], .companyLocation, .css-1f06pz4');
          const location = locEl?.textContent?.trim() || 'Jakarta';

          const elText = el.textContent || '';
          const isEasyApply = /Easily apply|Lamar dengan Cepat|Lamar Mudah|Apply with Indeed/i.test(elText) || !!el.querySelector('.iaIcon, .ialbl');
          const isAlreadyApplied = /Dilamar|Applied|Lamaran terkirim/i.test(elText);

          results.push({
            jobId,
            title,
            company,
            location,
            isEasyApply,
            isAlreadyApplied
          });
        }
        return results;
      });

      onLog(`📊 Panel Kiri Indeed: Terdeteksi ${jobCards.length} lowongan kerja pada halaman ini.`);

      if (jobCards.length === 0) {
        onLog('⚠️ Tidak ditemukan kartu lowongan kerja di halaman ini. Mencoba menyelesaikan.');
        break;
      }

      // 4. Iterasi setiap lowongan
      for (let i = 0; i < jobCards.length; i++) {
        const cardInfo = jobCards[i];
        if (!cardInfo || !cardInfo.jobId) continue;

        if (!global.isBotRunning) {
          onLog('🛑 Bot dihentikan oleh pengguna.');
          break;
        }

        if (checkLimitReached()) {
          onLog(`🎯 Batas kuota tercapai (${successCount}/${targetLimit}). Selesai.`);
          break;
        }

        if (processedJobIds.has(cardInfo.jobId)) {
          continue;
        }
        processedJobIds.add(cardInfo.jobId);

        const targetJobUrl = `https://id.indeed.com/viewjob?jk=${cardInfo.jobId}`;

        // Cek riwayat Google Sheets
        const alreadyInSheets = await isJobAlreadyApplied(targetJobUrl);
        if (alreadyInSheets) {
          onLog(`⏩ [${i + 1}/${jobCards.length}] Lowongan "${cardInfo.title}" - Sudah tercatat di riwayat Google Sheets. Melewati...`);
          alreadyAppliedCount++;
          continue;
        }

        if (cardInfo.isAlreadyApplied) {
          onLog(`⏩ [${i + 1}/${jobCards.length}] Lowongan "${cardInfo.title}" - Sudah ada label 'Dilamar / Applied' pada kartu.`);
          alreadyAppliedCount++;
          continue;
        }

        // Fast Pre-Flight Location Check
        const userLocations = config.location
          ? config.location.split(/[,/|]+/).map((l: string) => l.trim().toLowerCase()).filter(Boolean)
          : [];

        if (userLocations.length > 0 && cardInfo.location) {
          const isRemoteOrHybrid = /remote|hybrid|wfh/i.test(cardInfo.location);
          const matchesCity = userLocations.some((l: string) =>
            !l.includes('remote') && !l.includes('wfh') && cardInfo.location.toLowerCase().includes(l)
          );
          if (!matchesCity && !isRemoteOrHybrid) {
            onLog(`⚡ [Indeed Pre-Filter] Melewati "${cardInfo.title}" di ${cardInfo.company} - Lokasi (${cardInfo.location}) di luar preferensi.`);
            continue;
          }
        }

        // Fast Pre-Flight Title & Match Check
        if (config.enableJobMatchFilter || config.negativeKeywords || config.blacklistedCompanies) {
          const cardMatch = evaluateJobMatch({
            jobTitle: cardInfo.title,
            company: cardInfo.company,
            targetKeywords: config.searchKeywords || '',
            negativeKeywords: config.negativeKeywords || '',
            blacklistedCompanies: config.blacklistedCompanies || '',
            minScoreThreshold: config.enableJobMatchFilter ? (config.minMatchScore ?? 25) : 0,
            candidateSkills: config.skills || ''
          });

          if (!cardMatch.shouldApply) {
            onLog(`⚡ [Indeed Pre-Filter] Melewati "${cardInfo.title}" di ${cardInfo.company} - ${cardMatch.reason}`);
            continue;
          }
        }

        onLog('==================================================');
        onLog(`💼 [${i + 1}/${jobCards.length}] Lowongan: "${cardInfo.title}"`);
        onLog(`🏢 Perusahaan: "${cardInfo.company}" | 📍 ${cardInfo.location}`);
        onLog(`🔗 URL: ${targetJobUrl}`);

        // Klik kartu untuk membuka panel kanan (Right Pane)
        await page.evaluate((jobId: string) => {
          const anchor = document.querySelector(`a[data-jk="${jobId}"], a.jcs-JobTitle[data-jk="${jobId}"], a#job_${jobId}`) as HTMLElement;
          const container = anchor?.closest('.job_seen_beacon, .cardOutline') as HTMLElement || anchor;
          if (container) {
            container.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (anchor) anchor.click();
          }
        }, cardInfo.jobId);
        await sleep(2500);

        // Periksa komponen panel kanan / detail lowongan
        const detailInfo = await page.evaluate(() => {
          // Cari tombol / link Indeed Apply (Smart Apply)
          const applyEl = document.querySelector(
            '[data-testid="viewjob-indeed-apply"], [data-testid="primary-apply-action"] a, a[href*="smartapply.indeed.com"], a[href*="indeedapply"], button#indeedApplyButton, [data-testid="indeedApplyButton"], button[aria-label*="Lamar dengan Indeed"], button[aria-label*="Apply now"], button[aria-label*="Lamar sekarang"]'
          ) as HTMLElement | null;

          const externalBtn = document.querySelector(
            'button[aria-label*="Lamar di situs web"], button[aria-label*="Apply on company site"], a[aria-label*="Apply on company site"], a[href*="rc/clk"]'
          );

          const titleEl = document.querySelector('[data-testid="vj-job-title"], [data-testid="vj-job-title-compact"], .jobsearch-JobInfoHeader-title, h5[aria-level="5"]');
          const officialTitle = titleEl?.textContent?.trim() || '';

          const companyEl = document.querySelector('[data-testid="company-info-metadata"] a, [data-testid="inlineHeader-companyName"] a, [data-testid="inlineHeader-companyName"]');
          const officialCompany = companyEl?.textContent?.trim() || '';

          const applyHref = applyEl && (applyEl as HTMLAnchorElement).href ? (applyEl as HTMLAnchorElement).href : '';

          return {
            hasIndeedApply: !!applyEl,
            applyHref,
            isExternal: !!externalBtn && !applyEl,
            officialTitle,
            officialCompany,
            btnText: applyEl ? applyEl.textContent?.trim() : ''
          };
        });

        const activeTitle = detailInfo?.officialTitle || cardInfo.title;
        const activeCompany = detailInfo?.officialCompany || cardInfo.company;

        // Enterprise Filter: Job Match, Negative Keywords & Blacklist Check
        if (config.enableJobMatchFilter || config.negativeKeywords || config.blacklistedCompanies) {
          const matchResult = evaluateJobMatch({
            jobTitle: activeTitle,
            company: activeCompany,
            targetKeywords: config.searchKeywords || '',
            negativeKeywords: config.negativeKeywords || '',
            blacklistedCompanies: config.blacklistedCompanies || '',
            minScoreThreshold: config.enableJobMatchFilter ? (config.minMatchScore || 60) : 0,
            candidateSkills: config.skills || ''
          });

          if (!matchResult.shouldApply) {
            onLog(`🛡️ [Indeed Filter] Melewati loker: ${matchResult.reason}`);
            continue;
          } else if (config.enableJobMatchFilter) {
            onLog(`🎯 [Indeed Filter] Lolos seleksi kecocokan (Skor: ${matchResult.score}%). Melanjutkan...`);
          }
        }

        if (!detailInfo || !detailInfo.hasIndeedApply) {
          if (detailInfo?.isExternal) {
            onLog(`🌐 Terdeteksi tautan eksternal untuk "${activeTitle}". Mencoba membuka dan menyelesaikan dengan Universal External Job Solver...`);
            let extPagePromise = new Promise<any>((resolve) => {
              const handler = async (target: any) => {
                if (target.type() === 'page') {
                  const p = await target.page();
                  browser.off('targetcreated', handler);
                  resolve(p);
                }
              };
              browser.on('targetcreated', handler);
              setTimeout(() => {
                browser.off('targetcreated', handler);
                resolve(null);
              }, 6000);
            });

            await page.evaluate(() => {
              const externalBtn = document.querySelector(
                'button[aria-label*="Lamar di situs web"], button[aria-label*="Apply on company site"], a[aria-label*="Apply on company site"], a[href*="rc/clk"]'
              ) as HTMLElement;
              if (externalBtn) externalBtn.click();
            });

            const externalPage = await extPagePromise;
            if (externalPage) {
              const { applyStealthToPage } = require('../stealthHelper');
              await applyStealthToPage(externalPage);
              const { solveExternalJobApplication } = require('../externalJobSolver');
              const res = await solveExternalJobApplication(
                externalPage,
                config,
                {
                  title: activeTitle,
                  company: activeCompany,
                  platform: 'Indeed',
                  originalJobUrl: targetJobUrl
                },
                (msg: string) => onLog(`[External] ${msg}`)
              );
              if (res.success) {
                successCount++;
                if (sharedLimiter) sharedLimiter.onJobSuccess();
              }
              try { await externalPage.close(); } catch {}
            } else {
              await addAppliedJob({
                company: activeCompany,
                title: activeTitle,
                platform: 'Indeed',
                jobUrl: targetJobUrl,
                status: 'External Link'
              });
            }
          } else {
            onLog(`⏩ Melewati "${activeTitle}" - Tombol 'Lamar dengan Indeed / Apply now' tidak tersedia.`);
          }
          continue;
        }

        onLog(`🔘 Terdeteksi tombol "Apply now / Lamar dengan Indeed" untuk "${activeTitle}"!`);

        // Jalankan proses Apply Form
        let applyPage: any = null;
        const recordedQA: Array<{ question: string; answer: string; type?: string }> = [];

        try {
          if (detailInfo.applyHref && detailInfo.applyHref.includes('smartapply.indeed.com')) {
            onLog(`🌐 Membuka halaman Smart Apply Indeed: ${detailInfo.applyHref.slice(0, 70)}...`);
            applyPage = await browser.newPage();
            const { applyStealthToPage } = require('../stealthHelper');
            await applyStealthToPage(applyPage);
            await applyPage.goto(detailInfo.applyHref, { waitUntil: 'domcontentloaded', timeout: 45000 });
          } else {
            // Pasang listener tab baru sebelum klik apply
            let newTargetPromise: Promise<any> | null = new Promise((resolve) => {
              const handler = async (target: any) => {
                if (target.type() === 'page') {
                  const p = await target.page();
                  browser.off('targetcreated', handler);
                  resolve(p);
                }
              };
              browser.on('targetcreated', handler);
              setTimeout(() => {
                browser.off('targetcreated', handler);
                resolve(null);
              }, 5000);
            });

            // Klik tombol apply di halaman lowongan
            await page.evaluate(() => {
              const applyEl = document.querySelector(
                '[data-testid="viewjob-indeed-apply"], [data-testid="primary-apply-action"] a, button#indeedApplyButton, [data-testid="indeedApplyButton"]'
              ) as HTMLElement;
              if (applyEl) applyEl.click();
            });

            const newlyOpenedPage = await newTargetPromise;
            await sleep(2500);

            if (newlyOpenedPage && !newlyOpenedPage.isClosed()) {
              applyPage = newlyOpenedPage;
              const { applyStealthToPage } = require('../stealthHelper');
              await applyStealthToPage(applyPage);
            } else {
              const allPages = await browser.pages();
              const smartApplyPage = allPages.find((p: any) => p.url().includes('smartapply') || p.url().includes('indeed.com/apply'));
              if (smartApplyPage) {
                applyPage = smartApplyPage;
              } else if (allPages.length > 1) {
                applyPage = allPages[allPages.length - 1];
              } else {
                applyPage = page;
              }
            }
          }

          // Multi-step form solver Indeed Smart Apply
          let currentStep = 1;
          let reachedFinal = false;

          while (currentStep <= 10 && global.isBotRunning && !reachedFinal) {
            await sleep(2500);

            // Periksa frame jika modal menggunakan iframe
            let activeFrame = applyPage;
            const frames = applyPage.frames ? applyPage.frames() : [];
            const indeedFrame = frames.find((f: any) => f.name().includes('indeed-apply') || f.url().includes('indeed.com/apply') || f.url().includes('smartapply'));
            if (indeedFrame) {
              activeFrame = indeedFrame;
            }

            // 1. Cek & Isi Location Fields jika muncul pada halaman lokasi (Add your location)
            const locationHandled = await activeFrame.evaluate((candidateDomicile: string, candidateLocation: string, candidateAddress?: string) => {
              const container = document.querySelector('#ia-container, .ia-BasePage, [data-testid="ia-container"], main, body') || document;
              const locationHeading = container.querySelector('[data-testid="profile-location-page"], [data-testid="location-fields-country"], h2[data-testid="profile-location-heading"]');
              const postalInput = container.querySelector('input[name="location-postal-code"], [data-testid="location-fields-postal-code-input"]') as HTMLInputElement | null;
              const localityInput = container.querySelector('input[name="location-locality"], [data-testid="location-fields-locality-input"]') as HTMLInputElement | null;
              const addressInput = container.querySelector('input[name="location-address"], [data-testid="location-fields-address-input"]') as HTMLInputElement | null;

              let handled = false;
              const setVal = (el: HTMLInputElement, val: string) => {
                el.focus();
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                if (setter) setter.call(el, val);
                else el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.blur();
                handled = true;
              };

              if (postalInput && !postalInput.value) {
                setVal(postalInput, '12190');
              }
              if (localityInput && !localityInput.value) {
                setVal(localityInput, candidateLocation || candidateDomicile || 'Gresik');
              }
              if (addressInput && !addressInput.value) {
                setVal(addressInput, candidateAddress || candidateDomicile || 'Gresik, Jawa Timur');
              }

              return handled || !!locationHeading;
            }, config.domicile, config.location, config.address);

            // 1. Cek & Tangani Halaman Resume ("Add a resume" / "Select a resume")
            const resumeHandled = await activeFrame.evaluate(() => {
              const container = document.querySelector('#ia-container, .ia-BasePage, [data-testid="ia-container"], main, body') || document;
              const headingText = (container.querySelector('h1, h2, legend, [data-testid*="header"]')?.textContent || '').toLowerCase();
              const isResumePage = /add a resume|pilih resume|unggah resume|resume selection|select a resume/i.test(headingText) || window.location.href.includes('resume-selection');
              if (!isResumePage) return false;

              // A. Cari opsi "Upload a resume" / "Upload resume"
              const uploadResumeCard = Array.from(container.querySelectorAll('label, div[role="radio"], button, [data-testid*="resume"], fieldset > div')).find(el =>
                /Upload a resume|Unggah resume|Upload resume/i.test(el.textContent || '')
              ) as HTMLElement | null;

              if (uploadResumeCard) {
                const radioInput = uploadResumeCard.querySelector('input[type="radio"]') as HTMLInputElement | null;
                if (radioInput) {
                  radioInput.checked = true;
                  radioInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
                uploadResumeCard.click();
                return true;
              }

              // B. Jika sudah ada resume yang pernah diunggah di Indeed, pilih yang pertama
              const existingResumeRadio = container.querySelector('input[type="radio"][name*="resume"], [data-testid*="resume-card"] input[type="radio"]') as HTMLInputElement | null;
              if (existingResumeRadio && !existingResumeRadio.checked) {
                const lbl = container.querySelector(`label[for="${existingResumeRadio.id}"]`) || existingResumeRadio.closest('label');
                if (lbl) (lbl as HTMLElement).click();
                else existingResumeRadio.click();
                existingResumeRadio.checked = true;
                existingResumeRadio.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
              }

              return false;
            });

            if (resumeHandled) {
              onLog(`📄 [Indeed] Step ${currentStep}: Memilih opsi 'Upload / Select Resume'...`);
              await sleep(600);

              // Jika ada file input untuk CV, sematkan file CV dari config
              if (config.cvFilePath && fs.existsSync(config.cvFilePath)) {
                try {
                  const fileInput = await activeFrame.$('input[type="file"][accept*="pdf"], input[type="file"]');
                  if (fileInput) {
                    await fileInput.uploadFile(config.cvFilePath);
                    onLog(`📎 [Indeed] Mengunggah dokumen CV: "${config.cvFileName || 'CV'}"...`);
                    await sleep(2000);
                  }
                } catch (upErr: any) {
                  onLog(`⚠️ [Indeed] Gagal attach file CV: ${upErr?.message || upErr}`);
                }
              }
            }

            // 2. Cek & Tangani Cover Letter Step jika ada opsi "Enter text" (HANYA pada halaman Cover Letter!)
            const coverLetterText = generateCoverLetter(activeCompany, activeTitle);
            const coverLetterTriggered = await activeFrame.evaluate(() => {
              const container = document.querySelector('#ia-container, .ia-BasePage, [data-testid="ia-container"], main, body') || document;
              const isCoverLetterPage = /cover letter|surat lamaran/i.test(container.querySelector('h1, h2, legend, [data-testid*="header"]')?.textContent || '') || !!document.querySelector('#mosaic-provider-module-apply-cover-letter');
              if (!isCoverLetterPage) return false;

              const fieldsets = Array.from(container.querySelectorAll('fieldset, [role="radiogroup"]'));
              for (const fs of fieldsets) {
                const legendText = (fs.querySelector('legend, h3, label, [data-testid*="label"]')?.textContent || '').toLowerCase();
                if (legendText.includes('cover letter') || legendText.includes('surat lamaran')) {
                  const enterTextRadio = (
                    fs.querySelector('input[type="radio"][value="text"]') ||
                    Array.from(fs.querySelectorAll('label, span')).find(el => /Enter text|Tulis teks|Tulis sendiri/i.test(el.textContent || ''))?.closest('label')?.querySelector('input[type="radio"]')
                  ) as HTMLInputElement | null;

                  if (enterTextRadio) {
                    const lbl = fs.querySelector(`label[for="${enterTextRadio.id}"]`) || enterTextRadio.closest('label');
                    if (lbl) (lbl as HTMLElement).click();
                    else enterTextRadio.click();
                    enterTextRadio.checked = true;
                    enterTextRadio.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                  }
                }
              }
              return false;
            });

            if (coverLetterTriggered) {
              onLog(`✍️ [Indeed] Step ${currentStep}: Memilih opsi 'Enter text' untuk Cover Letter...`);
              await sleep(600);
            }

            // 3. Isi Textarea Cover Letter jika DAN HANYA JIKA ini adalah halaman Cover Letter
            const textareaFilled = await activeFrame.evaluate((clContent: string) => {
              const container = document.querySelector('#ia-container, .ia-BasePage, [data-testid="ia-container"], main, body') || document;
              const isCoverLetterPage = /cover letter|surat lamaran/i.test(container.querySelector('h1, h2, legend, [data-testid*="header"]')?.textContent || '') || !!document.querySelector('#mosaic-provider-module-apply-cover-letter');
              if (!isCoverLetterPage) return false;

              const clTextarea = document.querySelector('#mosaic-provider-module-apply-cover-letter textarea, [data-testid*="cover-letter"] textarea, [data-testid="coverLetter-textarea"]') as HTMLTextAreaElement;
              if (clTextarea) {
                clTextarea.focus();
                const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
                if (setter) setter.call(clTextarea, clContent);
                else clTextarea.value = clContent;
                clTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                clTextarea.dispatchEvent(new Event('change', { bubbles: true }));
                clTextarea.blur();
                return true;
              }
              return false;
            }, coverLetterText);

            if (textareaFilled) {
              onLog(`📄 [Indeed] Berhasil menyisipkan Cover Letter kustom untuk "${activeCompany}" (${activeTitle})!`);
              await sleep(400);
            }

            // 4. Analisa form state & pertanyaan screening umum
            const formState = await activeFrame.evaluate(() => {
              const container = document.querySelector('#ia-container, .ia-BasePage, [data-testid="ia-container"], main, body') || document;
              const textContent = container.textContent || '';

              const successHeading = container.querySelector('[data-testid="confirmation-header"], [data-testid="success-header"], h1, h2');
              const hasFormFields = !!container.querySelector('input[type="text"], input[type="radio"], select, textarea, [data-testid*="location-fields"], fieldset, [role="combobox"]');
              const isSuccess = (/Application submitted|Lamaran terkirim|Your application has been submitted|Lamaran Anda berhasil dikirim/i.test(successHeading?.textContent || '')) && !hasFormFields;

              const titleEl = container.querySelector('h1, h2, h3, .ia-BasePage-heading, [data-testid="header-text"], [data-testid="profile-location-heading"], [data-testid="questions-heading"]');
              const stepTitle = titleEl ? (titleEl.textContent || '').trim().replace(/\s+/g, ' ') : `Step`;

              // Cek tombol Submit akhir (termasuk submit-application-button)
              const submitBtn = (
                container.querySelector('[data-testid="submit-application-button"], [data-testid="submit-button"], button[name="submit-application"], button[aria-label*="Submit"], button[aria-label*="Kirim lamaran"]') ||
                Array.from(container.querySelectorAll('button, input[type="submit"]')).find(b =>
                  /Submit your application|Kirim lamaran Anda|Submit application|Kirim lamaran/i.test(b.textContent || b.getAttribute('value') || '')
                )
              ) as HTMLElement | null;

              // Cek tombol Continue / Review / Next
              const continueBtn = (
                container.querySelector('[data-testid="continue-button"], [data-testid="review-button"], [data-testid*="continue-button"], button[aria-label*="Continue"], button.ia-continueButton') ||
                Array.from(container.querySelectorAll('button, input[type="submit"], [role="button"]')).find(b => {
                  const txt = (b.textContent || b.getAttribute('aria-label') || b.getAttribute('value') || '').trim();
                  const testId = (b.getAttribute('data-testid') || '').toLowerCase();
                  return (/Continue|Lanjutkan|Next|Selanjutnya|Review your application|Review application|Tinjau lamaran|Save and continue/i.test(txt)) &&
                         (!/Save and close|Report|Feedback|Cancel|Back|Kembali|Edit|Option|Select file|Upload/i.test(txt)) &&
                         (!testId.includes('edit') && !testId.includes('option') && !testId.includes('feedback') && !testId.includes('upload'));
                })
              ) as HTMLElement | null;

              // Ekstraksi pertanyaan input
              const questions: { id: string; question: string; type: string; options: string[]; inputSelector: string; isFilled: boolean; currentValue: string }[] = [];

              // Radio groups
              const fieldsets = Array.from(container.querySelectorAll('fieldset, [role="radiogroup"]'));
              for (const fs of fieldsets) {
                const legend = fs.querySelector('legend, h3, h4, label, [data-testid*="label"]');
                const qText = (legend?.textContent || '').trim().replace(/\s+/g, ' ').replace(/\s*\*\s*$/, '');
                if (!qText || /cover letter|surat lamaran/i.test(qText)) continue;

                const radios = Array.from(fs.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
                if (radios.length > 0) {
                  const options = radios.map(r => {
                    const lbl = fs.querySelector(`label[for="${r.id}"]`) || r.closest('label');
                    return (lbl?.textContent || r.value || '').trim();
                  }).filter(Boolean);

                  const isFilled = radios.some(r => r.checked);
                  const checkedRadio = radios.find(r => r.checked);
                  const checkedLbl = checkedRadio ? (fs.querySelector(`label[for="${checkedRadio.id}"]`) || checkedRadio.closest('label')) : null;
                  const currentValue = (checkedLbl?.textContent || checkedRadio?.value || '').trim();

                  questions.push({
                    id: radios[0].name || fs.id || '',
                    question: qText,
                    type: 'radiobutton',
                    options,
                    inputSelector: radios[0].name ? `input[name="${radios[0].name}"]` : `input[type="radio"]`,
                    isFilled,
                    currentValue
                  });
                }
              }

              // Custom Combobox / Select List (Indeed custom dropdowns, e.g. Education Level)
              const comboboxes = Array.from(container.querySelectorAll('[role="combobox"], [data-testid*="select-list-select-list"]')) as HTMLElement[];
              for (const combo of comboboxes) {
                const itemContainer = combo.closest('.ia-Questions-item, [data-testid*="input-"], [class*="question"]') || combo.parentElement;
                const lbl = itemContainer?.querySelector('label, [data-testid*="label"], legend') || container.querySelector(`label[for="${combo.id}"]`);
                const qText = (lbl?.textContent || '').trim().replace(/\s+/g, ' ').replace(/\s*\*\s*$/, '').replace(/required$/i, '').trim();

                if (qText && !questions.some(q => q.question === qText)) {
                  const parentTestId = itemContainer?.getAttribute('data-testid') || combo.getAttribute('data-testid') || '';
                  const selector = parentTestId ? `[data-testid="${parentTestId}"] [role="combobox"], [data-testid="${parentTestId}"]` : (combo.id ? `#${combo.id}` : '[role="combobox"]');

                  const listbox = itemContainer?.querySelector('[role="listbox"]') || document.querySelector('[role="listbox"]');
                  const optionEls = listbox ? Array.from(listbox.querySelectorAll('[role="option"], li')) : [];
                  const options = optionEls.map(o => o.textContent?.trim() || '').filter(Boolean);

                  const isFilled = !/select|pilih/i.test(combo.textContent || '') && (combo.textContent || '').trim().length > 0 && !combo.querySelector('.mosaic-provider-module-apply-questions-ew4qyo');
                  const currentValue = (combo.textContent || '').trim();

                  questions.push({
                    id: parentTestId || combo.id || qText,
                    question: qText,
                    type: 'custom_dropdown',
                    options,
                    inputSelector: selector,
                    isFilled,
                    currentValue
                  });
                }
              }

              // Native Select dropdowns
              const selects = Array.from(container.querySelectorAll('select')) as HTMLSelectElement[];
              for (const sel of selects) {
                const lbl = container.querySelector(`label[for="${sel.id}"]`) || sel.closest('label') || sel.parentElement;
                const qText = (lbl?.textContent || '').trim().replace(/\s+/g, ' ').replace(/\s*\*\s*$/, '');
                if (qText && !questions.some(q => q.question === qText)) {
                  const options = Array.from(sel.options).map(o => o.text.trim()).filter(o => o && !/Select|Pilih/i.test(o));
                  const isFilled = !!sel.value && sel.selectedIndex > 0 && !/Select|Pilih/i.test(sel.options[sel.selectedIndex]?.text || '');
                  const currentValue = sel.options[sel.selectedIndex]?.text?.trim() || '';

                  questions.push({
                    id: sel.id || sel.name || '',
                    question: qText,
                    type: 'dropdown',
                    options,
                    inputSelector: sel.id ? `#${sel.id}` : `select[name="${sel.name}"]`,
                    isFilled,
                    currentValue
                  });
                }
              }

              // Checkbox Groups / Demographic Questions / Checklists
              const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
              const checkboxGroups: { [groupKey: string]: HTMLInputElement[] } = {};

              for (const cb of checkboxes) {
                if (cb.id?.includes('hidden') || cb.type === 'hidden') continue;
                const fieldsetParent = cb.closest('fieldset, [role="group"], [data-testid*="demographic"], [class*="demographic"], [data-testid*="question"]');
                const groupKey = fieldsetParent ? (fieldsetParent.id || fieldsetParent.getAttribute('data-testid') || cb.name || 'cb-group') : (cb.name || cb.id);
                if (!checkboxGroups[groupKey]) checkboxGroups[groupKey] = [];
                checkboxGroups[groupKey].push(cb);
              }

              for (const key in checkboxGroups) {
                const group = checkboxGroups[key];
                if (group.length === 0) continue;

                const firstCb = group[0];
                const fieldset = firstCb.closest('fieldset, [role="group"], [data-testid*="demographic"], [class*="demographic"], [data-testid*="question"]');
                const legend = fieldset?.querySelector('legend, h2, h3, h4, [data-testid*="label"]');
                const firstLbl = container.querySelector(`label[for="${firstCb.id}"]`) || firstCb.closest('label') || firstCb.parentElement;

                let qText = (legend?.textContent || firstLbl?.textContent || firstCb.name || 'Demographic Question').trim().replace(/\s+/g, ' ').replace(/\s*\*\s*$/, '');

                const options: string[] = [];
                for (const cb of group) {
                  const lbl = container.querySelector(`label[for="${cb.id}"]`) || cb.closest('label') || cb.parentElement;
                  const optText = (lbl?.textContent || cb.value || cb.name || '').trim().replace(/\s+/g, ' ');
                  if (optText && !options.includes(optText)) {
                    options.push(optText);
                  }
                }

                const isFilled = group.some(cb => cb.checked);
                const checkedCbs = group.filter(cb => cb.checked);
                const currentValue = checkedCbs.map(cb => {
                  const lbl = container.querySelector(`label[for="${cb.id}"]`) || cb.closest('label');
                  return (lbl?.textContent || cb.value || '').trim();
                }).join(', ');

                questions.push({
                  id: firstCb.id || firstCb.name || key,
                  question: qText,
                  type: 'checklist',
                  options,
                  inputSelector: group.map(cb => `#${cb.id}`).join(', '),
                  isFilled,
                  currentValue
                });
              }

              // Text, Textarea, Number Inputs
              const isCoverLetterStep = /cover letter|surat lamaran/i.test(container.querySelector('h1, h2, legend, [data-testid*="header"]')?.textContent || '') || !!document.querySelector('#mosaic-provider-module-apply-cover-letter');
              if (!isCoverLetterStep) {
                const inputs = Array.from(container.querySelectorAll('textarea, input[type="text"], input[type="number"], input[type="tel"], input[type="email"], [id*="rich-text-question-input"], [id*="number-input"]')) as (HTMLInputElement | HTMLTextAreaElement)[];
                for (const inp of inputs) {
                  if (inp.id?.includes('hidden') || inp.type === 'hidden') continue;
                  if (inp.name?.includes('location') || inp.id?.includes('location')) continue;

                  const itemContainer = inp.closest('.ia-Questions-item, [data-testid*="input-"], [class*="question"]') || inp.parentElement;
                  const lbl = itemContainer?.querySelector('label, [data-testid*="label"], legend') || container.querySelector(`label[for="${inp.id}"]`);
                  const qText = (lbl?.textContent || inp.placeholder || inp.name || '').trim().replace(/\s+/g, ' ').replace(/\s*\*\s*$/, '');
                  
                  if (qText && !questions.some(q => q.id === (inp.id || inp.name) || q.question === qText)) {
                    const isFilled = (inp.value || '').trim().length > 0;
                    const currentValue = (inp.value || '').trim();

                    questions.push({
                      id: inp.id || inp.name || qText,
                      question: qText,
                      type: inp.tagName.toLowerCase() === 'textarea' ? 'text' : (inp.type === 'number' ? 'number' : 'text'),
                      options: [],
                      inputSelector: inp.id ? `#${inp.id}` : (inp.name ? `[name="${inp.name}"]` : 'input'),
                      isFilled,
                      currentValue
                    });
                  }
                }
              }

              return {
                isSuccess,
                stepTitle,
                isSubmit: !!submitBtn,
                hasContinue: !!continueBtn,
                questions
              };
            });

            if (!formState || formState.isSuccess) {
              onLog('🏁 Form Indeed Apply selesai.');
              reachedFinal = true;
              break;
            }

            if (formState.questions && formState.questions.length > 0) {
              const unfilledQuestions = (formState.questions as any[]).filter((q: any) => !q.isFilled);
              const filledQuestions = (formState.questions as any[]).filter((q: any) => q.isFilled);

              if (filledQuestions.length > 0) {
                for (const fq of filledQuestions) {
                  onLog(`⏩ [Indeed] Input "${fq.question}" sudah terisi ("${fq.currentValue}"). Melewati...`);
                }
              }

              if (unfilledQuestions.length > 0) {
                onLog(`📍 [Indeed] Step ${currentStep}: [${formState.stepTitle}] -> ${unfilledQuestions.length} input belum terisi.`);

                // Jawab hanya pertanyaan yang belum terisi di step ini
                for (const qItem of unfilledQuestions) {
                  const chosenAnswers = await answerQuestion(qItem.question, qItem.options, qItem.type as any);
                  onLog(`🤖 [Indeed] Q: "${qItem.question}" -> Ans: [${chosenAnswers.join(' | ')}]`);
                  appendQuestionToCsv(qItem.question, qItem.type as any, qItem.options, chosenAnswers);
                  recordedQA.push({
                    question: qItem.question,
                    answer: chosenAnswers.join(', '),
                    type: qItem.type
                  });

                  // Tulis ke DOM
                  await activeFrame.evaluate(async (targetQ: any, answers: string[]) => {
                    const container = document.querySelector('#ia-container, .ia-BasePage, [data-testid="ia-container"], main, body') || document;

                    if (targetQ.type === 'radiobutton' && answers.length > 0) {
                      const radios = Array.from(container.querySelectorAll(targetQ.inputSelector)) as HTMLInputElement[];
                      for (const rd of radios) {
                        const lbl = container.querySelector(`label[for="${rd.id}"]`) || rd.closest('label');
                        const txt = (lbl?.textContent || rd.value || '').trim();
                        if (answers.some(a => txt.toLowerCase().includes(a.toLowerCase()) || a.toLowerCase().includes(txt.toLowerCase()) || (/^ya$/i.test(a) && (rd.value === '1' || /ya|yes/i.test(txt))))) {
                          if (lbl) (lbl as HTMLElement).click();
                          else rd.click();
                          rd.checked = true;
                          rd.dispatchEvent(new Event('input', { bubbles: true }));
                          rd.dispatchEvent(new Event('change', { bubbles: true }));
                          break;
                        }
                      }
                    } else if (targetQ.type === 'custom_dropdown' && answers.length > 0) {
                      const targetAnswer = answers[0] || 'S1';
                      const combo = (
                        container.querySelector(targetQ.inputSelector) ||
                        container.querySelector(`[data-testid*="${targetQ.id}"], [role="combobox"], [data-testid*="select-list-select-list"]`)
                      ) as HTMLElement | null;

                      if (combo) {
                        combo.focus();
                        combo.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                        combo.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                        combo.click();
                        await new Promise(r => setTimeout(r, 400));

                        const listbox = document.querySelector('[role="listbox"], ul[id*="Listbox"]') || container.querySelector('[role="listbox"]');
                        if (listbox) {
                          const options = Array.from(listbox.querySelectorAll('[role="option"], li')) as HTMLElement[];
                          let optionClicked = false;

                          for (const opt of options) {
                            const txt = (opt.textContent || '').trim();
                            const testId = (opt.getAttribute('data-testid') || '').toLowerCase();
                            const isMatch = 
                              txt.toLowerCase() === targetAnswer.toLowerCase() ||
                              txt.toLowerCase().includes(targetAnswer.toLowerCase()) ||
                              targetAnswer.toLowerCase().includes(txt.toLowerCase()) ||
                              testId.endsWith(`-${targetAnswer.toLowerCase()}`) ||
                              (targetAnswer.toLowerCase() === 's1' && (/^s1$/i.test(txt) || testId.includes('-s1')));

                            if (isMatch) {
                              opt.scrollIntoView({ block: 'nearest' });
                              opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                              opt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                              opt.click();
                              optionClicked = true;
                              break;
                            }
                          }

                          if (!optionClicked) {
                            const filterInput = document.querySelector('input[data-testid*="select-list-filter-input"], input[placeholder*="Search to select"]') as HTMLInputElement | null;
                            if (filterInput) {
                              filterInput.focus();
                              filterInput.value = targetAnswer;
                              filterInput.dispatchEvent(new Event('input', { bubbles: true }));
                              await new Promise(r => setTimeout(r, 300));
                              const firstOpt = listbox.querySelector('[role="option"], li') as HTMLElement | null;
                              if (firstOpt) {
                                firstOpt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                                firstOpt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                                firstOpt.click();
                              }
                            }
                          }
                        }
                      }
                    } else if (targetQ.type === 'checklist' && answers.length > 0) {
                      const cbs = Array.from(container.querySelectorAll(targetQ.inputSelector)) as HTMLInputElement[];
                      let anyChecked = false;
                      for (const cb of cbs) {
                        const lbl = container.querySelector(`label[for="${cb.id}"]`) || cb.closest('label') || cb.parentElement;
                        const txt = (lbl?.textContent || cb.value || cb.name || '').trim();
                        if (answers.some(a => txt.toLowerCase().includes(a.toLowerCase()) || a.toLowerCase().includes(txt.toLowerCase()) || /ya|yes|true|setuju|agree|single/i.test(a))) {
                          if (!cb.checked) {
                            if (lbl) (lbl as HTMLElement).click();
                            else cb.click();
                            cb.checked = true;
                            cb.dispatchEvent(new Event('change', { bubbles: true }));
                            anyChecked = true;
                          }
                        }
                      }
                      // Jika belum ada yang tercentang pada checklist mandatory, centang opsi pertama
                      if (!anyChecked && cbs.length > 0 && !cbs.some(c => c.checked)) {
                        const first = cbs[0];
                        const lbl = container.querySelector(`label[for="${first.id}"]`) || first.closest('label') || first.parentElement;
                        if (lbl) (lbl as HTMLElement).click();
                        else first.click();
                        first.checked = true;
                        first.dispatchEvent(new Event('change', { bubbles: true }));
                      }
                    } else if (targetQ.type === 'dropdown' && answers.length > 0) {
                      const sel = container.querySelector(targetQ.inputSelector) as HTMLSelectElement;
                      if (sel) {
                        for (let idx = 0; idx < sel.options.length; idx++) {
                          if (answers.some(a => sel.options[idx].text.toLowerCase().includes(a.toLowerCase()))) {
                            sel.selectedIndex = idx;
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                            break;
                          }
                        }
                      }
                    } else if ((targetQ.type === 'text' || targetQ.type === 'number') && answers.length > 0) {
                      const inp = container.querySelector(targetQ.inputSelector) as (HTMLInputElement | HTMLTextAreaElement);
                      if (inp) {
                        inp.focus();
                        let valToSet = answers[0] || '';
                        const isNumeric = /rate your|how many|berapa tahun|years of|experience/i.test(targetQ.question) && !/jelaskan|describe|project/i.test(targetQ.question);
                        if (isNumeric) {
                          const dMatch = valToSet.match(/\d+/);
                          valToSet = dMatch ? dMatch[0] : '3';
                        }

                        // Batasi panjang karakter agar tidak melampaui limit Indeed
                        if (valToSet.length > 1000) {
                          valToSet = valToSet.slice(0, 950);
                        }

                        const humanType = async (el: HTMLInputElement | HTMLTextAreaElement, text: string) => {
                          el.focus();
                          const proto = el.tagName.toLowerCase() === 'textarea' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
                          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                          
                          if (setter) setter.call(el, '');
                          else el.value = '';
                          el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));

                          for (let i = 0; i < text.length; i++) {
                            const currentVal = el.value + text[i];
                            if (setter) {
                              setter.call(el, currentVal);
                            } else {
                              el.value = currentVal;
                            }
                            el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                            await new Promise(r => setTimeout(r, 10));
                          }
                          el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                          el.blur();
                        };

                        await humanType(inp, valToSet);
                      }
                    }
                  }, qItem, chosenAnswers);

                  await sleep(300);
                }
              }
            }

            // Jika step Submit Akhir
            if (formState.isSubmit) {
              if (config.debugTest) {
                onLog(`🏁 [DEBUG MODE] Form Indeed (${activeTitle}) selesai diisi.`);
                onLog(`   🛡️ Simulasi berhasil (Lamaran tidak dikirim ke Indeed).`);

                await addAppliedJob({
                  company: activeCompany,
                  title: activeTitle,
                  platform: 'Indeed',
                  jobUrl: targetJobUrl,
                  status: 'Dry-run Sim',
                  questionsAndAnswers: recordedQA
                });

                onLog(`📝 [Dry-run Sim] Data simulasi "${activeCompany}" (${activeTitle}) disimpan ke Google Sheets.`);
                successCount++;
                if (sharedLimiter) sharedLimiter.onJobSuccess();
                reachedFinal = true;
                break;
              } else {
                onLog(`🚀 Mengirim Lamaran resmi Indeed ke "${activeCompany}"...`);
                await activeFrame.evaluate(() => {
                  const submitBtn = (
                    document.querySelector('[data-testid="submit-application-button"], [data-testid="submit-button"], button[name="submit-application"], button[aria-label*="Submit"], button[aria-label*="Kirim lamaran"]') ||
                    Array.from(document.querySelectorAll('button, input[type="submit"]')).find(b =>
                      /Submit your application|Kirim lamaran Anda|Submit application|Kirim lamaran/i.test(b.textContent || b.getAttribute('value') || '')
                    )
                  ) as HTMLElement | null;
                  if (submitBtn) submitBtn.click();
                });
                await sleep(3500);

                await addAppliedJob({
                  company: activeCompany,
                  title: activeTitle,
                  platform: 'Indeed',
                  jobUrl: targetJobUrl,
                  status: 'Applied',
                  questionsAndAnswers: recordedQA
                });

                onLog(`🎉 Lamaran Indeed ke "${activeCompany}" (${activeTitle}) berhasil terkirim & disimpan ke Google Sheets!`);
                successCount++;
                if (sharedLimiter) sharedLimiter.onJobSuccess();
                reachedFinal = true;
                break;
              }
            }

            // Klik tombol Continue / Next
            if (formState.hasContinue) {
              onLog(`👉 [Indeed] Mengklik tombol "Lanjutkan / Continue"...`);
              await activeFrame.evaluate(() => {
                const continueBtn = (
                  document.querySelector('[data-testid="continue-button"], [data-testid="review-button"], [data-testid*="continue-button"], button[aria-label*="Continue"], button.ia-continueButton') ||
                  Array.from(document.querySelectorAll('button, input[type="submit"], [role="button"]')).find(b => {
                    const txt = (b.textContent || b.getAttribute('aria-label') || b.getAttribute('value') || '').trim();
                    const testId = (b.getAttribute('data-testid') || '').toLowerCase();
                    return (/Continue|Lanjutkan|Next|Selanjutnya|Review your application|Review application|Tinjau lamaran|Save and continue/i.test(txt)) &&
                           (!/Save and close|Report|Feedback|Cancel|Back|Kembali|Edit|Option|Select file|Upload/i.test(txt)) &&
                           (!testId.includes('edit') && !testId.includes('option') && !testId.includes('feedback') && !testId.includes('upload'));
                  })
                ) as HTMLElement | null;
                if (continueBtn) continueBtn.click();
              });
              await sleep(3000);
            } else {
              reachedFinal = true;
              break;
            }

            currentStep++;
          }
        } catch (itemErr: any) {
          onLog(`❌ Error saat memproses lamaran "${activeTitle}": ${itemErr.message || itemErr}`);
          errorCount++;
        } finally {
          if (applyPage && applyPage !== page && !applyPage.isClosed()) {
            await applyPage.close().catch(() => {});
          }
        }

        await sleep(1500);
      }

      // 5. Pagination ke Halaman Berikutnya di Indeed
      const hasNextPage = await page.evaluate(() => {
        const nextBtn = document.querySelector('a[data-testid="pagination-page-next"], nav[aria-label="pagination"] a[aria-label*="Next"], a[aria-label*="Berikutnya"]') as HTMLElement;
        if (nextBtn && !nextBtn.hasAttribute('disabled')) {
          nextBtn.click();
          return true;
        }
        return false;
      });

      if (hasNextPage) {
        currentPage++;
        onLog(`➡️ Berpindah ke Halaman Indeed ke-${currentPage}...`);
        await sleep(4000);
      } else {
        onLog('🏁 Mencapai halaman terakhir pencarian Indeed.');
        break;
      }
    }
  } catch (err: any) {
    onLog(`❌ Terjadi error pada bot Indeed: ${err.message || err}`);
    errorCount++;
  }

  return { successCount, alreadyAppliedCount, errorCount };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
