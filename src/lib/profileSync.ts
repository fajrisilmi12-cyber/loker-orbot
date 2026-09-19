import { launchBrowserWithFallback } from './browserHelper';
import { getConfig } from './config';
import { parseCookiesInput, injectCookiesIntoPage } from './cookieHelper';
import { applyStealthToPage } from './stealthHelper';
import { sleep, humanType, humanClick } from './humanStealth';
import path from 'path';
import fs from 'fs';

export async function syncGlintsProfile(onLog: (msg: string) => void): Promise<{ success: boolean; message: string }> {
  const config = getConfig();
  onLog('🚀 Membuka browser untuk sinkronisasi profil Glints otomatis...');

  let browser: any = null;
  try {
    const launchResult = await launchBrowserWithFallback('headful', onLog);
    browser = launchResult.browser;

    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();
    await applyStealthToPage(page);

    // Injeksi cookies jika tersedia
    if (config.portalCookies?.glints) {
      const cookies = parseCookiesInput(config.portalCookies.glints, '.glints.com');
      if (cookies.length > 0) {
        await injectCookiesIntoPage(page, cookies);
        onLog(`🍪 Menyuntikkan ${cookies.length} cookie sesi Glints...`);
      }
    }

    onLog('🌐 Membuka halaman profil Glints (https://glints.com/id/profile)...');
    await page.goto('https://glints.com/id/profile', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(4000);

    const isLoginPage = page.url().includes('/login') || page.url().includes('/signup');
    if (isLoginPage) {
      onLog('⚠️ Sesi Glints belum login. Silakan selesaikan login di browser...');
      // Tunggu hingga user login maksimal 60 detik
      for (let i = 0; i < 12; i++) {
        await sleep(5000);
        if (!page.url().includes('/login') && !page.url().includes('/signup')) {
          onLog('✅ Login Glints berhasil terdeteksi!');
          break;
        }
        onLog(`⏳ Menunggu login... (${(i + 1) * 5}s/60s)`);
      }
    }

    // 1. Upload CV PDF jika tersedia
    const cvPath = config.cvFilePath ? (path.isAbsolute(config.cvFilePath) ? config.cvFilePath : path.join(process.cwd(), config.cvFilePath)) : null;
    if (cvPath && fs.existsSync(cvPath)) {
      onLog(`📄 Mengunggah file CV utama ke Glints: "${path.basename(cvPath)}"...`);
      try {
        const fileInput = await page.$('input[type="file"][accept*="pdf" i], input[type="file"]');
        if (fileInput) {
          await fileInput.uploadFile(cvPath);
          await sleep(3000);
          onLog('✅ File CV berhasil diunggah ke profil Glints!');
        } else {
          // Coba klik tombol "+ Resume"
          const clickedResumeBtn = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, a, div[role="button"]')) as HTMLElement[];
            const rBtn = btns.find(b => /Resume|Unggah CV|Upload CV/i.test(b.textContent || ''));
            if (rBtn) {
              rBtn.click();
              return true;
            }
            return false;
          });
          if (clickedResumeBtn) {
            await sleep(1500);
            const input2 = await page.$('input[type="file"]');
            if (input2) {
              await input2.uploadFile(cvPath);
              await sleep(3000);
              onLog('✅ File CV berhasil diunggah!');
            }
          }
        }
      } catch (uploadErr: any) {
        onLog(`⚠️ Upload CV profil: ${uploadErr.message || uploadErr}`);
      }
    }

    // 2. Isi Kota Domisili
    const candidateCity = (config.location || config.domicile || 'Surabaya').split(/[,/]/)[0].trim() || 'Surabaya';
    onLog(`📍 Mengatur kota domisili profil ke: "${candidateCity}"...`);
    try {
      const cityFieldClicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, div[role="button"], a, p')) as HTMLElement[];
        const cityBtn = btns.find(b => /Data Diri|Ubah data diri|Lokasi|Kota/i.test(b.textContent || ''));
        if (cityBtn) {
          cityBtn.click();
          return true;
        }
        return false;
      });

      if (cityFieldClicked) {
        await sleep(1500);
        const cityInput = await page.$('input[placeholder*="Kota" i], input[placeholder*="Lokasi" i], input[data-cy*="city" i]');
        if (cityInput) {
          await cityInput.click({ clickCount: 3 });
          await sleep(200);
          await cityInput.type(candidateCity, { delay: 60 });
          await sleep(1000);
          // Pilih opsi dropdown pertama
          await page.keyboard.press('ArrowDown');
          await sleep(200);
          await page.keyboard.press('Enter');
          await sleep(1000);
        }

        // Klik Simpan jika ada modal data diri
        await page.evaluate(() => {
          const saveBtn = Array.from(document.querySelectorAll('button')).find(b => /^(Simpan|Save)$/i.test((b.textContent || '').trim())) as HTMLElement;
          if (saveBtn) saveBtn.click();
        });
        await sleep(1500);
        onLog(`✅ Domisili "${candidateCity}" selesai disinkronkan!`);
      }
    } catch (cityErr: any) {
      onLog(`⚠️ Pengaturan domisili: ${cityErr.message || cityErr}`);
    }

    // 3. Tambahkan Skills dari konfigurasi
    const skills = (config.skills || 'Full Stack, JavaScript, React, Node.js, PHP, Laravel, TypeScript, PostgreSQL').split(',').map((s: string) => s.trim()).filter(Boolean);
    if (skills.length > 0) {
      onLog(`🛠️ Mengisi ${skills.length} keahlian utama ke profil Glints...`);
      try {
        const clickedSkill = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button, a, div[role="button"]')) as HTMLElement[];
          const sBtn = btns.find(b => /Skill|Keahlian|\+ Skill/i.test(b.textContent || ''));
          if (sBtn) {
            sBtn.click();
            return true;
          }
          return false;
        });

        if (clickedSkill) {
          await sleep(1500);
          for (const sk of skills.slice(0, 8)) {
            const skillInput = await page.$('input[placeholder*="skill" i], input[placeholder*="keahlian" i], input[placeholder*="cari" i]');
            if (skillInput) {
              await skillInput.click();
              await sleep(100);
              await skillInput.type(sk, { delay: 50 });
              await sleep(800);
              await page.keyboard.press('ArrowDown');
              await sleep(150);
              await page.keyboard.press('Enter');
              await sleep(600);
            }
          }

          // Klik simpan skill
          await page.evaluate(() => {
            const saveBtn = Array.from(document.querySelectorAll('button')).find(b => /^(Simpan|Save)$/i.test((b.textContent || '').trim())) as HTMLElement;
            if (saveBtn) saveBtn.click();
          });
          await sleep(1500);
          onLog('✅ Seluruh keahlian berhasil ditambahkan ke profil Glints!');
        }
      } catch (skillErr: any) {
        onLog(`⚠️ Pengaturan skill: ${skillErr.message || skillErr}`);
      }
    }

    onLog('🎉 Sinkronisasi profil Glints berhasil selesai!');
    await sleep(3000);
    return { success: true, message: 'Profil Glints berhasil disinkronkan dan diperbarui secara otomatis!' };
  } catch (error: any) {
    onLog(`❌ Error sinkronisasi profil: ${error.message || error}`);
    return { success: false, message: error.message || String(error) };
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
  }
}
