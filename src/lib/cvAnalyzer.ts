import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getConfig, saveConfig } from './config';

export interface CVAnalysisResult {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  gender?: string;
  maritalStatus?: string;
  dateOfBirth?: string;
  postalCode?: string;
  domicile?: string;
  educationLevel?: string;
  gpa?: string;
  yearsOfExperience?: number;
  expectedSalary?: number;
  skills?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  summary?: string;
}

/**
 * Extracts raw text from uploaded PDF or DOCX file
 */
export async function extractTextFromFile(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    const pdfParse = require('pdf-parse-fork');
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text || '';
  } else if (ext === '.docx' || ext === '.doc') {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || '';
  } else if (ext === '.txt') {
    return fs.readFileSync(filePath, 'utf8');
  }

  throw new Error(`Format file ${ext} tidak didukung. Harap upload PDF atau DOCX.`);
}

/**
 * Sends CV text to Gemini / 9Router / Custom AI to extract structured candidate profile
 */
export async function analyzeCvWithAi(rawCvText: string): Promise<CVAnalysisResult> {
  const { askUniversalAi } = require('./aiGateway');

  const prompt = `Anda adalah asisten AI rekrutmen profesional. Analisis teks Curriculum Vitae (CV) berikut dan ekstrak informasi pelamar kerja dalam format JSON valid.

DATA CV:
"""
${rawCvText.slice(0, 15000)}
"""

Format JSON yang wajib dikembalikan (hanya JSON, tanpa markdown wrap):
{
  "fullName": "Nama lengkap pelamar",
  "email": "Alamat email pelamar (misal: pelamar@gmail.com)",
  "phoneNumber": "Nomor HP / WhatsApp (format angka lokal misal 08...)",
  "gender": "Pilihan salah satu: Laki-laki atau Perempuan (sesuai data CV)",
  "maritalStatus": "Pilihan salah satu: Single atau Menikah",
  "dateOfBirth": "Tanggal lahir jika ada (format YYYY-MM-DD)",
  "postalCode": "Kode pos jika ada",
  "domicile": "Domisili/Kota tempat tinggal",
  "educationLevel": "Pilihan salah satu: SMA / SMK, Diploma (D3), Sarjana (S1), Magister (S2), Doktor (S3)",
  "gpa": "IPK terakhir (misal: 3.75)",
  "yearsOfExperience": 1,
  "skills": "Daftar seluruh keahlian, bahasa pemrograman, tools, framework, metodologi yang ditemukan, dipisahkan koma",
  "linkedinUrl": "Link profil LinkedIn jika ada (misal https://linkedin.com/in/...)",
  "githubUrl": "Link GitHub jika ada",
  "portfolioUrl": "Link Portofolio atau website pribadi jika ada",
  "summary": "Ringkasan profil profesional 2-3 kalimat"
}

Aturan:
- Jika suatu data tidak ditemukan di CV, berikan string kosong "" atau null.
- Untuk email: carilah alamat email valid di dalam CV.
- Untuk skills: kumpulkan sebanyak mungkin skill teknis, software, tools, dan kompetensi yang tercantum di CV dan pisahkan dengan koma rapi.
- Jangan mengarang data yang jelas-jelas tidak ada di CV.`;

  let textResponse = '';
  try {
    textResponse = await askUniversalAi({
      userPrompt: prompt,
      jsonMode: true,
      temperature: 0.1,
    });

    // Strip markdown code fences robustly (```json ... ``` or ``` ... ``` anywhere)
    let cleanText = textResponse
      .replace(/^```(?:json)?\s*/im, '')
      .replace(/```\s*$/im, '')
      .trim();

    // Try to extract a JSON object if response contains extra text
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleanText = jsonMatch[0];

    const parsed = JSON.parse(cleanText);
    return parsed as CVAnalysisResult;
  } catch (e: any) {
    // Log the REAL error so it's visible in the Next.js terminal
    console.error('[CV AI Analysis ERROR]', {
      error: e?.message || e,
      responsePreview: textResponse?.slice(0, 300) || '(no response)',
    });
    // Smart heuristic & regex fallback parser (extracts Name, Phone, Domicile, Skills, Education)
    const fallback = extractHeuristicFromText(rawCvText);
    if (fallback && (fallback.fullName || fallback.phoneNumber || fallback.skills)) {
      console.info('[CV AI] Using heuristic fallback. Fields found:', Object.keys(fallback).filter(k => !!(fallback as any)[k]));
      return fallback;
    }
    throw new Error(`AI analisis CV gagal: ${e?.message || 'tidak ada respon'} — pastikan API Key di Langkah 3 valid & aktif.`);
  }
}

