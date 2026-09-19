/**
 * CV Blaster Companion - Popup Script
 * Reads authenticated session cookies directly from Chrome's cookie store
 * and pushes them in 1-click to the CV Blaster local/hosted server.
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

async function getCookiesForPortal(info) {
  let allCookies = [];
  // 1. Fetch by URLs (crucial for Secure / Host-only cookies like li_at)
  if (info.urls) {
    for (const u of info.urls) {
      try {
        const uCookies = await chrome.cookies.getAll({ url: u });
        allCookies = allCookies.concat(uCookies);
      } catch {}
    }
  }
  // 2. Fetch by Domains
  if (info.domains) {
    for (const d of info.domains) {
      try {
        const dCookies = await chrome.cookies.getAll({ domain: d });
        allCookies = allCookies.concat(dCookies);
      } catch {}
    }
  }
  // Deduplicate
  const uniqueMap = new Map();
  allCookies.forEach(c => uniqueMap.set(`${c.name}_${c.domain}_${c.path}`, c));
  return Array.from(uniqueMap.values());
}


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
      const uniqueList = await getCookiesForPortal(info);
      const count = uniqueList.length;
      const hasAuthCookie = !info.checkCookie || uniqueList.some(c => c.name === info.checkCookie);

      const dot = document.getElementById(`dot-${key}`);
      const text = document.getElementById(`text-${key}`);

      if (count > 0 && hasAuthCookie) {
        dot.className = 'status-dot status-active';
        text.innerText = `${count} Cookies (Aktif)`;
        text.style.color = '#34d399';
      } else if (count > 0) {
        dot.className = 'status-dot status-active';
        text.innerText = `${count} Cookies`;
        text.style.color = '#fbbf24'; // Warning: cookies ada tapi token login spesifik belum ada
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

      // 2. Extract cookies for each portal across URLs and domains
      const collectedCookies = {};
      let totalSynced = 0;

      for (const [key, info] of Object.entries(PORTALS)) {
        const uniqueList = await getCookiesForPortal(info);
        if (uniqueList.length > 0) {
          collectedCookies[key] = JSON.stringify(uniqueList);
          totalSynced += uniqueList.length;
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
