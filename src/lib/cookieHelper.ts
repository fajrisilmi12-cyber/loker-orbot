/**
 * Cookie Helper Utility
 * Parses cookie strings or JSON arrays (from Cookie-Editor / EditThisCookie)
 * and injects them directly into Puppeteer pages/contexts.
 */

export interface ParsedCookie {
  name: string;
  value: string;
  domain: string;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

/**
 * Parses raw input which can be:
 * 1. JSON array from extensions like Cookie-Editor / EditThisCookie: [{"name":"li_at","value":"...","domain":".linkedin.com"}]
 * 2. Standard document.cookie string: "li_at=AQED...; JSESSIONID=ajax:..."
 */
export function parseCookiesInput(rawInput: string, defaultDomain: string): ParsedCookie[] {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) return [];

  // Attempt 1: JSON Array
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((c: any) => c && c.name && c.value !== undefined)
          .map((c: any) => ({
            name: c.name,
            value: String(c.value),
            domain: c.domain || defaultDomain,
            path: c.path || '/',
            httpOnly: Boolean(c.httpOnly),
            secure: Boolean(c.secure),
            sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite || 'Lax')
          }));
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
 * Injects cookies into a Puppeteer page
 */
export async function injectCookiesIntoPage(page: any, cookies: ParsedCookie[]): Promise<number> {
  if (!cookies || cookies.length === 0) return 0;
  let success = 0;
  for (const cookie of cookies) {
    try {
      await page.setCookie(cookie);
      success++;
    } catch {
      // Try relaxed format without strict sameSite
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
  }
  return success;
}
