import { NextResponse } from 'next/server';
import { launchBrowserWithFallback } from '@/lib/browserHelper';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 1 minute max for session checks

export async function POST(request: Request) {
  let browser: any = null;
  try {
    const { profileFolder } = await request.json();

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
      await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      const currentUrl = page.url();
      const isLoggedLinkedin = await page.evaluate(() => {
        const hasFeed = !!document.querySelector('.feed-identity-module, .global-nav__me, #global-nav');
        const hasSignIn = !!document.querySelector('a[href*="/login"], a[href*="/signup"], .join-form, #login-email');
        return hasFeed && !hasSignIn;
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
      await page.goto('https://id.jobstreet.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
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
      await page.goto('https://glints.com/id', { waitUntil: 'domcontentloaded', timeout: 15000 });
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
      await page.goto('https://id.indeed.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      const currentUrl = page.url();
      const isLoggedIndeed = await page.evaluate(() => {
        const hasUserMenu = !!document.querySelector('[data-gnav-element-name="UserMenu"], a[href*="/account"], button[aria-label*="akun"], [class*="AccountMenu"]');
        const hasSignIn = !!document.querySelector('a[href*="/account/login"], a[href*="secure.indeed.com/auth"]');
        return hasUserMenu && !hasSignIn;
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
