/**
 * CV Blaster - Indeed Auto-Apply Content Script
 * Executes directly inside user's authentic desktop Chrome session,
 * completely bypassing Cloudflare Turnstile & bot detection.
 * 
 * Functions:
 * 1. Extract job details (title, company, location, salary)
 * 2. Automated multi-step application form navigation
 * 3. Extract job URLs from Indeed search pages for 4-tab concurrency queue
 */

(function () {
  if (window.__cvBlasterIndeedLoaded) return;
  window.__cvBlasterIndeedLoaded = true;

  console.log('[CV Blaster] Indeed Auto-Apply Content Script ready.');

  function cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').replace(/[\n\r\t]+/g, ' ').trim();
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Extract job details on current page
  window.cvBlasterGetIndeedJobDetails = function () {
    let title = '';
    const titleEl = document.querySelector('h1[class*="JobInfoHeader-title"], h1.jobsearch-JobInfoHeader-title, h1[data-testid="jobsearch-JobInfoHeader-title"], h2.jobTitle');
    if (titleEl) title = cleanText(titleEl.innerText);
    if (!title) {
      const match = document.title.match(/^([^|\-–]+)/);
      if (match) title = cleanText(match[1]);
    }

    let company = '';
    const compEl = document.querySelector('[data-testid="inlineHeader-companyName"], div[data-company-name="true"], a[data-testid="inlineHeader-companyName"], span.css-1saafaq');
    if (compEl) company = cleanText(compEl.innerText);

    let location = 'Indonesia';
    const locEl = document.querySelector('[data-testid="inlineHeader-companyLocation"], div.css-6z8oev, div[data-testid="job-location"]');
    if (locEl) location = cleanText(locEl.innerText);

    let salary = '';
    const salEl = document.querySelector('#salaryInfoAndJobType, [data-testid="attribute_snippets_salary"], span.css-2iqe2o');
    if (salEl) salary = cleanText(salEl.innerText);

    const jobUrl = window.location.href.split('&')[0];

    return {
      title: title || 'Lowongan Indeed',
      company: company || 'Perusahaan Indeed',
      location,
      salary,
      jobUrl,
      platform: 'indeed'
    };
  };

  // Find Indeed "Apply now" button (Instant apply vs external site)
  window.cvBlasterFindIndeedApplyButton = function () {
    // 1. Direct ID or data-testid
    const directBtn = document.querySelector('button#indeedApplyButton, [data-testid="indeedApplyButton"], button[class*="indeed-apply-button"]');
    if (directBtn) return { btn: directBtn, isEasyApply: true };

    // 2. Buttons by text
    const allButtons = Array.from(document.querySelectorAll('button, a[role="button"]'));
    for (const b of allButtons) {
      const text = (b.innerText || '').toLowerCase();
      if (text.includes('lamar sekarang') || text.includes('apply now')) {
        return { btn: b, isEasyApply: true };
      }
      if (text.includes('lamar di situs perusahaan') || text.includes('apply on company site')) {
        return { btn: b, isEasyApply: false };
      }
    }

    return null;
  };

  // Comprehensive job cards extractor from Search pages, Home feed, and SmartApply feeds
  window.cvBlasterExtractIndeedJobCards = function () {
    const cards = [];
    const seenJks = new Set();

    function extractJk(el, href) {
      if (el && el.getAttribute('data-jk')) return el.getAttribute('data-jk');
      const parentWithJk = el ? el.closest('[data-jk]') : null;
      if (parentWithJk) return parentWithJk.getAttribute('data-jk');
      if (href) {
        const m1 = href.match(/jk=([a-zA-Z0-9]+)/);
        if (m1) return m1[1];
        const m2 = href.match(/\/viewjob\?.*?jk=([a-zA-Z0-9]+)/);
        if (m2) return m2[1];
        const m3 = href.match(/\/rc\/clk\?.*?jk=([a-zA-Z0-9]+)/);
        if (m3) return m3[1];
      }
      return null;
    }

    // 1. Query all job card containers (supports feed, search, smart apply)
    const cardElements = document.querySelectorAll(
      'div.job_seen_beacon, div.cardOutline, div[data-testid="jobsearch-FeedJobCard"], ' +
      'div.slider_item, li.css-5lfssm, [data-jk], [data-mobtk], div[role="region"] div.cardOutline'
    );

    cardElements.forEach(card => {
      const titleEl = card.querySelector('h2.jobTitle, a.jcs-JobTitle, a[id^="job_"], span[id^="jobTitle"], [data-testid="job-title"]');
      const linkEl = card.querySelector('a.jcs-JobTitle, a[id^="job_"], a[href*="/viewjob"], a[href*="/rc/clk"], a[href*="jk="]');
      const compEl = card.querySelector('[data-testid="company-name"], span.css-1saafaq, div.company_location [data-testid="company-name"], [class*="companyName"], span.companyName');
      const locEl = card.querySelector('[data-testid="text-location"], div.css-6z8oev, [class*="companyLocation"], div.companyLocation');
      
      const cardText = card.innerText || '';
      const isEasyApply = cardText.includes('Lamar dengan mudah') || 
                          cardText.includes('Lamar dengan Indeed') || 
                          cardText.includes('Easily apply') || 
                          cardText.includes('Apply with Indeed') ||
                          !!card.querySelector('[data-testid="indeedApply"], [class*="indeedApply"]');

      const href = linkEl ? linkEl.href : '';
      const jk = extractJk(card, href) || extractJk(linkEl, href);

      if (jk && !seenJks.has(jk)) {
        seenJks.add(jk);
        const title = titleEl ? cleanText(titleEl.innerText) : (linkEl ? cleanText(linkEl.innerText) : 'Lowongan Indeed');
        const company = compEl ? cleanText(compEl.innerText) : '';
        const location = locEl ? cleanText(locEl.innerText) : '';

        cards.push({
          jk,
          title,
          company,
          location,
          isEasyApply,
          url: `https://id.indeed.com/viewjob?jk=${jk}`
        });
      }
    });

    // 2. Fallback: scan all anchor links with jk or /viewjob
    if (cards.length === 0) {
      const allLinks = document.querySelectorAll('a[href*="jk="], a[href*="/viewjob"], a[href*="/rc/clk"]');
      allLinks.forEach(a => {
        const jk = extractJk(a, a.href);
        if (jk && !seenJks.has(jk)) {
          seenJks.add(jk);
          const parent = a.closest('div, li, tr') || a;
          const parentText = parent.innerText || '';
          cards.push({
            jk,
            title: cleanText(a.innerText) || 'Lowongan Indeed',
            company: '',
            location: '',
            isEasyApply: parentText.includes('Lamar dengan mudah') || parentText.includes('Easily apply'),
            url: `https://id.indeed.com/viewjob?jk=${jk}`
          });
        }
      });
    }

    return cards;
  };

  // Extract job links from an Indeed search page or feed
  window.cvBlasterExtractIndeedSearchUrls = function () {
    const cards = window.cvBlasterExtractIndeedJobCards();
    return cards.map(c => c.url);
  };

  // Step-by-step form filler for Indeed application modal
  async function fillIndeedFormSteps(userConfig) {
    chrome.runtime.sendMessage({
      action: 'TASK_PROGRESS',
      message: 'Mencari formulir lamaran Indeed...'
    }).catch(() => {});

    let maxSteps = 12;
    let stepCount = 0;
    const recordedQA = [];

    while (stepCount < maxSteps) {
      stepCount++;
      await sleep(1500);

      // Check for success / confirmation
      const pageText = document.body.innerText.toLowerCase();
      if (
        pageText.includes('lamaran anda telah dikirim') ||
        pageText.includes('your application has been submitted') ||
        pageText.includes('application submitted') ||
        pageText.includes('lamaran terkirim')
      ) {
        return { success: true, status: 'Applied Successfully', questionsAndAnswers: recordedQA };
      }

      // Check if inside iframe
      const iframes = document.querySelectorAll('iframe');
      let targetDoc = document;
      for (const f of iframes) {
        try {
          if (f.contentDocument && f.contentDocument.querySelector('input, button')) {
            targetDoc = f.contentDocument;
            break;
          }
        } catch {}
      }

      // Native React/Framework value setter with human jitter typing
      async function setNativeInputValue(element, value) {
        if (!element || value === undefined || value === null) return;
        try {
          element.focus();
          const strVal = String(value);
          const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
          const prototype = Object.getPrototypeOf(element);
          const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

          const applyVal = (v) => {
            if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
              prototypeValueSetter.call(element, v);
            } else if (valueSetter) {
              valueSetter.call(element, v);
            } else {
              element.value = v;
            }
            element.dispatchEvent(new Event('input', { bubbles: true }));
          };

          // Keystroke jitter typing simulation (40-80ms per character) for natural entry
          if (strVal.length > 0 && strVal.length <= 40) {
            applyVal('');
            for (let i = 0; i < strVal.length; i++) {
              applyVal(strVal.slice(0, i + 1));
              const delay = 40 + Math.floor(Math.random() * 45);
              await sleep(delay);
            }
          } else {
            applyVal(strVal);
          }

          element.dispatchEvent(new Event('change', { bubbles: true }));
          element.blur();
        } catch {
          element.value = String(value);
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      // 1. Fill Text Inputs (Name, Email, Phone, Expected Salary) with human typing
      const inputs = Array.from(targetDoc.querySelectorAll('input[type="text"], input[type="tel"], input[type="email"], input[type="number"], textarea'));
      for (const inp of inputs) {
        const nameAttr = (inp.name || inp.id || inp.getAttribute('aria-label') || '').toLowerCase();
        const labelEl = inp.closest('label') || targetDoc.querySelector(`label[for="${inp.id}"]`);
        const labelText = (labelEl ? labelEl.innerText : '').toLowerCase();
        const combined = `${nameAttr} ${labelText}`;

        if (!inp.value || inp.value.trim() === '') {
          let chosenVal = '';
          if (combined.includes('name') || combined.includes('nama')) {
            chosenVal = userConfig.fullName || 'Pelamar';
          } else if (combined.includes('phone') || combined.includes('telepon') || combined.includes('hp') || combined.includes('whatsapp')) {
            chosenVal = userConfig.phoneNumber || '08123456789';
          } else if (combined.includes('gaji') || combined.includes('salary') || combined.includes('ekspektasi')) {
            chosenVal = userConfig.expectedSalary || '4500000';
          } else if (combined.includes('tahun') || combined.includes('year') || combined.includes('pengalaman') || combined.includes('experience')) {
            chosenVal = userConfig.experienceYears ? String(userConfig.experienceYears) : '3';
          } else if (combined.includes('lokasi') || combined.includes('kota') || combined.includes('city')) {
            chosenVal = userConfig.location || 'Indonesia';
          }

          if (chosenVal) {
            await setNativeInputValue(inp, chosenVal);
            recordedQA.push({
              question: (labelEl?.innerText || inp.getAttribute('aria-label') || inp.placeholder || inp.name || 'Input').trim(),
              answer: chosenVal,
              type: inp.type || 'text'
            });
          }
        }
      }

      // Select Dropdowns (Pendidikan, Pengalaman, Status)
      const selects = targetDoc.querySelectorAll('select');
      selects.forEach((sel) => {
        if (!sel.value || sel.selectedIndex <= 0) {
          const selText = ((sel.name || sel.id || '') + ' ' + (sel.closest('label')?.innerText || '')).toLowerCase();
          for (let i = 1; i < sel.options.length; i++) {
            const opt = sel.options[i];
            const optText = (opt.innerText || opt.value || '').toLowerCase();
            let selectedOpt = null;
            if (selText.includes('pengalaman') || selText.includes('experience') || selText.includes('tahun')) {
              if (optText.includes('1') || optText.includes('2') || optText.includes('3') || optText.includes('ya') || optText.includes('yes')) {
                selectedOpt = opt;
              }
            } else if (selText.includes('pendidikan') || selText.includes('education')) {
              if (optText.includes('sarjana') || optText.includes('bachelor') || optText.includes('diploma') || optText.includes('s1')) {
                selectedOpt = opt;
              }
            } else if (i === 1) {
              selectedOpt = opt;
            }

            if (selectedOpt) {
              sel.selectedIndex = i;
              sel.dispatchEvent(new Event('change', { bubbles: true }));
              recordedQA.push({
                question: (sel.closest('label')?.innerText || sel.getAttribute('aria-label') || sel.name || 'Pilihan Dropdown').trim(),
                answer: (selectedOpt.innerText || selectedOpt.value || '').trim(),
                type: 'dropdown'
              });
              break;
            }
          }
        }
      });

      // 2. Select Radio buttons (Yes / Ya preferred for qualification questions)
      const radios = targetDoc.querySelectorAll('input[type="radio"]');
      const radioGroups = new Map();
      radios.forEach(r => {
        const groupName = r.name || 'default';
        if (!radioGroups.has(groupName)) radioGroups.set(groupName, []);
        radioGroups.get(groupName).push(r);
      });

      radioGroups.forEach((groupRadios) => {
        const hasChecked = groupRadios.some(r => r.checked);
        if (!hasChecked) {
          // Prefer 'Ya' or 'Yes'
          const yesRadio = groupRadios.find(r => {
            const lbl = (r.closest('label')?.innerText || r.value || '').toLowerCase();
            return lbl.includes('ya') || lbl.includes('yes');
          });
          const chosenRadio = yesRadio || groupRadios[0];
          if (chosenRadio) {
            chosenRadio.click();
            chosenRadio.dispatchEvent(new Event('change', { bubbles: true }));
            const labelText = (chosenRadio.closest('label')?.innerText || chosenRadio.value || 'Pilihan').trim();
            const groupTitle = chosenRadio.closest('fieldset')?.querySelector('legend')?.innerText ||
                               chosenRadio.name || 'Pertanyaan Kualifikasi';
            recordedQA.push({
              question: groupTitle.trim(),
              answer: labelText,
              type: 'radiobutton'
            });
          }
        }
      });

      // 3. Find navigation buttons (Continue, Review, Submit)
      const buttons = Array.from(targetDoc.querySelectorAll('button, input[type="submit"]'));
      let submitBtn = null;
      let continueBtn = null;

      for (const btn of buttons) {
        const txt = (btn.innerText || btn.value || '').toLowerCase();
        if (txt.includes('kirim lamaran') || txt.includes('submit your application') || txt.includes('submit application')) {
          submitBtn = btn;
          break;
        }
        if (txt.includes('lanjutkan') || txt.includes('continue') || txt.includes('tinjau') || txt.includes('review') || txt.includes('berikutnya') || txt.includes('next')) {
          continueBtn = btn;
        }
      }

      if (submitBtn) {
        if (userConfig.autoApplyMode === 'review') {
          chrome.runtime.sendMessage({
            action: 'TASK_PROGRESS',
            message: '🔔 [Copilot] Formulir terisi lengkap! Silakan tinjau dan klik Kirim Lamaran.'
          }).catch(() => {});
          if (typeof window.cvBlasterFloatToast === 'function') {
            window.cvBlasterFloatToast('Formulir siap! Silakan tinjau dan klik Kirim.', 'info');
          }
          return { success: true, status: 'Ready for Review (Copilot Mode)', questionsAndAnswers: recordedQA };
        }

        chrome.runtime.sendMessage({
          action: 'TASK_PROGRESS',
          message: 'Mengklik tombol Kirim Lamaran...'
        }).catch(() => {});
        submitBtn.click();
        await sleep(2500);
        return { success: true, status: 'Application Submitted', questionsAndAnswers: recordedQA };
      }

      if (continueBtn) {
        chrome.runtime.sendMessage({
          action: 'TASK_PROGRESS',
          message: `Melanjutkan langkah formulir (${stepCount})...`
        }).catch(() => {});
        continueBtn.click();
        await sleep(1500);
      } else {
        // No continue button found, could be waiting or finished
        break;
      }
    }

    return { success: true, status: 'Form completed or manual review required', questionsAndAnswers: recordedQA };
  }

  // Auto-apply orchestrator for single job page
  window.cvBlasterExecuteIndeedApply = async function (userConfig = {}) {
    try {
      const jobDetails = window.cvBlasterGetIndeedJobDetails();
      const applyBtnInfo = window.cvBlasterFindIndeedApplyButton();

      if (!applyBtnInfo) {
        return { success: false, error: 'Tombol lamar tidak ditemukan di halaman ini.' };
      }

      if (!applyBtnInfo.isEasyApply) {
        return {
          success: false,
          error: 'Lowongan ini mengarah ke situs eksternal perusahaan (Bukan Indeed Easy Apply).'
        };
      }

      // 0. Check Company Blacklist & Negative Keywords
      if (userConfig.blacklistedCompanies && jobDetails.company) {
        const blacklist = userConfig.blacklistedCompanies.split(/[,;\n]+/).map(c => c.trim().toLowerCase()).filter(c => c.length >= 2);
        const comp = jobDetails.company.toLowerCase();
        if (blacklist.some(b => comp.includes(b) || b.includes(comp))) {
          return { success: false, error: `Perusahaan "${jobDetails.company}" masuk daftar blacklist.` };
        }
      }

      if (userConfig.negativeKeywords) {
        const negKeywords = userConfig.negativeKeywords.split(/[,;\n]+/).map(k => k.trim().toLowerCase()).filter(k => k.length >= 2);
        const fullText = `${(jobDetails.title || '').toLowerCase()} ${(jobDetails.company || '').toLowerCase()}`;
        const matched = negKeywords.find(k => fullText.includes(k));
        if (matched) {
          return { success: false, error: `Loker mengandung kata terlarang: "${matched}".` };
        }
      }

      chrome.runtime.sendMessage({
        action: 'TASK_PROGRESS',
        message: `Membuka formulir: ${jobDetails.title} di ${jobDetails.company}...`
      }).catch(() => {});

      applyBtnInfo.btn.click();
      await sleep(2000);

      // Fill steps
      const result = await fillIndeedFormSteps(userConfig);

      // Record to backend
      const record = {
        company: jobDetails.company,
        title: jobDetails.title,
        platform: 'indeed',
        jobUrl: jobDetails.jobUrl,
        salary: jobDetails.salary,
        location: jobDetails.location,
        status: result.status || 'Applied via Chrome Extension',
        questionsAndAnswers: result.questionsAndAnswers || []
      };

      chrome.runtime.sendMessage({
        action: 'SAVE_APPLIED_JOB',
        job: record
      });

      return { success: true, record };
    } catch (err) {
      console.error('[CV Blaster] Error executing Indeed apply:', err);
      return { success: false, error: err.message || String(err) };
    }
  };

  // ==========================================================================
  // IN-TAB SEQUENTIAL AUTOMATION RUNNER (Tab Ini Saja, Anti-Begal Tab)
  // ==========================================================================
  let isInTabRunning = false;
  let isAborted = false;

  // In-tab banner — light theme
  function showInTabBanner(text, showStopBtn = true) {
    let banner = document.getElementById('cv-blaster-in-tab-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'cv-blaster-in-tab-banner';
      banner.style.cssText = `
        position: fixed;
        top: 14px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 2147483647;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 8px 16px;
        color: #1e293b;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 12px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.10);
      `;
      document.body.appendChild(banner);
    }

    banner.innerHTML = `
      <div style="width: 8px; height: 8px; border-radius: 50%; background: #ea580c; flex-shrink: 0;"></div>
      <span id="cv-in-tab-banner-text" style="color: #1e293b;">${text}</span>
      ${showStopBtn ? `<button id="cv-in-tab-stop-btn" style="background: #f1f5f9; border: 1px solid #e2e8f0; color: #475569; border-radius: 4px; padding: 3px 8px; font-size: 11px; cursor: pointer;">Hentikan</button>` : ''}
    `;

    const stopBtn = banner.querySelector('#cv-in-tab-stop-btn');
    if (stopBtn) {
      stopBtn.onclick = () => {
        isAborted = true;
        stopBtn.disabled = true;
        stopBtn.innerText = 'Menghentikan...';
      };
    }
    banner.style.display = 'flex';
  }

  function hideInTabBanner(delay = 4000) {
    setTimeout(() => {
      const banner = document.getElementById('cv-blaster-in-tab-banner');
      if (banner && !isInTabRunning) banner.style.display = 'none';
    }, delay);
  }

  window.cvBlasterStartInTabAutomation = async function (quota = 10, userConfig = {}) {
    if (isInTabRunning) return { success: false, message: 'Sudah sedang berjalan di tab ini.' };
    isInTabRunning = true;
    isAborted = false;

    try {
      const href = window.location.href;
      if (href.includes('/viewjob') || href.includes('vjk=')) {
        showInTabBanner('Melamar lowongan di tab ini...');
        const res = await window.cvBlasterExecuteIndeedApply(userConfig);
        if (res.success) {
          showInTabBanner(`Lamaran berhasil: ${res.record?.title} (${res.record?.company})`, false);
        } else {
          showInTabBanner(`Gagal: ${res.error || 'Terjadi kendala'}`, false);
        }
        isInTabRunning = false;
        hideInTabBanner();
        return res;
      }

      const cards = window.cvBlasterExtractIndeedJobCards();
      if (cards.length === 0) {
        showInTabBanner('Tidak ada kartu lowongan yang terdeteksi di halaman ini.', false);
        isInTabRunning = false;
        hideInTabBanner();
        return { success: false, message: 'Tidak ada lowongan ditemukan.' };
      }

      const limit = quota === 'all' ? cards.length : (parseInt(quota, 10) || 10);
      const targetCards = cards.slice(0, limit);
      let successCount = 0;

      showInTabBanner(`Memulai automasi ${targetCards.length} lowongan di tab ini...`);
      await sleep(1000);

      for (let i = 0; i < targetCards.length; i++) {
        if (isAborted) {
          showInTabBanner(`Automasi dihentikan (${successCount} lamaran terkirim).`, false);
          break;
        }

        const card = targetCards[i];
        showInTabBanner(`[${i + 1}/${targetCards.length}] Memproses: ${card.title} (${card.company || 'Indeed'})...`);

        if (card.jk) {
          const cardEl = document.querySelector(`[data-jk="${card.jk}"], a[href*="${card.jk}"]`);
          if (cardEl) {
            cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            cardEl.click();
            await sleep(2500);
          }
        }

        const applyBtnInfo = window.cvBlasterFindIndeedApplyButton();
        if (applyBtnInfo && applyBtnInfo.isEasyApply) {
          showInTabBanner(`[${i + 1}/${targetCards.length}] Mengisi formulir: ${card.title}...`);
          applyBtnInfo.btn.click();
          await sleep(2000);

          const formRes = await fillIndeedFormSteps(userConfig);
          if (formRes.success) {
            successCount++;
            const record = {
              company: card.company || 'Indeed',
              title: card.title || 'Lowongan',
              platform: 'indeed',
              jobUrl: card.url,
              salary: '',
              location: card.location || '',
              status: 'Applied via In-Tab Automation',
              questionsAndAnswers: formRes.questionsAndAnswers || []
            };
            chrome.runtime.sendMessage({ action: 'SAVE_APPLIED_JOB', job: record }, () => {
              if (chrome.runtime.lastError) {}
            });
            showInTabBanner(`[${i + 1}/${targetCards.length}] Berhasil! Jeda 3 detik ke lowongan berikutnya...`);
          } else {
            showInTabBanner(`[${i + 1}/${targetCards.length}] Dilewati (formulir butuh tinjauan manual).`);
          }
        } else {
          showInTabBanner(`[${i + 1}/${targetCards.length}] Dilewati (bukan Lamar Cepat).`);
        }

        await sleep(3500);
      }

      showInTabBanner(`Selesai! ${successCount} dari ${targetCards.length} lowongan berhasil dilamar.`, false);
      hideInTabBanner(6000);
      isInTabRunning = false;
      return { success: true, successCount, count: successCount };
    } catch (err) {
      showInTabBanner(`Error: ${err.message}`, false);
      hideInTabBanner();
      isInTabRunning = false;
      return { success: false, error: err.message };
    }
  };

  // Message listener — popup & background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // ── Popup: detect active page job info ──────────────────────────────────
    if (request.action === 'GET_PAGE_JOB_INFO') {
      const href = window.location.href;
      if (href.includes('/viewjob') || href.includes('vjk=')) {
        const details = window.cvBlasterGetIndeedJobDetails();
        sendResponse({ ...details, isMultiJob: false });
      } else {
        const cards = window.cvBlasterExtractIndeedJobCards();
        if (cards.length > 0) {
          sendResponse({ isMultiJob: true, jobs: cards });
        } else {
          sendResponse({ isMultiJob: false });
        }
      }
      return true;
    }

    // ── Popup: apply single job in active tab ────────────────────────────────
    if (request.action === 'EXECUTE_IN_TAB_APPLY') {
      const userConfig = request.config || {};
      window.cvBlasterExecuteIndeedApply(userConfig)
        .then(res => sendResponse(res))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true; // async
    }

    // ── Popup: multi-apply all detected jobs in active tab ──────────────────
    if (request.action === 'EXECUTE_IN_TAB_MULTI_APPLY') {
      const userConfig = request.config || {};
      window.cvBlasterStartInTabAutomation(request.quota || 10, userConfig)
        .then(res => sendResponse(res))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true; // async
    }

    // ── Background queue: start task ─────────────────────────────────────────
    if (request.action === 'START_IN_TAB_APPLY') {
      window.cvBlasterStartInTaskAutomation(request.quota, request.config)
        .then(res => sendResponse(res));
      return true;
    }

    if (request.action === 'EXECUTE_TASK' && request.task && request.task.type === 'indeed_apply') {
      chrome.storage.local.get(['userConfig'], (res) => {
        const userConfig = Object.assign({}, res.userConfig || {}, request.task.data || {});
        window.cvBlasterExecuteIndeedApply(userConfig)
          .then((applyRes) => {
            if (applyRes.success) {
              chrome.runtime.sendMessage({
                action: 'TASK_COMPLETED',
                summary: `Berhasil melamar: ${applyRes.record?.title} di ${applyRes.record?.company}`
              }, () => { if (chrome.runtime.lastError) {} });
            } else {
              chrome.runtime.sendMessage({
                action: 'TASK_FAILED',
                error: applyRes.error || 'Gagal melamar pekerjaan'
              }, () => { if (chrome.runtime.lastError) {} });
            }
          });
      });
      sendResponse({ received: true });
      return true;
    }

    // ── Utility queries ──────────────────────────────────────────────────────
    if (request.action === 'DIRECT_APPLY') {
      window.cvBlasterExecuteIndeedApply(request.config || {})
        .then(res => sendResponse(res));
      return true;
    }

    if (request.action === 'GET_INDEED_JOB_DETAILS') {
      const details = window.cvBlasterGetIndeedJobDetails();
      const applyBtn = window.cvBlasterFindIndeedApplyButton();
      sendResponse({ details, hasApplyBtn: !!applyBtn, isEasyApply: applyBtn ? applyBtn.isEasyApply : false });
      return true;
    }

    if (request.action === 'GET_SEARCH_JOB_URLS') {
      const urls = window.cvBlasterExtractIndeedSearchUrls();
      sendResponse({ urls });
      return true;
    }

    if (request.action === 'GET_INDEED_CARDS') {
      const cards = window.cvBlasterExtractIndeedJobCards();
      const urls = cards.map(c => c.url);
      sendResponse({ cards, urls });
      return true;
    }
  });
})();

