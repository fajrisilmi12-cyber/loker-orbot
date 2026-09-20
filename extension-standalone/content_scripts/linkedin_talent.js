/**
 * CV Blaster - LinkedIn Talent Scout & Sourcing Content Script
 * Extracts rich forensic candidate profiles:
 * - Name, headline, location, avatar
 * - #OpenToWork badge & details
 * - Full experience timeline (roles, dates, durations, descriptions)
 * - Education (school, degree, years)
 * - Skills & Activity Reposts / Posts
 */

(function () {
  if (window.__cvBlasterLinkedInLoaded) return;
  window.__cvBlasterLinkedInLoaded = true;

  console.log('[CV Blaster] LinkedIn Talent Scout Content Script ready.');

  // Clean text helper
  function cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').replace(/[\n\r\t]+/g, ' ').trim();
  }

  // Safe DOM query helpers - Guaranteed 0% chance of throwing DOMException
  function safeQuery(selector, root = document) {
    try {
      return root.querySelector(selector);
    } catch {
      return null;
    }
  }

  function safeQueryAll(selector, root = document) {
    try {
      return Array.from(root.querySelectorAll(selector));
    } catch {
      return [];
    }
  }

  // Extract candidate profile from current LinkedIn profile page
  window.cvBlasterExtractLinkedInProfile = function () {
    try {
      const url = window.location.href.split('?')[0].replace(/\/+$/, '');

      // 1. Name
      let name = '';
      const nameEl = safeQuery('h1.text-heading-xlarge, h1.inline.t-24, h1[class*="heading-xlarge"], main section h1');
      if (nameEl) name = cleanText(nameEl.innerText);
      if (!name) {
        const titleMatch = document.title.match(/^([^|\-–]+)/);
        if (titleMatch) name = cleanText(titleMatch[1]);
      }

      // 2. Headline & Location
      let headline = '';
      const headlineEl = safeQuery('div.text-body-medium.break-words, div.pv-text-details__left-panel > div.text-body-medium, [data-generated-suggestion-target]');
      if (headlineEl) headline = cleanText(headlineEl.innerText);

      let location = 'Indonesia';
      const locEl = safeQuery('span.text-body-small.inline.t-black--light.break-words, div.pv-text-details__left-panel span.text-body-small');
      if (locEl) location = cleanText(locEl.innerText);

      // 3. Avatar
      let avatar = '';
      const avatarEl = safeQuery('img.pv-top-card-profile-picture__image, img[class*="profile-picture"]');
      if (avatarEl && avatarEl.src) avatar = avatarEl.src;

      // 4. #OpenToWork Badge & Roles
      let isOpenToWork = false;
      let openToWorkDetails = '';

      // Check avatar frame or open to work badge safely in JS (no CSS flag parser issues)
      const allImages = safeQueryAll('img');
      for (const img of allImages) {
        const t = (img.title || '').toLowerCase();
        const a = (img.alt || '').toLowerCase();
        const c = (img.className || '').toLowerCase();
        if (t.includes('open to work') || a.includes('open to work') || c.includes('open-to-work') || c.includes('opentowork')) {
          isOpenToWork = true;
          break;
        }
      }

      // Check open to work section / card
      const openToWorkSection = safeQuery('section[data-section="openToWork"], div[class*="open-to-work"], div[data-view-name*="open-to-work"]');
      const bodyText = (document.body && document.body.innerText) || '';
      if (openToWorkSection || bodyText.includes('Open to work') || bodyText.includes('#OpenToWork')) {
        isOpenToWork = true;
      }

      // Try to find open to work job titles
      const otwRolesEl = safeQuery('div[class*="open-to-work"] .text-body-small, section[data-section="openToWork"] p');
      if (otwRolesEl) {
        openToWorkDetails = cleanText(otwRolesEl.innerText);
      } else if (isOpenToWork) {
        openToWorkDetails = 'Aktif mencari peluang kerja (#OpenToWork)';
      }

      // 5. Experience Timeline
      const experiences = [];
      const expAnchor = document.getElementById('experience');
      const expSection = expAnchor ? expAnchor.closest('section') : safeQuery('section:has(#experience)');
      if (expSection) {
        const items = safeQueryAll('li.artdeco-list__item, li[class*="experience"]', expSection);
        items.forEach((item) => {
          const titleEl = safeQuery('div[data-view-name="profile-component-entity"] span[aria-hidden="true"], span.mr1.t-bold span[aria-hidden="true"], div.display-flex.flex-column span[aria-hidden="true"]', item);
          const compEl = safeQuery('span.t-14.t-normal span[aria-hidden="true"], span.t-14.t-normal:not(.t-black--light)', item);
          const dateEl = safeQuery('span.t-14.t-normal.t-black--light span[aria-hidden="true"], span.pvs-entity__caption-wrapper', item);
          const descEl = safeQuery('div.inline-show-more-text, div[class*="description"]', item);

          const roleTitle = titleEl ? cleanText(titleEl.innerText) : '';
          const compName = compEl ? cleanText(compEl.innerText) : '';
          const dateText = dateEl ? cleanText(dateEl.innerText) : '';
          const desc = descEl ? cleanText(descEl.innerText) : '';

          if (roleTitle || compName) {
            experiences.push({
              title: roleTitle || 'Role Spesialis',
              company: compName || 'Perusahaan',
              employmentType: 'Full-time',
              startDate: dateText.split('·')[0] ? cleanText(dateText.split('·')[0].split('-')[0]) : '',
              endDate: dateText.split('·')[0] && dateText.split('·')[0].includes('-') ? cleanText(dateText.split('·')[0].split('-')[1]) : 'Sekarang',
              duration: dateText.split('·')[1] ? cleanText(dateText.split('·')[1]) : '',
              location: '',
              description: desc
            });
          }
        });
      }

      // 6. Education
      const education = [];
      const eduAnchor = document.getElementById('education');
      const eduSection = eduAnchor ? eduAnchor.closest('section') : safeQuery('section:has(#education)');
      if (eduSection) {
        const items = safeQueryAll('li.artdeco-list__item', eduSection);
        items.forEach((item) => {
          const schoolEl = safeQuery('span.mr1.t-bold span[aria-hidden="true"], div[data-view-name="profile-component-entity"] span[aria-hidden="true"]', item);
          const degreeEl = safeQuery('span.t-14.t-normal span[aria-hidden="true"]', item);
          const yearsEl = safeQuery('span.t-14.t-normal.t-black--light span[aria-hidden="true"]', item);

          const school = schoolEl ? cleanText(schoolEl.innerText) : '';
          const degree = degreeEl ? cleanText(degreeEl.innerText) : '';
          const years = yearsEl ? cleanText(yearsEl.innerText) : '';

          if (school) {
            education.push({ school, degree, years });
          }
        });
      }

      // 7. Skills
      const skills = [];
      const skillsAnchor = document.getElementById('skills');
      const skillsSection = skillsAnchor ? skillsAnchor.closest('section') : safeQuery('section:has(#skills)');
      if (skillsSection) {
        const items = safeQueryAll('li.artdeco-list__item, span[aria-hidden="true"]', skillsSection);
        items.forEach((item) => {
          const txt = cleanText(item.innerText);
          if (txt && txt.length > 1 && txt.length < 35 && !txt.includes('Endorsement') && !txt.includes('Skill') && !skills.includes(txt)) {
            skills.push(txt);
          }
        });
      }

      // 8. Activity Highlights (Reposts / Posts)
      const activityHighlights = [];
      const actAnchor = document.getElementById('activity');
      const actSection = actAnchor ? actAnchor.closest('section') : safeQuery('section:has(#activity)');
      if (actSection) {
        const actItems = safeQueryAll('div[data-view-name="profile-component-entity"], li.artdeco-list__item', actSection);
        actItems.forEach((act) => {
          const txt = cleanText(act.innerText);
          if (txt && txt.length > 15) {
            activityHighlights.push(txt.slice(0, 160) + (txt.length > 160 ? '...' : ''));
          }
        });
      }

      return {
        id: 'cand_' + Math.random().toString(36).substring(2, 9),
        name: name || 'Kandidat LinkedIn',
        headline: headline || 'Profesional Terverifikasi',
        platform: 'linkedin',
        profileUrl: url,
        location: location || 'Indonesia',
        phone: '',
        email: '',
        contact: url,
        avatar,
        isOpenToWork,
        openToWorkDetails,
        experiences,
        education,
        skills: skills.slice(0, 15),
        activityHighlights: activityHighlights.slice(0, 5),
        sourcedDate: new Date().toISOString().split('T')[0],
        status: 'new'
      };
    } catch (err) {
      console.error('[CV Blaster] Error extracting LinkedIn profile:', err ? (err.message || String(err)) : 'Unknown');
      return null;
    }
  };

  // Extract candidate profile URLs from LinkedIn People Search
  window.cvBlasterExtractLinkedInSearchResults = function () {
    const urls = new Set();
    const links = safeQueryAll('a[href*="/in/"]');
    links.forEach((a) => {
      let href = a.href.split('?')[0].replace(/\/+$/, '');
      if (href.includes('/in/') && !href.endsWith('/in') && !href.includes('/recent-activity/')) {
        urls.add(href);
      }
    });
    return Array.from(urls);
  };

  // Listen for task commands from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'EXECUTE_TASK' && request.task && request.task.type === 'linkedin_scrape') {
      chrome.runtime.sendMessage({
        action: 'TASK_PROGRESS',
        message: 'Mengekstrak profil LinkedIn...'
      }).catch(() => {});

      // Short delay for LinkedIn dynamic hydration
      setTimeout(() => {
        const candidate = window.cvBlasterExtractLinkedInProfile();
        if (candidate && candidate.name) {
          chrome.runtime.sendMessage({
            action: 'SAVE_TALENT',
            candidate,
            requirement: request.task.data ? request.task.data.requirement : ''
          }, (res) => {
            if (res && res.success) {
              chrome.runtime.sendMessage({
                action: 'TASK_COMPLETED',
                summary: `Profil ${candidate.name} berhasil diimpor & dianalisis AI!`
              }).catch(() => {});
            } else {
              chrome.runtime.sendMessage({
                action: 'TASK_FAILED',
                error: res ? res.error : 'Gagal menyimpan ke database'
              }).catch(() => {});
            }
          });
        } else {
          chrome.runtime.sendMessage({
            action: 'TASK_FAILED',
            error: 'Gagal mengekstrak elemen profil LinkedIn'
          }).catch(() => {});
        }
      }, 1500);

      sendResponse({ received: true });
      return true;
    }

    if (request.action === 'EXTRACT_ACTIVE_PROFILE') {
      const candidate = window.cvBlasterExtractLinkedInProfile();
      sendResponse({ candidate });
      return true;
    }

    if (request.action === 'GET_SEARCH_CANDIDATE_URLS') {
      const list = window.cvBlasterExtractLinkedInSearchResults();
      sendResponse({ urls: list });
      return true;
    }
  });
})();
