/**
 * CV Blaster Companion & Automation Engine (Background Service Worker)
 * 
 * Rules:
 * 1. Provider Tab Pool: Tab baru HANYA ketika membuka provider yang berbeda (Maks 4: Indeed, Jobstreet, Glints, LinkedIn).
 * 2. Tab Reuse: Jika tab masing-masing provider sudah ada yang terbuka di browser, GUNAKAN TAB TERSEBUT, JANGAN BIKIN BARU!
 * 3. Anti-Begal Tab: Tab TIDAK PERNAH ditutup otomatis (NO chrome.tabs.remove). Tab tetap dibiarkan hidup.
 * 4. Next.js API Bridge (localhost:3000) untuk pencatatan lamaran & sourcing talent.
 */
// Standalone Client-Side Mode (100% Serverless)
// Worker Queue State
let maxConcurrency = 4;
let isPaused = false;
let taskQueue = []; // [{ id, type, url, data, retries }]
let runningTasks = new Map(); // tabId -> { id, type, url, data, startTime, timerId, provider }
let completedCount = 0;
let failedCount = 0;
let recentLogs = [];

// Provider Tab Tracking (providerName -> tabId)
const providerTabs = new Map();

const PROVIDER_PATTERNS = {
  indeed: ['*://*.indeed.com/*'],
  jobstreet: ['*://*.jobstreet.co*/*', '*://*.jobstreet.com/*'],
  glints: ['*://*.glints.com/*'],
  linkedin: ['*://*.linkedin.com/*']
};

function getProvider(url = '') {
  if (url.includes('indeed.com')) return 'indeed';
  if (url.includes('jobstreet.co') || url.includes('jobstreet.com')) return 'jobstreet';
  if (url.includes('glints.com')) return 'glints';
  if (url.includes('linkedin.com')) return 'linkedin';
  return 'general';
}

function addLog(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString('id-ID');
  const entry = { timestamp, message, type };
  recentLogs.unshift(entry);
  if (recentLogs.length > 80) recentLogs.pop();
  
  chrome.runtime.sendMessage({ action: 'NEW_LOG', log: entry }, () => {
    if (chrome.runtime.lastError) {} // Suppress unchecked lastError
  });
}

// Load persisted settings
chrome.storage.local.get(['cvBlasterApiUrl', 'concurrency', 'isPaused'], (res) => {
  if (res.cvBlasterApiUrl) API_BASE = res.cvBlasterApiUrl.replace(/\/$/, '');
  if (res.concurrency) maxConcurrency = Math.min(4, Math.max(1, parseInt(res.concurrency, 10)));
  if (res.isPaused !== undefined) isPaused = res.isPaused;
  addLog(`Engine siap. Mode Provider Pool aktif (Maks 1 tab per provider, tanpa tutup paksa).`);
});

// ============================================================================
// Provider Tab Manager (Reuse existing tabs, never auto-close)
// ============================================================================

async function findExistingTabForProvider(provider) {
  // 1. Check mapped tab
  if (providerTabs.has(provider)) {
    const tabId = providerTabs.get(provider);
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab && !tab.discarded) return tab;
    } catch {
      providerTabs.delete(provider);
    }
  }

  // 2. Search all open tabs in browser for this provider
  const patterns = PROVIDER_PATTERNS[provider] || [];
  for (const pattern of patterns) {
    try {
      const tabs = await chrome.tabs.query({ url: pattern });
      if (tabs && tabs.length > 0) {
        // Pick the most recent active or first tab
        const picked = tabs.find(t => t.active) || tabs[0];
        providerTabs.set(provider, picked.id);
        return picked;
      }
    } catch {}
  }

  return null;
}

async function getOrCreateTabForTask(task) {
  const provider = getProvider(task.url);
  const existingTab = await findExistingTabForProvider(provider);

  if (existingTab) {
    // REUSE TAB YANG SUDAH ADA - JANGAN BIKIN BARU!
    addLog(`[Tab Manager] Menggunakan tab ${provider} yang sudah terbuka (Tab ID: ${existingTab.id})`);
    providerTabs.set(provider, existingTab.id);

    // Update URL if different
    if (existingTab.url !== task.url) {
      await chrome.tabs.update(existingTab.id, { url: task.url });
    }
    return existingTab;
  }

  // Hanya jika BELUM ADA tab untuk provider ini, baru buat 1 tab baru
  addLog(`[Tab Manager] Membuka 1 tab untuk provider ${provider}`);
  const newTab = await chrome.tabs.create({
    url: task.url,
    active: false
  });
  providerTabs.set(provider, newTab.id);
  return newTab;
}

