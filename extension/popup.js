/**
 * CV Blaster Companion - Popup Script
 * Reads authenticated session cookies directly from Chrome's cookie store
 * and pushes them in 1-click to the CV Blaster local/hosted server.
 */

let API_BASE = 'http://localhost:3000';

const PORTALS = {
  linkedin: { domain: '.linkedin.com', checkCookie: 'li_at' },
  indeed: { domain: '.indeed.com', checkCookie: 'SURF' },
  glints: { domain: '.glints.com', checkCookie: 'GlintsToken' },
  jobstreet: { domain: '.jobstreet.com', checkCookie: 'jobseekerSession' }
};

document.addEventListener('DOMContentLoaded', async () => {
  const syncBtn = document.getElementById('btn-sync');
  const dashBtn = document.getElementById('btn-open-dashboard');
  const msgBox = document.getElementById('msg-box');
  const guideBox = document.getElementById('guide-box');
  const toggleGuideBtn = document.getElementById('btn-toggle-guide');
  const closeGuideBtn = document.getElementById('guide-close');
  const inputApiUrl = document.getElementById('input-api-url');
  const saveUrlStatus = document.getElementById('save-url-status');

  // Load custom API URL from storage if exists
  chrome.storage.local.get(['cvBlasterApiUrl', 'hasSeenPopupGuide'], (res) => {
    if (res.cvBlasterApiUrl) {
      API_BASE = res.cvBlasterApiUrl.replace(/\/$/, '');
      if (inputApiUrl) inputApiUrl.value = API_BASE;
    }
    // Auto-show guide on first open
    if (!res.hasSeenPopupGuide && guideBox) {
      guideBox.classList.add('show');
    }
  });

  // Save custom API URL when changed
  if (inputApiUrl) {
    inputApiUrl.addEventListener('change', () => {
      let val = inputApiUrl.value.trim().replace(/\/$/, '');
      if (!val) val = 'http://localhost:3000';
      API_BASE = val;
      chrome.storage.local.set({ cvBlasterApiUrl: val }, () => {
        if (saveUrlStatus) {
          saveUrlStatus.style.display = 'inline';
          setTimeout(() => { saveUrlStatus.style.display = 'none'; }, 2000);
        }
      });
    });
  }

  toggleGuideBtn.addEventListener('click', () => {
    guideBox.classList.toggle('show');
  });

  closeGuideBtn.addEventListener('click', () => {
    guideBox.classList.remove('show');
    chrome.storage.local.set({ hasSeenPopupGuide: true });
  });

  dashBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: API_BASE });
  });

  // Check current cookie states
  for (const [key, info] of Object.entries(PORTALS)) {
    try {
      const cookies = await chrome.cookies.getAll({ domain: info.domain });
      const dot = document.getElementById(`dot-${key}`);
      const text = document.getElementById(`text-${key}`);

      if (cookies.length > 0) {
        dot.className = 'status-dot status-active';
        text.innerText = `${cookies.length} Cookies`;
        text.style.color = '#34d399';
      } else {
        dot.className = 'status-dot status-inactive';
        text.innerText = 'Belum Ada';
        text.style.color = '#94a3b8';
      }
    } catch {}
  }

  // 1-Click Sync Handler
  syncBtn.addEventListener('click', async () => {
    syncBtn.disabled = true;
    const syncText = document.getElementById('sync-btn-text');
    if (syncText) syncText.innerText = 'Menyinkronkan...';
    msgBox.className = 'msg';
    msgBox.innerText = '';

    try {
      // 1. Fetch active config
      const cfgRes = await fetch(`${API_BASE}/api/config`);
      if (!cfgRes.ok) throw new Error(`Server tidak merespons di ${API_BASE}`);
      const cfgData = await cfgRes.json();
      const currentConfig = cfgData.config || {};

      // 2. Extract cookies for each portal
      const collectedCookies = {};
      let totalSynced = 0;

      for (const [key, info] of Object.entries(PORTALS)) {
        const cookies = await chrome.cookies.getAll({ domain: info.domain });
        if (cookies && cookies.length > 0) {
          collectedCookies[key] = JSON.stringify(cookies);
          totalSynced += cookies.length;
        }
      }

      // 3. Save to backend config
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
        msgBox.className = 'msg success';
        msgBox.innerText = `${totalSynced} cookie berhasil tersinkron ke ${API_BASE}.`;
      } else {
        throw new Error('Gagal menyimpan ke config server');
      }
    } catch (err) {
      msgBox.className = 'msg error';
      msgBox.innerText = `${err.message || err}`;
    } finally {
      syncBtn.disabled = false;
      if (syncText) syncText.innerText = 'Sinkronkan Cookie';
    }
  });
});
