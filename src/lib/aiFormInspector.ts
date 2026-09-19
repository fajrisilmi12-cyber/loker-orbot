import { askUniversalAi } from './aiGateway';
import { Page, Frame } from 'puppeteer';

export interface InspectedField {
  index: number;
  label: string;
  type: 'radio' | 'checkbox' | 'select' | 'text' | 'number' | 'textarea' | 'button' | 'unknown';
  currentValue?: string;
  options?: string[];
  selectorHint?: string;
}

export interface FormInspectionResult {
  formGoal: string;
  unfilledFields: Array<{
    fieldIndex: number;
    question: string;
    suggestedAction: 'fill_text' | 'click_option' | 'select_dropdown' | 'click_button';
    suggestedValue?: string;
    targetSelector?: string;
  }>;
  nextButtonSelector?: string;
  confidence: number;
  reasoning: string;
}

/**
 * Clean & extract an interactive snapshot of the current active modal / form
 */
export async function captureFormDomSnapshot(pageOrFrame: Page | Frame, containerSelector = '[data-testid="modal-wrapper"], .artdeco-modal, #ia-container, form, main'): Promise<{
  htmlSnippet: string;
  elementMap: InspectedField[];
}> {
  return await pageOrFrame.evaluate((containerSel: string) => {
    const container = document.querySelector(containerSel) || document.body;

    // Collect all interactive elements
    const interactiveElements = Array.from(container.querySelectorAll(
      'input, textarea, select, [role="radio"], [role="checkbox"], [role="combobox"], button, [data-testid*="select"], [class*="SelectContainer"], [class*="Dropdown"]'
    ));

    const elementMap: InspectedField[] = [];
    const sanitizedNodes: string[] = [];

    interactiveElements.forEach((el, idx) => {
      // Mark element with temporary debug attribute for precision targeting
      el.setAttribute('data-ai-inspect-id', String(idx));

      const tagName = el.tagName.toLowerCase();
      const inputType = (el.getAttribute('type') || '').toLowerCase();
      const role = (el.getAttribute('role') || '').toLowerCase();

      // Find best nearby label or question text
      let label = '';
      const parentLabel = el.closest('label');
      if (parentLabel) {
        label = parentLabel.textContent || '';
      } else {
        const parentQuestion = el.closest('div, fieldset, li, section');
        const heading = parentQuestion?.querySelector('p, h1, h2, h3, h4, legend, span[class*="label"], [class*="title"]');
        if (heading) {
          label = heading.textContent || '';
        } else {
          label = el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || '';
        }
      }
      label = label.trim().replace(/\s+/g, ' ').slice(0, 150);

      let fieldType: InspectedField['type'] = 'unknown';
      let options: string[] = [];

      if (tagName === 'textarea') {
        fieldType = 'textarea';
      } else if (tagName === 'select') {
        fieldType = 'select';
        options = Array.from((el as HTMLSelectElement).options).map(o => o.textContent?.trim() || '').filter(Boolean);
      } else if (inputType === 'radio' || role === 'radio') {
        fieldType = 'radio';
      } else if (inputType === 'checkbox' || role === 'checkbox') {
        fieldType = 'checkbox';
      } else if (tagName === 'button' || role === 'button') {
        fieldType = 'button';
      } else if (['text', 'email', 'tel', 'url'].includes(inputType) || tagName === 'input') {
        fieldType = inputType === 'number' ? 'number' : 'text';
      } else if (role === 'combobox' || el.className.toLowerCase().includes('select') || el.className.toLowerCase().includes('dropdown')) {
        fieldType = 'select';
      }

      const val = (el as any).value || el.textContent?.trim().slice(0, 50) || '';

      elementMap.push({
        index: idx,
        label,
        type: fieldType,
        currentValue: val,
        options: options.slice(0, 15),
        selectorHint: `[data-ai-inspect-id="${idx}"]`,
      });

      sanitizedNodes.push(
        `<item id="${idx}" tag="${tagName}" type="${fieldType}" label="${label}" value="${val.slice(0, 40)}"${options.length > 0 ? ` options="${options.join('|')}"` : ''} />`
      );
    });

    return {
      htmlSnippet: sanitizedNodes.join('\n'),
      elementMap,
    };
  }, containerSelector);
}

/**
 * Ask AI to analyze the DOM snapshot and return concrete action recommendations
 */
