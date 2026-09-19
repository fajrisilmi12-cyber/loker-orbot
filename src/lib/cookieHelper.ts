/**
 * Cookie Helper Utility
 * Parses cookie strings or JSON arrays (from Chrome extension / Cookie-Editor / EditThisCookie)
 * and injects them reliably into Puppeteer pages and browser contexts.
 */

export interface ParsedCookie {
  name: string;
  value: string;
  domain: string;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  expires?: number;
}

/**
 * Normalizes sameSite strings coming from Chrome extension (unspecified, no_restriction, etc)
 * into standard Puppeteer-compatible sameSite values ('Strict', 'Lax', 'None').
 */
function normalizeSameSite(val?: string): 'Strict' | 'Lax' | 'None' | undefined {
  if (!val) return undefined;
  const lower = val.toLowerCase();
  if (lower === 'no_restriction' || lower === 'none') return 'None';
  if (lower === 'strict') return 'Strict';
  if (lower === 'lax') return 'Lax';
  return undefined; // If 'unspecified', omitting sameSite lets browser default to Lax
}

/**
 * Parses raw input which can be:
 * 1. JSON array from extensions: [{"name":"li_at","value":"...","domain":".www.linkedin.com"}]
 * 2. Standard document.cookie string: "li_at=AQED...; JSESSIONID=ajax:..."
 */
export function parseCookiesInput(rawInput: string, defaultDomain: string): ParsedCookie[] {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) return [];

  // Attempt 1: JSON Array from Chrome Extension
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((c: any) => c && c.name && c.value !== undefined)
          .map((c: any) => {
            const rawDomain = c.domain || defaultDomain;
            const sameSite = normalizeSameSite(c.sameSite);
            
            const cookieObj: ParsedCookie = {
              name: String(c.name).trim(),
              value: String(c.value).trim(),
              domain: rawDomain,
              path: c.path || '/',
              httpOnly: Boolean(c.httpOnly),
              secure: Boolean(c.secure),
            };

            if (sameSite) {
              cookieObj.sameSite = sameSite;
            }

            if (typeof c.expirationDate === 'number') {
              cookieObj.expires = Math.floor(c.expirationDate);
            }

            return cookieObj;
          });
      }
    } catch {}
  }

  // Attempt 2: Key-Value Cookie Header string
  const cookies: ParsedCookie[] = [];
  const pairs = trimmed.split(';');

  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (name && value) {
        cookies.push({
          name,
          value,
          domain: defaultDomain,
          path: '/',
          secure: true
        });
      }
    }
  }

  return cookies;
}

/**
 * Injects cookies into a Puppeteer page with multi-tier fallback
 * (standard, relaxed domain, and browser context level).
 */
export async function injectCookiesIntoPage(page: any, cookies: ParsedCookie[]): Promise<number> {
  if (!cookies || cookies.length === 0) return 0;
  let success = 0;

  for (const cookie of cookies) {
    // 1. Try standard exact injection
    try {
      await page.setCookie(cookie);
      success++;
      continue;
    } catch {}

    // 2. Try normalized domain (e.g., .www.linkedin.com -> .linkedin.com)
    try {
      let domain = cookie.domain;
      if (domain.includes('linkedin.com')) {
        domain = '.linkedin.com';
      } else if (domain.includes('indeed.com')) {
        domain = '.indeed.com';
      } else if (domain.includes('glints.com')) {
        domain = '.glints.com';
      } else if (domain.includes('jobstreet')) {
        domain = '.jobstreet.com';
      }

      await page.setCookie({
        name: cookie.name,
        value: cookie.value,
        domain: domain,
        path: cookie.path || '/',
        secure: cookie.secure,
        httpOnly: cookie.httpOnly
      });
      success++;
      continue;
    } catch {}

    // 3. Try stripped leading dot domain
    try {
      await page.setCookie({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain.replace(/^\./, ''),
        path: cookie.path || '/'
      });
      success++;
    } catch {}
  }

  return success;
}
