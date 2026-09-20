import { launchBrowserWithFallback } from './browserHelper';
import { getConfig } from './config';
import { parseCookiesInput, injectCookiesIntoPage } from './cookieHelper';
import { applyStealthToPage } from './stealthHelper';
import { sleep } from './humanStealth';

export interface ScrapedGlintsProfile {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  education?: string;
  experience?: string;
  hasResume?: boolean;
  resumeName?: string;
  hasSkills?: boolean;
  hasAboutMe?: boolean;
  hasExperienceSection?: boolean;
  hasEducationSection?: boolean;
}

export async function syncGlintsProfile(
  onLog: (msg: string) => void,
  onProfileScraped?: (profile: ScrapedGlintsProfile) => void
): Promise<{ success: boolean; data?: ScrapedGlintsProfile; message: string }> {
  const config = getConfig();
  onLog('🚀 Membuka browser untuk pemeriksaan & sinkronisasi profil Glints (Mode Non-Destruktif)...');

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
      onLog('⚠️ Sesi Glints belum login. Menunggu Anda menyelesaikan login di browser...');
      for (let i = 0; i < 12; i++) {
        await sleep(5000);
        if (!page.url().includes('/login') && !page.url().includes('/signup')) {
          onLog('✅ Sesi login Glints aktif!');
          break;
        }
        onLog(`⏳ Menunggu login... (${(i + 1) * 5}s/60s)`);
      }
    }

    // 1. BACA & SCRAPE DATA PROFIL YANG SUDAH ADA DI GLINTS (TIDAK DITIMPA)
    onLog('🔍 Memeriksa kelengkapan bagian profil Glints saat ini...');
    const currentProfile: ScrapedGlintsProfile = await page.evaluate(() => {
      const bodyText = document.body?.innerText || '';

      // Cek Nama
      const nameEl = document.querySelector('h1, h2, [class*="ProfileHeader"] h2, [class*="UserName"]');
      const name = nameEl ? nameEl.textContent?.trim().replace(/\s+/g, ' ') : '';

      // Cek Resume yang sudah ada
      const resumeSection = document.querySelector('[class*="Resume"], [class*="resume"]') || document.body;
      const resumeFileTag = resumeSection ? Array.from(resumeSection.querySelectorAll('p, span, div')).find(el => /\.pdf|\.docx/i.test(el.textContent || '')) : null;
      const hasResume = !!resumeFileTag || bodyText.includes('.pdf') || bodyText.includes('.docx');
      const resumeName = resumeFileTag ? resumeFileTag.textContent?.trim() : (hasResume ? 'CV Terpasang di Glints' : '');

      // Cek Lokasi Domisili
      const locEl = document.querySelector('[class*="Location"], [class*="lokasi"]');
      const locationMatch = bodyText.match(/(?:Kab\.|Kota|Kabupaten)\s+[A-Za-z\s,]+/i);
      const location = locEl ? locEl.textContent?.trim() : (locationMatch ? locationMatch[0].trim() : '');

      // Cek Kontak
      const phoneMatch = bodyText.match(/\+62\s*[\d\s-]+/);
      const emailMatch = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);

      // Cek Pendidikan
      const eduMatch = bodyText.match(/\b(S1|S2|S3|D3|D4|SMA|SMK)\b/i);
      const education = eduMatch ? eduMatch[0].toUpperCase() : '';

      // Cek apakah section tertentu masih kosong (memiliki tombol "+ Tambahkan")
      const hasAboutMeEmpty = /TAMBAHKAN DESKRIPSI TENTANG SAYA|Tambahkan deskripsi/i.test(bodyText);
      const hasSkillsEmpty = /TAMBAHKAN SKILL|Tambahkan skill/i.test(bodyText);
      const hasExperienceEmpty = /TAMBAHKAN PENGALAMAN KERJA|Tambahkan pengalaman/i.test(bodyText);
      const hasEducationEmpty = /TAMBAHKAN PENDIDIKAN|Tambahkan pendidikan/i.test(bodyText);

      return {
        name,
        phone: phoneMatch ? phoneMatch[0].trim() : '',
        email: emailMatch ? emailMatch[0].trim() : '',
        location,
        education,
        hasResume,
        resumeName,
        hasAboutMe: !hasAboutMeEmpty,
        hasSkills: !hasSkillsEmpty,
        hasExperienceSection: !hasExperienceEmpty,
        hasEducationSection: !hasEducationEmpty,
      };
    });

    onLog('==================================================');
    onLog(`👤 Data Terdeteksi di Glints: "${currentProfile.name || 'Pelamar'}"`);
    if (currentProfile.phone) onLog(`📱 WhatsApp: ${currentProfile.phone}`);
    if (currentProfile.email) onLog(`📧 Email: ${currentProfile.email}`);
    if (currentProfile.location) onLog(`📍 Lokasi: ${currentProfile.location}`);
    if (currentProfile.education) onLog(`🎓 Pendidikan: ${currentProfile.education}`);
    if (currentProfile.hasResume) {
      onLog(`📄 Status Resume: ✅ Sudah ada file CV ("${currentProfile.resumeName}") -> Tidak perlu upload ulang.`);
    } else {
      onLog(`📄 Status Resume: Belum ada file CV.`);
    }
    onLog('==================================================');

    if (onProfileScraped) {
      onProfileScraped(currentProfile);
    }

    // 2. ISI DESKRIPSI (TENTANG SAYA) HANYA JIKA MASIH KOSONG
    if (!currentProfile.hasAboutMe) {
      onLog('📝 Seksi "Tentang Saya" masih kosong. Menambahkan deskripsi profesional...');
      try {
        const clickedAddAbout = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button, div[role="button"], a, p, span')) as HTMLElement[];
          const addBtn = btns.find(b => /TAMBAHKAN DESKRIPSI TENTANG SAYA|Tambahkan deskripsi/i.test(b.textContent || ''));
          if (addBtn) {
            addBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            addBtn.click();
            return true;
          }
          return false;
        });

        if (clickedAddAbout) {
          await sleep(1500);
          const aboutInput = await page.$('textarea, [contenteditable="true"]');
          if (aboutInput) {
            const bioText = config.aboutMe || `Saya adalah seorang profesional yang berdedikasi dan adaptif dengan keahlian di bidang ${config.searchKeywords || 'teknologi & operasional'}. Siap berkontribusi secara maksimal baik secara remote maupun on-site.`;
            await aboutInput.click();
            await sleep(200);
            await aboutInput.type(bioText, { delay: 30 });
            await sleep(800);

            // Simpan
            await page.evaluate(() => {
              const saveBtn = Array.from(document.querySelectorAll('button')).find(b => /^(Simpan|Save)$/i.test((b.textContent || '').trim())) as HTMLElement;
              if (saveBtn) saveBtn.click();
            });
            await sleep(2000);
            onLog('✅ Deskripsi "Tentang Saya" berhasil ditambahkan!');
          }
        }
      } catch (aboutErr: any) {
        onLog(`⚠️ Gagal mengisi deskripsi: ${aboutErr?.message || aboutErr}`);
      }
    } else {
      onLog('⏩ Seksi "Tentang Saya" sudah terisi. Melewati pengisian untuk menjaga data asli Anda.');
    }

    // 3. TAMBAHKAN SKILLS HANYA JIKA MASIH KOSONG
    if (!currentProfile.hasSkills) {
      onLog('🛠️ Seksi "Skills" masih kosong. Menambahkan keahlian utama dari data CV...');
      try {
        const clickedAddSkill = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button, div[role="button"], a, p, span')) as HTMLElement[];
          const addBtn = btns.find(b => /TAMBAHKAN SKILL|Tambahkan skill/i.test(b.textContent || ''));
          if (addBtn) {
            addBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            addBtn.click();
            return true;
          }
          return false;
        });

        if (clickedAddSkill) {
          await sleep(1500);
          const rawSkills = (config.skills || 'JavaScript, React, Node.js, TypeScript, Git, Problem Solving, Communication').split(',').map((s: string) => s.trim()).filter(Boolean);
          for (const sk of rawSkills.slice(0, 6)) {
            const skillInput = await page.$('input[placeholder*="skill" i], input[placeholder*="keahlian" i], input[placeholder*="cari" i]');
            if (skillInput) {
              await skillInput.click();
              await sleep(100);
              await skillInput.type(sk, { delay: 40 });
              await sleep(800);
              await page.keyboard.press('ArrowDown');
              await sleep(150);
              await page.keyboard.press('Enter');
              await sleep(500);
            }
          }

          // Simpan
          await page.evaluate(() => {
            const saveBtn = Array.from(document.querySelectorAll('button')).find(b => /^(Simpan|Save)$/i.test((b.textContent || '').trim())) as HTMLElement;
            if (saveBtn) saveBtn.click();
          });
          await sleep(2000);
          onLog('✅ Keahlian (Skills) berhasil ditambahkan ke profil!');
        }
      } catch (skillErr: any) {
        onLog(`⚠️ Gagal mengisi skill: ${skillErr?.message || skillErr}`);
      }
    } else {
      onLog('⏩ Seksi "Skills" sudah terisi. Melewati pengisian untuk menjaga keahlian yang sudah Anda atur.');
    }

    // 4. LINK GITHUB / PORTOFOLIO (Hanya jika belum ada dan tersedia di config)
    if (config.githubUrl) {
      try {
        const clickedPortfolio = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button, div[role="button"], a, p, span')) as HTMLElement[];
          const portBtn = btns.find(b => /Portofolio, Lampiran|TAMBAHKAN PORTOFOLIO/i.test(b.textContent || ''));
          if (portBtn) {
            portBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            portBtn.click();
            return true;
          }
          return false;
        });

        if (clickedPortfolio) {
          await sleep(1500);
          const githubInput = await page.$('input[placeholder*="github.com" i], input[name*="github" i]');
          if (githubInput) {
            const isFilled = await page.evaluate((el: any) => Boolean(el.value && el.value.trim().length > 0), githubInput);
            if (!isFilled) {
              await githubInput.click();
              await githubInput.type(config.githubUrl, { delay: 30 });
              await sleep(500);

              // Simpan
              await page.evaluate(() => {
                const saveBtn = Array.from(document.querySelectorAll('button')).find(b => /^(Simpan|Save)$/i.test((b.textContent || '').trim())) as HTMLElement;
                if (saveBtn) saveBtn.click();
              });
              await sleep(1500);
              onLog(`✅ Link GitHub "${config.githubUrl}" berhasil disinkronkan!`);
            } else {
              // Tutup modal jika sudah terisi
              await page.evaluate(() => {
                const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => /^(Batal|Cancel)$/i.test((b.textContent || '').trim())) as HTMLElement;
                if (cancelBtn) cancelBtn.click();
              });
            }
          }
        }
      } catch {}
    }

    onLog('==================================================');
    onLog('🎉 Sinkronisasi Non-Destruktif Glints selesai sempurna!');
    onLog('💡 Seluruh data penting Anda (Nama, Kontak, Domisili, Resume, Foto) tetap aman dan tidak ditimpa.');
    onLog('==================================================');

    await sleep(2500);
    return {
      success: true,
      data: currentProfile,
      message: 'Profil Glints berhasil disinkronkan secara aman!'
    };
  } catch (error: any) {
    onLog(`❌ Error sinkronisasi profil: ${error.message || error}`);
    return { success: false, message: error.message || String(error) };
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
  }
}

