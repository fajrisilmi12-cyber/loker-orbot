import { isJobAlreadyApplied, addAppliedJob } from '../storage';
import { appendQuestionToCsv } from '../csvHelper';
import { answerQuestion } from '../questionAnswer';
import { captureFormDomSnapshot, inspectFormWithAi, applyAiFormActions } from '../aiFormInspector';
import { evaluateJobMatch } from '../jobMatcher';
import { generateDynamicCoverLetter } from '../coverLetterGenerator';
import { humanClick, humanType, randomDelay } from '../humanStealth';
import { parseCookiesInput, injectCookiesIntoPage } from '../cookieHelper';

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

export async function runLinkedinBot(
  page: any,
  config: any,
  onLog: (msg: string) => void,
  sharedLimiter?: SharedLimiter
): Promise<BotMetrics> {
  let successCount = 0;
  let alreadyAppliedCount = 0;
  let errorCount = 0;

  try {
    const keyword = (config.searchKeywords || '').trim();
    const location = (config.location || '').trim();

    // 2. Bentuk URL Pencarian Langsung dengan Query Parameter
    const searchParams = new URLSearchParams();
    if (keyword) searchParams.set('keywords', keyword);
    if (location) searchParams.set('location', location);
    searchParams.set('f_AL', 'true'); // Filter Easy Apply
    searchParams.set('origin', 'JOB_SEARCH_PAGE_SEARCH_BUTTON');
    searchParams.set('refresh', 'true');

    // Filter Pencarian Lanjutan (dari config)
    const datePostedMap: Record<string, string> = {
      '24h': 'r86400', 'week': 'r604800', 'month': 'r2592000',
    };
    if (config.datePosted && datePostedMap[config.datePosted]) {
      searchParams.set('f_TPR', datePostedMap[config.datePosted]);
    }

    const jobTypeMap: Record<string, string> = {
      'full_time': 'F', 'part_time': 'P', 'contract': 'C', 'internship': 'I', 'freelance': 'T',
    };
    const jobTypeValues = (config.jobType || []).map((t: string) => jobTypeMap[t]).filter(Boolean);
    if (jobTypeValues.length > 0) {
      searchParams.set('f_JT', jobTypeValues.join(','));
    }

    const workModeMap: Record<string, string> = {
      'onsite': '1', 'remote': '2', 'hybrid': '3',
    };
    const workModeValues = (config.workMode || []).map((m: string) => workModeMap[m]).filter(Boolean);
    if (workModeValues.length > 0) {
      searchParams.set('f_WT', workModeValues.join(','));
    }

    const expLevelMap: Record<string, string> = {
      'fresh': '1', '1-3': '2', '3-5': '3', '5+': '4',
    };
    const expValues = (config.experienceLevel || []).map((e: string) => expLevelMap[e]).filter(Boolean);
    if (expValues.length > 0) {
      searchParams.set('f_E', expValues.join(','));
    }

    const searchUrl = `https://www.linkedin.com/jobs/search/?${searchParams.toString()}`;
    onLog(`🌐 Membuka URL Pencarian LinkedIn: ${searchUrl}`);


    // Injeksi cookies jika tersedia di konfigurasi
    if (config.portalCookies?.linkedin) {
      const cookies = parseCookiesInput(config.portalCookies.linkedin, '.linkedin.com');
      if (cookies.length > 0) {
        const injectedCount = await injectCookiesIntoPage(page, cookies);
        onLog(`🍪 [Cookie Injection] Berhasil menyuntikkan ${injectedCount} cookie sesi LinkedIn!`);
      }
    }

    // Spoofing User-Agent agar lebih mirip browser manusia
    await page.setExtraHTTPHeaders({
      'sec-ch-ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
      'sec-ch-ua-platform': '"Windows"',
      'sec-ch-ua-mobile': '?0',
    });

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(3000);

    // Cek apakah LinkedIn redirect ke security challenge
    let currentUrlAfterNav = page.url();
    if (
      currentUrlAfterNav.includes('/checkpoint/') ||
      currentUrlAfterNav.includes('/security-verification') ||
      currentUrlAfterNav.includes('/challenge/')
    ) {
      onLog('⚠️ [LinkedIn] Terdeteksi Security Challenge / Verifikasi LinkedIn! Menunggu 30 detik untuk Anda menyelesaikannya di browser...');
      for (let scWait = 0; scWait < 6; scWait++) {
        await sleep(5000);
        currentUrlAfterNav = page.url();
        if (!currentUrlAfterNav.includes('/checkpoint/') && !currentUrlAfterNav.includes('/security-verification') && !currentUrlAfterNav.includes('/challenge/')) {
          onLog('✅ Verifikasi keamanan LinkedIn berhasil diselesaikan!');
          break;
        }
        onLog(`⏳ Menunggu verifikasi LinkedIn... (${(scWait + 1) * 5}s/30s)`);
      }
    }

    // 1. Pengecekan status login
    let isLoggedIn = await page.evaluate(() => {
      const hasNav = !!document.querySelector('.global-nav, .global-nav__me, #global-nav, [data-control-name="nav.settings"], img.global-nav__me-photo, button.global-nav__primary-link-me-menu-trigger');
      const hasSignIn = !!document.querySelector('a[href*="/login"], a[href*="/signup"], .join-form, #login-email, input#username');
      return hasNav || (!hasSignIn && !window.location.href.includes('/login') && !window.location.href.includes('/signup') && !window.location.href.includes('/checkpoint'));
    });

    let currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/signup') || currentUrl.includes('/checkpoint') || !isLoggedIn) {
      onLog('⚠️ LinkedIn: Sesi login belum terdeteksi. Menunggu 30 detik untuk Anda login langsung di tab browser ini...');
      for (let logWait = 0; logWait < 6; logWait++) {
        await sleep(5000);
        isLoggedIn = await page.evaluate(() => {
          const hasNav = !!document.querySelector('.global-nav, .global-nav__me, #global-nav, [data-control-name="nav.settings"], img.global-nav__me-photo, button.global-nav__primary-link-me-menu-trigger');
          const hasSignIn = !!document.querySelector('a[href*="/login"], a[href*="/signup"], .join-form, #login-email, input#username');
          return hasNav || (!hasSignIn && !window.location.href.includes('/login') && !window.location.href.includes('/signup') && !window.location.href.includes('/checkpoint'));
        });
        if (isLoggedIn) {
          onLog('✅ Login LinkedIn berhasil!');
          break;
        }
        onLog(`⏳ Menunggu login LinkedIn... (${(logWait + 1) * 5}s/30s)`);
      }
    }

    if (!isLoggedIn) {
      onLog('⚠️ LinkedIn: Sesi login belum aktif. Silakan login melalui "Buka Browser (Login Setup)" di Dashboard.');
      return { successCount, alreadyAppliedCount, errorCount };
    }

    onLog('✅ LinkedIn: Akun terverifikasi dan sesi login aktif.');

    // Tunggu hingga hasil pencarian selesai dimuat
    onLog('⏳ Menunggu hasil pencarian selesai dimuat...');
    try {
      await page.waitForFunction(() => {
        const loadingSpinner = document.querySelector('.jobs-search-results-list__loading, .artdeco-loader, .scaffold-layout__list--loading');
        const jobCards = document.querySelectorAll('li.scaffold-layout__list-item, li[data-occludable-job-id], div.job-card-container');
        return !loadingSpinner && jobCards.length > 0;
      }, { timeout: 15000 });
    } catch {
      await sleep(3000);
    }
    await sleep(1500);

    // Target Limit
    const targetLimit = sharedLimiter ? sharedLimiter.getTargetLimit() : (config.limitLinkedin || config.limitPerDay || 50);
    const checkLimitReached = () => sharedLimiter ? sharedLimiter.isLimitReached(successCount) : successCount >= targetLimit;

    let currentPage = 1;
    const maxPages = Math.max(30, Math.ceil(targetLimit * 3));
    const processedJobIds = new Set<string>();

    while (currentPage <= maxPages && global.isBotRunning !== false && !checkLimitReached()) {
      onLog('==================================================');
      onLog(`📄 Memproses Halaman Pencarian LinkedIn ke-${currentPage}...`);

      // 4. Scan seluruh daftar Job ID yang ada di dalam panel kiri
      const jobIdsOnPage = await page.evaluate(() => {
        const listItems = Array.from(document.querySelectorAll(
          'li[data-occludable-job-id], .jobs-search-results-list li, li.scaffold-layout__list-item, [data-job-id], div.job-card-container'
        ));
        const ids = listItems.map((li) => {
          return li.getAttribute('data-occludable-job-id') || 
                 li.getAttribute('data-job-id') || 
                 li.querySelector('[data-job-id]')?.getAttribute('data-job-id') ||
                 li.querySelector('a[href*="/jobs/view/"]')?.getAttribute('href')?.match(/\/jobs\/view\/(\d+)/)?.[1];
        }).filter(Boolean) as string[];
        return Array.from(new Set(ids));
      });

      const totalJobs = jobIdsOnPage.length;
      onLog(`📊 Panel Kiri: Terdeteksi ${totalJobs} lowongan kerja pada daftar halaman ini.`);

      if (totalJobs === 0) {
        onLog('⚠️ Tidak ditemukan kartu loker di panel kiri. Mencoba menyelesaikan.');
        break;
      }

      // 5. Iterasi satu per satu secara berurutan berdasarkan Job ID dari panel kiri
      let lastProcessedTitle = '';
      let lastProcessedCompany = '';

      for (let i = 0; i < totalJobs; i++) {
        const targetJobId = jobIdsOnPage[i];
        if (!targetJobId) continue;

        if (!global.isBotRunning) {
          onLog('🛑 Bot dihentikan oleh pengguna.');
          break;
        }

        if (checkLimitReached()) {
          onLog(`🎯 Batas kuota tercapai (${successCount}/${targetLimit}). Selesai.`);
          break;
        }

        if (processedJobIds.has(targetJobId)) {
          continue;
        }
        processedJobIds.add(targetJobId);

        const targetJobUrl = `https://www.linkedin.com/jobs/view/${targetJobId}/`;

        // 1. Cek riwayat Google Sheets terlebih dahulu
        const alreadyInSheets = await isJobAlreadyApplied(targetJobUrl);
        if (alreadyInSheets) {
          onLog(`⏩ [${i + 1}/${totalJobs}] Lowongan ID: ${targetJobId} - Sudah tercatat di riwayat Google Sheets. Melewati...`);
          alreadyAppliedCount++;
          continue;
        }

        // 2. Scroll container hasil pencarian panel kiri agar elemen target ter-render
        await page.evaluate((jobId: string) => {
          const listContainer = document.querySelector(
            '.jobs-search-results-list, .scaffold-layout__list, ul.scaffold-layout__list-container'
          ) as HTMLElement;
          const cardLi = document.querySelector(`li[data-occludable-job-id="${jobId}"], [data-job-id="${jobId}"]`) as HTMLElement;
          if (cardLi) {
            if (listContainer) {
              const topOffset = cardLi.offsetTop - listContainer.offsetTop;
              listContainer.scrollTop = Math.max(0, topOffset - 60);
            }
            cardLi.scrollIntoView({ behavior: 'auto', block: 'nearest' });
          }
        }, targetJobId);
        await sleep(500);

        // 3. Ekstraksi info detail dari kartu loker di panel kiri
        let cardInfo = await page.evaluate((jobId: string) => {
          const cardLi = document.querySelector(`li[data-occludable-job-id="${jobId}"]`) as HTMLElement;
          if (!cardLi) return null;

          const titleAnchor = cardLi.querySelector(
            'a.job-card-container__link, a.job-card-list__title--link, a[data-control-name="job_card_click"], [data-view-name="job-card-title-link"]'
          ) as HTMLAnchorElement;
          const title = titleAnchor?.getAttribute('aria-label') || titleAnchor?.textContent?.trim().replace(/\s+/g, ' ') || '';

          const companyEl = cardLi.querySelector(
            '.artdeco-entity-lockup__subtitle, .job-card-container__primary-description, .job-card-container__company-name'
          );
          const company = companyEl?.textContent?.trim().replace(/\s+/g, ' ') || '';

          const locEl = cardLi.querySelector(
            '.job-card-container__metadata-wrapper li, .artdeco-entity-lockup__caption, .job-card-container__metadata-item'
          );
          const location = locEl?.textContent?.trim().replace(/\s+/g, ' ') || '';

          const isAlreadyApplied = /Applied|Dilamar|Lamaran terkirim/i.test(cardLi.textContent || '');

          return {
            jobId,
            title: title || '',
            company: company || '',
            location,
            url: `https://www.linkedin.com/jobs/view/${jobId}/`,
            isAlreadyApplied
          };
        }, targetJobId);

        if (!cardInfo) {
          continue;
        }

        // 4. Klik kartu untuk memicu pemuatan detail di panel kanan
        await page.evaluate((jobId: string) => {
          const cardLi = document.querySelector(`li[data-occludable-job-id="${jobId}"]`) as HTMLElement;
          if (cardLi) {
            const clickableTarget = cardLi.querySelector(
              'a.job-card-container__link, a.job-card-list__title--link, div.job-card-container, [data-view-name="job-card-title-link"]'
            ) as HTMLElement;
            if (clickableTarget) {
              clickableTarget.click();
            } else {
              cardLi.click();
            }
          }
        }, targetJobId);

        // Tunggu panel detail kanan selesai memuat
        await sleep(1500);

        // 5. Ekstraksi info detail & tombol Apply di komponen panel kanan
        const getRightPaneDetail = () => page.evaluate((currentJobId: string) => {
          const detailContainer = document.querySelector(
            '.jobs-search__job-details--container, .jobs-search__job-details--wrapper, .jobs-details, .scaffold-layout__detail, main'
          );
          if (!detailContainer) return null;

          const titleEl = detailContainer.querySelector(
            'h1.job-details-jobs-unified-top-card__job-title, h1.t-24, h1 a, h1, .jobs-unified-top-card__job-title'
          );
          const officialTitle = titleEl?.textContent?.trim().replace(/\s+/g, ' ') || '';

          const companyEl = detailContainer.querySelector(
            '.job-details-jobs-unified-top-card__company-name a, .job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name a, .jobs-unified-top-card__company-name'
          );
          const officialCompany = companyEl?.textContent?.trim().replace(/\s+/g, ' ') || '';

          const applyBtn = detailContainer.querySelector(
            'button.jobs-apply-button, button#jobs-apply-button-id, button[data-live-test-job-apply-button], .jobs-s-apply button, button[aria-label*="Easy Apply"], button[aria-label*="Lamar Mudah"]'
          ) as HTMLButtonElement;

          const alreadyAppliedTag = detailContainer.querySelector(
            '.jobs-applied-tag, button[aria-label*="Applied"], button[aria-label*="Sudah Dilamar"], .jobs-s-apply .artdeco-inline-feedback'
          );

          const btnText = applyBtn ? (applyBtn.textContent || '').trim().replace(/\s+/g, ' ') : '';
          const hasEasyApply = applyBtn ? (/Easy Apply|Lamar Mudah|Apply/i.test(btnText) || !!applyBtn.querySelector('.artdeco-button__icon--in-bug')) : false;

          return {
            officialTitle,
            officialCompany,
            hasApplyBtn: !!applyBtn,
            hasEasyApply,
            btnText,
            isAlreadyApplied: !!alreadyAppliedTag
          };
        }, targetJobId);

        let rightPaneDetail = await getRightPaneDetail();

        // Jika judul belum terdeteksi dari panel kiri, gunakan yang ada di panel kanan
        if (!cardInfo.title && rightPaneDetail?.officialTitle) {
          cardInfo.title = rightPaneDetail.officialTitle;
        }
        if (!cardInfo.company && rightPaneDetail?.officialCompany) {
          cardInfo.company = rightPaneDetail.officialCompany;
        }

        const displayTitle = cardInfo.title || rightPaneDetail?.officialTitle || 'Lowongan Kerja';
        const displayCompany = cardInfo.company || rightPaneDetail?.officialCompany || 'Perusahaan';

        onLog('==================================================');
        onLog(`💼 [${i + 1}/${totalJobs}] Lowongan: "${displayTitle}"`);
        onLog(`🏢 Perusahaan: "${displayCompany}" | 📍 ${cardInfo.location || 'Indonesia'}`);
        onLog(`🔗 URL: ${cardInfo.url}`);

        // Cek label sudah dilamar pada kartu
        if (cardInfo.isAlreadyApplied) {
          onLog(`⏩ Melewati "${displayTitle}" - Sudah ada label 'Applied / Dilamar' pada kartu.`);
          alreadyAppliedCount++;
          continue;
        }

        // Pengecekan apakah panel kanan belum berganti dari kartu sebelumnya
        if (
          rightPaneDetail &&
          lastProcessedTitle &&
          lastProcessedTitle !== 'Lowongan Kerja' &&
          rightPaneDetail.officialTitle === lastProcessedTitle &&
          rightPaneDetail.officialCompany === lastProcessedCompany
        ) {
          onLog(`ℹ️ Kartu belum berpindah dari "${lastProcessedTitle}". Mengklik ulang kartu loker...`);
          await page.evaluate((jobId: string) => {
            const cardLi = document.querySelector(`li[data-occludable-job-id="${jobId}"]`) as HTMLElement;
            if (cardLi) {
              const target = cardLi.querySelector(
                'a.job-card-container__link, a.job-card-list__title--link, div.job-card-container, [data-view-name="job-card-title-link"]'
              ) as HTMLElement;
              if (target) target.click();
            }
          }, targetJobId);
          await sleep(1500);
          rightPaneDetail = await getRightPaneDetail();
        }

        // Jika panel kanan masih belum memiliki tombol Apply, coba navigasikan langsung ke targetJobUrl untuk me-refresh detail view
        if (!rightPaneDetail?.hasApplyBtn && !rightPaneDetail?.isAlreadyApplied) {
          // Buka view URL langsung jika panel kanan gagal ter-load di single-page mode
          onLog(`🔄 Mencoba memuat panel detail melalui URL view: ${targetJobUrl}`);
          try {
            await page.goto(targetJobUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await sleep(2000);
            rightPaneDetail = await getRightPaneDetail();
          } catch {
            // Abaikan jika timeout
          }
        }

        if (!rightPaneDetail) {
          onLog(`⚠️ Komponen detail panel kanan tidak termuat untuk lowongan "${displayTitle}". Melewati...`);
          continue;
        }

        const activeTitle = rightPaneDetail.officialTitle || displayTitle;
        const activeCompany = rightPaneDetail.officialCompany || displayCompany;

        lastProcessedTitle = activeTitle;
        lastProcessedCompany = activeCompany;

        if (rightPaneDetail.isAlreadyApplied) {
          onLog(`⏩ Lowongan "${activeTitle}" di "${activeCompany}" SUDAH DILAMAR. Melewati...`);
          alreadyAppliedCount++;
          continue;
        }

        // Enterprise Filter: Job Match & Dealbreaker Check
        if (config.enableJobMatchFilter) {
          const matchResult = evaluateJobMatch({
            jobTitle: activeTitle,
            company: activeCompany,
            targetKeywords: config.searchKeywords || '',
            negativeKeywords: config.negativeKeywords || '',
            minScoreThreshold: config.minMatchScore || 60,
            candidateSkills: config.skills || ''
          });

          if (!matchResult.shouldApply) {
            onLog(`🛡️ [LinkedIn Filter] Melewati loker: ${matchResult.reason}`);
            continue;
          } else {
            onLog(`🎯 [LinkedIn Filter] Lolos seleksi kecocokan (Skor: ${matchResult.score}%). Melanjutkan...`);
          }
        }

        if (!rightPaneDetail.hasApplyBtn) {
          onLog(`⏩ Tidak ada tombol Apply di panel kanan untuk "${activeTitle}". Melewati...`);
          await addAppliedJob({
            company: activeCompany,
            title: activeTitle,
            platform: 'LinkedIn',
            jobUrl: targetJobUrl,
            status: 'External Link'
          });
          continue;
        }

        // Siapkan listener untuk mendeteksi pembukaan tab eksternal
        const browser = page.browser();
        let externalTargetCreated: any = null;
        const targetListener = (target: any) => {
          if (target.type() === 'page') {
            externalTargetCreated = target;
          }
        };
        browser.on('targetcreated', targetListener);

        onLog(`🔘 Mengklik tombol Apply di panel kanan ("${rightPaneDetail.btnText}")...`);
        if (config.enableHumanStealth) {
          await humanClick(page, 'button.jobs-apply-button, button#jobs-apply-button-id, .jobs-s-apply button');
        } else {
          await page.evaluate(() => {
            const applyBtn = document.querySelector(
              'button.jobs-apply-button, button#jobs-apply-button-id, button[data-live-test-job-apply-button], .jobs-s-apply button, button[aria-label*="Easy Apply"], button[aria-label*="Lamar Mudah"]'
            ) as HTMLElement;
            if (applyBtn) applyBtn.click();
          });
        }

        await sleep(3000);
        browser.off('targetcreated', targetListener);

        // Jika membuka tab eksternal baru
        if (externalTargetCreated) {
          onLog(`🌐 Terdeteksi pembukaan tab eksternal baru untuk "${activeTitle}". Mengaktifkan Universal External Job Solver...`);
          try {
            const externalPage = await externalTargetCreated.page();
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
                  platform: 'LinkedIn',
                  originalJobUrl: targetJobUrl
                },
                (msg: string) => onLog(`[External] ${msg}`)
              );
              if (res.success) {
                successCount++;
                if (sharedLimiter) sharedLimiter.onJobSuccess();
              }
              try { await externalPage.close(); } catch {}
            }
          } catch (extErr: any) {
            onLog(`⚠️ Gagal memproses halaman eksternal: ${extErr.message || extErr}`);
          }
          continue;
        }

        // Tunggu modal Easy Apply muncul jika bukan external tab
        try {
          await page.waitForSelector('.artdeco-modal.jobs-easy-apply-modal, .jobs-easy-apply-modal', { visible: true, timeout: 6000 });
          onLog('🎉 Modal Easy Apply LinkedIn terbuka!');
        } catch {
          onLog(`⏩ Modal Easy Apply tidak terbuka. Melewati "${activeTitle}"...`);
          continue;
        }

        // Tunggu hingga .jobs-loader / .artdeco-loader selesai memuat form
        onLog('⏳ Menunggu loader modal Easy Apply selesai memuat...');
        try {
          await page.waitForFunction(() => {
            const modal = document.querySelector('.jobs-easy-apply-modal');
            if (!modal) return false;
            const loader = modal.querySelector('.jobs-loader, .artdeco-loader, .inline-spinner');
            const hasForm = modal.querySelector('form, select, input, textarea, .jobs-easy-apply-modal__content');
            return !loader && !!hasForm;
          }, { timeout: 12000 });
        } catch {}
        await sleep(1500);

        // ====================================================
        // LOOP SOLVER SELURUH STEP MODAL EASY APPLY LINKEDIN
        // ====================================================
        let currentStep = 1;
        const maxSteps = 15;
        let reachedFinal = false;
        let stuckStepCount = 0;
        let lastProgressLabel = '';

        while (currentStep <= maxSteps && !reachedFinal) {
          if (!global.isBotRunning) break;

          // Tunggu jika ada spinner/loader yang aktif di step ini
          await page.waitForFunction(() => {
            const modal = document.querySelector('.jobs-easy-apply-modal');
            if (!modal) return true;
            const loader = modal.querySelector('.jobs-loader, .artdeco-loader');
            return !loader;
          }, { timeout: 8000 }).catch(() => {});
          await sleep(1500);

          // 1. Ekstraksi informasi step & form KHUSUS dari modal Easy Apply yang aktif
          const stepInfo = await page.evaluate(() => {
            const modal = document.querySelector(
              '.artdeco-modal.jobs-easy-apply-modal, .jobs-easy-apply-modal, [data-test-modal].jobs-easy-apply-modal, .artdeco-modal[role="dialog"]'
            ) as HTMLElement;

            if (!modal) return null;

            // Baca persentase & judul step bersih
            const progressEl = modal.querySelector('progress') as HTMLProgressElement;
            const progressPercent = progressEl ? progressEl.value : null;
            const progressSpan = modal.querySelector('.artdeco-completeness-meter-linear ~ span, span.t-black--light, span[role="note"]');
            const progressRaw = progressSpan?.textContent?.trim() || (progressPercent !== null ? `${progressPercent}%` : '');
            const progressText = progressRaw.match(/\d+%/)?.[0] || progressRaw.split('\n')[0].trim() || (progressPercent !== null ? `${progressPercent}%` : '');

            const stepHeader = modal.querySelector('.jobs-easy-apply-modal__content h3, .artdeco-modal__header h2, h3.t-16, h3');
            const stepTitle = stepHeader?.textContent?.trim().replace(/\s+/g, ' ') || 'Form Step';

            // Deteksi tombol aksi di dalam footer modal
            const submitBtn = modal.querySelector('button[aria-label*="Submit application"], button[aria-label*="Kirim lamaran"], button[data-easy-apply-next-button="submit"]') as HTMLButtonElement;
            const reviewBtn = modal.querySelector('button[aria-label*="Review your application"], button[aria-label*="Tinjau lamaran Anda"]') as HTMLButtonElement;
            const nextBtn = modal.querySelector('button[aria-label*="Continue to next step"], button[aria-label*="Lanjut ke langkah berikutnya"], button[data-easy-apply-next-button]') as HTMLButtonElement;

            const actionBtn = submitBtn || reviewBtn || nextBtn;
            const isSubmit = !!submitBtn;
            const isReview = !!reviewBtn;
            const actionBtnText = actionBtn ? (actionBtn.textContent || '').trim() : '';

            // Ekstraksi pertanyaan dan input di dalam form modal
            const questions: Array<{
              id: string;
              question: string;
              type: 'dropdown' | 'radiobutton' | 'checklist' | 'text';
              options: string[];
              currentValue: string;
              inputSelector: string;
            }> = [];

            // A. Dropdown Selects (Email, Phone Country Code, dll.)
            const selects = Array.from(modal.querySelectorAll('select')) as HTMLSelectElement[];
            for (const sel of selects) {
              const label = modal.querySelector(`label[for="${sel.id}"]`) || sel.closest('.fb-dash-form-element')?.querySelector('label') || sel.parentElement?.querySelector('label');
              const questionText = label?.textContent?.trim().replace(/\s+/g, ' ') || sel.getAttribute('aria-label') || 'Dropdown Option';
              const options = Array.from(sel.options).map(o => (o.textContent || '').trim()).filter(o => o.length > 0 && !/Select an option|Pilih opsi/i.test(o));
              const currentValue = sel.value || '';

              questions.push({
                id: sel.id || sel.name || '',
                question: questionText,
                type: 'dropdown',
                options,
                currentValue,
                inputSelector: sel.id ? `#${sel.id}` : `select[name="${sel.name}"]`
              });
            }

            // B. Text Inputs / Numeric / Tel Inputs & Textarea
            const textInputs = Array.from(modal.querySelectorAll('input[type="text"], input[type="number"], input[type="tel"], textarea')) as (HTMLInputElement | HTMLTextAreaElement)[];
            for (const input of textInputs) {
              if (input.type === 'hidden' || input.style.display === 'none') continue;
              const label = modal.querySelector(`label[for="${input.id}"]`) || input.closest('.fb-dash-form-element')?.querySelector('label') || input.closest('.artdeco-text-input--container')?.querySelector('label') || input.parentElement?.querySelector('label');
              const questionText = label?.textContent?.trim().replace(/\s+/g, ' ') || input.getAttribute('aria-label') || input.placeholder || 'Text Input';

              questions.push({
                id: input.id || input.name || '',
                question: questionText,
                type: 'text',
                options: [],
                currentValue: input.value || '',
                inputSelector: input.id ? `#${input.id}` : `input[name="${input.name}"]`
              });
            }

            // C. Radio Button Groups (Yes/No, Experience, Work Rights, dll.)
            const radioFieldsets = Array.from(modal.querySelectorAll('fieldset, [data-test-form-builder-radio-button-form-component]'));
            for (const fs of radioFieldsets) {
              const legend = fs.querySelector('legend, span.fb-form-element-label, label')?.textContent?.trim().replace(/\s+/g, ' ') || 'Radio Question';
              const radios = Array.from(fs.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
              const options: string[] = [];
              let checkedValue = '';

              for (const rd of radios) {
                const lbl = fs.querySelector(`label[for="${rd.id}"]`) || rd.closest('label') || rd.parentElement;
                const optText = (lbl?.textContent || rd.value || '').trim();
                if (optText && !options.includes(optText)) options.push(optText);
                if (rd.checked) checkedValue = optText;
              }

              if (radios.length > 0) {
                questions.push({
                  id: radios[0].name || fs.id || '',
                  question: legend,
                  type: 'radiobutton',
                  options,
                  currentValue: checkedValue,
                  inputSelector: radios[0].name ? `input[name="${radios[0].name}"]` : 'input[type="radio"]'
                });
              }
            }

            // D. Checkbox Groups
            const checkboxElements = Array.from(modal.querySelectorAll('input[type="checkbox"]:not(#follow-company-checkbox)')) as HTMLInputElement[];
            for (const cb of checkboxElements) {
              const lbl = modal.querySelector(`label[for="${cb.id}"]`) || cb.closest('label') || cb.parentElement;
              const cbText = (lbl?.textContent || cb.value || '').trim();
              if (cbText) {
                questions.push({
                  id: cb.id || '',
                  question: cbText,
                  type: 'checklist',
                  options: [cbText],
                  currentValue: cb.checked ? 'true' : 'false',
                  inputSelector: cb.id ? `#${cb.id}` : 'input[type="checkbox"]'
                });
              }
            }

            // E. Cek pemilihan Resume
            const resumeItems = Array.from(modal.querySelectorAll('.jobs-document-upload__title, [data-test-document-upload-card], .jobs-resume-picker__resume-card'));
            const hasResumeCards = resumeItems.length > 0;

            return {
              progressText,
              stepTitle,
              isSubmit,
              isReview,
              actionBtnText,
              hasResumeCards,
              questions
            };
          });

          if (!stepInfo) {
            onLog('🏁 Modal Easy Apply selesai atau tertutup.');
            reachedFinal = true;
            break;
          }

          const currentProgressKey = `${stepInfo.progressText}_${stepInfo.stepTitle}`;
          if (currentProgressKey === lastProgressLabel) {
            stuckStepCount++;
            if (stuckStepCount >= 3) {
              onLog(`⚠️ Form Easy Apply tidak berpindah step setelah 3 kali percobaan. Menutup modal dan melewati "${activeTitle}"...`);
              await page.evaluate(() => {
                const closeBtn = document.querySelector('.jobs-easy-apply-modal button[aria-label*="Dismiss"], .jobs-easy-apply-modal button[data-test-modal-close-btn]') as HTMLElement;
                if (closeBtn) closeBtn.click();
              });
              await sleep(600);
              await page.evaluate(() => {
                const discardBtn = document.querySelector('[data-test-dialog-secondary-action], [data-control-name="discard_application_confirm_btn"]') as HTMLElement ||
                                   Array.from(document.querySelectorAll('button')).find(b => /Discard|Batalkan/i.test(b.textContent || ''));
                if (discardBtn) discardBtn.click();
              });
              break;
            }
          } else {
            stuckStepCount = 0;
            lastProgressLabel = currentProgressKey;
          }

          const progressLabel = stepInfo.progressText ? `(${stepInfo.progressText})` : '';
          onLog(`📍 Step ${currentStep} ${progressLabel}: [${stepInfo.stepTitle}] -> ${stepInfo.questions.length} input terdeteksi.`);

          // 2. Pilih Resume default jika sedang di step Resume
          if (stepInfo.hasResumeCards || /Resume|CV/i.test(stepInfo.stepTitle)) {
            await page.evaluate(() => {
              const firstResume = document.querySelector('.jobs-easy-apply-modal .jobs-document-upload__title, .jobs-easy-apply-modal [data-test-document-upload-card] button, .jobs-easy-apply-modal .jobs-resume-picker__resume-card') as HTMLElement;
              if (firstResume) firstResume.click();
            });
            await sleep(500);
          }

          // 3. Jawab & isi seluruh field pertanyaan di step ini
          for (const qItem of stepInfo.questions) {
            const cleanQ = qItem.question.toLowerCase();

            // Special Case A: Email Address Dropdown
            if (qItem.type === 'dropdown' && /email/i.test(cleanQ)) {
              await page.evaluate((sel: string) => {
                const selectEl = document.querySelector(`.jobs-easy-apply-modal ${sel}, ${sel}`) as HTMLSelectElement;
                if (selectEl && selectEl.options.length > 1 && (selectEl.value === 'Select an option' || !selectEl.value)) {
                  selectEl.selectedIndex = 1;
                  selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                }
              }, qItem.inputSelector);
              continue;
            }

            // Special Case B: Phone Country Code Dropdown
            if (qItem.type === 'dropdown' && (/country code|kode negara|phone/i.test(cleanQ) || qItem.inputSelector.includes('country'))) {
              await page.evaluate((sel: string) => {
                const selectEl = document.querySelector(`.jobs-easy-apply-modal ${sel}, ${sel}`) as HTMLSelectElement;
                if (selectEl) {
                  for (let i = 0; i < selectEl.options.length; i++) {
                    const optText = selectEl.options[i].text;
                    if (optText.includes('Indonesia') || optText.includes('+62')) {
                      selectEl.selectedIndex = i;
                      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                      break;
                    }
                  }
                }
              }, qItem.inputSelector);
              continue;
            }

            // Special Case C: Mobile Phone Number Input
            if (qItem.type === 'text' && (/mobile|phone|telepon|hp|nomor/i.test(cleanQ) || qItem.inputSelector.includes('phoneNumber') || qItem.inputSelector.includes('nationalNumber'))) {
              const phoneVal = config.phoneNumber || '081234567890';
              await page.evaluate((sel: string, val: string) => {
                const inputEl = document.querySelector(`.jobs-easy-apply-modal ${sel}, ${sel}`) as HTMLInputElement;
                if (inputEl && (!inputEl.value || inputEl.value.trim() === '')) {
                  inputEl.focus();
                  inputEl.value = val;
                  inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                  inputEl.dispatchEvent(new Event('change', { bubbles: true }));
                  inputEl.blur();
                }
              }, qItem.inputSelector, phoneVal);
              continue;
            }

            // Skip jika text sudah terisi
            if (qItem.currentValue && qItem.currentValue !== 'Select an option' && qItem.currentValue !== 'false' && qItem.type === 'text') {
              continue;
            }

            // Selesaikan via Q&A Engine (KB CSV -> Regex Deterministic -> Gemini LLM)
            let chosenAnswers: string[] = [];
            const isCoverLetter = /(cover letter|surat lamaran|surat pengantar|why do you want to work|why are you a good fit|alasan melamar)/i.test(cleanQ);
            if (isCoverLetter && config.enableCoverLetterGen) {
              onLog(`✍️ [AI Cover Letter] Menyusun surat motivasi khusus untuk "${activeCompany}"...`);
              const letter = await generateDynamicCoverLetter({
                jobTitle: activeTitle,
                company: activeCompany,
                preferredLanguage: 'en'
              });
              chosenAnswers = [letter];
            } else {
              chosenAnswers = await answerQuestion(qItem.question, qItem.options, qItem.type as any);
            }

            onLog(`🤖 Pertanyaan: "${qItem.question}" -> Jawaban: [${chosenAnswers.join(' | ')}]`);
            appendQuestionToCsv(qItem.question, qItem.type as any, qItem.options, chosenAnswers);

            // Injeksi hasil jawaban ke DOM modal LinkedIn
            await page.evaluate((targetQ: any, answers: string[]) => {
              const modal = document.querySelector('.jobs-easy-apply-modal, [data-test-modal].jobs-easy-apply-modal') || document;

              if (targetQ.type === 'text' && answers.length > 0) {
                const el = modal.querySelector(targetQ.inputSelector) as HTMLInputElement;
                if (el) {
                  el.focus();
                  let valToSet = answers[0] || '';

                  // Sanitasi: Hanya jika pertanyaan murni menanyakan durasi angka (0-99) dan BUKAN deskripsi/project
                  const isDescriptive = /jelaskan|ceritakan|sebutkan|describe|explain|project|proyek|portfolio|contoh|apa saja|why|bagaimana/i.test(targetQ.question);
                  const isNumericQuestion = !isDescriptive && (
                    /(?:how many|berapa)\s+(?:years?|tahun)|years of (?:work )?experience|tahun pengalaman|whole number|age|usia|umur|gpa|ipk/i.test(targetQ.question) ||
                    el.type === 'number' ||
                    el.inputMode === 'numeric'
                  );

                  if (isNumericQuestion) {
                    const digitMatch = valToSet.match(/\d+/);
                    valToSet = digitMatch ? digitMatch[0] : (valToSet.replace(/\D/g, '') || '3');
                  }

                  el.value = valToSet;
                  el.dispatchEvent(new Event('input', { bubbles: true }));
                  el.dispatchEvent(new Event('change', { bubbles: true }));
                  el.blur();
                }
              } else if (targetQ.type === 'radiobutton' && answers.length > 0) {
                const radios = Array.from(modal.querySelectorAll(targetQ.inputSelector)) as HTMLInputElement[];
                for (const rd of radios) {
                  const lbl = (modal.querySelector(`label[for="${rd.id}"]`) || rd.closest('label') || rd.parentElement) as HTMLElement | null;
                  const txt = (lbl?.textContent || rd.value || '').trim();
                  if (answers.some(a => txt.toLowerCase().includes(a.toLowerCase()) || a.toLowerCase().includes(txt.toLowerCase()))) {
                    if (lbl) {
                      lbl.click();
                    } else {
                      rd.click();
                    }
                    rd.checked = true;
                    rd.dispatchEvent(new Event('change', { bubbles: true }));
                    break;
                  }
                }
              } else if (targetQ.type === 'dropdown' && answers.length > 0) {
                const sel = modal.querySelector(targetQ.inputSelector) as HTMLSelectElement;
                if (sel) {
                  const targetAns = answers[0].toLowerCase();
                  for (let optIdx = 0; optIdx < sel.options.length; optIdx++) {
                    const opt = sel.options[optIdx];
                    if (opt.text.toLowerCase().includes(targetAns) || opt.value.toLowerCase().includes(targetAns)) {
                      sel.selectedIndex = optIdx;
                      sel.dispatchEvent(new Event('change', { bubbles: true }));
                      break;
                    }
                  }
                }
              } else if (targetQ.type === 'checklist') {
                const cb = modal.querySelector(targetQ.inputSelector) as HTMLInputElement;
                if (cb && !cb.checked) {
                  cb.click();
                  cb.checked = true;
                  cb.dispatchEvent(new Event('change', { bubbles: true }));
                }
              }
            }, qItem, chosenAnswers);

            await sleep(600);
          }

          // Uncheck checkbox "Follow company" pada halaman Review
          await page.evaluate(() => {
            const followCb = document.querySelector('.jobs-easy-apply-modal input#follow-company-checkbox, .jobs-easy-apply-modal [data-test-form-element="follow-company"] input') as HTMLInputElement;
            if (followCb && followCb.checked) {
              followCb.click();
            }
          });

          // 4. Cek apakah ini Step Terakhir (Submit Application)
          if (stepInfo.isSubmit) {
            if (config.debugTest) {
              onLog(`🏁 [DEBUG MODE] Form Easy Apply LinkedIn (${activeTitle}) selesai diisi.`);
              onLog(`   🛡️ Simulasi berhasil (Lamaran tidak dikirim ke LinkedIn).`);

              // Tutup modal Easy Apply & Discard
              await page.evaluate(() => {
                const closeBtn = document.querySelector('.jobs-easy-apply-modal button[aria-label*="Dismiss"], .jobs-easy-apply-modal button[data-test-modal-close-btn], .jobs-easy-apply-modal button.artdeco-modal__dismiss') as HTMLElement;
                if (closeBtn) closeBtn.click();
              });
              await sleep(800);

              // Konfirmasi discard
              await page.evaluate(() => {
                const discardBtn = document.querySelector('[data-test-dialog-secondary-action], [data-control-name="discard_application_confirm_btn"]') as HTMLElement ||
                                   Array.from(document.querySelectorAll('button')).find(b => /Discard|Batalkan/i.test(b.textContent || ''));
                if (discardBtn) discardBtn.click();
              });
              await sleep(1000);

              await addAppliedJob({
                company: activeCompany,
                title: activeTitle,
                platform: 'LinkedIn',
                jobUrl: cardInfo.url,
                status: 'Dry-run Sim'
              });

              onLog(`📝 [Dry-run Sim] Data simulasi "${activeCompany}" (${activeTitle}) disimpan ke Google Sheets.`);
              successCount++;
              if (sharedLimiter) sharedLimiter.onJobSuccess();
              reachedFinal = true;
              break;
            } else {
              onLog(`🚀 Mengirim Lamaran Easy Apply LinkedIn ke "${activeCompany}"...`);
              await page.evaluate(() => {
                const submitBtn = document.querySelector('.jobs-easy-apply-modal button[aria-label*="Submit application"], .jobs-easy-apply-modal button[aria-label*="Kirim lamaran"], .jobs-easy-apply-modal button[data-easy-apply-next-button="submit"]') as HTMLElement;
                if (submitBtn) submitBtn.click();
              });
              await sleep(3500);

              // Tutup popup konfirmasi jika ada
              await page.evaluate(() => {
                const closeConfirmBtn = document.querySelector('.artdeco-modal button[aria-label*="Dismiss"], button[data-test-modal-close-btn]') as HTMLElement;
                if (closeConfirmBtn) closeConfirmBtn.click();
              });

              await addAppliedJob({
                company: activeCompany,
                title: activeTitle,
                platform: 'LinkedIn',
                jobUrl: cardInfo.url,
                status: 'Applied'
              });

              onLog(`🎉 Lamaran Easy Apply ke "${activeCompany}" (${activeTitle}) berhasil terkirim & disimpan ke Google Sheets!`);
              successCount++;
              if (sharedLimiter) sharedLimiter.onJobSuccess();
              reachedFinal = true;
              break;
            }
          }

          // 5. Klik Tombol Next / Review di dalam modal Easy Apply
          onLog(`👉 Mengklik tombol "${stepInfo.actionBtnText || 'Next'}"...`);
          await page.evaluate(() => {
            const modal = document.querySelector('.jobs-easy-apply-modal, [data-test-modal].jobs-easy-apply-modal') || document;
            const nextBtn = modal.querySelector(
              'button[aria-label*="Continue to next step"], button[aria-label*="Lanjut ke langkah berikutnya"], button[aria-label*="Review your application"], button[aria-label*="Tinjau lamaran Anda"], button[data-easy-apply-next-button]'
            ) as HTMLElement;
            if (nextBtn) nextBtn.click();
          });

          await sleep(2500);

          // Pengecekan jika ada pesan validasi error
          const hasError = await page.evaluate(() => {
            const errorEl = document.querySelector('.jobs-easy-apply-modal .artdeco-inline-feedback--error, .jobs-easy-apply-modal [data-test-form-element-error], .jobs-easy-apply-modal .artdeco-inline-feedback__message, .jobs-easy-apply-modal .fb-dash-form-element--error');
            return errorEl ? (errorEl.textContent || '').trim().replace(/\s+/g, ' ') : null;
          });

          if (hasError) {
            onLog(`⚠️ Validasi form LinkedIn: "${hasError}". Memanggil AI Inspector untuk memeriksa elemen yang belum terisi/valid...`);
            try {
              const snapshot = await captureFormDomSnapshot(page, '.jobs-easy-apply-modal');
              if (snapshot.htmlSnippet) {
                const profileContext = `Nama: ${config.fullName || ''}, Email: ${config.email || ''}, No HP: ${config.phoneNumber || ''}, Domisili: ${config.domicile || ''}, Alamat: ${config.address || ''}, Pengalaman: ${config.yearsOfExperience || 1} tahun, Gaji: Rp ${config.expectedSalary || 5000000}`;
                const plan = await inspectFormWithAi({
                  platform: 'LinkedIn',
                  jobTitle: activeTitle,
                  company: activeCompany,
                  candidateProfileContext: profileContext,
                  domSnippet: snapshot.htmlSnippet,
                  stepHint: `Error: ${hasError}`
                });
                if (plan) {
                  await applyAiFormActions(page, plan, (msg) => onLog(msg));
                  await sleep(1500);
                }
              }
            } catch (aiErr: any) {
              onLog(`⚠️ AI Inspector LinkedIn error: ${aiErr?.message || aiErr}`);
            }

            await page.evaluate(() => {
              const modal = document.querySelector('.jobs-easy-apply-modal') || document;
              const errorElements = Array.from(modal.querySelectorAll('.artdeco-inline-feedback--error, [data-test-form-element-error], .artdeco-inline-feedback__message, .fb-dash-form-element--error'));

              for (const errEl of errorElements) {
                const errText = errEl.textContent || '';
                const formElement = errEl.closest('.fb-dash-form-element, .artdeco-text-input--container') || errEl.parentElement;
                if (!formElement) continue;

                const input = formElement.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement;
                if (input) {
                  let currentVal = input.value || '';
                  // Jika LinkedIn meminta whole number (angka bulat 0-99) atau input kosong
                  if (/whole number|between 0 and 99|angka bulat|number|numeric/i.test(errText) || !currentVal) {
                    const digitMatch = currentVal.match(/\d+/);
                    input.value = digitMatch ? digitMatch[0] : '3';
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                  }
                }
              }

              const nextBtn = modal.querySelector('button[aria-label*="Continue to next step"], button[aria-label*="Review your application"], button[data-easy-apply-next-button]') as HTMLElement;
              if (nextBtn) nextBtn.click();
            });
            await sleep(2000);
          }

          currentStep++;
        }

        // Jika halaman sempat dialihkan ke halaman view langsung (/jobs/view/), kembalikan ke halaman pencarian
        if (page.url().includes('/jobs/view/')) {
          onLog('🔙 Mengembalikan browser ke halaman daftar pencarian LinkedIn...');
          await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await sleep(2500);
        }

        await sleep(1500);
      }

      // 6. Pagination ke Halaman Berikutnya di panel bawah
      const hasNextPage = await page.evaluate((currPage: number) => {
        const nextBtn = document.querySelector(`button[aria-label="Page ${currPage + 1}"], button[aria-label="Halaman ${currPage + 1}"]`) as HTMLElement ||
                        document.querySelector('.artdeco-pagination__button--next') as HTMLElement;
        if (nextBtn && !nextBtn.hasAttribute('disabled')) {
          nextBtn.click();
          return true;
        }
        return false;
      }, currentPage);

      if (hasNextPage) {
        onLog(`➡️ Berpindah ke Halaman LinkedIn ke-${currentPage + 1}...`);
        await sleep(3500);
        currentPage++;
      } else {
        onLog('🏁 Tidak ada halaman berikutnya di LinkedIn atau halaman terakhir tercapai.');
        break;
      }
    }
  } catch (err: any) {
    onLog(`❌ Terjadi kesalahan pada alur LinkedIn: ${err.message || err}`);
  }

  return { successCount, alreadyAppliedCount, errorCount };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
