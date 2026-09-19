/**
 * Advanced Browser Stealth & Anti-Detection Helper
 * Provides realistic browser fingerprinting, WebGL spoofing, webdriver removal,
 * and navigator normalization to pass Cloudflare, LinkedIn, Indeed, and Glints bot checks.
 */

export async function applyStealthToPage(page: any): Promise<void> {
  const standardUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  
  try {
    await page.setViewport({ width: 1366, height: 768 });
  } catch (e) {}

  try {
    await page.setUserAgent(standardUA);
  } catch (e) {}

  try {
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
      'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
    });
  } catch (e) {}

  try {
    await page.evaluateOnNewDocument(() => {
      // 1. Remove navigator.webdriver flag
      try {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
          configurable: true,
        });
        delete (navigator as any).__proto__.webdriver;
      } catch (e) {}

      // 2. Mock window.chrome runtime & app objects
      try {
        (window as any).chrome = {
          app: {
            isInstalled: false,
            InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
            RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }
          },
          runtime: {
            OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' },
            OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
            PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
            PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
            PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
            RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' },
            connect: () => {},
            sendMessage: () => {}
          }
        };
      } catch (e) {}

      // 3. Mock navigator.plugins and mimeTypes
      try {
        const fakePlugins = [
          {
            0: { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' },
            description: 'Portable Document Format',
            filename: 'internal-pdf-viewer',
            length: 1,
            name: 'Chrome PDF Plugin'
          },
          {
            0: { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
            description: 'Portable Document Format',
            filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
            length: 1,
            name: 'Chrome PDF Viewer'
          }
        ];

        Object.defineProperty(navigator, 'plugins', {
          get: () => fakePlugins,
          configurable: true,
        });

        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en', 'id'],
          configurable: true,
        });
      } catch (e) {}

      // 4. Mock Permissions query
      try {
        if (window.navigator.permissions && window.navigator.permissions.query) {
          const originalQuery = window.navigator.permissions.query;
          window.navigator.permissions.query = (parameters: any) => {
            if (parameters && parameters.name === 'notifications') {
              return Promise.resolve({
                state: (Notification as any)?.permission || 'default',
                onchange: null
              } as any);
            }
            return originalQuery(parameters);
          };
        }
      } catch (e) {}

      // 5. Spoof WebGL Vendor and Renderer (Intel / Windows native GPU)
      try {
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter: number) {
          // UNMASKED_VENDOR_WEBGL
          if (parameter === 37445) {
            return 'Google Inc. (Intel)';
          }
          // UNMASKED_RENDERER_WEBGL
          if (parameter === 37446) {
            return 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)';
          }
          return getParameter.apply(this, [parameter]);
        };

        if (typeof WebGL2RenderingContext !== 'undefined') {
          const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
          WebGL2RenderingContext.prototype.getParameter = function(parameter: number) {
            if (parameter === 37445) {
              return 'Google Inc. (Intel)';
            }
            if (parameter === 37446) {
              return 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)';
            }
            return getParameter2.apply(this, [parameter]);
          };
        }
      } catch (e) {}
    });
  } catch (e) {}
}
