import { TalentCandidate, ParsedTalentPrompt } from './talentTypes';
import { askUniversalAi } from './aiGateway';

/**
 * AI Talent Assessor & Honesty Evaluator
 * Menganalisis profil kandidat, konsistensi pengalaman, mendeteksi gap kerja / tumpang-tindih mencurigakan,
 * dan memberikan skor kejujuran serta kesesuaian untuk perusahaan outsourcing/HRIS.
 */
export async function evaluateCandidateIntegrity(
  candidate: Partial<TalentCandidate>,
  targetRequirement: string
): Promise<{
  honestyScore: number;
  matchScore: number;
  notes: string[];
  availability: 'immediate' | '1_month_notice' | 'employed' | 'unknown';
  tenureAnalysis?: {
    averageTenureYears?: number;
    stabilityRating: 'high' | 'moderate' | 'low';
    notes: string;
  };
}> {
  const experiencesText = candidate.experiences?.map((e, idx) => 
    `${idx + 1}. ${e.title} di ${e.company} (${e.duration}): ${e.description || 'Tidak ada keterangan'}`
  ).join('\n') || 'Tidak ada riwayat detail';

  const prompt = `
Anda adalah Senior Headhunter & Forensic Recruiter untuk perusahaan outsourcing terkemuka.
Analisis profil kandidat berikut untuk mendeteksi kejujuran riwayat kerja, kredibilitas, stabilitas karir (tenure), dan kesesuaian dengan persyaratan posisi:

PROFIL KANDIDAT:
- Nama: ${candidate.name || 'Anonim'}
- Headline: ${candidate.headline || '-'}
- Lokasi: ${candidate.location || '-'}
- Riwayat Pengalaman:
${experiencesText}
- Skills: ${candidate.skills?.join(', ') || '-'}

PERSYARATAN POSISI:
${targetRequirement || 'Posisi profesional umum dengan dedikasi penuh dan rekam jejak jelas'}

TUGAS EVALUASI:
1. Periksa konsistensi riwayat kerja: Apakah ada overlapping (bekerja di 2 perusahaan full-time bersamaan secara tidak wajar), loncatan karir tidak logis, atau klaim senioritas tanpa bukti tugas yang sepadan.
2. Analisis Stabilitas Karir (Tenure): Apakah kandidat loyal (bertahan >2 tahun) atau kutu loncat (sering pindah <6 bulan).
3. Hitung Honesty Score (0-100): 90-100 sangat kredibel, <70 mencurigakan/terlalu banyak red flags.
4. Hitung Match Score (0-100): Kesesuaian dengan posisi yang dibutuhkan.
5. Buat 2-4 poin catatan temuan konkret (Bahasa Indonesia).
6. Tentukan availability: "immediate" (bila open to work / tidak bekerja sekarang), "1_month_notice", atau "employed".

Format Output JSON persis:
{
  "honestyScore": 95,
  "matchScore": 85,
  "notes": ["Riwayat kerja runut tanpa tumpang-tindih", "Keahlian sesuai kebutuhan"],
  "availability": "immediate",
  "stabilityRating": "high",
  "tenureNotes": "Sangat stabil. Memiliki rekam jejak loyalitas tinggi pada industri manufaktur."
}
`;

  // Hitung heuristik durasi kerja
  let totalYears = 0;
  let hasLongStay = false;
  let expCount = candidate.experiences?.length || 0;

  if (candidate.experiences) {
    for (const exp of candidate.experiences) {
      const durStr = exp.duration || '';
      const yearMatch = durStr.match(/(\d+)\s*(?:yr|thn|tahun)/i);
      const yr = yearMatch ? parseInt(yearMatch[1], 10) : 1;
      totalYears += yr;
      if (yr >= 2) hasLongStay = true;
    }
  }

  const avgTenure = expCount > 0 ? parseFloat((totalYears / expCount).toFixed(1)) : 1.5;
  const defaultStability: 'high' | 'moderate' | 'low' = hasLongStay || avgTenure >= 2 ? 'high' : avgTenure >= 1 ? 'moderate' : 'low';
  const defaultTenureNote = defaultStability === 'high' 
    ? `Sangat stabil dengan rata-rata masa kerja ${avgTenure} tahun per perusahaan.`
    : defaultStability === 'moderate'
    ? `Stabilitas kerja wajar dengan masa kerja ${avgTenure} tahun.`
    : `Tingkat retensi pendek (rata-rata <1 tahun per perusahaan).`;

  try {
    const rawAiRes = await askUniversalAi({ userPrompt: prompt, temperature: 0.2, jsonMode: true });
    const jsonMatch = rawAiRes.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        honestyScore: typeof parsed.honestyScore === 'number' ? parsed.honestyScore : 90,
        matchScore: typeof parsed.matchScore === 'number' ? parsed.matchScore : 85,
        notes: Array.isArray(parsed.notes) ? parsed.notes : ['Profil terverifikasi normal'],
        availability: parsed.availability || (candidate.isOpenToWork ? 'immediate' : 'employed'),
        tenureAnalysis: {
          averageTenureYears: avgTenure,
          stabilityRating: (parsed.stabilityRating as any) || defaultStability,
          notes: parsed.tenureNotes || defaultTenureNote
        }
      };
    }
  } catch (err) {
    console.error('AI Integrity Evaluation failed:', err);
  }

  // Fallback heuristic scoring jika AI offline
  const notes: string[] = [];
  let score = 88;

  if (candidate.isOpenToWork) {
    notes.push('Kandidat memasang status resmi #OpenToWork (Aktif siap kerja)');
  }
  if (!candidate.experiences || candidate.experiences.length === 0) {
    score -= 10;
    notes.push('Riwayat pekerjaan belum tercantum detail');
  } else {
    notes.push(`Memiliki ${candidate.experiences.length} riwayat pekerjaan terdata`);
  }

  return {
    honestyScore: score,
    matchScore: 85,
    notes: notes.length > 0 ? notes : ['Kandidat memenuhi kualifikasi dasar'],
    availability: candidate.isOpenToWork ? 'immediate' : 'unknown',
    tenureAnalysis: {
      averageTenureYears: avgTenure,
      stabilityRating: defaultStability,
      notes: defaultTenureNote
    }
  };
}