export interface UniversalCandidateProfile {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  education?: string;
  experience?: string;
  skills?: string;
  hasResume?: boolean;
  resumeName?: string;
  headline?: string;
  aboutMe?: string;
  sourcePortal: 'glints' | 'indeed' | 'linkedin' | 'jobstreet';
}

/**
 * Universal Profile Sync Dispatcher for all 4 supported portals
 */
export async function syncCandidateProfile(
  platform: 'glints' | 'indeed' | 'linkedin' | 'jobstreet',
  onLog: (msg: string) => void,
  onProfileScraped?: (profile: UniversalCandidateProfile) => void
): Promise<{ success: boolean; data?: UniversalCandidateProfile; message: string }> {
  if (platform === 'glints') {
    const res = await syncGlintsProfile(onLog, (glintsData) => {
      if (onProfileScraped) {
        onProfileScraped({
          ...glintsData,
          sourcePortal: 'glints',
        });
      }
    });
    return {
      success: res.success,
      data: res.data ? { ...res.data, sourcePortal: 'glints' } : undefined,
      message: res.message,
    };
  }

  const config = getConfig();
  const portalName = platform.toUpperCase();
  onLog(`🚀 Membuka browser untuk pemeriksaan profil ${portalName}...`);

  let browser: any = null;
  try {
    const launchResult = await launchBrowserWithFallback('headful', onLog);
    browser = launchResult.browser;
    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();
    await applyStealthToPage(page);

    let targetUrl = 'https://profile.indeed.com/';
    if (platform === 'jobstreet') targetUrl = 'https://id.jobstreet.com/candidate/profile';
    if (platform === 'linkedin') targetUrl = 'https://www.linkedin.com/in/me';

    // Inject cookies if available
    const cookieString = config.portalCookies?.[platform as keyof typeof config.portalCookies];
    if (cookieString) {
      const domain = platform === 'jobstreet' ? '.jobstreet.com' : platform === 'linkedin' ? '.linkedin.com' : '.indeed.com';
      const cookies = parseCookiesInput(cookieString, domain);
      if (cookies.length > 0) {
        await injectCookiesIntoPage(page, cookies);
        onLog(`🍪 Menyuntikkan ${cookies.length} cookie sesi ${portalName}...`);
      }
    }

    onLog(`🌐 Membuka halaman profil ${portalName} (${targetUrl})...`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(4000);

    // Wait if login is required
    const isLogin = page.url().includes('/login') || page.url().includes('/signup') || page.url().includes('/checkpoint');
    if (isLogin) {
      onLog(`⚠️ Sesi ${portalName} belum aktif. Silakan selesaikan login di browser (menunggu 60 detik)...`);
      for (let i = 0; i < 12; i++) {
        await sleep(5000);
        if (!page.url().includes('/login') && !page.url().includes('/signup') && !page.url().includes('/checkpoint')) {
          onLog(`✅ Sesi login ${portalName} aktif!`);
          break;
        }
        onLog(`⏳ Menunggu login ${portalName}... (${(i + 1) * 5}s/60s)`);
      }
    }

    onLog(`🔍 Membaca data profil ${portalName}...`);

    let scrapedProfile: UniversalCandidateProfile = { sourcePortal: platform };

    if (platform === 'indeed') {
      scrapedProfile = await page.evaluate(() => {
        const bodyText = document.body?.innerText || '';
        const nameEl = document.querySelector('h1, [data-testid="contact-info-name"], [class*="ProfileName"]');
        const name = nameEl ? nameEl.textContent?.trim() : '';

        const phoneMatch = bodyText.match(/\+62\s*[\d\s-]+|\b08\d{8,11}\b/);
        const emailMatch = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        const eduMatch = bodyText.match(/\b(S1|S2|S3|D3|D4|SMA|SMK|Sarjana|Bachelor|Master)\b/i);

        const resumeTag = Array.from(document.querySelectorAll('*')).find(el => /\.pdf|\.docx/i.test(el.textContent || ''));
        const resumeName = resumeTag ? resumeTag.textContent?.trim() : (bodyText.includes('.pdf') ? 'CV Terpasang di Indeed' : '');

        return {
          name: name || '',
          phone: phoneMatch ? phoneMatch[0].trim() : '',
          email: emailMatch ? emailMatch[0].trim() : '',
          education: eduMatch ? eduMatch[0] : '',
          hasResume: !!resumeName,
          resumeName: resumeName || '',
          sourcePortal: 'indeed' as const,
        };
      });
    } else if (platform === 'jobstreet') {
      scrapedProfile = await page.evaluate(() => {
        const bodyText = document.body?.innerText || '';
        const nameEl = document.querySelector('[data-automation="profile-name"], h1, h2');
        const name = nameEl ? nameEl.textContent?.trim() : '';

        const phoneMatch = bodyText.match(/\+62\s*[\d\s-]+|\b08\d{8,11}\b/);
        const emailMatch = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        const eduMatch = bodyText.match(/\b(S1|S2|S3|D3|D4|SMA|SMK|Sarjana|Bachelor)\b/i);

        const resumeEl = document.querySelector('[data-automation="profile-resume"], [data-automation*="resume"]');
        const hasResume = !!resumeEl || bodyText.includes('.pdf');

        return {
          name: name || '',
          phone: phoneMatch ? phoneMatch[0].trim() : '',
          email: emailMatch ? emailMatch[0].trim() : '',
          education: eduMatch ? eduMatch[0] : '',
          hasResume,
          resumeName: hasResume ? 'CV Terpasang di JobStreet' : '',
          sourcePortal: 'jobstreet' as const,
        };
      });
    } else if (platform === 'linkedin') {
      scrapedProfile = await page.evaluate(() => {
        const nameEl = document.querySelector('h1, .text-heading-xlarge');
        const name = nameEl ? nameEl.textContent?.trim() : '';

        const headlineEl = document.querySelector('.text-body-medium, [data-generated-suggestion-target]');
        const headline = headlineEl ? headlineEl.textContent?.trim() : '';

        const locationEl = document.querySelector('.text-body-small.inline.t-black--light.break-words');
        const location = locationEl ? locationEl.textContent?.trim() : '';

        const aboutSection = document.querySelector('section#about, [data-view-name="profile-card"]:has(#about)');
        const aboutMe = aboutSection ? aboutSection.textContent?.replace(/About|Tentang/i, '').trim() : '';

        return {
          name: name || '',
          headline: headline || '',
          location: location || '',
          aboutMe: (aboutMe || '').slice(0, 500),
          sourcePortal: 'linkedin' as const,
        };
      });
    }

    onLog(`==================================================`);
    onLog(`👤 Data Profil ${portalName} Terdeteksi: "${scrapedProfile.name || 'Pelamar'}"`);
    if (scrapedProfile.email) onLog(`📧 Email: ${scrapedProfile.email}`);
    if (scrapedProfile.phone) onLog(`📱 Telepon: ${scrapedProfile.phone}`);
    if (scrapedProfile.location) onLog(`📍 Lokasi: ${scrapedProfile.location}`);
    if (scrapedProfile.education) onLog(`🎓 Pendidikan: ${scrapedProfile.education}`);
    onLog(`==================================================`);

    if (onProfileScraped) {
      onProfileScraped(scrapedProfile);
    }

    await sleep(2000);
    return {
      success: true,
      data: scrapedProfile,
      message: `Profil ${portalName} berhasil ditarik!`,
    };
  } catch (err: any) {
    onLog(`❌ Gagal membaca profil ${portalName}: ${err.message || err}`);
    return {
      success: false,
      message: err.message || String(err),
    };
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
  }
}