/**
 * Fallback regex & heuristic parser when AI key is empty or network fails
 */
function extractHeuristicFromText(text: string): CVAnalysisResult {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const result: CVAnalysisResult = {};

  // 1. Detect candidate name (usually in the first 5 lines, 2 to 5 words, not header words)
  const headerDisqualifiers = ['tentang saya', 'curriculum vitae', 'resume', 'data diri', 'kontak', 'pendidikan', 'experience', 'profile', 'biodata'];
  for (const line of lines.slice(0, 8)) {
    const lower = line.toLowerCase();
    if (!headerDisqualifiers.some(h => lower.includes(h)) && line.length >= 4 && line.length <= 40 && !/\d/.test(line)) {
      result.fullName = line;
      break;
    }
  }

  // 2. Detect phone number (08... or +62...)
  const phoneMatch = text.match(/(?:(?:\+62|62)|0)8[0-9]{2}[\s\-]?[0-9]{3,4}[\s\-]?[0-9]{3,5}/);
  if (phoneMatch) {
    result.phoneNumber = phoneMatch[0].replace(/[\s\-]/g, '');
  }

  // 2b. Detect email
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    result.email = emailMatch[0].trim();
  }

  // 2c. Detect gender
  if (/laki-laki|pria/i.test(text)) {
    result.gender = 'Laki-laki';
  } else if (/perempuan|wanita/i.test(text)) {
    result.gender = 'Perempuan';
  }

  // 2d. Detect marital status
  if (/belum menikah|single|lajang/i.test(text)) {
    result.maritalStatus = 'Single';
  } else if (/menikah|kawin/i.test(text)) {
    result.maritalStatus = 'Menikah';
  }

  // 3. Detect domicile / city
  const cityMatch = text.match(/(?:domisili|kota|tinggal|alamat|desa|kelurahan)[^:\n]*[:\s]+([^\n,]{3,35})/i);
  if (cityMatch && cityMatch[1]) {
    result.domicile = cityMatch[1].trim();
  } else if (/gresik/i.test(text)) {
    result.domicile = 'Gresik, Jawa Timur';
  } else if (/surabaya/i.test(text)) {
    result.domicile = 'Surabaya, Jawa Timur';
  } else if (/jakarta/i.test(text)) {
    result.domicile = 'Jakarta';
  }

  // 4. Detect education level
  if (/s1|sarjana|semester|informatika|itats|universitas|institut/i.test(text)) {
    result.educationLevel = 'Sarjana (S1)';
  } else if (/d3|diploma/i.test(text)) {
    result.educationLevel = 'Diploma (D3)';
  } else if (/smk|sma/i.test(text)) {
    result.educationLevel = 'SMA / SMK';
  }

  // 5. Detect skills
  const knownKeywords = [
    'Laravel', 'PHP', 'JavaScript', 'JS', 'TypeScript', 'TS', 'HTML', 'CSS', 'Tailwind',
    'Tailwind CSS', 'Bootstrap', 'React', 'React.js', 'Next.js', 'Node.js', 'Express',
    'Git', 'GitHub', 'GitLab', 'MySQL', 'PostgreSQL', 'Python', 'Java', 'Docker', 'Figma'
  ];
  const foundSkills: string[] = [];
  for (const kw of knownKeywords) {
    const reg = new RegExp(`\\b${kw.replace('.', '\\.')}\\b`, 'i');
    if (reg.test(text)) {
      foundSkills.push(kw);
    }
  }
  if (foundSkills.length > 0) {
    result.skills = foundSkills.join(', ');
  }

  // 6. Detect Github & Linkedin
  const githubMatch = text.match(/(?:github\.com\/[A-Za-z0-9_-]+|@[A-Za-z0-9_-]+\s*-\s*Github)/i);
  if (githubMatch) {
    const raw = githubMatch[0];
    if (raw.includes('github.com')) {
      result.githubUrl = `https://${raw}`;
    } else {
      const user = raw.split('-')[0].replace(/[@\s]/g, '');
      result.githubUrl = `https://github.com/${user}`;
    }
  }

  // 7. Years of experience estimate
  if (/mahasiswa|fresh graduate|semester/i.test(text) && !/tahun pengalaman/i.test(text)) {
    result.yearsOfExperience = 1;
  }

  return result;
}

