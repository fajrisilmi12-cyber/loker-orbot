/**
 * CV Blaster Companion - Minimal Passive Background Worker
 * Purely on-demand: 0% CPU consumption during general browsing.
 * All cookie sync actions are executed intentionally by the user via the popup.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('[CV Blaster Companion] Ready for on-demand 1-click sync.');
});