export async function inspectFormWithAi(params: {
  platform: string;
  jobTitle: string;
  company: string;
  candidateProfileContext: string;
  domSnippet: string;
  stepHint?: string;
}): Promise<FormInspectionResult | null> {
  const prompt = `Anda adalah AI pakar Web Automation & Form Inspector.
Analisis struktur formulir loker berikut dan berikan rencana aksi pengisian yang tepat dan tombol lanjut/kirim.

Konteks Pelamar:
${params.candidateProfileContext}

Target Loker:
Platform: ${params.platform}
Posisi: ${params.jobTitle}
Perusahaan: ${params.company}
Step Saat Ini: ${params.stepHint || 'Form Step'}

Elemen Form Terdeteksi:
"""
${params.domSnippet}
"""

Tugas Anda:
1. Identifikasi apakah ada input yang belum terisi / dropdown yang masih berupa default "Pilih..." / radio button yang belum dipilih.
2. Tentukan tombol "Selanjutnya" / "Next" / "Kirim" / "Submit" (berdasarkan atribut label atau teks tombol).
3. Kembalikan format JSON valid:
{
  "formGoal": "Tujuan form ini (misal: Ekspektasi Gaji / Pertanyaan Kualifikasi / Kontak)",
  "unfilledFields": [
    {
      "fieldIndex": 0,
      "question": "Pertanyaan yang diajukan",
      "suggestedAction": "click_option | fill_text | select_dropdown | click_button",
      "suggestedValue": "Nilai atau opsi yang harus dipilih sesuai profil pelamar",
      "targetSelector": "[data-ai-inspect-id='0']"
    }
  ],
  "nextButtonSelector": "[data-ai-inspect-id='5']",
  "confidence": 0.95,
  "reasoning": "Alasan singkat"
}`;

  try {
    const rawResponse = await askUniversalAi({
      userPrompt: prompt,
      jsonMode: true,
      temperature: 0.1,
    });

    let cleanJson = rawResponse.replace(/^```(?:json)?\s*/im, '').replace(/```\s*$/im, '').trim();
    const match = cleanJson.match(/\{[\s\S]*\}/);
    if (match) cleanJson = match[0];

    const result = JSON.parse(cleanJson);
    return result as FormInspectionResult;
  } catch (error: any) {
    console.error('[AI Form Inspector Error]', error?.message || error);
    return null;
  }
}

/**
 * Execute AI-derived actions directly on the page/frame
 */
export async function applyAiFormActions(
  pageOrFrame: Page | Frame,
  plan: FormInspectionResult,
  onLog?: (msg: string) => void
): Promise<boolean> {
  const log = onLog || console.log;

  log(`🧠 [AI Inspector] Analisis Form: "${plan.formGoal}" (Confidence: ${Math.round(plan.confidence * 100)}%)`);

  for (const action of plan.unfilledFields) {
    if (!action.targetSelector) continue;

    try {
      const el = await pageOrFrame.$(action.targetSelector);
      if (!el) continue;

      if (action.suggestedAction === 'fill_text' && action.suggestedValue !== undefined) {
        log(`   ✍️ AI Mengisi "${action.question}": "${action.suggestedValue}"`);
        await el.click({ clickCount: 3 });
        await el.type(action.suggestedValue, { delay: 30 });
      } else if (action.suggestedAction === 'click_option' || action.suggestedAction === 'click_button') {
        log(`   🔘 AI Mengklik opsi: "${action.suggestedValue || action.question}"`);
        await el.click();
      } else if (action.suggestedAction === 'select_dropdown') {
        log(`   🔽 AI Memilih dropdown: "${action.suggestedValue || 'Opsi'}"`);
        await el.click();
        await new Promise(r => setTimeout(r, 300));
        // Coba klik opsi dropdown yang muncul
        await pageOrFrame.evaluate((val: string) => {
          const options = Array.from(document.querySelectorAll('[role="option"], [class*="option"], [class*="Option"], [class*="DropdownItem"]'));
          const matched = options.find(o => (o.textContent || '').toLowerCase().includes(val.toLowerCase())) as HTMLElement;
          if (matched) matched.click();
          else if (options[0]) (options[0] as HTMLElement).click();
        }, action.suggestedValue || '');
      }
      await new Promise(r => setTimeout(r, 400));
    } catch (err: any) {
      log(`   ⚠️ Gagal menerapkan aksi AI pada ${action.targetSelector}: ${err?.message || err}`);
    }
  }

  // Klik Next Button jika AI menemukan tombol lanjut
  if (plan.nextButtonSelector) {
    try {
      log(`   👉 AI Mengklik tombol navigasi formulir...`);
      const nextBtn = await pageOrFrame.$(plan.nextButtonSelector);
      if (nextBtn) {
        await nextBtn.click();
        return true;
      }
    } catch (err: any) {
      log(`   ⚠️ Gagal mengklik tombol next via AI: ${err?.message || err}`);
    }
  }

  return false;
}
