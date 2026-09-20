/**
 * lemparjaring - External ATS Form Adapter (Greenhouse & Lever)
 * Inspired by Simplify Jobs architecture: Dedicated adapter for external company portals.
 * Anti-slop solid architecture, restrained SVG icons, zero emojis.
 */

(function () {
  if (window.__lemparjaringATSLoaded) return;
  window.__lemparjaringATSLoaded = true;

  const host = window.location.hostname;
  let atsType = null;

  if (host.includes('greenhouse.io')) {
    atsType = 'greenhouse';
  } else if (host.includes('lever.co')) {
    atsType = 'lever';
  }

  if (!atsType) return;

  function setNativeValue(element, value) {
    if (!element || value === undefined || value === null) return;
    try {
      element.focus();
      const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
      const prototype = Object.getPrototypeOf(element);
      const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

      if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
        prototypeValueSetter.call(element, value);
      } else if (valueSetter) {
        valueSetter.call(element, value);
      } else {
        element.value = value;
      }

      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.blur();
    } catch {
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // Autofill ATS Form Fields
  function autofillATSForm(cfg = {}) {
    let filledCount = 0;
    const fullName = cfg.fullName || '';
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0] || '';
    const email = cfg.email || '';
    const phone = cfg.phoneNumber || '';
    const location = cfg.domicile || cfg.location || 'Indonesia';
    const linkedinUrl = cfg.linkedinProfileUrl || 'https://linkedin.com';
    const portfolioUrl = cfg.portfolioUrl || '';
    const githubUrl = cfg.githubUrl || '';

    // Field matchers for Greenhouse and Lever
    const fieldMappings = [
      {
        selectors: ['input#first_name', 'input[name*="first_name"]', 'input[autocomplete="given-name"]'],
        val: firstName
      },
      {
        selectors: ['input#last_name', 'input[name*="last_name"]', 'input[autocomplete="family-name"]'],
        val: lastName
      },
      {
        selectors: ['input[name="name"]', 'input#name', 'input[autocomplete="name"]', 'input[data-qa="name-input"]'],
        val: fullName
      },
      {
        selectors: ['input#email', 'input[type="email"]', 'input[name*="email"]', 'input[data-qa="email-input"]'],
        val: email
      },
      {
        selectors: ['input#phone', 'input[type="tel"]', 'input[name*="phone"]', 'input[data-qa="phone-input"]'],
        val: phone
      },
      {
        selectors: ['input#location', 'input[name*="location"]', 'input[data-qa="location-input"]'],
        val: location
      },
      {
        selectors: ['input[name*="linkedin"], input[name*="urls[LinkedIn]"], input[id*="linkedin"]'],
        val: linkedinUrl
      },
      {
        selectors: ['input[name*="github"], input[name*="urls[GitHub]"], input[id*="github"]'],
        val: githubUrl || portfolioUrl
      },
      {
        selectors: ['input[name*="portfolio"], input[name*="website"], input[name*="urls[Portfolio]"], input[name*="urls[Other]"]'],
        val: portfolioUrl || linkedinUrl
      }
    ];

    fieldMappings.forEach(mapping => {
      if (!mapping.val) return;
      for (const sel of mapping.selectors) {
        const el = document.querySelector(sel);
        if (el && (!el.value || el.value.trim() === '')) {
          setNativeValue(el, mapping.val);
          el.style.borderColor = '#10b981';
          filledCount++;
          break;
        }
      }
    });

    return filledCount;
  }

  // Floating Pill UI for ATS Pages
  function mountATSFloatingPill() {
    if (document.getElementById('lemparjaring-ats-pill')) return;

    const pill = document.createElement('div');
    pill.id = 'lemparjaring-ats-pill';
    pill.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      background: #090d16;
      border: 1px solid #222f46;
      border-radius: 9999px;
      padding: 6px 12px 6px 10px;
      display: flex;
      align-items: center;
      gap: 8px;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11px;
      font-weight: 600;
      box-shadow: 0 10px 25px rgba(0,0,0,0.6);
      user-select: none;
    `;

    pill.innerHTML = `
      <div style="width: 22px; height: 22px; border-radius: 50%; background: #ea580c; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M3 9h18"/>
          <path d="M3 15h18"/>
          <path d="M9 3v18"/>
          <path d="M15 3v18"/>
        </svg>
      </div>
      <span>ATS ${atsType === 'greenhouse' ? 'Greenhouse' : 'Lever'}</span>
      <button id="lemparjaring-ats-btn-fill" style="background: #ea580c; color: white; border: none; border-radius: 9999px; padding: 5px 10px; font-size: 11px; font-weight: 600; cursor: pointer;">
        Isi Otomatis
      </button>
    `;

    document.body.appendChild(pill);

    const btnFill = pill.querySelector('#lemparjaring-ats-btn-fill');
    btnFill.addEventListener('click', async () => {
      btnFill.disabled = true;
      btnFill.innerText = 'Mengisi...';

      try {
        const res = await fetch('http://localhost:3000/api/config');
        const data = await res.json();
        const cfg = data.config || {};
        const count = autofillATSForm(cfg);

        btnFill.style.background = '#059669';
        btnFill.innerText = `Terisi (${count} Kolom)`;
        setTimeout(() => {
          btnFill.disabled = false;
          btnFill.style.background = '#ea580c';
          btnFill.innerText = 'Isi Otomatis';
        }, 3500);
      } catch {
        btnFill.disabled = false;
        btnFill.style.background = '#dc2626';
        btnFill.innerText = 'Backend Offline';
        setTimeout(() => {
          btnFill.style.background = '#ea580c';
          btnFill.innerText = 'Isi Otomatis';
        }, 3000);
      }
    });
  }

  if (document.body) {
    mountATSFloatingPill();
  } else {
    document.addEventListener('DOMContentLoaded', mountATSFloatingPill);
  }
})();
