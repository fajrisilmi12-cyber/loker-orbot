import { NextResponse } from 'next/server';
import { launchBrowserWithFallback } from '@/lib/browserHelper';
import { getConfig } from '@/lib/config';
import { parseCookiesInput, injectCookiesIntoPage } from '@/lib/cookieHelper';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 1 minute max for session checks

export async function POST(request: Request) {
  if (global.activeSetupBrowser || global.isBotRunning) {
    return NextResponse.json({
      success: false,
      message: 'Browser otomasi sedang berjalan. Pengecekan sesi ditunda agar tidak bentrok.',
      results: {
        glints: { loggedIn: true, details: 'Sesi aktif / sedang digunakan bot' },
        jobstreet: { loggedIn: true, details: 'Sesi aktif / sedang digunakan bot' },
        linkedin: { loggedIn: true, details: 'Sesi aktif / sedang digunakan bot' },
        indeed: { loggedIn: true, details: 'Sesi aktif / sedang digunakan bot' },
      }
    });
  }

  let browser: any = null;
  try {
    const { profileFolder } = await request.json();
    const config = getConfig();

    // Launch in headless mode to quickly check session status
    const launchResult = await launchBrowserWithFallback('headless', undefined, profileFolder);
    browser = launchResult.browser;

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    const results: {
      glints: { loggedIn: boolean; details?: string };
      jobstreet: { loggedIn: boolean; details?: string };
      linkedin: { loggedIn: boolean; details?: string };
      indeed: { loggedIn: boolean; details?: string };
    } = {
      glints: { loggedIn: false },
      jobstreet: { loggedIn: false },
      linkedin: { loggedIn: false },
      indeed: { loggedIn: false },
    };

    // 1. Cek LinkedIn
    try {
      // Injeksi cookies jika tersedia di config (dari ekstensi Chrome / sinkronisasi)
      if (config.portalCookies?.linkedin) {
        const cookies = parseCookiesInput(config.portalCookies.linkedin, '.linkedin.com');
        if (cookies.length > 0) {
          await injectCookiesIntoPage(page, cookies);
        }
      }

      await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await new Promise((r) => setTimeout(r, 2000));
      const currentUrl = page.url();
      const isLoggedLinkedin = await page.evaluate(() => {
        const hasFeed = !!document.querySelector('.feed-identity-module, .global-nav__me, #global-nav, img.global-nav__me-photo, button.global-nav__primary-link-me-menu-trigger, [data-control-name="nav.settings"]');
        const hasSignIn = !!document.querySelector('a[href*="/login"], a[href*="/signup"], .join-form, #login-email, input#username');
        const isFeedUrl = window.location.href.includes('/feed');
        return hasFeed || (isFeedUrl && !hasSignIn);
      });
      const isNotLoginUrl = !currentUrl.includes('/login') && !currentUrl.includes('/signup') && !currentUrl.includes('/checkpoint');
      results.linkedin = {
        loggedIn: isLoggedLinkedin && isNotLoginUrl,
        details: isLoggedLinkedin && isNotLoginUrl ? 'Sesi aktif' : 'Belum login / Sesi kedaluwarsa',
      };
    } catch (e: any) {
      results.linkedin = { loggedIn: false, details: 'Gagal memuat halaman' };
    }

    // 2. Cek Jobstreet
    try {
      if (config.portalCookies?.jobstreet) {
        const cookies = parseCookiesInput(config.portalCookies.jobstreet, '.jobstreet.com');
        if (cookies.length > 0) {
          await injectCookiesIntoPage(page, cookies);
        }
      }

      await page.goto('https://id.jobstreet.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await new Promise((r) => setTimeout(r, 1000));
      const isLoggedJobstreet = await page.evaluate(() => {
        return !!document.querySelector('[data-automation="user-menu"], a[href*="/profile"], button[aria-label*="Profile"]');
      });
      results.jobstreet = {
        loggedIn: isLoggedJobstreet,
        details: isLoggedJobstreet ? 'Sesi aktif' : 'Belum login',
      };
    } catch (e: any) {
      results.jobstreet = { loggedIn: false, details: 'Gagal memuat halaman' };
    }

    // 3. Cek Glints
    try {
      if (config.portalCookies?.glints) {
        const cookies = parseCookiesInput(config.portalCookies.glints, '.glints.com');
        if (cookies.length > 0) {
          await injectCookiesIntoPage(page, cookies);
        }
      }

      await page.goto('https://glints.com/id', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await new Promise((r) => setTimeout(r, 1000));
      const isLoggedGlints = await page.evaluate(() => {
        const hasAvatar = !!document.querySelector('[data-cy="user-avatar"], [class*="UserAvatar"], a[href*="/profile"]');
        const hasSignInBtn = !!document.querySelector('a[href*="/login"], button[data-cy="login-button"], a[href*="/register"]');
        return hasAvatar || !hasSignInBtn;
      });
      results.glints = {
        loggedIn: isLoggedGlints,
        details: isLoggedGlints ? 'Sesi aktif' : 'Belum login',
      };
    } catch (e: any) {
      results.glints = { loggedIn: false, details: 'Gagal memuat halaman' };
    }

    // 4. Cek Indeed
    try {
      if (config.portalCookies?.indeed) {
        const cookies = parseCookiesInput(config.portalCookies.indeed, '.indeed.com');
        if (cookies.length > 0) {
          await injectCookiesIntoPage(page, cookies);
        }
      }

      await page.goto('https://id.indeed.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await new Promise((r) => setTimeout(r, 2000));
      const currentUrl = page.url();
      const isLoggedIndeed = await page.evaluate(() => {
        const hasUserMenu = !!document.querySelector('[data-gnav-element-name="UserMenu"], a[href*="/account"], button[aria-label*="akun"], [class*="AccountMenu"], [data-testid="gnav-ProfileMenu"]');
        const hasSignIn = !!document.querySelector('a[href*="/account/login"], a[href*="secure.indeed.com/auth"], button[data-gnav-element-name="SignIn"]');
        return (hasUserMenu && !hasSignIn) || (!hasSignIn && !window.location.href.includes('/auth') && !window.location.href.includes('/login'));
      });
      const isNotLoginUrl = !currentUrl.includes('/account/login') && !currentUrl.includes('/auth');
      results.indeed = {
        loggedIn: isLoggedIndeed && isNotLoginUrl,
        details: isLoggedIndeed && isNotLoginUrl ? 'Sesi aktif' : 'Belum login',
      };
    } catch (e: any) {
      results.indeed = { loggedIn: false, details: 'Gagal memuat halaman' };
    }

    return NextResponse.json({
      success: true,
      profileFolder: profileFolder || 'automation-profile',
      sessions: results,
    });
  } catch (error: any) {
    console.error('Check sessions error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Gagal memeriksa sesi portal akun.',
    }, { status: 500 });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
  }
}
