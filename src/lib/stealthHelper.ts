/**
 * Advanced Browser Stealth & Anti-Detection Helper
 * Provides realistic browser fingerprinting, WebGL spoofing, webdriver removal,
 * and navigator normalization to pass Cloudflare Turnstile, LinkedIn, Indeed, and Glints bot checks.
 */

export async function applyStealthToPage(page: any): Promise<void> {
  try {
    await page.setViewport({ width: 1366, height: 768 });
  } catch (e) {}

  try {
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      'sec-ch-ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
    });
  } catch (e) {}

  try {
    await page.evaluateOnNewDocument(() => {
      // 1. Remove navigator.webdriver
      try {
        const newProto = Object.getPrototypeOf(navigator);
        delete newProto.webdriver;
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      } catch (e) {}

      // 2. Mock window.chrome runtime & plugins
      try {
        if (!(window as any).chrome) {
          (window as any).chrome = {};
        }
        if (!(window as any).chrome.runtime) {
          (window as any).chrome.runtime = {
            id: undefined,
            connect: () => {},
            sendMessage: () => {},
          };
        }
        if (!(window as any).chrome.app) {
          (window as any).chrome.app = {
            isInstalled: false,
            InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
            RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }
          };
        }
      } catch (e) {}

      // 3. Realistic hardware & languages
      try {
        if (!navigator.hardwareConcurrency || navigator.hardwareConcurrency < 4) {
          Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
        }
        Object.defineProperty(navigator, 'languages', {
          get: () => ['id-ID', 'id', 'en-US', 'en'],
        });
        Object.defineProperty(navigator, 'deviceMemory', {
          get: () => 8,
        });
      } catch (e) {}

      // 4. Mock navigator.plugins (PDF Viewer & Chrome PDF Viewer)
      try {
        const mockPlugins = [
          { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        ];
        Object.defineProperty(navigator, 'plugins', {
          get: () => mockPlugins,
        });
      } catch (e) {}

      // 5. Handle permissions query gracefully
      try {
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters: any) =>
          parameters.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission } as any)
            : originalQuery(parameters);
      } catch (e) {}
    });
  } catch (e) {}
}