// ============================================================================
// Queue Processor
// ============================================================================

async function processQueue() {
  if (isPaused) return;
  if (taskQueue.length === 0) return;
  if (runningTasks.size >= maxConcurrency) return;

  const slotsAvailable = maxConcurrency - runningTasks.size;
  for (let i = 0; i < slotsAvailable && taskQueue.length > 0; i++) {
    const task = taskQueue.shift();
    startTaskInTab(task);
  }
}

async function startTaskInTab(task) {
  try {
    const tab = await getOrCreateTabForTask(task);
    const provider = getProvider(task.url);

    // 60-second watchdog timeout
    const timerId = setTimeout(() => {
      handleTaskTimeout(tab.id);
    }, 60000);

    runningTasks.set(tab.id, {
      ...task,
      tabId: tab.id,
      provider,
      startTime: Date.now(),
      timerId
    });

    broadcastQueueState();

    // Trigger execution if tab is already complete
    try {
      const currentTab = await chrome.tabs.get(tab.id);
      if (currentTab.status === 'complete') {
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, { action: 'EXECUTE_TASK', task }, () => {
            if (chrome.runtime.lastError) {}
          });
        }, 1000);
      }
    } catch {}
  } catch (err) {
    addLog(`[Worker] Gagal memulai tugas: ${err.message}`, 'error');
    failedCount++;
    processQueue();
  }
}

function handleTaskTimeout(tabId) {
  const task = runningTasks.get(tabId);
  if (!task) return;

  addLog(`[Worker] Timeout 60s pada tab ${tabId} (${task.provider || 'portal'}).`, 'warning');
  finishTask(tabId, false, 'Timeout 60 detik');
}

/**
 * Finish a task WITHOUT closing the tab (Anti-Begal Tab)
 */
function finishTask(tabId, isSuccess, summaryOrError) {
  const task = runningTasks.get(tabId);
  if (task && task.timerId) clearTimeout(task.timerId);
  runningTasks.delete(tabId);

  if (isSuccess) {
    completedCount++;
    addLog(`[Worker] Selesai: ${summaryOrError || ''}`, 'success');
  } else {
    failedCount++;
    addLog(`[Worker] ${summaryOrError || 'Tugas tidak selesai'}`, 'error');
  }

  broadcastQueueState();

  // JANGAN TUTUP TAB! Tab tetap dibiarkan aktif di browser pengguna
  // Lanjutkan memproses antrean berikutnya di tab tersebut atau tab provider lain
  setTimeout(() => {
    processQueue();
  }, 1200);
}

// Watch tab updates to signal content script when page is ready
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && runningTasks.has(tabId)) {
    const task = runningTasks.get(tabId);
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, { action: 'EXECUTE_TASK', task }, () => {
        if (chrome.runtime.lastError) {
          // Retry once after 1.5s if content script was slow to inject
          setTimeout(() => {
            chrome.tabs.sendMessage(tabId, { action: 'EXECUTE_TASK', task }, () => {
              if (chrome.runtime.lastError) {}
            });
          }, 1500);
        }
      });
    }, 1000);
  }
});

// Clean up task ONLY if user manually closes the tab in Chrome UI
chrome.tabs.onRemoved.addListener((tabId) => {
  for (const [provider, id] of providerTabs.entries()) {
    if (id === tabId) providerTabs.delete(provider);
  }
  if (runningTasks.has(tabId)) {
    const task = runningTasks.get(tabId);
    if (task.timerId) clearTimeout(task.timerId);
    runningTasks.delete(tabId);
    addLog(`[Worker] Tab ${tabId} ditutup oleh pengguna.`, 'info');
    broadcastQueueState();
    processQueue();
  }
});

