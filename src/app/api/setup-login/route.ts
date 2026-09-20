import { NextResponse } from 'next/server';
import { launchBrowserWithFallback } from '@/lib/browserHelper';
import { applyStealthToPage } from '@/lib/stealthHelper';

declare global {
  var activeSetupBrowser: any;
}

export async function POST(request: Request) {
  try {
    const { action, profileFolderOverride } = await request.json();

    if (action === 'stop') {
      if (global.activeSetupBrowser) {
        try {
          await global.activeSetupBrowser.close();
        } catch (e) {}
        global.activeSetupBrowser = null;
        return NextResponse.json({ success: true, message: 'Browser closed' });
      }
      return NextResponse.json({ success: true, message: 'No browser running' });
    }

    if (global.activeSetupBrowser) {
      // Periksa apakah browser benar-benar masih terhubung atau sudah ditutup manual oleh user
      const isConnected = typeof global.activeSetupBrowser.isConnected === 'function' 
        ? global.activeSetupBrowser.isConnected() 
        : true;

      if (!isConnected) {
        global.activeSetupBrowser = null;
      } else {
        return NextResponse.json({ success: false, error: 'Browser login masih berjalan. Silakan klik "Tutup Browser" atau tutup jendelanya terlebih dahulu.' }, { status: 400 });
      }
    }

    // Launch Google Chrome (with automatic Chromium fallback) in headful mode
    try {
      const { browser, browserType } = await launchBrowserWithFallback(
        'headful', 
        (msg: string) => console.log(`[SetupLogin] ${msg}`),
        profileFolderOverride
      );

      global.activeSetupBrowser = browser;

      const pages = await browser.pages();
      const page1 = pages[0] || await browser.newPage();
      await applyStealthToPage(page1);
      page1.goto('https://glints.com/id', { waitUntil: 'domcontentloaded' }).catch(() => {});

      const page2 = await browser.newPage();
      await applyStealthToPage(page2);
      page2.goto('https://www.jobstreet.co.id', { waitUntil: 'domcontentloaded' }).catch(() => {});

      const page3 = await browser.newPage();
      await applyStealthToPage(page3);
      page3.goto('https://www.linkedin.com', { waitUntil: 'domcontentloaded' }).catch(() => {});

      const page4 = await browser.newPage();
      await applyStealthToPage(page4);
      page4.goto('https://id.indeed.com', { waitUntil: 'domcontentloaded' }).catch(() => {});

      // Bring tab 1 to front to ensure Chrome window focuses on the user's screen
      await page1.bringToFront().catch(() => {});

      if (process.platform === 'win32') {
        try {
          const { exec } = require('child_process');
          const ps = `(New-Object -ComObject WScript.Shell).AppActivate('Google Chrome')`;
          const encoded = Buffer.from(ps, 'utf16le').toString('base64');
          exec(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, () => {});
        } catch {}
      }

      browser.on('disconnected', () => {
        global.activeSetupBrowser = null;
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Browser launched successfully.',
        browserType
      });
    } catch (error: any) {
      console.error('Error running setup browser:', error);
      global.activeSetupBrowser = null;
      return NextResponse.json({ success: false, error: error.message || 'Failed to launch browser' }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  if (global.activeSetupBrowser) {
    const isConnected = typeof global.activeSetupBrowser.isConnected === 'function' 
      ? global.activeSetupBrowser.isConnected() 
      : true;
    if (!isConnected) {
      global.activeSetupBrowser = null;
    }
  }
  const isRunning = !!global.activeSetupBrowser;
  return NextResponse.json({ isRunning });
}
