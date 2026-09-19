import { Page } from 'puppeteer';
import { askUniversalAi } from './aiGateway';
import { addAppliedJob } from './storage';
import { sleep, humanType, humanClick } from './humanStealth';
import path from 'path';
import fs from 'fs';

export interface ExternalJobApplyResult {
  success: boolean;
  message: string;
  appliedUrl: string;
  questionsAndAnswers: Array<{ question: string; answer: string; type?: string }>;
}

/**
 * Universal External Job Application Solver
 * Uses AI Vision & DOM analysis to automatically fill external career forms
 * (Greenhouse, Lever, Workday, Ashby, BambooHR, SmartRecruiters, custom HTML forms).
 */
export async function solveExternalJobApplication(
  page: Page,
  config: any,
  jobDetails: {
    title: string;
    company: string;
    platform: string;
    originalJobUrl: string;
  },
  onLog: (msg: string) => void
): Promise<ExternalJobApplyResult> {
  const qaRecords: Array<{ question: string; answer: string; type?: string }> = [];
  const activeUrl = page.url();
  onLog(`🌐 [External Job Solver] Membuka formulir eksternal: ${activeUrl}`);

  try {
    await sleep(3500);

    // 1. Cek apakah halaman memiliki form lamaran
    const hasForm = await page.evaluate(() => {
      return !!document.querySelector('form, [class*="application" i], [id*="application" i], input[type="file"], input[name*="name" i], input[name*="email" i]');
    });

    if (!hasForm) {
      // Coba klik tombol "Apply", "Apply Now", "Lamar", "Submit Application" jika berada di halaman landing loker
      const clickedApply = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('a, button')) as HTMLElement[];
        const applyBtn = buttons.find(b => {
          const text = (b.textContent || '').trim().toLowerCase();
          return /^(apply|apply now|apply for this job|lamar sekarang|lamar pekerjaan ini)$/i.test(text);
        });
        if (applyBtn) {
          applyBtn.click();
          return true;
        }
        return false;
      });

      if (clickedApply) {
        onLog('🔘 [External Job Solver] Menekan tombol "Apply Now" pada halaman utama...');
        await sleep(3000);
      }
    }

    // 2. Upload File CV / Resume jika ada input file
    const cvPath = config.cvFilePath ? (path.isAbsolute(config.cvFilePath) ? config.cvFilePath : path.join(/*turbopackIgnore: true*/ process.cwd(), config.cvFilePath)) : null;
    if (cvPath && fs.existsSync(cvPath)) {
      try {
        const fileInputs = await page.$$('input[type="file"]');
        if (fileInputs.length > 0) {
          onLog(`📄 [External Job Solver] Mengunggah file CV: "${path.basename(cvPath)}"...`);
          for (const fileInput of fileInputs) {
            await fileInput.uploadFile(cvPath);
            await sleep(1000);
          }
          qaRecords.push({
            question: 'Resume / CV Document',
            answer: path.basename(cvPath),
            type: 'file_upload'
          });
          onLog('✅ [External Job Solver] File CV berhasil diunggah!');
        }
      } catch (err: any) {
        onLog(`⚠️ [External Job Solver] Gagal upload file CV: ${err.message || err}`);
      }
    }

    // 3. Scan seluruh field formulir yang tersedia
    const formFields = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="file"]), textarea, select'
      )) as (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)[];

      return inputs.map((el, idx) => {
        el.setAttribute('data-external-field-id', String(idx));
        const labelEl = el.closest('label') || 
                        document.querySelector(`label[for="${el.id}"]`) ||
                        el.closest('div, fieldset, tr')?.querySelector('label, [class*="label"], [class*="title"], p, span');

        let label = labelEl?.textContent?.trim().replace(/\s+/g, ' ') || '';
        if (!label) {
          label = el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || '';
        }

        const tagName = el.tagName.toLowerCase();
        const type = (el.getAttribute('type') || tagName).toLowerCase();
        const name = el.getAttribute('name') || '';
        const id = el.id || '';
        const required = el.required || el.getAttribute('aria-required') === 'true' || label.includes('*');

        let options: string[] = [];
        if (tagName === 'select') {
          options = Array.from((el as HTMLSelectElement).options).map(o => o.textContent?.trim() || '').filter(Boolean);
        }

        return {
          idx,
          tagName,
          type,
          name,
          id,
          label,
          required,
          currentValue: el.value || '',
          options
        };
      });
    });

    onLog(`📋 [External Job Solver] Terdeteksi ${formFields.length} kolom formulir pada halaman.`);

    // 4. Isi field standar berbasis profil kandidat
    const nameParts = (config.fullName || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || firstName;
    const email = config.email || '';
    const phone = config.phoneNumber || '';
    const city = config.location || config.domicile || 'Surabaya';
    const linkedin = config.linkedinUrl || '';
    const github = config.githubUrl || '';
    const portfolio = config.portfolioUrl || '';
    const salary = String(config.expectedSalary || 5000000);

    for (const field of formFields) {
      if (field.currentValue && field.currentValue.length > 0) continue;
      const lbl = field.label.toLowerCase();
      const nm = field.name.toLowerCase();
      const id = field.id.toLowerCase();

      let fillValue = '';

      if (/first\s*name|nama\s*depan/i.test(lbl) || /first_?name/i.test(nm) || /first_?name/i.test(id)) {
        fillValue = firstName;
      } else if (/last\s*name|nama\s*belakang|surname/i.test(lbl) || /last_?name/i.test(nm) || /last_?name/i.test(id)) {
        fillValue = lastName;
      } else if (/full\s*name|nama\s*lengkap|your\s*name|nama/i.test(lbl) || /full_?name/i.test(nm) || /name/i.test(id)) {
        fillValue = config.fullName || firstName;
      } else if (/email|surel/i.test(lbl) || /email/i.test(nm) || /email/i.test(id)) {
        fillValue = email;
      } else if (/phone|telepon|no\s*hp|mobile|whatsapp/i.test(lbl) || /phone/i.test(nm) || /mobile/i.test(id)) {
        fillValue = phone;
      } else if (/linkedin/i.test(lbl) || /linkedin/i.test(nm) || /linkedin/i.test(id)) {
        fillValue = linkedin;
      } else if (/github/i.test(lbl) || /github/i.test(nm) || /github/i.test(id)) {
        fillValue = github;
      } else if (/portfolio|website|link|url/i.test(lbl) || /website/i.test(nm) || /portfolio/i.test(id)) {
        fillValue = portfolio;
      } else if (/city|kota|domisili|location|lokasi|address|alamat/i.test(lbl) || /city/i.test(nm) || /location/i.test(id)) {
        fillValue = city;
      } else if (/salary|gaji|compensation|ekspektasi/i.test(lbl) || /salary/i.test(nm)) {
        fillValue = salary;
      }

      // Jika field kustom / kuesioner belum terjawab, tanyakan ke AI
      if (!fillValue && field.label.length > 3) {
        try {
          const aiResponseText = await askUniversalAi({
            userPrompt: `Anda adalah asisten cerdas yang sedang mengisi formulir lamaran kerja.
Jawab pertanyaan berikut secara ringkas, profesional, dan to-the-point sesuai profil kandidat.

Data Kandidat:
- Nama: ${config.fullName}
- Keahlian: ${config.skills}
- Pengalaman: ${config.yearsOfExperience} tahun
- Lokasi: ${city}
- Gaji yang Diharapkan: Rp ${salary}
- Status Kerja: Siap bergabung segera (${config.noticePeriod || 'Immediately'})
- CV Teks: ${config.cvExtractedText ? config.cvExtractedText.slice(0, 1000) : ''}

Pertanyaan Formulir:
"${field.label}"
${field.options && field.options.length > 0 ? `Pilihan Opsi: [${field.options.join(', ')}]` : ''}

Instruksi:
- Jika ini pilihan dropdown, jawab HANYA dengan teks opsi yang paling cocok.
- Jika ini input teks/angka, jawab dengan nilai langsung (tanpa penjelasan tambahan).`,
            systemPrompt: 'Jawab pertanyaan form dengan akurat, singkat, dan siap diisikan ke dalam input.'
          });

          if (aiResponseText) {
            fillValue = aiResponseText.trim().replace(/^["']|["']$/g, '');
          }
        } catch (e) {}
      }

      if (fillValue) {
        onLog(`✍️ [External Form] Mengisi "${field.label || field.name}": "${fillValue}"`);
        qaRecords.push({
          question: field.label || field.name || 'Pertanyaan Form',
          answer: fillValue,
          type: field.type
        });

        // Terapkan nilai ke elemen
        await page.evaluate((fieldIdx: number, val: string) => {
          const el = document.querySelector(`[data-external-field-id="${fieldIdx}"]`) as (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement);
          if (!el) return;

          if (el.tagName.toLowerCase() === 'select') {
            const selectEl = el as HTMLSelectElement;
            const targetOption = Array.from(selectEl.options).find(o => 
              (o.textContent || '').toLowerCase().includes(val.toLowerCase()) || 
              (o.value || '').toLowerCase().includes(val.toLowerCase())
            );
            if (targetOption) {
              selectEl.value = targetOption.value;
            } else if (selectEl.options.length > 1) {
              selectEl.selectedIndex = 1;
            }
            selectEl.dispatchEvent(new Event('change', { bubbles: true }));
          } else if ((el as HTMLInputElement).type === 'checkbox') {
            (el as HTMLInputElement).checked = true;
            el.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            const nativeSetter = Object.getOwnPropertyDescriptor(
              el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
              'value'
            )?.set;
            if (nativeSetter) {
              nativeSetter.call(el, val);
            } else {
              el.value = val;
            }
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, field.idx, fillValue);
        await sleep(300);
      }
    }

    // 5. Centang seluruh checkbox persetujuan / consent / terms
    await page.evaluate(() => {
      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]:not(:checked)')) as HTMLInputElement[];
      checkboxes.forEach(cb => {
        cb.checked = true;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });

    // 6. Submit atau Simulasi Submit
    if (config.debugTest) {
      onLog(`🛡️ [External Job Solver - DEBUG] Formulir eksternal selesai diisi secara otomatis (Simulasi - Tombol submit tidak ditekan).`);
      await addAppliedJob({
        company: jobDetails.company,
        title: jobDetails.title,
        platform: `${jobDetails.platform} (External)`,
        jobUrl: activeUrl,
        status: 'Dry-run Sim',
        questionsAndAnswers: qaRecords
      });
      return {
        success: true,
        message: 'Simulasi pengisian form eksternal berhasil',
        appliedUrl: activeUrl,
        questionsAndAnswers: qaRecords
      };
    } else {
      onLog('🚀 [External Job Solver] Mengirimkan formulir lamaran eksternal...');
      const submitted = await page.evaluate(() => {
        const submitBtn = document.querySelector('button[type="submit"], input[type="submit"]') ||
                          Array.from(document.querySelectorAll('button, a')).find(b => 
                            /^(submit|submit application|send application|kirim lamaran|apply)$/i.test((b.textContent || '').trim())
                          );
        if (submitBtn) {
          (submitBtn as HTMLElement).click();
          return true;
        }
        return false;
      });

      await sleep(4000);

      await addAppliedJob({
        company: jobDetails.company,
        title: jobDetails.title,
        platform: `${jobDetails.platform} (External)`,
        jobUrl: activeUrl,
        status: 'Applied',
        questionsAndAnswers: qaRecords
      });

      onLog(`🎉 [External Job Solver] Lamaran eksternal ke "${jobDetails.company}" (${jobDetails.title}) berhasil dikirim & disimpan!`);
      return {
        success: true,
        message: 'Lamaran eksternal berhasil dikirim',
        appliedUrl: activeUrl,
        questionsAndAnswers: qaRecords
      };
    }
  } catch (err: any) {
    onLog(`❌ [External Job Solver Error] ${err.message || err}`);
    return {
      success: false,
      message: err.message || String(err),
      appliedUrl: activeUrl,
      questionsAndAnswers: qaRecords
    };
  }
}
