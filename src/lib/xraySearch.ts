import { TalentFilter, XRaySearchResult } from './talentTypes';

/**
 * Google X-Ray Search Query Builder for Talent Sourcing
 * Menggunakan operator Boolean & Dorking untuk mengambil profil LinkedIn tanpa batas akun & tanpa risiko ban.
 */
export function buildLinkedInXRayQuery(filter: TalentFilter): string {
  const roleTerms = filter.targetRole.trim()
    ? `("${filter.targetRole.trim()}")`
    : '("Developer" OR "Engineer" OR "Admin" OR "Staff")';

  const locationTerms = filter.locations.length > 0
    ? `(${filter.locations.map(loc => `"${loc.trim()}"`).join(' OR ')})`
    : '("Indonesia")';

  const openToWorkTerm = filter.onlyOpenToWork
    ? '("Open to work" OR "OpenToWork" OR "seeking opportunities" OR "siap kerja")'
    : '';

  // Mencari pola kontak WhatsApp / HP Indonesia / Email di bio publik
  const contactTerm = filter.requireContact
    ? '("08" OR "628" OR "@gmail.com" OR "wa.me" OR "contact" OR "hubungi")'
    : '';

  const queryParts = [
    'site:id.linkedin.com/in/',
    roleTerms,
    locationTerms,
    openToWorkTerm,
    contactTerm
  ].filter(Boolean);

  return queryParts.join(' ');
}

/**
 * Regex Phone & Email Parser untuk Format Kontak Indonesia
 */
export function extractIndonesianPhone(text: string): string | undefined {
  if (!text) return undefined;
  // Cocokkan +628..., 628..., atau 08... dengan panjang 10-13 digit
  const match = text.match(/(?:\+62|62|0)8[1-9][0-9]{7,10}/);
  if (!match) return undefined;

  let raw = match[0].replace(/\D/g, '');
  if (raw.startsWith('0')) {
    raw = '62' + raw.substring(1);
  }
  return raw;
}

export function extractEmail(text: string): string | undefined {
  if (!text) return undefined;
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0].toLowerCase() : undefined;
}

/**
 * Format Direct WhatsApp Click-to-Chat Link
 */
export function generateWhatsAppUrl(phone: string, candidateName: string, companyName?: string, position?: string): string {
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '62' + cleanPhone.substring(1);
  }

  const roleText = position ? `posisi ${position}` : 'peluang karir terbaru';
  const compText = companyName ? `di ${companyName}` : 'dari tim rekruter kami';
  const text = `Halo Kak ${candidateName}, salam kenal. Kami melihat profil profesional Kakak dan tertarik mendiskusikan ${roleText} ${compText}. Apakah saat ini Kakak sedang terbuka untuk diskusi lebih lanjut? Terima kasih.`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

/**
 * Generator URL Pencarian OSINT Kontak (Google Dorking untuk Melacak CV PDF / Nomor WA Publik)
 */
