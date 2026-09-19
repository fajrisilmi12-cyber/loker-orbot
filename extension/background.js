/**
 * CV Blaster Companion - Automatic Background Cookie Synchronizer
 * Automatically watches login sessions and syncs cookies to CV Blaster
 * in the background (ZERO USER INTERACTION REQUIRED).
 */

let API_BASE = 'http://localhost:3000';

const PORTALS = {
  linkedin: { domain: '.linkedin.com' },
  indeed: { domain: '.indeed.com' },
  glints: { domain: '.glints.com' },
  jobstreet: { domain: '.jobstreet.com' }
};

// Automatic Sync Function
async function autoSyncCookies() {
  try {
    // Read saved custom server URL if configured
    const storageData = await chrome.storage.local.get(['cvBlasterApiUrl']);
    if (storageData.cvBlasterApiUrl) {
      API_BASE = storageData.cvBlasterApiUrl.replace(/\/$/, '');
    }

    const collectedCookies = {};
    let hasAnyCookie = false;

    for (const [key, info] of Object.entries(PORTALS)) {
      const cookies = await chrome.cookies.getAll({ domain: info.domain });
      if (cookies && cookies.length > 0) {
        collectedCookies[key] = JSON.stringify(cookies);
        hasAnyCookie = true;
      }
    }

    if (!hasAnyCookie) return;

    // Fetch current config
    const cfgRes = await fetch(`${API_BASE}/api/config`);
    if (!cfgRes.ok) return;
    const cfgData = await cfgRes.json();
    const currentConfig = cfgData.config || {};

    // Push updated cookies
    const updatedConfig = {
      ...currentConfig,
      portalCookies: {
        ...(currentConfig.portalCookies || {}),
        ...collectedCookies
      }
    };

    await fetch(`${API_BASE}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedConfig)
    });

    console.log('[CV Blaster Auto-Sync] Cookies automatically updated in background!');
  } catch (err) {
    // Silent fail if server is not reachable
  }
}

// 1. Run auto-sync whenever user installs or starts browser
chrome.runtime.onInstalled.addListener(() => {
  autoSyncCookies();
  // Set alarm to re-sync every 15 minutes automatically
  chrome.alarms.create('autoSyncCookiesAlarm', { periodInMinutes: 15 });
});

chrome.runtime.onStartup.addListener(() => {
  autoSyncCookies();
});

// 2. Periodic alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'autoSyncCookiesAlarm') {
    autoSyncCookies();
  }
});

// 3. Listen to cookie changes on LinkedIn, Indeed, Glints, JobStreet
// Whenever user logs in on their browser, it automatically pushes to CV Blaster!
chrome.cookies.onChanged.addListener((changeInfo) => {
  const domain = changeInfo.cookie.domain || '';
  if (
    domain.includes('linkedin.com') ||
    domain.includes('indeed.com') ||
    domain.includes('glints.com') ||
    domain.includes('jobstreet')
  ) {
    autoSyncCookies();
  }
});
