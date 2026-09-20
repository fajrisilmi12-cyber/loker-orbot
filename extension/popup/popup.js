/**
 * CV Blaster - Popup Controller
 * Anti-slop solid architecture, restrained icons, clean interactive feedback.
 * 
 * Rules:
 * - Tab Reuse: Gunakan tab yang sudah terbuka untuk masing-masing provider (Maks 1 tab per provider).
 * - Tab Ini Saja: Prioritaskan automasi langsung di tab aktif (In-Place), tanpa buka-tutup tab baru.
 * - Suppress Unchecked runtime.lastError: 100% aman saat dibuka di chrome://extensions atau halaman non-portal.
 */

let API_BASE = 'http://localhost:3000';

const PORTALS = {
  linkedin: { 
    urls: ['https://www.linkedin.com', 'https://linkedin.com'],
    domains: ['linkedin.com', '.linkedin.com', 'www.linkedin.com', '.www.linkedin.com'], 
    checkCookie: 'li_at' 
  },
  indeed: { 
    urls: ['https://id.indeed.com', 'https://secure.indeed.com', 'https://indeed.com', 'https://www.indeed.com'],
    domains: ['indeed.com', '.indeed.com', 'id.indeed.com', '.id.indeed.com', 'secure.indeed.com'], 
    checkCookie: 'PPID' 
  },
  glints: { 
    urls: ['https://glints.com'],
    domains: ['glints.com', '.glints.com'], 
    checkCookie: 'session' 
  },
  jobstreet: { 
    urls: ['https://id.jobstreet.com', 'https://jobstreet.co.id', 'https://jobstreet.com'],
    domains: ['jobstreet.com', '.jobstreet.com', 'id.jobstreet.com', 'jobstreet.co.id', '.jobstreet.co.id'], 
    checkCookie: 'JobseekerSessionId' 
  }
};

// Safe Message Handlers (Prevents Unchecked runtime.lastError)
function safeSendMessageToTab(tabId, message, callback) {
  try {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        return; // Suppress harmless receiving end not found
      }
      if (callback) callback(response);
    });
  } catch {}
}

function safeSendMessage(message, callback) {
  try {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        return;
      }
      if (callback) callback(response);
    });
  } catch {}
}

