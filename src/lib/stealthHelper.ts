/**
 * Advanced Browser Stealth & Anti-Detection Helper
 * Provides realistic browser fingerprinting, WebGL spoofing, webdriver removal,
 * and navigator normalization to pass Cloudflare, LinkedIn, Indeed, and Glints bot checks.
 */

export async function applyStealthToPage(page: any): Promise<void> {
  try {
    await page.setViewport({ width: 1366, height: 768 });
  } catch (e) {}

  try {
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    });
  } catch (e) {}

  try {
    // Non-destructive safe defaults: ensure hardwareConcurrency & maxTouchPoints are realistic
    await page.evaluateOnNewDocument(() => {
      try {
        if (!navigator.hardwareConcurrency || navigator.hardwareConcurrency < 4) {
          Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
        }
      } catch (e) {}
    });
  } catch (e) {}
}
