/**
 * Pintarnya Bot — API-based (satu-satunya portal tanpa browser).
 * Port dari /root/pintarnya-bot/bot.py (235 baris):
 * - base https://api.pintarnya.com, header authorization Bearer + platform web-kerja
 * - GET /api/v2/pk/job search (pageSize 50), GET /api/pk/job-quiz/<slug>,
 *   POST /api/pk/job/<slug>/apply body {source, is_confirmed_location, quiz_answer}
 * - kuis dijawab via aiGateway (askUniversalAi), skip aman bila gagal, delay 3 detik
 * Signature mengikuti pola glints.ts: runPintarnyaBot(page, config, onLog, sharedLimiter).
 * `page` diabaikan (API-based, tidak butuh browser).
 */
import { isJobAlreadyApplied, addAppliedJob } from '../storage';
import { appendQuestionToCsv } from '../csvHelper';
import { askUniversalAi } from '../aiGateway';
import { evaluateJobMatch } from '../jobMatcher';

export interface BotMetrics {
  successCount: number;
  alreadyAppliedCount: number;
  errorCount: number;
}

export interface SharedLimiter {
  isLimitReached: (platformSuccess: number) => boolean;
  onJobSuccess: () => void;
  getTargetLimit: () => number;
}

const PINTARNYA_BASE = 'https://api.pintarnya.com';
const PAGE_SIZE = 50;
const APPLY_DELAY_MS = 3000;

interface PintarnyaQuizOption {
  code: string;
  description: string;
}

interface PintarnyaQuizQuestion {
  no: number | string;
  name?: string;
  options?: PintarnyaQuizOption[];
}

interface PintarnyaJob {
  slug: string;
  title?: string;
  company?: string;
  company_name?: string;
  location?: string;
  salary?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildPintarnyaHeaders(token: string): Record<string, string> {
  let tok = (token || '').trim();
  if (!tok.toLowerCase().startsWith('bearer ')) tok = `Bearer ${tok}`;
  return {
    authorization: tok,
    platform: 'web-kerja',
    accept: 'application/json',
    'content-type': 'application/json',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/151.0.0.0 Safari/537.36',
  };
}

function buildSearchUrl(page: number, keyword: string): string {
  const q = encodeURIComponent(keyword || '');
  return (
    `${PINTARNYA_BASE}/api/v2/pk/job?city_id=-1&from=Search%20Bar&latitude=3.59154` +
    `&longitude=98.6693&province_id=-1&sort=-recommend&search=${q}&page=${page}&page_size=${PAGE_SIZE}`
  );
}

/** GET satu halaman search; return { jobs, totalPage }. */
export async function fetchPintarnyaSearchPage(
  token: string,
  page: number,
  keyword: string
): Promise<{ jobs: PintarnyaJob[]; totalPage: number }> {
  const headers = buildPintarnyaHeaders(token);
  const res = await fetch(buildSearchUrl(page, keyword), { method: 'GET', headers });
  if (res.status === 401 || res.status === 403) {
    throw new Error(`PINTARNYA_AUTH:${res.status}`);
  }
  if (!res.ok) {
    throw new Error(`Pencarian Pintarnya HTTP ${res.status}`);
  }
  const body: any = await res.json();
  const jobs: PintarnyaJob[] = [];
  const list = body?.data?.list || [];
  for (const group of list) {
    for (const j of group?.sublist || []) {
      if (j?.slug) jobs.push(j as PintarnyaJob);
    }
  }
  const totalPage = Math.max(1, parseInt(body?.data?.pagination?.total_page || '1', 10) || 1);
  return { jobs, totalPage };
}

/** GET kuis; return null bila 404 (tanpa kuis) atau payload tanpa soal. */
export async function fetchPintarnyaQuiz(
  token: string,
  slug: string
): Promise<PintarnyaQuizQuestion[] | null> {
  const headers = buildPintarnyaHeaders(token);
  const res = await fetch(`${PINTARNYA_BASE}/api/pk/job-quiz/${slug}`, { method: 'GET', headers });
  if (res.status === 404) return null;
  if (res.status === 401 || res.status === 403) {
    throw new Error(`PINTARNYA_AUTH:${res.status}`);
  }
  if (!res.ok) return null; // skip aman bila gagal
  try {
    const body: any = await res.json();
    const qs = body?.data?.quiz?.question || [];
    return Array.isArray(qs) && qs.length > 0 ? (qs as PintarnyaQuizQuestion[]) : null;
  } catch {
    return null;
  }
}

/** Jawab kuis pilih-satu-kode via aiGateway. Return [] bila gagal (skip aman). */
export async function answerPintarnyaQuiz(
  questions: PintarnyaQuizQuestion[],
  onLog: (msg: string) => void
): Promise<Array<{ no: number | string; answer: string }>> {
  try {
    let prompt =
      'Pilih tepat satu kode opsi untuk setiap pertanyaan.\n' +
      'Kembalikan tepat: {"answers":[{"no":1,"answer":"a"}]}\n\n';
    for (const q of questions) {
      prompt += `\n[${q.no}] ${q.name || '?'}\n`;
      for (const o of q.options || []) {
        prompt += `  (${o.code}) ${o.description}\n`;
      }
    }
    const raw = await askUniversalAi({
      systemPrompt: 'Jawab hanya dengan satu objek JSON valid.',
      userPrompt: prompt,
      temperature: 0,
      jsonMode: true,
    });
    let cleaned = (raw || '').trim().replace(/^```/, '').trim();
    if (cleaned.toLowerCase().startsWith('json')) cleaned = cleaned.slice(4).trim();
    cleaned = cleaned.replace(/```$/, '').trim();
    const parsed: any = JSON.parse(cleaned);
    const arr = Array.isArray(parsed) ? parsed : parsed?.answers;
    if (!Array.isArray(arr)) throw new Error('format jawaban AI tidak valid');
    const out: Array<{ no: number | string; answer: string }> = [];
    for (const q of questions) {
      const found = arr.find((a: any) => String(a?.no) === String(q.no));
      if (!found) throw new Error(`soal no ${q.no} tidak dijawab AI`);
      const code = String(found.answer).trim();
      const validCodes = (q.options || []).map((o) => String(o.code));
      if (!validCodes.includes(code)) throw new Error(`jawaban ${code} invalid untuk soal ${q.no}`);
      out.push({ no: q.no, answer: code });
    }
    return out;
  } catch (err: any) {
    onLog(`⚠️ AI gagal menjawab kuis, skip lamaran: ${err?.message || err}`);
    return [];
  }
}

/**
 * POST apply. Return 'applied' | 'already' | 'skipped'.
 * 409 = sudah melamar. 401/403 dilempar sebagai PINTARNYA_AUTH agar bot berhenti.
 */
export async function submitPintarnyaApply(
  token: string,
  slug: string,
  answers: Array<{ no: number | string; answer: string }>
): Promise<'applied' | 'already' | 'skipped'> {
  const headers = buildPintarnyaHeaders(token);
  const res = await fetch(`${PINTARNYA_BASE}/api/pk/job/${slug}/apply`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      source: 'job_detail',
      is_confirmed_location: true,
      quiz_answer: answers,
    }),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error(`PINTARNYA_AUTH:${res.status}`);
  }
  if (res.status === 409) return 'already';
  if (res.ok) return 'applied';
  return 'skipped';
}

