/**
 * AI Cover Letter Generator Module
 * Creates highly customized 1-2 paragraph motivation letters tailored to the specific
 * company name, job title, and the candidate's core skills/experience.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getConfig } from './config';

const coverLetterCache = new Map<string, string>();

export interface CoverLetterParams {
  jobTitle: string;
  company: string;
  jobDescriptionSnippet?: string;
  candidateProfileContext?: string;
  preferredLanguage?: 'id' | 'en';
}

export async function generateDynamicCoverLetter(params: CoverLetterParams): Promise<string> {
  const { jobTitle, company, jobDescriptionSnippet = '', preferredLanguage = 'id' } = params;

  // Cache key based on company + jobTitle
  const cacheKey = `${company.toLowerCase()}_${jobTitle.toLowerCase()}`;
  if (coverLetterCache.has(cacheKey)) {
    return coverLetterCache.get(cacheKey)!;
  }

  const config = getConfig();

  // Determine candidate context
  const candidateName = config.fullName || 'Pelamar Kerja';
  const skills = config.skills || 'Full Stack Development, JavaScript, React, Node.js';
  const expYears = config.yearsOfExperience || 1;
  const edu = config.educationLevel || 'Sarjana';

  const systemInstruction = `Kamu adalah asisten penulisan surat lamaran (Cover Letter / Motivation Statement) profesional tingkat tinggi.
Tugasmu adalah menyusun surat pengantar singkat (maksimal 2 paragraf padat, sekitar 70-110 kata) untuk formulir aplikasi kerja.
Prinsip Penulisan:
1. Menyapa rekruter / Hiring Manager secara profesional.
2. Menyebut secara spesifik nama posisi: "${jobTitle}" dan nama perusahaan: "${company}".
3. Menjelaskan kecocokan latar belakang kandidat (${expYears} tahun pengalaman, keahlian: ${skills}, pendidikan: ${edu}) dengan kebutuhan posisi tersebut.
4. Gunakan gaya bahasa yang sopan, antusias, percaya diri, tanpa basa-basi berlebihan.
5. Bahasa: ${preferredLanguage === 'id' ? 'Bahasa Indonesia yang formal dan elegan' : 'Professional fluent English'}.
6. Output HANYA berupa teks isi surat/paragraf, jangan tambahkan judul, subjek, atau tanda kurung placeholder.`;

  const userPrompt = `Nama Kandidat: ${candidateName}
Posisi Dilamar: ${jobTitle}
Nama Perusahaan: ${company}
Keahlian: ${skills}
${jobDescriptionSnippet ? `Potongan Deskripsi Loker: "${jobDescriptionSnippet.slice(0, 400)}"` : ''}

Buatkan surat pengantar singkat yang memikat sekarang:`;

  try {
    // 1. Custom AI Router (OpenRouter/9Router) if configured
    if (config.customAiApiKey && config.customAiBaseUrl) {
      const model = config.customAiModel || 'gemini-2.5-flash';
      const cleanBaseUrl = config.customAiBaseUrl.replace(/\/+$/, '');
      const endpoint = cleanBaseUrl.endsWith('/chat/completions') ? cleanBaseUrl : `${cleanBaseUrl}/chat/completions`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.customAiApiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 300
        }),
        signal: AbortSignal.timeout(10000)
      });

      if (res.ok) {
        const data = await res.json();
        const letter = (data.choices?.[0]?.message?.content || '').trim();
        if (letter) {
          coverLetterCache.set(cacheKey, letter);
          return letter;
        }
      }
    }

    // 2. Official Gemini API
    const geminiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;
    if (geminiKey && geminiKey !== 'your_gemini_api_key_here') {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const response = await model.generateContent(`${systemInstruction}\n\n${userPrompt}`);
      const letter = (response.response.text() || '').trim();
      if (letter) {
        coverLetterCache.set(cacheKey, letter);
        return letter;
      }
    }
  } catch (e) {
    // Fallback template jika offline atau AI timeout
  }

  // Graceful Fallback Template
  const fallback = preferredLanguage === 'id'
    ? `Kepada Yth. Tim Rekrutmen ${company},\n\nMelalui pesan ini, saya ingin menyatakan ketertarikan saya untuk posisi ${jobTitle}. Dengan latar belakang keahlian saya di bidang ${skills} serta pengalaman kerja yang solid, saya optimis dapat berkontribusi secara nyata bagi perkembangan tim ${company}. Saya sangat menyambut kesempatan untuk mendiskusikan kualifikasi saya lebih lanjut.\n\nHormat saya,\n${candidateName}`
    : `Dear Hiring Team at ${company},\n\nI am writing to express my enthusiastic interest in the ${jobTitle} position. With my background in ${skills} and relevant hands-on experience, I am confident in my ability to deliver meaningful impact to ${company}. I look forward to the opportunity to discuss my qualifications with you.\n\nSincerely,\n${candidateName}`;

  coverLetterCache.set(cacheKey, fallback);
  return fallback;
}