export function generateOsintContactUrl(name: string, location?: string): string {
  const cleanName = name.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const q = `"${cleanName}" ("08" OR "628" OR "@gmail.com" OR "wa.me" OR filetype:pdf OR resume OR cv)`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

/**
 * Quick-Parser: Ekstrak kandidat dari teks hasil copy-paste Google Search SERP
 */
export function parseGoogleResultsFromText(rawText: string, defaultLocation: string = 'Indonesia'): any[] {
  if (!rawText || rawText.trim().length === 0) return [];

  const candidates: any[] = [];
  const seenUrls = new Set<string>();
  const seenNames = new Set<string>();

  // Pecah teks berdasarkan blok hasil pencarian
  const blocks = rawText.split(/(?=\n[A-Z0-9][a-zA-Z0-9\s.,'/-]+ [-–—|] )|\n{2,}/);

  for (const rawBlock of blocks) {
    const block = rawBlock.trim();
    if (block.length < 15) continue;

    // Cari URL LinkedIn, Glints, atau PDF jika ada
    const urlMatch = block.match(/https?:\/\/(?:[a-z]{2}\.)?(?:linkedin\.com\/in\/|glints\.com\/id\/(?:profile|candidates)\/)[a-zA-Z0-9%_-]+/i)
      || block.match(/https?:\/\/[^\s"]+\.pdf/i);
    const profileUrl = urlMatch ? urlMatch[0].split('?')[0] : '';
    if (profileUrl && seenUrls.has(profileUrl)) continue;
    if (profileUrl) seenUrls.add(profileUrl);

    // Cari baris judul: "Nama - Jabatan / Headline"
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    let name = '';
    let headline = '';

    for (const line of lines) {
      if (line.includes(' - ') || line.includes(' | ') || line.includes(' – ') || line.includes(' — ')) {
        const parts = line.split(/ [-–—|] /);
        if (parts.length >= 2 && parts[0].length >= 3 && parts[0].length <= 50) {
          name = parts[0].replace(/^(LinkedIn\s*[·•-]\s*)/i, '').trim();
          headline = parts.slice(1).join(' - ').trim();
          break;
        }
      }
    }

    // Jika tidak menemukan pemisah dash, coba baris pertama
    if (!name && lines.length > 0) {
      const firstLine = lines[0].replace(/^(LinkedIn\s*[·•-]\s*)/i, '').trim();
      if (firstLine.length >= 3 && firstLine.length <= 60 && !firstLine.startsWith('http')) {
        name = firstLine;
        headline = lines[1] || 'Profesional';
      }
    }

    if (!name || seenNames.has(name.toLowerCase())) continue;
    seenNames.add(name.toLowerCase());

    // Ekstraksi Lokasi
    const locMatch = block.match(/(Surabaya|Gresik|Sidoarjo|Jakarta|Bandung|Semarang|Medan|Yogyakarta|Tangerang|Bekasi|Bogor|Depok|Kediri|Malang|Jawa Timur|Jawa Barat|Jawa Tengah|Bali)[^·\n]*/i);
    const location = locMatch ? locMatch[0].trim() : defaultLocation;

    // Ekstraksi Telepon & Email
    const phone = extractIndonesianPhone(block) || '';
    const email = extractEmail(block) || '';

    candidates.push({
      id: 'cand_' + Math.random().toString(36).substring(2, 9),
      name,
      headline: headline || 'Profesional Terverifikasi',
      location,
      profileUrl: profileUrl || `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(name)}`,
      isOpenToWork: /open\s*to\s*work|siap\s*kerja|membuka\s*kesempatan|seeking/i.test(block),
      contact: phone || email,
      phone,
      email,
      notes: [
        block.replace(/\s+/g, ' ').substring(0, 160)
      ],
      honestyScore: 90,
      matchScore: 85,
      sourcedAt: new Date().toISOString()
    });
  }

  return candidates;
}

/**
 * 1-Click Bookmarklet Code Generator untuk Halaman Google Search SERP
 */
export function getBookmarkletCode(): string {
  return `javascript:(function(){const items=[];const anchors=Array.from(document.querySelectorAll('a[href*="linkedin.com/in/"]'));const seen=new Set();for(const a of anchors){const cleanUrl=a.href.split('?')[0];if(seen.has(cleanUrl))continue;seen.add(cleanUrl);const h3=a.querySelector('h3')||a;const titleText=(h3.textContent||'').trim();if(!titleText||titleText.length<3)continue;const parts=titleText.split(/ [-–—|] /);const name=parts[0]?parts[0].replace(/^(LinkedIn[·•\s-]*)/i,'').trim():'Kandidat';const headline=parts.slice(1).join(' - ').trim()||titleText;const container=a.closest('.g')||a.closest('div[data-hveid]')||a.parentElement;const snippet=container?(container.textContent||'').trim():'';const locMatch=snippet.match(/(Jakarta|Surabaya|Bandung|Gresik|Sidoarjo|Semarang|Medan|Yogyakarta|Tangerang|Bekasi|Bogor|Depok|Kediri|Malang)[^·\\n]*/i);const location=locMatch?locMatch[0].trim():'Indonesia';const phoneMatch=snippet.match(/(08\\d{8,11}|(\\+62|62)8\\d{8,11})/);const phone=phoneMatch?phoneMatch[0]:'';items.push({id:'tal_'+Math.random().toString(36).substr(2,9),name,headline,location,profileUrl:cleanUrl,isOpenToWork:true,contact:phone,phone:phone,notes:[snippet.slice(0,160)],honestyScore:90,matchScore:85,sourcedAt:new Date().toISOString()});}if(items.length===0){alert('⚠️ Tidak ditemukan profil LinkedIn pada halaman Google ini.');return;}fetch('http://localhost:3000/api/talents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'bulk_import',candidates:items})}).then(r=>r.json()).then(res=>{alert('🎉 SUKSES! '+items.length+' kandidat berhasil dikirim langsung ke dashboard CV Blaster.');window.focus();}).catch(err=>{alert('Gagal mengirim ke CV Blaster. Pastikan server http://localhost:3000 sedang aktif.');});})();`;
}

/**
 * 1-Click Bookmarklet Code Generator untuk Tab Profil LinkedIn Kandidat (Mengekstrak Riwayat Kerja Lengkap & Background Check)
 */
export function getLinkedInProfileBookmarkletCode(): string {
  return `javascript:(function(){try{if(!window.location.hostname.includes('linkedin.com')){alert('⚠️ Buka halaman profil LinkedIn kandidat (linkedin.com/in/...) terlebih dahulu.');return;}const h1=document.querySelector('h1');const name=(h1?h1.textContent:'').trim();if(!name){alert('⚠️ Tidak dapat mendeteksi nama kandidat di halaman ini.');return;}const headlineEl=document.querySelector('.text-body-medium')||document.querySelector('.pv-text-details__left-panel div');const headline=(headlineEl?headlineEl.textContent:'').trim();const locEl=document.querySelector('span.text-body-small.inline.t-black--light.break-words')||document.querySelector('.pv-text-details__left-panel span');const location=(locEl?locEl.textContent:'Indonesia').trim();const profileUrl=window.location.href.split('?')[0];const pageText=document.body.innerText||'';const isOpenToWork=/open\\s*to\\s*work|terbuka\\s*untuk\\s*bekerja/i.test(pageText);const experiences=[];const expSec=document.getElementById('experience')?document.getElementById('experience').closest('section'):null;if(expSec){const items=expSec.querySelectorAll('li.artdeco-list__item');for(const item of items){const titleEl=item.querySelector('span[aria-hidden="true"]');const title=(titleEl?titleEl.textContent:'').trim();const detailSpans=Array.from(item.querySelectorAll('span.t-14.t-normal span[aria-hidden="true"], span.t-14.t-black--light span[aria-hidden="true"]'));const company=(detailSpans[0]?detailSpans[0].textContent:'').trim();const duration=(detailSpans[1]?detailSpans[1].textContent:'').trim();const descEl=item.querySelector('.inline-show-more-text span[aria-hidden="true"]');const description=(descEl?descEl.textContent:'').trim();if(title&&(company||duration)){experiences.push({title,company,duration,description});}}}const skills=[];const skillSec=document.getElementById('skills')?document.getElementById('skills').closest('section'):null;if(skillSec){const sEls=skillSec.querySelectorAll('span[aria-hidden="true"]');for(const el of sEls){const s=(el.textContent||'').trim();if(s&&s.length>2&&s.length<35&&!skills.includes(s)&&!s.includes('skill')){skills.push(s);}}}const cand={id:'cand_'+Math.random().toString(36).substr(2,9),name,headline,location,profileUrl,platform:'linkedin',isOpenToWork,experiences,skills:skills.slice(0,10),status:'new'};fetch('http://localhost:3000/api/talents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'import_profile',candidate:cand})}).then(r=>r.json()).then(res=>{alert('🎉 SUKSES! Profil '+name+' ('+experiences.length+' riwayat kerja) berhasil diimpor ke CV Blaster.');window.focus();}).catch(err=>{alert('Gagal mengirim ke CV Blaster. Pastikan server http://localhost:3000 sedang aktif.');});}catch(err){alert('Error saat mengekstrak profil: '+err.message);}})();`;
}