// Interactive Toast Notification
function showToast(message, type = 'info', duration = 2800) {
  const toast = document.getElementById('global-toast');
  if (!toast) return;
  toast.className = `toast-pill show ${type}`;
  toast.innerText = message;
  clearTimeout(toast.__timer);
  toast.__timer = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

async function getCookiesForPortal(info) {
  let allCookies = [];
  if (info.urls) {
    for (const u of info.urls) {
      try {
        const uCookies = await chrome.cookies.getAll({ url: u });
        allCookies = allCookies.concat(uCookies);
      } catch {}
    }
  }
  if (info.domains) {
    for (const d of info.domains) {
      try {
        const dCookies = await chrome.cookies.getAll({ domain: d });
        allCookies = allCookies.concat(dCookies);
      } catch {}
    }
  }
  const uniqueMap = new Map();
  allCookies.forEach(c => uniqueMap.set(`${c.name}_${c.domain}_${c.path}`, c));
  return Array.from(uniqueMap.values());
}

// Find existing open tab for a provider or create one
async function navigateOrReuseProviderTab(portal, targetUrl) {
  const patterns = {
    indeed: ['*://*.indeed.com/*'],
    jobstreet: ['*://*.jobstreet.co*/*', '*://*.jobstreet.com/*'],
    linkedin: ['*://*.linkedin.com/*'],
    glints: ['*://*.glints.com/*']
  };

  const pats = patterns[portal] || [];
  let existingTab = null;

  for (const p of pats) {
    try {
      const tabs = await chrome.tabs.query({ url: p });
      if (tabs && tabs.length > 0) {
        existingTab = tabs.find(t => t.active) || tabs[0];
        break;
      }
    } catch {}
  }

  if (existingTab) {
    // REUSE TAB YANG SUDAH TERBUKA - JANGAN BIKIN BARU!
    await chrome.tabs.update(existingTab.id, { url: targetUrl, active: true });
    return existingTab;
  } else {
    // HANYA buat tab baru jika tab provider tersebut belum ada
    return await chrome.tabs.create({ url: targetUrl, active: true });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const concBtns = document.querySelectorAll('.conc-btn');
  const labelActiveConc = document.getElementById('label-active-conc');
  const dashBtn = document.getElementById('btn-open-dashboard');
  const inputApiUrl = document.getElementById('input-api-url');
  const saveUrlStatus = document.getElementById('save-url-status');
  const dotSyncStatus = document.getElementById('dot-sync-status');
  const badgeSyncConfigStatus = document.getElementById('badge-sync-config-status');
  const labelActivePortal = document.getElementById('label-active-portal');

  // Tab 1 Elements
  const btnApplyActiveTab = document.getElementById('btn-apply-active-tab');
  const activeJobTitle = document.getElementById('active-job-title');
  const activeJobCompany = document.getElementById('active-job-company');
  const badgeActivePlatform = document.getElementById('badge-active-platform');
  const statRunning = document.getElementById('stat-running');
  const statQueued = document.getElementById('stat-queued');
  const statCompleted = document.getElementById('stat-completed');
  const statFailed = document.getElementById('stat-failed');
  const queueStatusText = document.getElementById('queue-status-text');
  const btnQueuePause = document.getElementById('btn-queue-pause');
  const btnQueueResume = document.getElementById('btn-queue-resume');
  const btnQueueClear = document.getElementById('btn-queue-clear');
  const logContainer = document.getElementById('worker-log-container');

  // Filter & Search Controls
  const inputFilterKeyword = document.getElementById('input-filter-keyword');
  const inputFilterLocation = document.getElementById('input-filter-location');
  const selectFilterQuota = document.getElementById('select-filter-quota');
  const selectFilterPortal = document.getElementById('select-filter-portal');
  const checkEasyApplyOnly = document.getElementById('check-easy-apply-only');
  const btnSearchPortal = document.getElementById('btn-search-portal');
  const textBtnSearch = document.getElementById('text-btn-search');
  const btnLaunchAutoQueue = document.getElementById('btn-launch-auto-queue');

  // Multi-Job Detection Elements
  const multiJobDetectedView = document.getElementById('multi-job-detected-view');
  const singleJobDetectedView = document.getElementById('single-job-detected-view');
  const multiJobCountText = document.getElementById('multi-job-count-text');
  const multiJobFilterMatch = document.getElementById('multi-job-filter-match');
  const multiJobPreviewSnippets = document.getElementById('multi-job-preview-snippets');
  const btnEnqueueDetectedJobs = document.getElementById('btn-enqueue-detected-jobs');
  const textEnqueueBtn = document.getElementById('text-enqueue-btn');

  // Tab 2 Elements
  const badgeTalentStatus = document.getElementById('badge-talent-status');
  const talentName = document.getElementById('talent-name');
  const talentHeadline = document.getElementById('talent-headline');
  const inputTalentReq = document.getElementById('input-talent-req');
  const btnSaveCurrentTalent = document.getElementById('btn-save-current-talent');
  const btnBatchLinkedinSearch = document.getElementById('btn-batch-linkedin-search');
  const textBatchSearch = document.getElementById('text-batch-search');
  const btnViewTalentDashboard = document.getElementById('btn-view-talent-dashboard');

  // Tab 3 Elements
  const syncBtn = document.getElementById('btn-sync');

  let detectedJobCards = [];
  let currentActiveTab = null;
  let activeTalentCandidate = null;

  // ----------------------------------------------------
  // 1. Navigation Tab Switching
  // ----------------------------------------------------
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-target');
      const panel = document.getElementById(targetId);
      if (panel) panel.classList.add('active');
    });
  });

  // Open Dashboard handler
  if (dashBtn) {
    dashBtn.addEventListener('click', () => chrome.tabs.create({ url: API_BASE }));
  }
  if (btnViewTalentDashboard) {
    btnViewTalentDashboard.addEventListener('click', () => chrome.tabs.create({ url: `${API_BASE}?tab=talent` }));
  }

  // Open Draggable Floating Modal on current page
  const btnPopDragWindow = document.getElementById('btn-pop-drag-window');
  if (btnPopDragWindow) {
    btnPopDragWindow.addEventListener('click', async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs[0]) {
        safeSendMessageToTab(tabs[0].id, { action: 'OPEN_DRAGGABLE_WINDOW' }, () => {
          window.close();
        });
      }
    });
  }

  // ----------------------------------------------------
  // 2. Load Persisted Settings & Backend Sync
  // ----------------------------------------------------
  chrome.storage.local.get(['cvBlasterApiUrl', 'concurrency'], (res) => {
    if (res.cvBlasterApiUrl) {
      API_BASE = res.cvBlasterApiUrl.replace(/\/$/, '');
      if (inputApiUrl) inputApiUrl.value = API_BASE;
    }
    const currentConc = res.concurrency || 4;
    updateConcurrencyUI(currentConc);
  });

  async function loadWebConfig() {
    try {
      const res = await fetch(`${API_BASE}/api/config`);
      if (!res.ok) throw new Error('Offline');
      const data = await res.json();
      const cfg = data.config || data || {};

      const kw = cfg.searchKeywords || 'full stack developer';
      const loc = cfg.location || 'Surabaya';

      if (inputFilterKeyword) inputFilterKeyword.value = kw;
      if (inputFilterLocation) inputFilterLocation.value = loc;
      if (textBtnSearch) textBtnSearch.innerText = `Cari ${loc}`;

      if (selectFilterPortal) {
        if (cfg.enableIndeed) selectFilterPortal.value = 'indeed';
        else if (cfg.enableJobstreet) selectFilterPortal.value = 'jobstreet';
        else if (cfg.enableLinkedin) selectFilterPortal.value = 'linkedin';
        if (labelActivePortal) labelActivePortal.innerText = selectFilterPortal.options[selectFilterPortal.selectedIndex].text;
      }

      if (badgeSyncConfigStatus) badgeSyncConfigStatus.innerText = 'Online';
      if (dotSyncStatus) dotSyncStatus.className = 'status-dot-mini';
    } catch {
      if (badgeSyncConfigStatus) badgeSyncConfigStatus.innerText = 'Offline';
      if (dotSyncStatus) dotSyncStatus.className = 'status-dot-mini offline';
    }
  }

  loadWebConfig();

  if (inputApiUrl) {
    inputApiUrl.addEventListener('change', () => {
      let val = inputApiUrl.value.trim().replace(/\/$/, '');
      if (!val) val = 'http://localhost:3000';
      API_BASE = val;
      chrome.storage.local.set({ cvBlasterApiUrl: val });
      safeSendMessage({ action: 'SET_API_URL', url: val });
      if (saveUrlStatus) {
        saveUrlStatus.style.display = 'inline';
        setTimeout(() => { saveUrlStatus.style.display = 'none'; }, 2000);
      }
      showToast('URL server tersimpan', 'info');
      loadWebConfig();
    });
  }

  // ----------------------------------------------------
  // 3. Concurrency Selector Handler
  // ----------------------------------------------------
  function updateConcurrencyUI(val) {
    concBtns.forEach((b) => {
      if (parseInt(b.getAttribute('data-val'), 10) === val) {
        b.classList.add('selected');
      } else {
        b.classList.remove('selected');
      }
    });
    if (labelActiveConc) labelActiveConc.innerText = `${val} Tab`;
  }

  concBtns.forEach((b) => {
    b.addEventListener('click', () => {
      const val = parseInt(b.getAttribute('data-val'), 10);
      updateConcurrencyUI(val);
      safeSendMessage({ action: 'SET_CONCURRENCY', concurrency: val });
      showToast(`Concurrency diatur ke ${val} tab`, 'info');
    });
  });

  // ----------------------------------------------------
  // 4. Interactive Filter, Portal Navigation & In-Tab Apply
  // ----------------------------------------------------
  if (inputFilterLocation) {
    inputFilterLocation.addEventListener('input', () => {
      const loc = inputFilterLocation.value.trim();
      if (textBtnSearch) textBtnSearch.innerText = loc ? `Cari ${loc}` : 'Cari di Portal';
      filterAndRenderDetectedCards();
    });
  }

  if (selectFilterPortal) {
    selectFilterPortal.addEventListener('change', () => {
      if (labelActivePortal) labelActivePortal.innerText = selectFilterPortal.options[selectFilterPortal.selectedIndex].text;
    });
  }

  if (checkEasyApplyOnly) {
    checkEasyApplyOnly.addEventListener('change', () => filterAndRenderDetectedCards());
  }

  if (selectFilterQuota) {
    selectFilterQuota.addEventListener('change', () => filterAndRenderDetectedCards());
  }

  function buildPortalSearchUrl(portal, kw, loc) {
    const q = encodeURIComponent(kw || 'full stack developer');
    const l = encodeURIComponent(loc || 'Surabaya');
    if (portal === 'jobstreet') {
      return `https://id.jobstreet.com/id/job-search/${encodeURIComponent(kw.toLowerCase().replace(/\s+/g, '-'))}-jobs/in-${encodeURIComponent(loc.toLowerCase().replace(/\s+/g, '-'))}/`;
    }
    if (portal === 'linkedin') {
      return `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${l}`;
    }
    return `https://id.indeed.com/jobs?q=${q}&l=${l}`;
  }

  // Tombol "Cari di Portal": Gunakan tab yang sudah ada (jangan buka tab duplikat)
  if (btnSearchPortal) {
    btnSearchPortal.addEventListener('click', async () => {
      const kw = inputFilterKeyword ? inputFilterKeyword.value.trim() : 'full stack developer';
      const loc = inputFilterLocation ? inputFilterLocation.value.trim() : 'Surabaya';
      const portal = selectFilterPortal ? selectFilterPortal.value : 'indeed';
      const targetUrl = buildPortalSearchUrl(portal, kw, loc);

      btnSearchPortal.disabled = true;
      if (textBtnSearch) textBtnSearch.innerText = 'Membuka...';

      await navigateOrReuseProviderTab(portal, targetUrl);

      setTimeout(() => {
        btnSearchPortal.disabled = false;
        if (textBtnSearch) textBtnSearch.innerText = `Cari ${loc}`;
        window.close();
      }, 400);
    });
  }

  // Tombol "Lamar di Tab Ini": Jalankan langsung di tab aktif
  if (btnLaunchAutoQueue) {
    btnLaunchAutoQueue.addEventListener('click', async () => {
      btnLaunchAutoQueue.disabled = true;
      btnLaunchAutoQueue.innerText = 'Menyiapkan...';

      const quota = selectFilterQuota ? selectFilterQuota.value : '10';

      if (currentActiveTab && currentActiveTab.id && currentActiveTab.url) {
        if (currentActiveTab.url.includes('indeed.com')) {
          safeSendMessageToTab(currentActiveTab.id, { action: 'START_IN_TAB_APPLY', quota }, () => {
            showToast('Automasi berjalan di tab ini', 'success');
            setTimeout(() => window.close(), 500);
          });
          return;
        }
      }

      // Jika belum di halaman portal, bawa ke portal tersebut
      const kw = inputFilterKeyword ? inputFilterKeyword.value.trim() : 'full stack developer';
      const loc = inputFilterLocation ? inputFilterLocation.value.trim() : 'Surabaya';
      const portal = selectFilterPortal ? selectFilterPortal.value : 'indeed';
      const targetUrl = buildPortalSearchUrl(portal, kw, loc);

      await navigateOrReuseProviderTab(portal, targetUrl);
      setTimeout(() => window.close(), 500);
    });
  }

  function getFilteredCards() {
    if (!detectedJobCards || detectedJobCards.length === 0) return [];
    const locFilter = inputFilterLocation ? inputFilterLocation.value.trim().toLowerCase() : '';
    const easyOnly = checkEasyApplyOnly ? checkEasyApplyOnly.checked : false;

    let list = [...detectedJobCards];
    if (easyOnly) {
      const easyList = list.filter(c => c.isEasyApply);
      if (easyList.length > 0) list = easyList;
    }
    if (locFilter) {
      const locList = list.filter(c => (c.location || '').toLowerCase().includes(locFilter) || (c.title || '').toLowerCase().includes(locFilter));
      if (locList.length > 0) list = locList;
    }

    const quotaVal = selectFilterQuota ? selectFilterQuota.value : '10';
    if (quotaVal !== 'all') {
      const limit = parseInt(quotaVal, 10) || 10;
      list = list.slice(0, limit);
    }
    return list;
  }

  function filterAndRenderDetectedCards() {
    if (!detectedJobCards || detectedJobCards.length === 0) return;
    const filtered = getFilteredCards();
    const locFilter = inputFilterLocation ? inputFilterLocation.value.trim() : '';

    if (multiJobCountText) {
      multiJobCountText.innerText = `${detectedJobCards.length} lowongan di halaman`;
    }
    if (multiJobFilterMatch) {
      multiJobFilterMatch.innerText = locFilter ? `${filtered.length} cocok (${locFilter})` : `${filtered.length} dipilih`;
    }
    if (textEnqueueBtn) {
      textEnqueueBtn.innerText = `Lamar ${filtered.length} Lowongan di Tab Ini`;
    }
  }

  // Lamar Lowongan Terpilih di Tab Ini (In-Place)
  if (btnEnqueueDetectedJobs) {
    btnEnqueueDetectedJobs.addEventListener('click', () => {
      const filtered = getFilteredCards();
      if (filtered.length === 0) {
        showToast('Tidak ada lowongan yang sesuai kriteria', 'error');
        return;
      }

      btnEnqueueDetectedJobs.disabled = true;
      btnEnqueueDetectedJobs.innerText = 'Memulai di tab ini...';

      if (currentActiveTab && currentActiveTab.id) {
        const quota = selectFilterQuota ? selectFilterQuota.value : '10';
        safeSendMessageToTab(currentActiveTab.id, { action: 'START_IN_TAB_APPLY', quota }, () => {
          showToast(`Automasi ${filtered.length} lowongan dimulai di tab ini`, 'success');
          setTimeout(() => window.close(), 600);
        });
      }
    });
  }

  // ----------------------------------------------------
  // 5. Inspect Currently Active Browser Tab (100% Safe)
  // ----------------------------------------------------
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) {
      currentActiveTab = tabs[0];
      const url = currentActiveTab.url || '';

      if (url.includes('indeed.com') || url.includes('jobstreet.co')) {
        badgeActivePlatform.innerText = url.includes('indeed.com') ? 'Indeed' : 'JobStreet';

        safeSendMessageToTab(currentActiveTab.id, { action: 'GET_INDEED_CARDS' }, (resp) => {
          if (resp && resp.cards && resp.cards.length > 0) {
            detectedJobCards = resp.cards;
            if (multiJobDetectedView) multiJobDetectedView.style.display = 'block';

            if (multiJobPreviewSnippets) {
              const previewHtml = resp.cards.slice(0, 3).map(c => `• <strong>${c.title}</strong> (${c.company || 'Perusahaan'}${c.location ? ' · ' + c.location : ''})`).join('<br>');
              multiJobPreviewSnippets.innerHTML = previewHtml + (resp.cards.length > 3 ? `<br><em>...dan ${resp.cards.length - 3} lowongan lainnya</em>` : '');
            }

            filterAndRenderDetectedCards();
          }
        });

        safeSendMessageToTab(currentActiveTab.id, { action: 'GET_INDEED_JOB_DETAILS' }, (resp) => {
          if (resp && resp.details && resp.details.title) {
            activeJobTitle.innerText = resp.details.title;
            activeJobCompany.innerText = `${resp.details.company} · ${resp.details.location}`;
            btnApplyActiveTab.disabled = false;
            btnApplyActiveTab.innerText = `Lamar di Tab Ini: ${resp.details.title.slice(0, 20)}...`;
          }
        });

        btnApplyActiveTab.onclick = () => {
          btnApplyActiveTab.disabled = true;
          btnApplyActiveTab.innerText = 'Memproses...';
          safeSendMessageToTab(currentActiveTab.id, { action: 'DIRECT_APPLY' }, (resp) => {
            if (resp && resp.success) {
              btnApplyActiveTab.innerText = 'Lamaran Terkirim';
              showToast('Lamaran berhasil dikirim ke Indeed', 'success');
            } else {
              btnApplyActiveTab.disabled = false;
              btnApplyActiveTab.innerText = 'Coba Lagi';
              showToast(resp ? resp.error : 'Gagal mengirim lamaran', 'error');
            }
          });
        };
      }

      // Check LinkedIn Profile or Search
      if (url.includes('linkedin.com')) {
        if (url.includes('/in/')) {
          badgeTalentStatus.innerText = 'Profil Aktif';

          safeSendMessageToTab(currentActiveTab.id, { action: 'EXTRACT_ACTIVE_PROFILE' }, (resp) => {
            if (resp && resp.candidate && resp.candidate.name) {
              activeTalentCandidate = resp.candidate;
              talentName.innerText = resp.candidate.name + (resp.candidate.isOpenToWork ? ' (#OpenToWork)' : '');
              talentHeadline.innerText = resp.candidate.headline;
              btnSaveCurrentTalent.disabled = false;
            }
          });
        } else if (url.includes('/search/results/people')) {
          badgeTalentStatus.innerText = 'Pencarian Orang';
          talentName.innerText = 'Pencarian Orang LinkedIn';
          talentHeadline.innerText = 'Dapat di-sourcing langsung dari halaman ini.';
          btnBatchLinkedinSearch.style.display = 'flex';

          safeSendMessageToTab(currentActiveTab.id, { action: 'GET_SEARCH_CANDIDATE_URLS' }, (resp) => {
            if (resp && resp.urls && resp.urls.length > 0) {
              textBatchSearch.innerText = `Batch Sourcing (${resp.urls.length} Profil)`;
              btnBatchLinkedinSearch.onclick = () => {
                btnBatchLinkedinSearch.disabled = true;
                const tasks = resp.urls.map(u => ({
                  type: 'linkedin_scrape',
                  url: u,
                  data: { requirement: inputTalentReq.value.trim() }
                }));
                safeSendMessage({ action: 'ENQUEUE_TASKS', tasks }, () => {
                  showToast(`${tasks.length} profil masuk antrean sourcing`, 'success');
                  btnBatchLinkedinSearch.innerText = `Tersimpan di Antrean (${tasks.length})`;
                });
              };
            }
          });
        }
      }
    }
  } catch {}

  // Save current talent button
  btnSaveCurrentTalent.addEventListener('click', async () => {
    if (!activeTalentCandidate) return;
    btnSaveCurrentTalent.disabled = true;
    btnSaveCurrentTalent.innerText = 'Menyimpan & Analisis AI...';

    try {
      const res = await fetch(`${API_BASE}/api/talents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import_profile',
          candidate: activeTalentCandidate,
          requirement: inputTalentReq ? inputTalentReq.value.trim() : ''
        })
      });
      const data = await res.json();
      if (data.success) {
        const score = data.candidate?.aiHonestyScore || 90;
        btnSaveCurrentTalent.innerText = `Tersimpan (${score}% Skor)`;
        showToast(`Profil ${activeTalentCandidate.name} tersimpan di database`, 'success');
      } else {
        throw new Error(data.error || 'Gagal menyimpan kandidat');
      }
    } catch (err) {
      btnSaveCurrentTalent.disabled = false;
      btnSaveCurrentTalent.innerText = 'Coba Lagi';
      showToast(err.message || 'Gagal menyimpan profil', 'error');
    }
  });

  // ----------------------------------------------------
  // 6. Queue Status & State Sync
  // ----------------------------------------------------
  function updateQueueUI(state) {
    if (!state) return;
    if (statRunning) statRunning.innerText = state.runningCount || 0;
    if (statQueued) statQueued.innerText = state.queueLength || 0;
    if (statCompleted) statCompleted.innerText = state.completedCount || 0;
    if (statFailed) statFailed.innerText = state.failedCount || 0;

    if (state.isPaused) {
      if (queueStatusText) {
        queueStatusText.innerText = 'Dijeda';
        queueStatusText.style.color = '#facc15';
      }
      if (btnQueuePause) btnQueuePause.style.display = 'none';
      if (btnQueueResume) btnQueueResume.style.display = 'flex';
    } else {
      if (queueStatusText) {
        queueStatusText.innerText = 'Aktif';
        queueStatusText.style.color = '#10b981';
      }
      if (btnQueuePause) btnQueuePause.style.display = 'flex';
      if (btnQueueResume) btnQueueResume.style.display = 'none';
    }
  }

  function appendLog(log) {
    if (!logContainer) return;
    const item = document.createElement('div');
    item.className = `log-entry ${log.type || 'info'}`;
    item.innerText = `[${log.timestamp || ''}] ${log.message}`;
    logContainer.prepend(item);
  }

  safeSendMessage({ action: 'GET_STATE' }, (res) => {
    if (res) {
      updateQueueUI(res);
      if (res.logs && logContainer) {
        logContainer.innerHTML = '';
        res.logs.forEach(l => appendLog(l));
      }
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'QUEUE_STATE_UPDATE') {
      updateQueueUI(msg.state);
    }
    if (msg.action === 'NEW_LOG') {
      appendLog(msg.log);
    }
  });

  btnQueuePause.addEventListener('click', () => {
    safeSendMessage({ action: 'PAUSE_QUEUE' }, () => {
      btnQueuePause.style.display = 'none';
      btnQueueResume.style.display = 'flex';
      queueStatusText.innerText = 'Dijeda';
      queueStatusText.style.color = '#facc15';
      showToast('Antrean background dijeda', 'info');
    });
  });

  btnQueueResume.addEventListener('click', () => {
    safeSendMessage({ action: 'RESUME_QUEUE' }, () => {
      btnQueueResume.style.display = 'none';
      btnQueuePause.style.display = 'flex';
      queueStatusText.innerText = 'Aktif';
      queueStatusText.style.color = '#10b981';
      showToast('Antrean background dilanjutkan', 'success');
    });
  });

  btnQueueClear.addEventListener('click', () => {
    safeSendMessage({ action: 'CLEAR_QUEUE' }, () => {
      showToast('Antrean dibersihkan', 'info');
    });
  });

  // ----------------------------------------------------
  // 7. Cookie Sync
  // ----------------------------------------------------
  for (const [key, info] of Object.entries(PORTALS)) {
    try {
      const uniqueList = await getCookiesForPortal(info);
      const count = uniqueList.length;
      const hasAuthCookie = !info.checkCookie || uniqueList.some(c => c.name === info.checkCookie);

      const dot = document.getElementById(`dot-${key}`);
      const text = document.getElementById(`text-${key}`);

      if (count > 0 && hasAuthCookie) {
        dot.className = 'status-dot-mini';
        text.innerText = `${count} Cookies (Aktif)`;
        text.style.color = '#10b981';
      } else if (count > 0) {
        dot.className = 'status-dot-mini';
        text.innerText = `${count} Cookies`;
        text.style.color = '#facc15';
      } else {
        dot.className = 'status-dot-mini offline';
        text.innerText = 'Belum Ada';
        text.style.color = '#94a3b8';
      }
    } catch {}
  }

  syncBtn.addEventListener('click', async () => {
    syncBtn.disabled = true;
    const syncText = document.getElementById('sync-btn-text');
    if (syncText) syncText.innerText = 'Menyinkronkan...';

    try {
      const cfgRes = await fetch(`${API_BASE}/api/config`);
      if (!cfgRes.ok) throw new Error(`Server tidak merespons di ${API_BASE}`);
      const cfgData = await cfgRes.json();
      const currentConfig = cfgData.config || {};

      const collectedCookies = {};
      let totalSynced = 0;

      for (const [key, info] of Object.entries(PORTALS)) {
        const uniqueList = await getCookiesForPortal(info);
        if (uniqueList.length > 0) {
          collectedCookies[key] = JSON.stringify(uniqueList);
          totalSynced += uniqueList.length;
        }
      }

      const updatedConfig = {
        ...currentConfig,
        portalCookies: {
          ...(currentConfig.portalCookies || {}),
          ...collectedCookies
        }
      };

      const saveRes = await fetch(`${API_BASE}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedConfig)
      });

      if (saveRes.ok) {
        showToast(`${totalSynced} cookie tersinkron ke backend`, 'success');
      } else {
        throw new Error('Gagal menyimpan ke config server');
      }
    } catch (err) {
      showToast(err.message || 'Gagal sinkronisasi cookie', 'error');
    } finally {
      syncBtn.disabled = false;
      if (syncText) syncText.innerText = 'Sinkronkan Cookie ke Backend';
    }
  });
});
