import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { getConfig } from '@/lib/config';
import { askUniversalAi } from '@/lib/aiGateway';
import { invalidateKnowledgeBaseCache } from '@/lib/questionAnswer';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 minutes max per batch chunk

const CSV_PATH = path.join(process.cwd(), 'public', 'imploye-question.csv');

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const startIndex = Math.max(0, parseInt(body.startIndex ?? '0', 10));
    const batchSize = Math.min(25, Math.max(5, parseInt(body.batchSize ?? '15', 10)));

    if (!fs.existsSync(CSV_PATH)) {
      return NextResponse.json({
        success: false,
        error: 'File public/imploye-question.csv tidak ditemukan.',
      }, { status: 404 });
    }

    const content = fs.readFileSync(CSV_PATH, 'utf8');
    const records: string[][] = parse(content, {
      columns: false,
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: true,
    });

    if (records.length <= 1) {
      return NextResponse.json({
        success: false,
        error: 'File CSV kosong atau hanya berisi header.',
      }, { status: 400 });
    }

    const totalQuestions = records.length - 1; // excluding header
    if (startIndex >= totalQuestions) {
      return NextResponse.json({
        success: true,
        completed: true,
        total: totalQuestions,
        processed: 0,
        nextIndex: totalQuestions,
        message: 'Semua pertanyaan sudah selesai diproses!',
      });
    }

    const endIndex = Math.min(startIndex + batchSize, totalQuestions);
    const chunkQuestions: Array<{
      rowIdx: number;
      question: string;
      type: string;
      options: string;
      currentAnswer: string;
    }> = [];

    for (let i = startIndex + 1; i <= endIndex; i++) {
      const row = records[i] || [];
      const question = (row[0] || '').trim();
      const type = (row[1] || 'text').trim();
      const options = (row[2] || '').trim();
      const currentAnswer = (row[3] || '').trim();

      if (question) {
        chunkQuestions.push({
          rowIdx: i,
          question,
          type,
          options,
          currentAnswer,
        });
      }
    }

    if (chunkQuestions.length === 0) {
      return NextResponse.json({
        success: true,
        completed: endIndex >= totalQuestions,
        total: totalQuestions,
        processed: 0,
        nextIndex: endIndex,
      });
    }

    // Prepare Profile Context for AI
    const config = getConfig();
    const candidateContext = `
PROFIL PELAMAR:
- Nama Lengkap: ${config.fullName || 'Pelamar'}
- Email: ${config.email || ''}
- No HP: ${config.phoneNumber || ''}
- Domisili / Lokasi: ${config.domicile || config.location || 'Surabaya, Indonesia'}
- Tingkat Pendidikan: ${config.educationLevel || 'SMA/SMK (Sedang Kuliah S1 Informatika)'}
- IPK / GPA: ${config.gpa || '3.71'}
- Pengalaman Kerja: ${config.yearsOfExperience || 1} tahun
- Ekspektasi Gaji Bulanan: Rp ${config.expectedSalary || 4500000} (atau pilihan terdekat)
- Periode Pemberitahuan (Notice Period): ${config.noticePeriod || 'Immediately (Bisa segera bergabung)'}
- Keahlian Utama (Skills): ${config.skills || 'Full Stack Developer, Laravel, PHP, Node.js, React, Next.js, Python, TypeScript, REST API, Git'}
- Portfolio / GitHub: ${config.portfolioUrl || config.githubUrl || ''}
- LinkedIn: ${config.linkedinUrl || ''}
- CV / Resume File: ${config.cvFileName || 'CV-LUTHFI.pdf'}
`.trim();

    const formattedQuestionsForPrompt = chunkQuestions.map((item, idx) => {
      let optStr = item.options ? ` | Opsi: [${item.options}]` : '';
      return `${idx + 1}. [Tipe: ${item.type}] "${item.question}"${optStr}`;
    }).join('\n');

    const prompt = `Anda adalah asisten AI profesional untuk pengisian formulir lamaran kerja otomatis.
Berdasarkan profil pelamar di bawah, tentukan jawaban yang paling tepat, jujur, realistis, dan menguntungkan bagi pelamar untuk setiap pertanyaan berikut.

${candidateContext}

DAFTAR PERTANYAAN:
${formattedQuestionsForPrompt}

ATURAN MENJAWAB:
1. Jika pertanyaan memiliki opsi pilihan (dropdown, radio, checklist):
   - Jawab HANYA dengan teks persis dari salah satu opsi yang tersedia.
   - Jika tipe checklist dan pelamar menguasai beberapa skill di opsi tersebut, pisahkan dengan " | " (misal: "HTML | CSS | JavaScript | PHP").
   - Jika ada pilihan gaji, pilih nominal yang paling mendekati ekspektasi gaji pelamar (Rp ${config.expectedSalary || 4500000}).
   - Jika pertanyaan meminta nama file resume/CV, pilih nama CV yang paling sesuai (${config.cvFileName || 'CV-LUTHFI.pdf'}).
2. Jika pertanyaan berupa isian bebas (text / angka):
   - Untuk pertanyaan jumlah tahun pengalaman, jawab dengan angka (misal "1" atau "2").
   - Untuk pertanyaan ekspektasi gaji, jawab dengan angka nominal (misal "${config.expectedSalary || 4500000}").
   - Untuk pertanyaan link portfolio/github/linkedin, berikan URL dari profil pelamar.
   - Untuk pertanyaan deskripsi/esai singkat (seperti "Mengapa kami harus merekrut Anda"), berikan jawaban profesional, padat, dan meyakinkan dalam 1-2 kalimat (bahasa disesuaikan dengan bahasa pertanyaan).
3. Kembalikan format JSON valid berupa array objek:
[
  {
    "index": 1,
    "answer": "Jawaban yang dipilih"
  }
]
Hanya kembalikan JSON array tanpa teks pembuka atau penutup.`;

    let aiAnswers: Array<{ index: number; answer: string }> = [];
    try {
      const rawAi = await askUniversalAi({
        userPrompt: prompt,
        jsonMode: true,
        temperature: 0.1,
      });

      const cleanJson = rawAi.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (Array.isArray(parsed)) {
        aiAnswers = parsed;
      }
    } catch (aiErr: any) {
      console.error('[Batch AI Error]', aiErr?.message || aiErr);
    }

    // Map AI answers back to rows
    let updatedCount = 0;
    chunkQuestions.forEach((item, idx) => {
      const matchedAi = aiAnswers.find(a => a.index === (idx + 1));
      if (matchedAi && matchedAi.answer) {
        records[item.rowIdx][3] = String(matchedAi.answer).trim();
        updatedCount++;
      }
    });

    // Write updated records back to CSV
    if (updatedCount > 0) {
      const updatedCsv = stringify(records);
      fs.writeFileSync(CSV_PATH, updatedCsv, 'utf8');
      invalidateKnowledgeBaseCache();
    }

    const nextIndex = endIndex;
    const isCompleted = nextIndex >= totalQuestions;

    return NextResponse.json({
      success: true,
      processed: updatedCount,
      startIndex,
      endIndex,
      nextIndex,
      total: totalQuestions,
      completed: isCompleted,
      progressPercent: Math.round((nextIndex / totalQuestions) * 100),
      currentSampleQuestion: chunkQuestions[chunkQuestions.length - 1]?.question || '',
      currentSampleAnswer: records[chunkQuestions[chunkQuestions.length - 1]?.rowIdx]?.[3] || '',
    });
  } catch (error: any) {
    console.error('[Batch Answer Route Error]', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Terjadi kesalahan saat memproses batch pertanyaan.',
    }, { status: 500 });
  }
}