export async function runPintarnyaBot(
  _page: any,
  config: any,
  onLog: (msg: string) => void,
  sharedLimiter?: SharedLimiter
): Promise<BotMetrics> {
  // _page diabaikan — Pintarnya API-based, tidak butuh browser.
  void _page;
  let successCount = 0;
  let alreadyAppliedCount = 0;
  let errorCount = 0;

  const token: string = (config.pintarnyaToken || '').trim();
  if (!token) {
    onLog('❌ Token Pintarnya belum diisi. Masukkan token di tab Wizard (Portal Pintarnya).');
    return { successCount, alreadyAppliedCount, errorCount };
  }

  const keyword: string = (config.pintarnyaKeyword || config.searchKeywords || '').trim();
  const targetLimit = sharedLimiter
    ? sharedLimiter.getTargetLimit()
    : config.limitPintarnya || config.limitPerDay || 50;
  const checkLimitReached = () =>
    sharedLimiter ? sharedLimiter.isLimitReached(successCount) : successCount >= targetLimit;

  onLog(`🔍 Memulai Pintarnya API (keyword: "${keyword || 'Semua'}", target: ${targetLimit} lamaran)...`);

  let currentPage = 1;
  let totalPage = 1;

  try {
    while (currentPage <= totalPage && (global as any).isBotRunning !== false && !checkLimitReached()) {
      let jobs: PintarnyaJob[];
      try {
        const res = await fetchPintarnyaSearchPage(token, currentPage, keyword);
        jobs = res.jobs;
        totalPage = res.totalPage;
      } catch (err: any) {
        if (String(err?.message || '').startsWith('PINTARNYA_AUTH')) {
          onLog('🔑 Token Pintarnya ditolak/expired (401/403). Perbarui token lalu jalankan ulang.');
          break;
        }
        onLog(`⚠️ Gagal mengambil halaman ${currentPage}: ${err?.message || err}`);
        errorCount++;
        break;
      }

      onLog(`📄 Halaman ${currentPage}/${totalPage}: ${jobs.length} loker ditemukan.`);

      for (let i = 0; i < jobs.length; i++) {
        if ((global as any).isBotRunning === false || checkLimitReached()) break;
        const job = jobs[i];
        const title = job.title || '(tanpa judul)';
        const company = job.company || job.company_name || '';
        onLog(`[${i + 1}/${jobs.length}] ${title} | ${job.slug}`);

        try {
          // 1. Dedup lokal
          if (await isJobAlreadyApplied(`https://pintarnya.com/lowongan/${job.slug}`)) {
            onLog(`⏩ Sudah dilamar sebelumnya: ${title}`);
            alreadyAppliedCount++;
            continue;
          }

          // 2. Filter kecocokan (bila aktif)
          if (config.enableJobMatchFilter) {
            const verdict = evaluateJobMatch({
              jobTitle: title,
              company,
              jobDescription: title,
              targetKeywords: config.searchKeywords || '',
              negativeKeywords: config.negativeKeywords || '',
              blacklistedCompanies: config.blacklistedCompanies || '',
              minScoreThreshold: config.minMatchScore ?? 60,
              candidateSkills: config.skills || '',
            });
            if (!verdict.shouldApply) {
              onLog(`⏭️ Dilewati (skor ${verdict.score}): ${verdict.reason}`);
              continue;
            }
          }

          // 3. Kuis (404 = langsung apply)
          let answers: Array<{ no: number | string; answer: string }> = [];
          const quiz = await fetchPintarnyaQuiz(token, job.slug);
          if (quiz && quiz.length > 0) {
            onLog(`  📝 ${quiz.length} soal kuis → menjawab via AI...`);
            answers = await answerPintarnyaQuiz(quiz, onLog);
            if (answers.length === 0) continue; // AI gagal → skip aman
            try {
              for (let qi = 0; qi < quiz.length; qi++) {
                const q = quiz[qi];
                appendQuestionToCsv(
                  `[Pintarnya] ${q.name || `Soal ${q.no}`}`,
                  'radiobutton',
                  (q.options || []).map((o) => `(${o.code}) ${o.description}`),
                  [answers[qi]?.answer || '']
                );
              }
            } catch {}
          } else {
            onLog('  Tanpa kuis → langsung melamar.');
          }

          // 4. Apply (debugTest=true = simulasi tanpa POST, default aman)
          const result = config.debugTest
            ? 'applied'
            : await submitPintarnyaApply(token, job.slug, answers);
          if (result === 'applied') {
            await addAppliedJob({
              company,
              title,
              platform: 'Pintarnya',
              jobUrl: `https://pintarnya.com/lowongan/${job.slug}`,
              status: config.debugTest ? 'Simulated' : 'Success',
              location: job.location || '',
              salary: job.salary || '',
            });
            onLog(`✅ Berhasil melamar: ${title}${config.debugTest ? ' (simulasi)' : ''}`);
            successCount++;
            if (sharedLimiter) sharedLimiter.onJobSuccess();
          } else if (result === 'already') {
            await addAppliedJob({
              company,
              title,
              platform: 'Pintarnya',
              jobUrl: `https://pintarnya.com/lowongan/${job.slug}`,
              status: 'Already Applied',
              location: job.location || '',
            });
            onLog(`⏩ Sudah melamar (409): ${title}`);
            alreadyAppliedCount++;
          } else {
            onLog(`⚠️ Apply gagal/skip untuk: ${title}`);
            errorCount++;
          }
        } catch (err: any) {
          if (String(err?.message || '').startsWith('PINTARNYA_AUTH')) {
            onLog('🔑 Token Pintarnya ditolak/expired (401/403). Perbarui token lalu jalankan ulang.');
            return { successCount, alreadyAppliedCount, errorCount };
          }
          onLog(`❌ Error pada ${title}: ${err?.message || err}`);
          errorCount++;
        }

        if (i < jobs.length - 1) await sleep(APPLY_DELAY_MS);
      }

      currentPage++;
    }
  } catch (err: any) {
    onLog(`❌ Fatal Pintarnya: ${err?.message || err}`);
    errorCount++;
  }

  onLog(`🏁 Pintarnya selesai: ✅ ${successCount} | ⏩ ${alreadyAppliedCount} | ❌ ${errorCount}`);
  return { successCount, alreadyAppliedCount, errorCount };
}