function broadcastQueueState() {
  chrome.runtime.sendMessage({
    action: 'QUEUE_STATE_UPDATE',
    state: {
      queueLength: taskQueue.length,
      runningCount: runningTasks.size,
      maxConcurrency,
      isPaused,
      completedCount,
      failedCount,
      runningTasks: Array.from(runningTasks.values()).map(t => ({
        id: t.id,
        type: t.type,
        url: t.url,
        provider: t.provider,
        elapsed: Math.round((Date.now() - t.startTime) / 1000)
      }))
    }
  }, () => {
    if (chrome.runtime.lastError) {} // Suppress unchecked lastError
  });
}

// ============================================================================
// Standalone Serverless Storage & Gemini AI Engine (Zero-Backend)
// ============================================================================

async function saveAppliedJobToStorage(jobData) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['applied_jobs'], (res) => {
      const list = res.applied_jobs || [];
      const dateStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
      const record = {
        ...jobData,
        date: jobData.date || dateStr,
        id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      };
      // Prepend to top of list
      list.unshift(record);
      // Keep up to 2000 records in local storage
      if (list.length > 2000) list.pop();
      chrome.storage.local.set({ applied_jobs: list }, () => {
        addLog(`[Tersimpan] ${record.title || 'Loker'} di ${record.company || 'Perusahaan'} dicatat ke memori lokal.`, 'success');
        resolve({ success: true, record, totalCount: list.length });
      });
    });
  });
}

async function generateGeminiDirect(prompt, customApiKey = '', model = 'gemini-2.5-flash') {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['userConfig'], async (res) => {
      const apiKey = customApiKey || res.userConfig?.geminiApiKey || '';
      if (!apiKey) {
        return reject(new Error('Kunci API Gemini belum diatur di menu Pengaturan Profil.'));
      }
      const selectedModel = model || res.userConfig?.geminiModel || 'gemini-2.5-flash';
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 300
            }
          })
        });
        const data = await response.json();
        if (data.error) {
          throw new Error(data.error.message || 'Error dari Gemini API');
        }
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        resolve(text);
      } catch (err) {
        reject(err);
      }
    });
  });
}

