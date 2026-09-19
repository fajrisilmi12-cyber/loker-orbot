/**
 * Human-like Stealth Utility for Puppeteer
 * Emulates natural human typing, random jitter delays, and curved mouse movements
 * to bypass anti-bot, behavioral analysis, and Cloudflare bot detection.
 */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns a random integer between min and max inclusive
 */
export function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Adds a natural human pause with slight random jitter
 */
export async function randomDelay(minMs: number = 800, maxMs: number = 2200): Promise<void> {
  const ms = getRandomInt(minMs, maxMs);
  await sleep(ms);
}

/**
 * Types text character by character with human-like speed variances,
 * occasional micro-hesitations, and punctuation pauses.
 */
export async function humanType(
  page: any,
  selectorOrElement: string | any,
  text: string,
  options?: {
    minDelay?: number;
    maxDelay?: number;
    clearFirst?: boolean;
  }
): Promise<void> {
  const minDelay = options?.minDelay ?? 35;
  const maxDelay = options?.maxDelay ?? 120;
  const clearFirst = options?.clearFirst ?? true;

  try {
    let handle = typeof selectorOrElement === 'string' 
      ? await page.$(selectorOrElement) 
      : selectorOrElement;

    if (!handle) return;

    // Focus on target
    await handle.focus();
    await sleep(getRandomInt(100, 250));

    if (clearFirst) {
      // Select all and delete naturally
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      await sleep(getRandomInt(80, 200));
    }

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      await page.keyboard.type(char);

      // Micro-delay between keystrokes
      let delay = getRandomInt(minDelay, maxDelay);

      // Hesitation after punctuation marks or spaces
      if (['.', ',', '?', '!', '\n'].includes(char)) {
        delay += getRandomInt(180, 450);
      } else if (char === ' ') {
        delay += getRandomInt(30, 90);
      }

      // 3% chance of natural typing pause (human thinking pause)
      if (Math.random() < 0.03 && i < text.length - 1) {
        delay += getRandomInt(350, 800);
      }

      await sleep(delay);
    }

    await sleep(getRandomInt(120, 300));
  } catch (err) {
    // Fallback directly via evaluate if typing fails
    try {
      if (typeof selectorOrElement === 'string') {
        await page.$eval(selectorOrElement, (el: any, val: string) => {
          el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }, text);
      }
    } catch {}
  }
}

/**
 * Naturally moves mouse along a curve towards element and clicks it
 */
export async function humanClick(
  page: any,
  selectorOrElement: string | any,
  options?: {
    waitAfterClick?: boolean;
    minWait?: number;
    maxWait?: number;
  }
): Promise<boolean> {
  try {
    const handle = typeof selectorOrElement === 'string' 
      ? await page.$(selectorOrElement) 
      : selectorOrElement;

    if (!handle) return false;

    // Scroll element into view smoothly
    await handle.evaluate((el: HTMLElement) => {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    });
    await sleep(getRandomInt(200, 450));

    const box = await handle.boundingBox();
    if (!box) {
      // Fallback click
      await handle.click();
      return true;
    }

    // Pick target with slight random offset from center
    const targetX = box.x + box.width * (0.35 + Math.random() * 0.3);
    const targetY = box.y + box.height * (0.35 + Math.random() * 0.3);

    // Perform curved move simulation
    await page.mouse.move(targetX, targetY, { steps: getRandomInt(8, 18) });
    await sleep(getRandomInt(50, 180));

    await page.mouse.down();
    await sleep(getRandomInt(60, 140));
    await page.mouse.up();

    if (options?.waitAfterClick !== false) {
      await sleep(getRandomInt(options?.minWait ?? 600, options?.maxWait ?? 1500));
    }
    return true;
  } catch {
    // Ultimate fallback direct evaluate click
    try {
      if (typeof selectorOrElement === 'string') {
        await page.$eval(selectorOrElement, (el: HTMLElement) => el.click());
      } else if (selectorOrElement) {
        await selectorOrElement.click();
      }
      return true;
    } catch {
      return false;
    }
  }
}
