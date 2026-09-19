import { NextResponse } from 'next/server';
import { getSourcedTalents, exportTalentsToCsv, upsertCandidate } from '@/lib/talentStorage';
import { buildLinkedInXRayQuery, parseGoogleResultsFromText, getBookmarkletCode, getLinkedInProfileBookmarkletCode } from '@/lib/xraySearch';
import { evaluateCandidateIntegrity, parseTalentPromptWithAi } from '@/lib/talentMatcher';
import { TalentCandidate, TalentFilter } from '@/lib/talentTypes';
import { launchBrowserWithFallback } from '@/lib/browserHelper';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format');
  const action = searchParams.get('action');

  if (action === 'bookmarklet') {
    return NextResponse.json({ success: true, bookmarklet: getBookmarkletCode() });
  }

  if (action === 'profile_bookmarklet') {
    return NextResponse.json({ success: true, bookmarklet: getLinkedInProfileBookmarkletCode() });
  }

  const talents = getSourcedTalents();

  if (format === 'csv') {
    const csvContent = exportTalentsToCsv(talents);
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="talent_pool_${Date.now()}.csv"`
      }
    });
  }

  return NextResponse.json({ success: true, count: talents.length, talents });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, filter, candidate, requirement, candidates, rawText, defaultLocation, googleUrl } = body;

    // 0. Action: Parse Talent Prompt with AI (Semantic Talent Generator)
    if (action === 'parse_prompt' && body.prompt) {
      const parsedPrompt = await parseTalentPromptWithAi(body.prompt);
      return NextResponse.json({
        success: true,
        parsedPrompt,
        googleUrls: {
          linkedin: `https://www.google.com/search?q=${encodeURIComponent(parsedPrompt.queries.linkedin)}`,
          glints: `https://www.google.com/search?q=${encodeURIComponent(parsedPrompt.queries.glints)}`,
          webResumePdf: `https://www.google.com/search?q=${encodeURIComponent(parsedPrompt.queries.webResumePdf)}`
        }
      });
    }

    // 1. Action: Generate X-Ray Search URL
    if (action === 'generate_xray') {
      const query = buildLinkedInXRayQuery(filter as TalentFilter);
      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      return NextResponse.json({ success: true, query, googleUrl: url });
    }

    // 2. Action: Evaluate with AI
    if (action === 'evaluate' && candidate) {
      const evaluation = await evaluateCandidateIntegrity(candidate, requirement || '');
      return NextResponse.json({ success: true, evaluation });
    }

    // 3. Action: Import Rich LinkedIn Profile (dari Bookmarklet Profil / Input URL)
    if (action === 'import_profile' && candidate) {
      const evalRes = await evaluateCandidateIntegrity(candidate, requirement || '');
      const enriched: TalentCandidate = {
        id: candidate.id || ('cand_' + Math.random().toString(36).substring(2, 9)),
        name: candidate.name || 'Kandidat',
        headline: candidate.headline || 'Profesional Terverifikasi',
        platform: candidate.platform || 'linkedin',
        profileUrl: candidate.profileUrl || '',
        location: candidate.location || 'Indonesia',
        phone: candidate.phone || '',
        email: candidate.email || '',
        contact: candidate.contact || candidate.phone || candidate.email || '',
        isOpenToWork: candidate.isOpenToWork ?? true,
        openToWorkDetails: candidate.openToWorkDetails,
        experiences: candidate.experiences || [],
        skills: candidate.skills || [],
        activityHighlights: candidate.activityHighlights || [],
        tenureAnalysis: evalRes.tenureAnalysis,
        aiHonestyScore: evalRes.honestyScore,
        aiHonestyNotes: evalRes.notes,
        aiMatchScore: evalRes.matchScore,
        availabilityStatus: evalRes.availability,
        sourcedDate: candidate.sourcedDate || new Date().toISOString().split('T')[0],
        status: candidate.status || 'new',
        notes: candidate.notes
      };
      upsertCandidate(enriched);
      return NextResponse.json({
        success: true,
        candidate: enriched,
        message: `Profil ${enriched.name} berhasil diimpor & dianalisis background check-nya!`
      });
    }

    // 4. Action: Save / Upsert Single Candidate
    if (action === 'save_candidate' && candidate) {
      upsertCandidate(candidate);
      return NextResponse.json({ success: true, message: 'Kandidat berhasil disimpan' });
    }

    // 5. Action: Bulk Import (dari Bookmarklet Google SERP)
    if (action === 'bulk_import' && Array.isArray(candidates)) {
      for (const cand of candidates) {
        upsertCandidate(cand);
      }
      return NextResponse.json({ success: true, count: candidates.length, message: `${candidates.length} kandidat berhasil disimpan` });
    }

    // 6. Action: Parse Raw Text / Copy-Paste dari Google SERP
    if (action === 'parse_paste' && rawText) {
      const parsedCandidates = parseGoogleResultsFromText(rawText, defaultLocation || 'Indonesia');
      for (const cand of parsedCandidates) {
        upsertCandidate(cand);
      }
      return NextResponse.json({ 
        success: true, 
        count: parsedCandidates.length, 
        candidates: parsedCandidates,
        message: `${parsedCandidates.length} profil kandidat berhasil diekstrak dan disimpan`
      });
    }

    // 7. Action: Auto-Scrape via Puppeteer Browser
    if (action === 'auto_scrape_browser') {
      const targetUrl = googleUrl || (filter ? `https://www.google.com/search?q=${encodeURIComponent(buildLinkedInXRayQuery(filter))}` : '');
      if (!targetUrl) {
        return NextResponse.json({ success: false, error: 'Target URL pencarian tidak valid' }, { status: 400 });
      }

      const { browser } = await launchBrowserWithFallback('headful');
      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });

        // Tunggu hasil termuat secara dinamis (hingga 30 detik untuk toleransi pemuatan / verifikasi captcha)
        let extracted: any[] = [];
        const startTime = Date.now();

        while (Date.now() - startTime < 30000) {
          extracted = await page.evaluate(() => {
            const items: any[] = [];
            const anchors = Array.from(document.querySelectorAll('a[href*="linkedin.com/in/"], a[href*="glints.com/"], a[href$=".pdf"], a[href*=".pdf?"]'));
            const seen = new Set();

            for (const a of anchors) {
              const anchor = a as HTMLAnchorElement;
              let rawHref = anchor.href;
              if (rawHref.includes('/url?q=')) {
                try {
                  const u = new URL(rawHref);
                  rawHref = u.searchParams.get('q') || rawHref;
                } catch {}
              }
              const cleanUrl = rawHref.split('?')[0];
              if (seen.has(cleanUrl)) continue;
              seen.add(cleanUrl);

              const h3 = anchor.querySelector('h3') || anchor;
              const titleText = (h3.textContent || '').trim();
              if (!titleText || titleText.length < 3) continue;

              const parts = titleText.split(/ [-–—|] /);
              const name = parts[0] ? parts[0].replace(/^(LinkedIn[·•\s-]*)/i, '').trim() : 'Kandidat';
              const headline = parts.slice(1).join(' - ').trim() || titleText;

              const container = anchor.closest('.g') || anchor.closest('div[data-hveid]') || anchor.parentElement;
              const snippet = container ? (container.textContent || '').trim() : '';

              const locMatch = snippet.match(/(Jakarta|Surabaya|Bandung|Gresik|Sidoarjo|Semarang|Medan|Yogyakarta|Tangerang|Bekasi|Bogor|Depok|Kediri|Malang)[^·\n]*/i);
              const location = locMatch ? locMatch[0].trim() : 'Indonesia';

              const phoneMatch = snippet.match(/(08\d{8,11}|(\+62|62)8\d{8,11})/);
              const phone = phoneMatch ? phoneMatch[0] : '';

              items.push({
                id: 'cand_' + Math.random().toString(36).substring(2, 9),
                name,
                headline,
                location,
                profileUrl: cleanUrl,
                platform: cleanUrl.includes('glints') ? 'glints' : 'linkedin',
                isOpenToWork: true,
                phone: phone,
                contact: phone,
                aiHonestyScore: 90,
                aiHonestyNotes: ['Data teridentifikasi via penelusuran publik'],
                aiMatchScore: 85,
                availabilityStatus: 'immediate',
                experiences: [],
                skills: [],
                sourcedDate: new Date().toISOString().split('T')[0],
                status: 'new'
              });
            }
            return items;
          });

          if (extracted.length > 0) {
            break; // Berhasil menemukan kandidat, langsung keluar dari loop
          }

          await new Promise(r => setTimeout(r, 1500));
        }

        // Simpan semua kandidat yang berhasil diambil
        for (const cand of extracted) {
          upsertCandidate(cand);
        }

        await browser.close();

        return NextResponse.json({
          success: true,
          count: extracted.length,
          candidates: extracted,
          message: extracted.length > 0 
            ? `${extracted.length} talenta berhasil diimpor otomatis dari browser!`
            : 'Belum ada profil yang terdeteksi. Gunakan "Buka di Google" lalu klik Bookmarklet 1-Klik atau Tempel Cepat untuk hasil instan tanpa kendala bot checkpoint.'
        });
      } catch (scrapeErr: any) {
        try { await browser.close(); } catch {}
        return NextResponse.json({ success: false, error: `Gagal scraping otomatis: ${scrapeErr.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ success: false, error: 'Aksi tidak dikenali' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