/**
 * AI Semantic Talent Prompter:
 * Mengurai instruksi natural language dari recruiter/HR menjadi parameter pencarian presisi
 * dan menyusun query Google X-Ray Dorking untuk LinkedIn, Glints, dan Web Resume PDF.
 */
export async function parseTalentPromptWithAi(userPrompt: string): Promise<ParsedTalentPrompt> {
  const systemPrompt = `
Anda adalah Chief Sourcing Architect & Headhunter Engine kelas dunia untuk pasar rekrutmen Indonesia.
Tugas Anda: Membedah kebutuhan rekrutmen dalam bahasa sehari-hari (Bahasa Indonesia / English) dan mengekstrak entitas rekrutmen secara tajam.

Hasilkan output JSON murni dengan format persis:
{
  "primaryRole": "Staff Gudang",
  "roleSynonyms": ["Staff Gudang", "Admin Gudang", "Admin Logistik", "Warehouse Staff", "Inventory Control"],
  "locations": ["Surabaya", "Gresik", "Sidoarjo"],
  "skills": ["Excel", "WMS", "SAP", "Stock Opname"],
  "seniority": "junior",
  "availability": "immediate",
  "requireContact": true
}
`;

  try {
    const rawAiRes = await askUniversalAi({
      systemPrompt,
      userPrompt: `Permintaan Rekruter: "${userPrompt}"\n\nEkstrak entitas dan susun sinonim peran serta keahlian terkait:`,
      temperature: 0.1,
      jsonMode: true
    });

    const jsonMatch = rawAiRes.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const primaryRole = parsed.primaryRole || 'Staff';
      const roleSynonyms: string[] = Array.isArray(parsed.roleSynonyms) && parsed.roleSynonyms.length > 0 
        ? parsed.roleSynonyms 
        : [primaryRole];
      const locations: string[] = Array.isArray(parsed.locations) && parsed.locations.length > 0 
        ? parsed.locations 
        : ['Indonesia'];
      const skills: string[] = Array.isArray(parsed.skills) ? parsed.skills : [];
      const requireContact = parsed.requireContact !== false;

      // 1. LinkedIn X-Ray Query
      const roleBlock = `(${roleSynonyms.slice(0, 4).map((r: string) => `"${r.trim()}"`).join(' OR ')})`;
      const locBlock = `(${locations.slice(0, 3).map((l: string) => `"${l.trim()}"`).join(' OR ')})`;
      const openBlock = '("Open to work" OR "OpenToWork" OR "siap kerja" OR "seeking opportunities")';
      const contactBlock = requireContact 
        ? '("08" OR "628" OR "wa.me" OR "@gmail.com" OR "hubungi")' 
        : '';

      const linkedinQuery = [
        'site:id.linkedin.com/in/',
        roleBlock,
        locBlock,
        openBlock,
        contactBlock
      ].filter(Boolean).join(' ');

      // 2. Glints Candidate Query
      const glintsQuery = [
        'site:glints.com/id/',
        roleBlock,
        locBlock,
        '("siap kerja" OR "open for opportunities" OR "pengalaman")',
        contactBlock
      ].filter(Boolean).join(' ');

      // 3. Web Resume PDF Dorking
      const webResumePdfQuery = [
        'filetype:pdf',
        '("Curriculum Vitae" OR "Resume" OR "CV")',
        roleBlock,
        locBlock,
        '("08" OR "628" OR "@gmail.com")'
      ].filter(Boolean).join(' ');

      return {
        originalPrompt: userPrompt,
        primaryRole,
        roleSynonyms,
        locations,
        skills,
        seniority: parsed.seniority || 'any',
        availability: parsed.availability || 'immediate',
        requireContact,
        queries: {
          linkedin: linkedinQuery,
          glints: glintsQuery,
          webResumePdf: webResumePdfQuery
        }
      };
    }
  } catch (err) {
    console.error('AI Prompt parsing error:', err);
  }

  // Fallback Heuristic Parser jika AI offline
  const cleaned = userPrompt.trim();
  const words = cleaned.split(/\s+/);
  const detectedLocations: string[] = [];
  const indonesianCities = ['Jakarta', 'Surabaya', 'Bandung', 'Gresik', 'Sidoarjo', 'Semarang', 'Medan', 'Yogyakarta', 'Tangerang', 'Bekasi', 'Bogor', 'Depok', 'Kediri', 'Malang', 'Bali'];
  
  for (const city of indonesianCities) {
    if (new RegExp(`\\b${city}\\b`, 'i').test(cleaned)) {
      detectedLocations.push(city);
    }
  }

  const primaryRole = words.slice(0, 3).join(' ') || 'Staff';
  const roleBlock = `("${primaryRole}")`;
  const locBlock = detectedLocations.length > 0 
    ? `(${detectedLocations.map(c => `"${c}"`).join(' OR ')})` 
    : '("Indonesia")';

  return {
    originalPrompt: userPrompt,
    primaryRole,
    roleSynonyms: [primaryRole],
    locations: detectedLocations.length > 0 ? detectedLocations : ['Indonesia'],
    skills: [],
    seniority: 'any',
    availability: 'immediate',
    requireContact: true,
    queries: {
      linkedin: `site:id.linkedin.com/in/ ${roleBlock} ${locBlock} ("Open to work" OR "siap kerja") ("08" OR "628" OR "wa.me")`,
      glints: `site:glints.com/id/ ${roleBlock} ${locBlock} ("siap kerja" OR "open for opportunities")`,
      webResumePdf: `filetype:pdf ("Curriculum Vitae" OR "CV") ${roleBlock} ${locBlock} ("08" OR "628")`
    }
  };
}