async function saveTalentToStorage(candidateData, requirement = '') {
  return new Promise((resolve) => {
    chrome.storage.local.get(['sourced_talents'], (res) => {
      const list = res.sourced_talents || [];
      const record = {
        ...candidateData,
        requirement,
        sourcedAt: new Date().toISOString(),
        id: `talent_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      };
      list.unshift(record);
      if (list.length > 1000) list.pop();
      chrome.storage.local.set({ sourced_talents: list }, () => {
        addLog(`[Talent] Kandidat ${record.name || 'LinkedIn'} disimpan ke database lokal.`, 'success');
        resolve({ success: true, record });
      });
    });
  });
}

// ============================================================================
// Message Listener
// ============================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (request.action === 'ENQUEUE_TASKS') {
      const tasks = (request.tasks || []).map((t, idx) => ({
        id: `task_${Date.now()}_${idx}`,
        type: t.type,
        url: t.url,
        data: t.data || {},
        retries: 0
      }));

      taskQueue.push(...tasks);
      addLog(`Menerima ${tasks.length} tugas ke antrean.`);
      broadcastQueueState();
      processQueue();
      sendResponse({ success: true, count: tasks.length });
      return true;
    }

    if (request.action === 'PAUSE_QUEUE') {
      isPaused = true;
      chrome.storage.local.set({ isPaused: true });
      addLog('Antrean dijeda.');
      broadcastQueueState();
      sendResponse({ success: true, isPaused });
      return true;
    }

    if (request.action === 'RESUME_QUEUE') {
      isPaused = false;
      chrome.storage.local.set({ isPaused: false });
      addLog('Antrean dilanjutkan.');
      broadcastQueueState();
      processQueue();
      sendResponse({ success: true, isPaused });
      return true;
    }

    if (request.action === 'CLEAR_QUEUE') {
      taskQueue = [];
      addLog('Antrean tugas dibersihkan.');
      broadcastQueueState();
      sendResponse({ success: true });
      return true;
    }

    if (request.action === 'SET_CONCURRENCY') {
      maxConcurrency = Math.min(4, Math.max(1, parseInt(request.concurrency, 10)));
      chrome.storage.local.set({ concurrency: maxConcurrency });
      addLog(`Concurrency diubah ke ${maxConcurrency} tab.`);
      broadcastQueueState();
      processQueue();
      sendResponse({ success: true, maxConcurrency });
      return true;
    }

    if (request.action === 'SET_API_URL') {
      API_BASE = request.url.replace(/\/$/, '');
      addLog(`Target API diperbarui ke: ${API_BASE}`);
      sendResponse({ success: true, API_BASE });
      return true;
    }

    if (request.action === 'GET_STATE') {
      sendResponse({
        queueLength: taskQueue.length,
        runningCount: runningTasks.size,
        maxConcurrency,
        isPaused,
        completedCount,
        failedCount,
        logs: recentLogs.slice(0, 30)
      });
      return true;
    }

    // Task lifecycle from content scripts
    if (request.action === 'TASK_COMPLETED' && sender.tab) {
      finishTask(sender.tab.id, true, request.summary || 'Lamaran selesai');
      sendResponse({ received: true });
      return true;
    }

    if (request.action === 'TASK_FAILED' && sender.tab) {
      finishTask(sender.tab.id, false, request.error || 'Gagal');
      sendResponse({ received: true });
      return true;
    }

    if (request.action === 'TASK_PROGRESS') {
      addLog(`[Progress] ${request.message || ''}`);
      sendResponse({ received: true });
      return true;
    }

    // Standalone Storage & AI Handlers
    if (request.action === 'SAVE_APPLIED_JOB') {
      saveAppliedJobToStorage(request.job)
        .then(data => sendResponse({ success: true, data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (request.action === 'GET_APPLIED_JOBS') {
      chrome.storage.local.get(['applied_jobs'], (res) => {
        sendResponse({ success: true, jobs: res.applied_jobs || [] });
      });
      return true;
    }

    if (request.action === 'CLEAR_APPLIED_JOBS') {
      chrome.storage.local.set({ applied_jobs: [] }, () => {
        addLog('Riwayat lamaran lokal berhasil dikosongkan.', 'info');
        sendResponse({ success: true });
      });
      return true;
    }

    if (request.action === 'SAVE_TALENT') {
      saveTalentToStorage(request.candidate, request.requirement)
        .then(data => sendResponse({ success: true, data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (request.action === 'GET_USER_CONFIG') {
      chrome.storage.local.get(['userConfig'], (res) => {
        sendResponse({ success: true, config: res.userConfig || {} });
      });
      return true;
    }

    if (request.action === 'SAVE_USER_CONFIG') {
      chrome.storage.local.set({ userConfig: request.config }, () => {
        addLog('Konfigurasi profil berhasil diperbarui.', 'success');
        sendResponse({ success: true, config: request.config });
      });
      return true;
    }

    if (request.action === 'GENERATE_GEMINI') {
      generateGeminiDirect(request.prompt, request.apiKey, request.model)
        .then(text => sendResponse({ success: true, text }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    // Find or navigate provider tab
    if (request.action === 'NAVIGATE_PROVIDER_TAB') {
      const provider = request.provider || getProvider(request.url);
      findExistingTabForProvider(provider).then((existingTab) => {
        if (existingTab) {
          chrome.tabs.update(existingTab.id, { url: request.url, active: true }, (tab) => {
            sendResponse({ success: true, tabId: tab.id, reused: true });
          });
        } else {
          chrome.tabs.create({ url: request.url, active: true }, (tab) => {
            providerTabs.set(provider, tab.id);
            sendResponse({ success: true, tabId: tab.id, reused: false });
          });
        }
      });
      return true;
    }

    // Save imported candidate profile from active browser tab
    if (request.action === 'SAVE_IMPORTED_PROFILE') {
      const profile = request.profile || {};
      chrome.storage.local.set({ candidateProfile: profile }, () => {
        addLog(`[Profile] Profil ${profile.sourcePortal || 'portal'} berhasil disimpan: "${profile.name || 'Pelamar'}"`, 'success');
      sendResponse({ success: true, profile });
      return true;
    }

    if (request.action === 'GET_IMPORTED_PROFILE') {
      chrome.storage.local.get(['candidateProfile'], (res) => {
        sendResponse({ success: true, profile: res.candidateProfile || null });
      });
      return true;
    }
  } catch (e) {
    sendResponse({ error: e.message });
  }
});
