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

export async function runGlintsBot(
  page: any, 
  config: any, 
  onLog: (msg: string) => void,
  sharedLimiter?: SharedLimiter
): Promise<BotMetrics> {
  let successCount = 0;
  let alreadyAppliedCount = 0;
  let errorCount = 0;

  const targetUrl = 'https://glints.com/id/opportunities/jobs/explore?country=ID&locationName=All%20Cities%2FProvinces';
  onLog(`🌐 Membuka URL Glints: ${targetUrl}`);

  // Injeksi cookies jika tersedia di konfigurasi
  if (config.portalCookies?.glints) {
    const cookies = parseCookiesInput(config.portalCookies.glints, '.glints.com');
    if (cookies.length > 0) {
      const injectedCount = await injectCookiesIntoPage(page, cookies);
      onLog(`🍪 [Glints Cookie] Menyuntikkan ${injectedCount} cookie sesi Glints!`);
    }
  }

  try {
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(3000);

    const currentUrl = page.url();
    const pageTitle = await page.title();
    onLog(`📍 Halaman saat ini: "${pageTitle}"`);
    onLog(`🔗 URL saat ini: ${currentUrl}`);

    // Analisa elemen input di halaman
    onLog('🔍 Memeriksa elemen input pencarian...');
    const inputAnalysis = await page.evaluate(() => {
      // 1. Cek spesifik input pencarian keyword/posisi
      const keywordInputByPlaceholder = document.querySelector('input[placeholder*="Cari Nama Pekerjaan"], input[placeholder*="Job title, skill"], input[aria-label*="Cari Nama Pekerjaan"]');
      
      // 2. Cek spesifik input lokasi/kota
      const cityInputByDataCy = document.querySelector('input[data-cy="search_bar_city"]');
      const cityInputByPlaceholder = document.querySelector('input[placeholder*="Semua Kota"], input[placeholder*="All Cities"], input[aria-label*="Semua Kota"]');

      // 3. Scan semua elemen input text
      const allInputs = Array.from(document.querySelectorAll('input')).map(input => ({
        type: input.type,
        placeholder: input.placeholder || '',
        ariaLabel: input.getAttribute('aria-label') || '',
        dataCy: input.getAttribute('data-cy') || '',
        name: input.name || '',
        id: input.id || '',
        className: input.className || '',
        value: input.value || ''
      }));

      // 4. Cek tombol submit / cari
      const buttons = Array.from(document.querySelectorAll('button')).map(btn => ({
        text: (btn.textContent || '').trim(),
        type: btn.type,
        dataCy: btn.getAttribute('data-cy') || '',
        className: btn.className || ''
      })).filter(b => /Cari|Search/i.test(b.text) || b.dataCy.includes('search'));

      return {
        keywordInputFound: !!keywordInputByPlaceholder,
        keywordInputDetails: keywordInputByPlaceholder ? {
          placeholder: (keywordInputByPlaceholder as HTMLInputElement).placeholder,
          ariaLabel: keywordInputByPlaceholder.getAttribute('aria-label'),
          className: keywordInputByPlaceholder.className,
          value: (keywordInputByPlaceholder as HTMLInputElement).value
        } : null,
        cityInputFound: !!(cityInputByDataCy || cityInputByPlaceholder),
        cityInputDetails: (cityInputByDataCy || cityInputByPlaceholder) ? {
          placeholder: ((cityInputByDataCy || cityInputByPlaceholder) as HTMLInputElement).placeholder,
          ariaLabel: (cityInputByDataCy || cityInputByPlaceholder)?.getAttribute('aria-label'),
          dataCy: (cityInputByDataCy || cityInputByPlaceholder)?.getAttribute('data-cy'),
          className: (cityInputByDataCy || cityInputByPlaceholder)?.className,
          value: ((cityInputByDataCy || cityInputByPlaceholder) as HTMLInputElement).value
        } : null,
        allInputsSummary: allInputs,
        searchButtons: buttons
      };
    });

    // 1. Ketik Keyword / Nama Pekerjaan dari Dashboard
    const keyword = config.searchKeywords || '';
    const location = (config.location || '').trim();

    if (keyword) {
      onLog(`✍️ Mengisi kata kunci pekerjaan: "${keyword}"...`);
      const keywordSelector = 'input[data-cy="search_bar_job_title"]';
      try {
        await page.waitForSelector(keywordSelector, { timeout: 10000 });

        // Gunakan React Native Value Setter agar state React Glints langsung ter-update
        const resultValue = await page.evaluate((sel: string, val: string) => {
          const el = document.querySelector(sel) as HTMLInputElement;
          if (!el) return null;
          
          el.scrollIntoView({ block: 'center' });
          el.focus();
          el.click();

          // Pemicu React controlled component
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (nativeSetter) {
            nativeSetter.call(el, val);
          } else {
            el.value = val;
          }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return el.value;
        }, keywordSelector, keyword);

        await sleep(300);

        // Tambahan: Tekan spasi lalu backspace untuk memastikan event trigger aktif di browser
        await page.keyboard.press('Space');
        await sleep(100);
        await page.keyboard.press('Backspace');
        await sleep(300);

        // Verifikasi nilai di DOM
        const domValue = await page.$eval(keywordSelector, (el: any) => el.value);
        onLog(`✅ Kata kunci berhasil diisi! (Nilai di input: "${domValue}")`);
      } catch (err: any) {
        onLog(`⚠️ Gagal mengisi input kata kunci: ${err.message || err}`);
      }
    }

    // 2. Ketik Lokasi dari Dashboard
    if (location) {
      // Glints dropdown mengharapkan nama 1 kota bersih (misal: "Surabaya", bukan "Surabaya, remote")
      const primaryCity = location.split(/[,/]/)[0].trim();
      onLog(`✍️ Mengisi lokasi: "${primaryCity}" (dari konfigurasi "${location}")...`);
      const citySelector = 'input[data-cy="search_bar_city"], input[placeholder*="Semua Kota"], input[aria-label*="Semua Kota"]';
      try {
        const cityInput = await page.$(citySelector);
        if (cityInput) {
          await page.click(citySelector, { clickCount: 3 });
          await sleep(300);
          await page.keyboard.press('Backspace');
          await page.type(citySelector, primaryCity, { delay: 100 });
          // Menunggu kontainer SuggestionDropdown muncul
          try {
            await page.waitForSelector('[class*="SuggestionDropdown"], [class*="SearchFieldsc__SuggestionDropdown"]', { visible: true, timeout: 5000 });
          } catch (e) {}

          // Klik opsi dropdown PALING ATAS
          const selected = await page.evaluate(() => {
            const dropdown = document.querySelector('[class*="SuggestionDropdown"], [class*="SearchFieldsc__SuggestionDropdown"]');
            if (dropdown) {
              // Cari elemen anak di dalam dropdown
              const items = Array.from(dropdown.querySelectorAll('div, li, p, span, a')) as HTMLElement[];
              // Filter elemen yang memiliki teks dan bisa diklik
              const clickableOptions = items.filter(el => {
                const text = (el.textContent || '').trim();
                const rect = el.getBoundingClientRect();
                return text.length > 0 && rect.width > 0 && rect.height > 0 && el.children.length === 0;
              });

              if (clickableOptions.length > 0) {
                const topItem = clickableOptions[0];
                const itemText = (topItem.textContent || '').trim();
                topItem.click();
                return { success: true, text: itemText };
              }

              // Jika tidak ada leaf element, klik anak pertama langsung
              if (dropdown.firstElementChild) {
                const firstChild = dropdown.firstElementChild as HTMLElement;
                const text = (firstChild.textContent || '').trim();
                firstChild.click();
                return { success: true, text };
              }
            }

            return { success: false, text: null };
          });

          if (selected.success) {
            onLog(`📍 Berhasil memilih opsi dropdown paling atas: "${selected.text}"`);
          } else {
            onLog('⚠️ Mencoba memilih opsi pertama dengan tombol keyboard (ArrowDown + Enter)...');
            await page.keyboard.press('ArrowDown');
            await sleep(300);
            await page.keyboard.press('Enter');
          }

          await sleep(1000);
          onLog(`✅ Lokasi "${location}" selesai diproses.`);
        }
      } catch (err: any) {
        onLog(`⚠️ Gagal mengisi input lokasi: ${err.message || err}`);
      }
    }

    // 3. Tekan Enter / Klik Tombol Cari untuk Eksekusi Pencarian
    onLog('↵ Menjalankan pencarian...');
    
    // Coba klik tombol Cari jika ada, atau tekan Enter
    const clickedSearchBtn = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
      const searchBtn = buttons.find(b => {
        const text = (b.textContent || '').trim();
        const dataCy = b.getAttribute('data-cy') || '';
        return /Cari|Search/i.test(text) || dataCy.includes('search_button') || dataCy.includes('submit');
      });
      if (searchBtn) {
        searchBtn.click();
        return true;
      }
      return false;
    });

    if (clickedSearchBtn) {
      onLog('🔘 Tombol "Cari" berhasil diklik.');
    } else {
      onLog('↵ Menekan tombol Enter keyboard...');
      await page.keyboard.press('Enter');
    }

    await sleep(5000);

    const resultUrl = page.url();
    const resultTitle = await page.title();
    const baseSearchUrl = resultUrl.replace(/[?&]page=\d+/, '');
    const urlSeparator = baseSearchUrl.includes('?') ? '&' : '?';

    let currentPage = 1;
    const targetLimit = sharedLimiter ? sharedLimiter.getTargetLimit() : (config.limitGlints || config.limitPerDay || 20);
    const maxPages = Math.max(1, Math.ceil(targetLimit / 25) + 3);

    const checkLimitReached = () => sharedLimiter ? sharedLimiter.isLimitReached(successCount) : successCount >= targetLimit;

    const processedJobUrls = new Set<string>();

    while (currentPage <= maxPages && global.isBotRunning !== false && !checkLimitReached()) {
      if (currentPage > 1) {
        const pageSearchUrl = `${baseSearchUrl}${urlSeparator}page=${currentPage}`;
        onLog('==================================================');
        onLog(`📄 Membuka Halaman Pencarian Glints ke-${currentPage}: ${pageSearchUrl}`);
        try {
          await page.goto(pageSearchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await sleep(3000);
        } catch (navErr: any) {
          onLog(`⚠️ Gagal membuka halaman ${currentPage}: ${navErr.message || navErr}`);
          break;
        }
      }

      // Scroll halaman perlahan untuk memuat seluruh 30 kartu batch pada halaman ini
      onLog(`📜 Menggulir halaman ke-${currentPage} untuk merender lowongan kerja...`);
      await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
          let totalHeight = 0;
          const distance = 500;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;

            if (totalHeight >= scrollHeight || totalHeight >= 7000) {
              clearInterval(timer);
              resolve();
            }
          }, 150);
        });
      });
      await sleep(2000);

      // Scroll kembali ke atas
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(1000);

      // Ekstraksi dan Mapping Lengkap Setiap Kartu Lowongan Kerja (Job Card)
      onLog(`🔍 Memetakan (mapping) seluruh kartu loker pada halaman ke-${currentPage}...`);
      const mappedJobs = await page.evaluate(() => {
        const cardContainers = Array.from(document.querySelectorAll(
          'div[class*="JobCardsc__JobcardContainer"], div[class*="CompactOpportunityCardsc__CompactJobCardWrapper"]'
        ));

        const results: Array<{
          id: string;
          title: string;
          company: string;
          location: string;
          salary: string;
          tags: string[];
          url: string;
          isAlreadyApplied: boolean;
        }> = [];

        for (const card of cardContainers) {
          // 1. Judul & Link Loker
          const titleAnchor = card.querySelector('h2 a[href*="/opportunities/jobs/"], a[class*="JobCardTitleNoStyleAnchor"]') as HTMLAnchorElement;
          if (!titleAnchor) continue;

          const rawHref = titleAnchor.getAttribute('href') || '';
          if (!rawHref) continue;

          // Buat absolute URL tanpa query params (?utm_...)
          let cleanUrl = rawHref.startsWith('http') ? rawHref.split('?')[0] : `https://glints.com${rawHref.split('?')[0]}`;
          const title = (titleAnchor.textContent || '').trim().replace(/\s+/g, ' ');

          // 2. ID Pekerjaan
          const gtmEl = card.querySelector('[data-gtm-job-id]');
          const jobId = gtmEl ? gtmEl.getAttribute('data-gtm-job-id') || '' : cleanUrl.split('/').pop() || '';

          // 3. Nama Perusahaan
          const companyAnchor = card.querySelector('a[class*="CompanyLinkResolver"], [data-cy="company_name_job_card"] a');
          const company = (companyAnchor?.textContent || 'Glints Partner').trim().replace(/\s+/g, ' ');

          // 4. Lokasi
          const locationWrapper = card.querySelector('div[class*="LocationWrapper"], div[class*="CardJobLocation"]');
          const loc = (locationWrapper?.textContent || '').trim().replace(/\s+/g, ' ');

          // 5. Gaji
          const salaryEl = card.querySelector('[class*="NotDisclosedMessage"], [class*="JobTitleSalaryWrapper"] span');
          const salary = (salaryEl?.textContent || 'Gaji Tidak Ditampilkan').trim().replace(/\s+/g, ' ');

          // 6. Tags / Skills
          const tagElements = Array.from(card.querySelectorAll('[class*="TagsWrapper"] [class*="TagContentWrapper"], [class*="TagContent-sc"]'));
          const tags = tagElements.map(t => (t.textContent || '').trim()).filter(t => t.length > 0);

          // 7. Cek apakah sudah pernah dilamar langsung dari tanda/badge pada kartu loker Glints
          const isAlreadyApplied = !!card.querySelector('[class*="AppliedTagContainer"], [class*="AppliedIcon"]') ||
                                   /Sudah dilamar|Applied/i.test(card.textContent || '');

          results.push({
            id: jobId,
            title,
            company,
            location: loc,
            salary,
            tags,
            url: cleanUrl,
            isAlreadyApplied
          });
        }

        return results;
      });

      // Filter loker yang belum pernah diproses di sesi ini
      const newJobsToProcess = mappedJobs.filter((j: any) => !processedJobUrls.has(j.url));
      newJobsToProcess.forEach((j: any) => processedJobUrls.add(j.url));

      onLog(`📊 Halaman ${currentPage}: Ditemukan ${mappedJobs.length} loker (${newJobsToProcess.length} loker baru untuk diproses):`);
      newJobsToProcess.forEach((job: any, i: number) => {
        const statusIcon = job.isAlreadyApplied ? '⏩ [Sudah Dilamar]' : '🆕 [Belum Dilamar]';
        onLog(`   📌 [${i + 1}] ${statusIcon} "${job.title}" di "${job.company}"`);
      });

      if (newJobsToProcess.length === 0) {
        onLog(`⚠️ Tidak ada loker baru yang ditemukan pada halaman ke-${currentPage}. Mencoba lanjut atau selesai.`);
        if (mappedJobs.length === 0) break;
      }

      // ----------------------------------------------------
      // PROSES LAMARAN DENGAN WORKER CONCURRENCY
      // ----------------------------------------------------
      const numWorkers = Math.max(1, config.concurrency || 1);
      const chunks: any[][] = Array.from({ length: numWorkers }, () => []);
      newJobsToProcess.forEach((job: any, index: number) => {
        chunks[index % numWorkers].push(job);
      });

      const browser = page.browser();
      onLog(`🚀 Menjalankan ${numWorkers} worker concurrent untuk memproses ${newJobsToProcess.length} lowongan di halaman ${currentPage}...`);

      const workerPromises = chunks.map(async (chunkJobs, workerId) => {
        if (chunkJobs.length === 0) return;

        const workerPrefix = numWorkers > 1 ? `[Worker ${workerId + 1}] ` : '';
        const workerLog = (msg: string) => onLog(`${workerPrefix}${msg}`);

        workerLog(`👷 Worker ${workerId + 1} aktif memproses ${chunkJobs.length} lowongan kerja.`);
        const workerPage = await browser.newPage();
        await workerPage.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await workerPage.setViewport({ width: 1280, height: 800 });

        for (let i = 0; i < chunkJobs.length; i++) {
          if (!global.isBotRunning) {
            workerLog('🛑 Bot dihentikan oleh pengguna.');
            break;
          }

          if (checkLimitReached()) {
            workerLog(`🎯 Batas kuota tercapai (${successCount}/${targetLimit}). Selesai.`);
            break;
          }

          const targetJob = chunkJobs[i];
          workerLog('==================================================');
          workerLog(`💼 Memproses Lowongan [${i + 1}/${chunkJobs.length}]: "${targetJob.title}"`);
          workerLog(`🏢 Perusahaan: "${targetJob.company}"`);
          workerLog(`📍 Lokasi: ${targetJob.location || 'Indonesia'} | 💰 ${targetJob.salary}`);
          workerLog(`🔗 URL: ${targetJob.url}`);

          // 1. Cek apakah kartu loker di Glints sudah berlabel "Sudah dilamar"
          if (targetJob.isAlreadyApplied) {
            workerLog(`⏩ Melewati "${targetJob.title}" - Sudah pernah dilamar di Glints (terdapat badge 'Sudah dilamar').`);
            alreadyAppliedCount++;
            continue;
          }

          // 2. Cek apakah sudah ada di Google Sheets
          const alreadyInSheets = await isJobAlreadyApplied(targetJob.url);
          if (alreadyInSheets) {
            workerLog(`⏩ Melewati "${targetJob.title}" - Sudah tercatat di riwayat Google Sheets.`);
            alreadyAppliedCount++;
            continue;
          }

          // 3. Buka halaman detail loker
          try {
            await workerPage.goto(targetJob.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await sleep(1500);

            const jobPageTitle = await workerPage.title();
            workerLog(`📍 Halaman Loker: "${jobPageTitle}"`);

            // Ekstrak data resmi (Job Title & Company Name) & periksa tombol "Lamar" (data-testid="apply-start")
            const detailInfo = await workerPage.evaluate(() => {
              // 1. Ekstrak Job Title resmi
              const titleEl = document.querySelector('h1[aria-label="Job Title"], h1[class*="JobOverViewTitle"], [class*="JobOverViewTitle"], h1');
              const officialJobTitle = titleEl?.textContent?.trim() || '';

              // 2. Ekstrak Company Name resmi
              const companyEl = document.querySelector('div[class*="JobOverViewCompanyName"] a, [class*="JobOverViewCompanyName"] a, a[href*="/companies/"], [class*="JobOverViewCompanyName"]');
              const officialCompanyName = companyEl?.textContent?.trim() || '';

              const testIdBtn = document.querySelector('button[data-testid="apply-start"]') as HTMLButtonElement;
              const allButtons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
              const textMatchBtn = allButtons.find(b => /^(Lamar|Lamar Cepat|Apply|Quick Apply|Easy Apply|Apply Now)$/i.test((b.textContent || '').trim()));
              const alreadyAppliedBtn = allButtons.find(b => /Lamaran Terkirim|Sudah Dilamar|Applied|Application Sent|Already Applied|Applied on/i.test((b.textContent || '').trim()));
              const targetBtn = testIdBtn || textMatchBtn;

              return {
                officialJobTitle,
                officialCompanyName,
                hasTargetBtn: !!targetBtn,
                isAlreadyApplied: !!alreadyAppliedBtn,
                alreadyAppliedText: alreadyAppliedBtn ? (alreadyAppliedBtn.textContent || '').trim() : null,
                buttonText: targetBtn ? (targetBtn.textContent || '').trim() : ''
              };
            });

            const activeJobTitle = detailInfo.officialJobTitle || targetJob.title;
            const activeCompanyName = detailInfo.officialCompanyName || targetJob.company;

            workerLog(`📋 Posisi Resmi: "${activeJobTitle}" | 🏢 Perusahaan: "${activeCompanyName}"`);

            if (detailInfo.isAlreadyApplied) {
              workerLog(`⏩ Loker ini SUDAH DILAMAR pada halaman detail: "${detailInfo.alreadyAppliedText}". Melewati...`);
              alreadyAppliedCount++;
              continue;
            }

            // Enterprise Filter: Job Match & Dealbreaker Check
            if (config.enableJobMatchFilter) {
              const matchResult = evaluateJobMatch({
                jobTitle: activeJobTitle,
                company: activeCompanyName,
                targetKeywords: config.searchKeywords || '',
                negativeKeywords: config.negativeKeywords || '',
                minScoreThreshold: config.minMatchScore || 60,
                candidateSkills: config.skills || ''
              });

              if (!matchResult.shouldApply) {
                workerLog(`🛡️ [Job Filter] Melewati loker: ${matchResult.reason}`);
                continue;
              } else {
                workerLog(`🎯 [Job Filter] Lolos seleksi kecocokan (Skor: ${matchResult.score}%). Melanjutkan...`);
              }
            }

            if (!detailInfo.hasTargetBtn) {
              workerLog(`⏩ Tidak ditemukan tombol "Lamar" internal (kemungkinan lowongan eksternal/ditutup). Melewati "${activeJobTitle}"...`);
              // Catat sebagai info lowongan eksternal
              await addAppliedJob({
                company: activeCompanyName,
                title: activeJobTitle,
                platform: 'Glints',
                jobUrl: targetJob.url,
                status: 'External Link'
              });
              await sleep(1500);
              continue;
            }

            workerLog(`🔘 Mengklik tombol "${detailInfo.buttonText}" (data-testid="apply-start")...`);
            if (config.enableHumanStealth) {
              await humanClick(workerPage, 'button[data-testid="apply-start"]');
            } else {
              await workerPage.evaluate(() => {
                const btn = (document.querySelector('button[data-testid="apply-start"]') || 
                             Array.from(document.querySelectorAll('button')).find(b => /^(Lamar|Lamar Cepat|Apply|Quick Apply|Easy Apply|Apply Now)$/i.test((b.textContent || '').trim()))) as HTMLElement;
                if (btn) btn.click();
              });
            }

            try {
              await workerPage.waitForSelector('[data-testid="modal-wrapper"]', { visible: true, timeout: 8000 });
              workerLog('🎉 Modal Lamaran Glints terbuka!');
            } catch {
              workerLog(`⏩ Modal lamaran tidak terbuka setelah klik "${detailInfo.buttonText}". Melewati loker "${activeJobTitle}"...`);
              continue;
            }

            // Multi-Step Modal Questionnaire Solver Loop
            let currentStep = 1;
            const maxSteps = 15;
            let reachedFinal = false;
            let lastStepLabel = '';
            let stuckStepCount = 0;

            while (currentStep <= maxSteps && !reachedFinal) {
              if (!global.isBotRunning) break;

              await sleep(2000);

              // 0. Auto-bypass popup peringatan kriteria (Bahasa Indonesia & English)
              const warningHandled = await workerPage.evaluate(() => {
                const warningModal = document.querySelector('[class*="WarningModalContainer"], [class*="WarningModal"]') ||
                                     Array.from(document.querySelectorAll('[data-testid="modal-wrapper"]')).find(m => /Tidak memenuhi kriteria|belum sesuai|does not meet|doesn't meet|not eligible|criteria/i.test(m.textContent || ''));
                if (!warningModal) return null;

                const continueBtn = Array.from(warningModal.querySelectorAll('button')).find(b => 
                  /^(Lanjutkan|Tetap Lamar|Lanjut|Continue|Proceed|Apply anyway)$/i.test((b.textContent || '').trim())
                ) as HTMLElement;

                if (continueBtn) {
                  continueBtn.click();
                  return true;
                }
                return false;
              });

              if (warningHandled) {
                workerLog(`⚠️ Terdeteksi popup peringatan kriteria ("Profil belum sesuai / Doesn't match criteria"). Berhasil mengklik "Lanjutkan / Continue"...`);
                await sleep(2000);
                continue;
              }

              // 0b. Auto-fill Ekspektasi Gaji Bulanan (Min. & Max.) atau Resume di Step 1
              await workerPage.evaluate((targetSalary: number) => {
                const modal = document.querySelector('[data-testid="modal-wrapper"]');
                if (!modal) return;

                // 1. Native Selects jika ada
                const nativeSelects = Array.from(modal.querySelectorAll('select')) as HTMLSelectElement[];
                for (const sel of nativeSelects) {
                  if (sel.selectedIndex <= 0 && sel.options.length > 1) {
                    sel.selectedIndex = Math.min(2, sel.options.length - 1);
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                  }
                }

                // 2. Radio buttons pada step 1 jika belum terpilih
                const radios = Array.from(modal.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
                if (radios.length > 0 && !radios.some(r => r.checked)) {
                  radios[0].click();
                }
              }, config.expectedSalary || 4500000);

              // Tangani dropdown custom Glints (React-Select / Styled Select) jika ada
              try {
                const customSelectContainers = await workerPage.$$('[data-testid="modal-wrapper"] [class*="control"], [data-testid="modal-wrapper"] [class*="SelectContainer"], [data-testid="modal-wrapper"] [class*="Dropdown"]');
                for (const selEl of customSelectContainers) {
                  const currentText = await selEl.evaluate((el: Element) => el.textContent || '');
                  if (/pilih|select|min|max|rentang|rp/i.test(currentText)) {
                    await selEl.click();
                    await sleep(300);
                    const opt = await workerPage.$('[class*="option"], [class*="Option"], [role="option"]');
                    if (opt) await opt.click();
                    await sleep(300);
                  }
                }
              } catch (e) {}

              // Baca step & pertanyaan modal
              const stepData = await workerPage.evaluate(() => {
                const modal = document.querySelector('[data-testid="modal-wrapper"]');
                if (!modal) return null;

                const stepLabel = modal.querySelector('[class*="ProgressBarLabel"]')?.textContent?.trim() || `${currentStep}/?`;
                const headerTitle = modal.querySelector('[class*="ModalHeader"] [class*="Typography"]')?.textContent?.trim() || '';
                const resumeName = modal.querySelector('[class*="ResumeFileName"]')?.textContent?.trim() || '';

                const questions: Array<{
                  inputName: string;
                  question: string;
                  type: 'radiobutton' | 'checklist' | 'dropdown' | 'text';
                  options: string[];
                }> = [];

                // Matrix Sub-Questions (contoh: Skill Proficiency Matrix, Industry Matrix)
                const subQuestionContainers = Array.from(modal.querySelectorAll(
                  'div[class*="SingleChoiceWithSubQuestionsFormsc__QuestionContainer"], div[class*="QuestionContainer-sc"]'
                ));

                if (subQuestionContainers.length > 0) {
                  const parentHeader = modal.querySelector('div[class*="SingleChoiceWithSubQuestionsForm"] > p, [class*="ModalContent"] > div > p')?.textContent?.trim() || 'Keahlian';
                  for (const subContainer of subQuestionContainers) {
                    const subTitle = subContainer.querySelector('p')?.textContent?.trim() || '';
                    const radios = Array.from(subContainer.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
                    if (radios.length > 0) {
                      const inputName = radios[0].name || '';
                      const options: string[] = [];
                      for (const rd of radios) {
                        const labelWrapper = rd.closest('label') || rd.parentElement;
                        const optText = (labelWrapper?.textContent || rd.value || '').trim();
                        if (optText && !options.includes(optText)) {
                          options.push(optText);
                        }
                      }
                      questions.push({
                        inputName,
                        question: subTitle ? `${parentHeader} - ${subTitle}` : parentHeader,
                        type: 'radiobutton',
                        options
                      });
                    }
                  }
                } else {
                  // Single Question Radio Groups
                  const radios = Array.from(modal.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
                  if (radios.length > 0) {
                    const questionEl = modal.querySelector('div[class*="SingleChoiceWithoutSubQuestionsForm"] p, [class*="ModalContent"] p');
                    const questionText = questionEl?.textContent?.trim() || 'Pertanyaan Pilihan Tunggal';
                    const inputName = radios[0].name || '';

                    const options: string[] = [];
                    for (const rd of radios) {
                      const labelWrapper = rd.closest('label') || rd.parentElement;
                      const optText = (labelWrapper?.textContent || rd.value || '').trim();
                      if (optText && !options.includes(optText)) {
                        options.push(optText);
                      }
                    }

                    if (options.length > 0) {
                      questions.push({
                        inputName,
                        question: questionText,
                        type: 'radiobutton',
                        options
                      });
                    }
                  }
                }

                // Checkbox Groups (Multi Choice)
                const checkboxes = Array.from(modal.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
                if (checkboxes.length > 0) {
                  const questionEl = modal.querySelector('[class*="ModalContent"] p');
                  const questionText = questionEl?.textContent?.trim() || 'Pertanyaan Pilihan Ganda';

                  const options: string[] = [];
                  for (const cb of checkboxes) {
                    const labelWrapper = cb.closest('label') || cb.parentElement;
                    const optText = (labelWrapper?.textContent || cb.value || '').trim();
                    if (optText && !options.includes(optText)) {
                      options.push(optText);
                    }
                  }

                  if (options.length > 0) {
                    questions.push({
                      inputName: checkboxes[0].name || '',
                      question: questionText,
                      type: 'checklist',
                      options
                    });
                  }
                }

                // Free Text & Numeric Questions (Textarea atau Text/Number Input, contoh: GPA/IPK, Expected Salary, Link Portofolio)
                const textareas = Array.from(modal.querySelectorAll('textarea, input[type="text"]:not([data-cy*="search"]), input[type="number"], input[inputmode="numeric"]')) as (HTMLTextAreaElement | HTMLInputElement)[];
                if (textareas.length > 0) {
                  for (const txtArea of textareas) {
                    const formContainer = txtArea.closest('div[class*="CustomPlainTextQuestionForm"], div[class*="FormContainer"], [class*="ModalContent"]');
                    const qEl = formContainer?.querySelector('p') || modal.querySelector('[class*="ModalContent"] p');
                    const questionText = qEl?.textContent?.trim() || 'Pertanyaan Isian';
                    const inputName = txtArea.name || '';

                    questions.push({
                      inputName,
                      question: questionText,
                      type: 'text',
                      options: []
                    });
                  }
                }

                const submitBtn = modal.querySelector('button[data-testid="apply-submit"]') as HTMLButtonElement;
                const nextBtn = (submitBtn || modal.querySelector('button[data-testid="apply-next-step"]')) as HTMLButtonElement;
                const nextBtnText = nextBtn ? (nextBtn.textContent || '').trim() : '';
                const isSubmit = !!submitBtn || /^(Kirim|Kirim Lamaran|Submit|Submit Application|Send Application|Confirm)$/i.test(nextBtnText);
                const isDisabled = nextBtn ? (nextBtn.disabled || nextBtn.getAttribute('aria-disabled') === 'true') : true;

                return {
                  stepLabel,
                  headerTitle,
                  resumeName,
                  questions,
                  hasNextBtn: !!nextBtn,
                  nextBtnText,
                  isSubmit,
                  isDisabled
                };
              });

              if (!stepData) {
                workerLog('🏁 Modal lamaran ditutup atau selesai.');
                reachedFinal = true;
                break;
              }

              if (stepData.stepLabel === lastStepLabel) {
                stuckStepCount++;
                if (stuckStepCount === 2) {
                  workerLog(`🤖 [AI Inspector] Mendeteksi step modal tertahan di "${stepData.stepLabel}". Memanggil AI untuk menginspeksi DOM form...`);
                  try {
                    const snapshot = await captureFormDomSnapshot(workerPage, '[data-testid="modal-wrapper"]');
                    if (snapshot.htmlSnippet) {
                      const profileContext = `Nama: ${config.fullName || ''}, Gaji Diharapkan: Rp ${config.expectedSalary || 4500000}, Pendidikan: ${config.educationLevel || ''}, Pengalaman: ${config.yearsOfExperience || 1} thn, Skills: ${config.skills || ''}`;
                      const plan = await inspectFormWithAi({
                        platform: 'Glints',
                        jobTitle: activeJobTitle,
                        company: activeCompanyName,
                        candidateProfileContext: profileContext,
                        domSnippet: snapshot.htmlSnippet,
                        stepHint: stepData.stepLabel
                      });
                      if (plan) {
                        await applyAiFormActions(workerPage, plan, (msg) => workerLog(msg));
                        await sleep(1500);
                      }
                    }
                  } catch (aiErr: any) {
                    workerLog(`⚠️ AI Inspector error: ${aiErr?.message || aiErr}`);
                  }
                } else if (stuckStepCount >= 4) {
                  workerLog(`⚠️ Modal tidak berpindah dari step ${stepData.stepLabel} setelah 4 kali percobaan. Melewati loker ini...`);
                  break;
                }
              } else {
                stuckStepCount = 0;
                lastStepLabel = stepData.stepLabel;
              }

              workerLog(`📍 Progres Modal: Step ${stepData.stepLabel}`);

              // 1. Auto-fill Ekspektasi Gaji (Dukungan penuh untuk Button Dropdown Popover Glints)
              try {
                const salaryHandled = await workerPage.evaluate(async (userSalary: number) => {
                  const modal = document.querySelector('[data-testid="modal-wrapper"]') || document.body;
                  const minBtn = modal.querySelector('button[name="salaryExpectation"]') as HTMLButtonElement;
                  const maxBtn = modal.querySelector('button[name="maxSalaryExpectation"]') as HTMLButtonElement;

                  if (!minBtn && !maxBtn) return false;

                  const targetSalary = userSalary || 4500000;
                  const targetMaxSalary = Math.round(targetSalary * 1.25);

                  // Helper untuk memilih opsi dalam popover yang sedang terbuka
                  const pickOptionFromPopover = (targetNum: number) => {
                    const popovers = Array.from(document.querySelectorAll('[id^="popover-"], [role="listbox"], [class*="Popover"], [class*="SelectDropdown"], [class*="MenuList"]'));
                    const activePopover = popovers[popovers.length - 1]; // Popover terbaru
                    if (!activePopover) return false;

                    const options = Array.from(activePopover.querySelectorAll('[role="option"], li, div[tabindex], button, [class*="Option"]')) as HTMLElement[];
                    if (options.length === 0) return false;

                    // Parse angka dari teks setiap opsi
                    const scored = options.map(opt => {
                      const txt = (opt.textContent || '').replace(/[^\d]/g, '');
                      const num = parseInt(txt, 10);
                      return {
                        el: opt,
                        num: isNaN(num) ? 0 : num,
                        text: opt.textContent || ''
                      };
                    }).filter(item => item.num > 0);

                    if (scored.length > 0) {
                      // Cari yang paling mendekati targetNum
                      scored.sort((a, b) => Math.abs(a.num - targetNum) - Math.abs(b.num - targetNum));
                      scored[0].el.click();
                      return true;
                    } else if (options.length > 2) {
                      // Fallback: pilih opsi tengah
                      options[Math.floor(options.length / 2)].click();
                      return true;
                    }
                    return false;
                  };

                  // A. Klik dan pilih Min Salary
                  if (minBtn && (minBtn.textContent || '').includes('Min.')) {
                    minBtn.click();
                    await new Promise(r => setTimeout(r, 400));
                    pickOptionFromPopover(targetSalary);
                    await new Promise(r => setTimeout(r, 400));
                  }

                  // B. Klik dan pilih Max Salary
                  if (maxBtn && (maxBtn.textContent || '').includes('Max.')) {
                    maxBtn.click();
                    await new Promise(r => setTimeout(r, 400));
                    pickOptionFromPopover(targetMaxSalary);
                    await new Promise(r => setTimeout(r, 400));
                  }

                  return true;
                }, config.expectedSalary || 4500000);

                if (salaryHandled) {
                  workerLog(`💰 [Ekspektasi Gaji] Dropdown Min & Max gaji Glints berhasil dipilih sesuai profil (Rp ${config.expectedSalary || 4500000})!`);
                  await sleep(800);
                }
              } catch (salaryErr: any) {
                // abaikan jika gagal
              }

              // Fallback input teks/numeric biasa jika bukan dropdown
              await workerPage.evaluate((userSalary: number) => {
                const modal = document.querySelector('[data-testid="modal-wrapper"]');
                if (!modal) return;

                const setVal = (el: HTMLInputElement, val: string) => {
                  el.focus();
                  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                  if (nativeSetter) {
                    nativeSetter.call(el, val);
                  } else {
                    el.value = val;
                  }
                  el.dispatchEvent(new Event('input', { bubbles: true }));
                  el.dispatchEvent(new Event('change', { bubbles: true }));
                  el.dispatchEvent(new Event('blur', { bubbles: true }));
                };

                const salaryNum = userSalary || 4500000;
                const minInputs = Array.from(modal.querySelectorAll('input[name*="min" i], input[placeholder*="Min" i], input[aria-label*="Min" i]')) as HTMLInputElement[];
                const maxInputs = Array.from(modal.querySelectorAll('input[name*="max" i], input[placeholder*="Max" i], input[aria-label*="Max" i]')) as HTMLInputElement[];
                const allNumInputs = Array.from(modal.querySelectorAll('input[type="number"], input[inputmode="numeric"]')) as HTMLInputElement[];
                const isSalaryContext = /gaji|salary|ekspektasi/i.test(modal.textContent || '');

                if (minInputs.length > 0) {
                  minInputs.forEach(inp => { if (!inp.value) setVal(inp, String(salaryNum)); });
                }
                if (maxInputs.length > 0) {
                  maxInputs.forEach(inp => { if (!inp.value) setVal(inp, String(Math.round(salaryNum * 1.25))); });
                }
                if (isSalaryContext && allNumInputs.length > 0) {
                  if (allNumInputs.length === 1 && !allNumInputs[0].value) {
                    setVal(allNumInputs[0], String(salaryNum));
                  } else if (allNumInputs.length >= 2) {
                    if (!allNumInputs[0].value) setVal(allNumInputs[0], String(salaryNum));
                    if (!allNumInputs[1].value) setVal(allNumInputs[1], String(Math.round(salaryNum * 1.25)));
                  }
                }
              }, config.expectedSalary || 4500000);

              // 2. Pastikan CV/Resume terpilih (terutama pada step 1 awal)
              const resumeSelected = await workerPage.evaluate(() => {
                const modal = document.querySelector('[data-testid="modal-wrapper"]');
                if (!modal) return false;

                // A. Cek radio button native
                const resumeRadios = Array.from(modal.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
                const checkedRadio = resumeRadios.find(r => r.checked);
                if (checkedRadio) return true;

                if (resumeRadios.length > 0) {
                  const firstRadio = resumeRadios[0];
                  const label = firstRadio.closest('label') || firstRadio.parentElement || firstRadio;
                  (label as HTMLElement).click();
                  firstRadio.checked = true;
                  firstRadio.dispatchEvent(new Event('change', { bubbles: true }));
                  return true;
                }

                // B. Cek Card Resume Kustom Glints (div/button dengan aria-checked atau class selected)
                const resumeCards = Array.from(modal.querySelectorAll(
                  '[data-testid*="resume" i], [class*="ResumeCard" i], [class*="ResumeItem" i], [class*="ResumeContainer" i], [data-testid*="cv" i]'
                )) as HTMLElement[];

                if (resumeCards.length > 0) {
                  const alreadyActive = resumeCards.find(c => 
                    c.getAttribute('aria-checked') === 'true' || 
                    c.classList.contains('active') || 
                    c.classList.contains('selected') ||
                    c.querySelector('[aria-checked="true"], [class*="selected"], [class*="active"]')
                  );
                  if (alreadyActive) return true;

                  // Klik card resume pertama
                  const targetCard = resumeCards[0];
                  targetCard.click();
                  return true;
                }

                // C. Cek elemen yang menampilkan nama file .pdf / nama resume
                const pdfElements = Array.from(modal.querySelectorAll('div, p, span')).filter(el => 
                  /\.pdf$/i.test((el.textContent || '').trim()) || /resume|curriculum vitae/i.test((el.textContent || '').trim())
                ) as HTMLElement[];
                if (pdfElements.length > 0) {
                  const clickable = pdfElements[0].closest('div[role="button"], div[tabindex], label') as HTMLElement;
                  if (clickable) {
                    clickable.click();
                    return true;
                  }
                }

                return false;
              });

              if (resumeSelected) {
                workerLog('📄 [CV/Resume] Memastikan CV utama aktif dan terpilih.');
              }

              // Jawab pertanyaan pada step ini
              if (stepData.questions.length > 0) {
                for (const qItem of stepData.questions) {
                  workerLog(`📋 Pertanyaan (${qItem.type.toUpperCase()}): "${qItem.question}"`);
                  if (qItem.options.length > 0) {
                    workerLog(`   Opsi: [${qItem.options.join(' | ')}]`);
                  }

                  let chosenAnswers: string[] = [];

                  // Cek apakah pertanyaan adalah Cover Letter / Surat Pengantar
                  const isCoverLetterQuestion = /(cover letter|surat pengantar|why should we hire you|mengapa kami harus|motivation|alasan melamar)/i.test(qItem.question);
                  if (isCoverLetterQuestion && config.enableCoverLetterGen) {
                    workerLog(`✍️ [AI Cover Letter] Membuat surat pengantar khusus untuk "${activeCompanyName}"...`);
                    const letter = await generateDynamicCoverLetter({
                      jobTitle: activeJobTitle,
                      company: activeCompanyName,
                      preferredLanguage: 'id'
                    });
                    chosenAnswers = [letter];
                  } else {
                    chosenAnswers = await answerQuestion(qItem.question, qItem.options, qItem.type as any);
                  }

                  workerLog(`🤖 Keputusan Jawaban: [${chosenAnswers.join(' | ')}]`);
                  appendQuestionToCsv(qItem.question, qItem.type as any, qItem.options, chosenAnswers);

                  // Terapkan pilihan ke DOM Glints
                  await workerPage.evaluate((targetQ: any, answers: string[]) => {
                    const modal = document.querySelector('[data-testid="modal-wrapper"]');
                    if (!modal) return;

                    if (targetQ.type === 'radiobutton' && answers.length > 0) {
                      const targetAnswer = answers[0];
                      const radioInputs = targetQ.inputName 
                        ? Array.from(modal.querySelectorAll(`input[type="radio"][name="${targetQ.inputName}"]`)) as HTMLInputElement[]
                        : Array.from(modal.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];

                      for (const rd of radioInputs) {
                        const lbl = rd.closest('label') || rd.parentElement;
                        const txt = (lbl?.textContent || rd.value || '').trim();
                        if (txt === targetAnswer || txt.toLowerCase().includes(targetAnswer.toLowerCase()) || targetAnswer.toLowerCase().includes(txt.toLowerCase())) {
                          (lbl || rd).click();
                          rd.checked = true;
                          rd.dispatchEvent(new Event('change', { bubbles: true }));
                          break;
                        }
                      }
                    } else if (targetQ.type === 'checklist') {
                      const labels = Array.from(modal.querySelectorAll('label'));
                      for (const lbl of labels) {
                        const txt = (lbl.textContent || '').trim();
                        const shouldCheck = answers.some(ans => txt === ans || txt.includes(ans));
                        const cbInput = lbl.querySelector('input[type="checkbox"]') as HTMLInputElement;
                        if (cbInput && shouldCheck !== cbInput.checked) {
                          lbl.click();
                        }
                      }
                    } else if (targetQ.type === 'text' && answers.length > 0) {
                      const targetAnswer = answers[0];
                      const txtInput = (targetQ.inputName
                        ? modal.querySelector(`textarea[name="${targetQ.inputName}"], input[name="${targetQ.inputName}"]`)
                        : modal.querySelector('textarea, input[type="text"]')) as (HTMLTextAreaElement | HTMLInputElement);

                      if (txtInput) {
                        txtInput.focus();
                        const nativeTextAreaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
                        const nativeInputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;

                        if (txtInput instanceof HTMLTextAreaElement && nativeTextAreaSetter) {
                          nativeTextAreaSetter.call(txtInput, targetAnswer);
                        } else if (txtInput instanceof HTMLInputElement && nativeInputSetter) {
                          nativeInputSetter.call(txtInput, targetAnswer);
                        } else {
                          txtInput.value = targetAnswer;
                        }

                        // Dispatch complete suite of React input/change events
                        txtInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                        txtInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                        try {
                          txtInput.dispatchEvent(new InputEvent('input', { bubbles: true, data: targetAnswer }));
                        } catch {}
                        txtInput.blur();
                      }
                    }
                  }, qItem, chosenAnswers);

                  await sleep(1000);
                }
              }

              // Cek apakah step terakhir
              const isLastStepIndicator = /^(\d+)\/\1$/.test(stepData.stepLabel.replace(/\s+/g, ''));
              if (stepData.isSubmit || isLastStepIndicator) {
                if (config.debugTest) {
                  workerLog(`🏁 [DEBUG MODE] Seluruh pertanyaan (${stepData.stepLabel}) selesai diisi. Tombol "Kirim" terdeteksi.`);
                  workerLog(`   🛡️ Simulasi berhasil (Lamaran tidak dikirim ke server).`);

                  // 1. Klik tombol X (Close)
                  await workerPage.evaluate(() => {
                    const closeBtn = document.querySelector('button[data-testid="modal-close-btn"]') as HTMLElement;
                    if (closeBtn) closeBtn.click();
                  });
                  await sleep(800);

                  // 2. Klik konfirmasi popup "Hapus Lamaran Pekerjaanmu? -> Batalkan tanpa menyimpan"
                  await workerPage.evaluate(() => {
                    const confirmModal = document.querySelector('[class*="CloseModalConfirmation"], [class*="ModalContainer"]') || document.body;
                    const discardBtn = Array.from(confirmModal.querySelectorAll('button')).find(b => 
                      /^(Batalkan tanpa menyimpan|Batalkan|Discard without saving|Discard)$/i.test((b.textContent || '').trim())
                    ) as HTMLElement;
                    if (discardBtn) discardBtn.click();
                  });
                  await sleep(800);

                  await addAppliedJob({
                    company: activeCompanyName,
                    title: activeJobTitle,
                    platform: 'Glints',
                    jobUrl: targetJob.url,
                    status: 'Dry-run Sim'
                  });

                  workerLog(`📝 [Dry-run Sim] Data simulasi "${activeCompanyName}" (${activeJobTitle}) dicatat ke Google Sheets!`);
                  successCount++;
                  if (sharedLimiter) sharedLimiter.onJobSuccess();
                  reachedFinal = true;
                  break;
                } else {
                  workerLog(`🚀 Mengirim Lamaran Glints ("${stepData.nextBtnText}")...`);
                  await workerPage.evaluate(() => {
                    const submitBtn = (document.querySelector('button[data-testid="apply-submit"]') ||
                                       document.querySelector('button[data-testid="apply-next-step"]')) as HTMLElement;
                    if (submitBtn) submitBtn.click();
                  });
                  await sleep(3000);

                  await addAppliedJob({
                    company: activeCompanyName,
                    title: activeJobTitle,
                    platform: 'Glints',
                    jobUrl: targetJob.url,
                    status: 'Applied'
                  });

                  workerLog(`🎉 Lamaran ke "${activeCompanyName}" (${activeJobTitle}) berhasil dikirim & disimpan ke Google Sheets!`);
                  successCount++;
                  if (sharedLimiter) sharedLimiter.onJobSuccess();
                  reachedFinal = true;
                  break;
                }
              }

              // Klik Selanjutnya dengan deteksi validasi form
              const clickStatus = await workerPage.evaluate(() => {
                const modal = document.querySelector('[data-testid="modal-wrapper"]') || document.body;
                const nextBtn = (modal.querySelector('button[data-testid="apply-next-step"]') ||
                                 modal.querySelector('button[data-testid="apply-submit"]')) as HTMLButtonElement;
                if (!nextBtn) return { found: false, disabled: true, text: '' };

                const disabled = nextBtn.disabled || nextBtn.getAttribute('aria-disabled') === 'true';

                // Jika masih disabled, coba centang checkbox atau cari input kosong yang terlewat
                if (disabled) {
                  // Cek apakah ada checkbox persetujuan yang belum dicentang
                  const uncheckedBoxes = Array.from(modal.querySelectorAll('input[type="checkbox"]:not(:checked)')) as HTMLInputElement[];
                  for (const cb of uncheckedBoxes) {
                    const lbl = cb.closest('label') || cb.parentElement;
                    (lbl || cb).click();
                    cb.checked = true;
                    cb.dispatchEvent(new Event('change', { bubbles: true }));
                  }
                }

                return {
                  found: true,
                  disabled: nextBtn.disabled || nextBtn.getAttribute('aria-disabled') === 'true',
                  text: (nextBtn.textContent || '').trim()
                };
              });

              workerLog(`👉 Mengklik tombol "${clickStatus.text || stepData.nextBtnText || 'Selanjutnya'}" (Status: ${clickStatus.disabled ? 'Terkunci/Disabled' : 'Siap Klik'})...`);

              try {
                // Coba gunakan Puppeteer ElementHandle click agar event sintetis React terpicu sempurna
                const nextBtnHandle = await workerPage.$('button[data-testid="apply-next-step"], button[data-testid="apply-submit"]');
                if (nextBtnHandle) {
                  await nextBtnHandle.click();
                } else {
                  await workerPage.evaluate(() => {
                    const btn = document.querySelector('button[data-testid="apply-next-step"], button[data-testid="apply-submit"]') as HTMLElement;
                    if (btn) btn.click();
                  });
                }
              } catch (e) {
                await workerPage.evaluate(() => {
                  const btn = document.querySelector('button[data-testid="apply-next-step"], button[data-testid="apply-submit"]') as HTMLElement;
                  if (btn) btn.click();
                });
              }

              await sleep(3000);
              currentStep++;
            }

            await sleep(1000);
          } catch (jobErr: any) {
            workerLog(`❌ Terjadi error saat memproses loker "${targetJob.title}": ${jobErr.message || jobErr}`);
            errorCount++;
          }
        }

        try {
          await workerPage.close();
        } catch {}
      });

      await Promise.all(workerPromises);
      currentPage++;
    }
  } catch (err: any) {
    onLog(`❌ Terjadi kesalahan pada alur pencarian Glints: ${err.message || err}`);
  }

  return { successCount, alreadyAppliedCount, errorCount };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

