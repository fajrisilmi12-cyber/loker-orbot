/**
 * CV Blaster - In-Page Floating Assistant & Draggable Controller
 * Anti-slop solid architecture, restrained SVG icons, zero emojis, clean interactive feedback.
 */

(function () {
  if (document.getElementById('cv-blaster-float-root')) return;

  const host = window.location.hostname;
  const path = window.location.pathname;
  const href = window.location.href;

  // Context detection
  let mode = null;
  if (host.includes('linkedin.com')) {
    if (path.startsWith('/in/')) mode = 'linkedin_profile';
    else if (path.includes('/search/results/people')) mode = 'linkedin_search';
  } else if (host.includes('indeed.com')) {
    if (href.includes('/viewjob') || href.includes('/rc/clk') || href.includes('/m/viewjob') || href.includes('vjk=')) {
      mode = 'indeed_job';
    } else {
      mode = 'indeed_search';
    }
  } else if (host.includes('jobstreet.co') || host.includes('jobstreet.com') || host.includes('glints.com')) {
    mode = 'general';
  }

  if (!mode) return;

  // Shared Toast Notification
  function createToast(container) {
    const toast = document.createElement('div');
    toast.className = 'cv-blaster-toast';
    container.appendChild(toast);

    return function (message, type = 'info', duration = 2800) {
      toast.className = `cv-blaster-toast show ${type}`;
      toast.innerText = message;
      clearTimeout(toast.__timer);
      toast.__timer = setTimeout(() => {
        toast.className = 'cv-blaster-toast';
      }, duration);
    };
  }

  // ============================================================================
  // 1. IN-PAGE FLOATING PILL (Bottom Right)
  // ============================================================================
  const root = document.createElement('div');
  root.id = 'cv-blaster-float-root';

  const card = document.createElement('div');
  card.className = 'cv-blaster-float-card';

  // Badge icon
  const badge = document.createElement('div');
  badge.className = 'cv-blaster-float-badge';
  badge.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M3 9h18"/>
      <path d="M3 15h18"/>
      <path d="M9 3v18"/>
      <path d="M15 3v18"/>
    </svg>
  `;

  // Content
  const textContainer = document.createElement('div');
  textContainer.className = 'cv-blaster-float-content';

  const titleEl = document.createElement('div');
  titleEl.className = 'cv-blaster-float-title';

  const subEl = document.createElement('div');
  subEl.className = 'cv-blaster-float-sub';

  textContainer.appendChild(titleEl);
  textContainer.appendChild(subEl);

  // Action Button
  const actionBtn = document.createElement('button');
  actionBtn.className = 'cv-blaster-float-action-btn';

  // Draggable Window Trigger Button
  const expandModalBtn = document.createElement('button');
  expandModalBtn.className = 'cv-blaster-float-icon-btn';
  expandModalBtn.title = 'Buka panel melayang (bisa digeser)';
  expandModalBtn.innerHTML = `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M9 3v18"/>
    </svg>
  `;
  expandModalBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    window.cvBlasterOpenDraggableWindow();
  });

  // Minimize Button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'cv-blaster-float-icon-btn';
  closeBtn.title = 'Kecilkan widget';
  closeBtn.innerHTML = `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  `;

  let isMinimized = false;
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    isMinimized = true;
    card.classList.add('minimized');
    badge.title = 'Buka CV Blaster Assistant';
  });

  badge.addEventListener('click', () => {
    if (isMinimized) {
      isMinimized = false;
      card.classList.remove('minimized');
      badge.removeAttribute('title');
    }
  });

  card.appendChild(badge);
  card.appendChild(textContainer);
  card.appendChild(actionBtn);
  card.appendChild(expandModalBtn);
  card.appendChild(closeBtn);
  root.appendChild(card);

  const floatToast = createToast(root);

  // Configure Pill Content Based on Context
  if (mode === 'linkedin_profile') {
    titleEl.innerText = 'LinkedIn Talent';
    subEl.innerText = 'Ekstraksi profil aktif';
    actionBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
      <span>Simpan Profil</span>
    `;

    actionBtn.addEventListener('click', async () => {
      actionBtn.disabled = true;
      actionBtn.innerHTML = '<span>Mengekstrak...</span>';

      try {
        const candidate = typeof window.cvBlasterExtractLinkedInProfile === 'function' 
          ? window.cvBlasterExtractLinkedInProfile() 
          : null;

        if (!candidate || !candidate.name) {
          throw new Error('Gagal membaca elemen profil LinkedIn.');
        }

        actionBtn.innerHTML = '<span>Menganalisis...</span>';

        chrome.runtime.sendMessage({
          action: 'SAVE_TALENT',
          candidate
        }, (res) => {
          if (res && res.success) {
            actionBtn.className = 'cv-blaster-float-action-btn success';
            const score = res.data?.candidate?.aiHonestyScore || 90;
            actionBtn.innerHTML = `<span>Tersimpan (${score}% Skor)</span>`;
            floatToast(`Profil ${candidate.name} tersimpan`, 'success');
          } else {
            throw new Error(res ? res.error : 'Gagal terhubung ke server');
          }
        });
      } catch (err) {
        actionBtn.className = 'cv-blaster-float-action-btn error';
        actionBtn.innerHTML = '<span>Gagal</span>';
        floatToast(err.message || 'Gagal menyimpan profil', 'error');
        setTimeout(() => {
          actionBtn.className = 'cv-blaster-float-action-btn';
          actionBtn.disabled = false;
          actionBtn.innerHTML = '<span>Coba Lagi</span>';
        }, 2500);
      }
    });

  } else if (mode === 'linkedin_search') {
    titleEl.innerText = 'Pencarian Orang';
    subEl.innerText = 'Hasil pencarian LinkedIn';
    actionBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      <span>Antrekan (4 Tab)</span>
    `;

    actionBtn.addEventListener('click', () => {
      const urls = typeof window.cvBlasterExtractLinkedInSearchResults === 'function'
        ? window.cvBlasterExtractLinkedInSearchResults()
        : [];

      if (urls.length === 0) {
        floatToast('Tidak ada profil ditemukan di halaman ini', 'error');
        return;
      }

      actionBtn.disabled = true;
      const tasks = urls.map(u => ({ type: 'linkedin_scrape', url: u }));
      chrome.runtime.sendMessage({ action: 'ENQUEUE_TASKS', tasks }, () => {
        actionBtn.className = 'cv-blaster-float-action-btn success';
        actionBtn.innerHTML = `<span>${urls.length} Masuk Antrean</span>`;
        floatToast(`${urls.length} profil masuk antrean 4 tab`, 'success');
      });
    });

  } else if (mode === 'indeed_job') {
    titleEl.innerText = 'Indeed Auto-Apply';
    subEl.innerText = 'Sesi desktop asli';
    actionBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      <span>Lamar Otomatis</span>
    `;

    actionBtn.addEventListener('click', async () => {
      actionBtn.disabled = true;
      actionBtn.innerHTML = '<span>Memproses...</span>';

      try {
        if (typeof window.cvBlasterExecuteIndeedApply !== 'function') {
          throw new Error('Script automasi belum siap.');
        }

        const res = await window.cvBlasterExecuteIndeedApply();
        if (res.success) {
          actionBtn.className = 'cv-blaster-float-action-btn success';
          actionBtn.innerHTML = '<span>Lamaran Terkirim</span>';
          floatToast('Lamaran berhasil dikirim', 'success');
        } else {
          throw new Error(res.error || 'Gagal melamar pekerjaan.');
        }
      } catch (err) {
        actionBtn.className = 'cv-blaster-float-action-btn error';
        actionBtn.innerHTML = '<span>Gagal</span>';
        floatToast(err.message || 'Gagal melamar', 'error');
        setTimeout(() => {
          actionBtn.className = 'cv-blaster-float-action-btn';
          actionBtn.disabled = false;
          actionBtn.innerHTML = '<span>Coba Lagi</span>';
        }, 3000);
      }
    });

  } else if (mode === 'indeed_search') {
    titleEl.innerText = 'Pencarian Lowongan';
    subEl.innerText = 'Deteksi feed Indeed';
    actionBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      <span>Lamar di Tab Ini</span>
    `;

    actionBtn.addEventListener('click', () => {
      let cards = [];
      if (typeof window.cvBlasterExtractIndeedJobCards === 'function') {
        cards = window.cvBlasterExtractIndeedJobCards();
      }
      if (cards.length === 0 && typeof window.cvBlasterExtractIndeedSearchUrls === 'function') {
        const urls = window.cvBlasterExtractIndeedSearchUrls();
        cards = urls.map(u => ({ url: u, title: 'Lowongan Indeed', company: 'Indeed' }));
      }

      if (cards.length === 0) {
        floatToast('Tidak ada lowongan ditemukan di halaman ini', 'error');
        return;
      }

      actionBtn.disabled = true;
      const tasks = cards.map(c => ({
        type: 'indeed_apply',
        url: c.url,
        data: { title: c.title, company: c.company }
      }));

      chrome.runtime.sendMessage({ action: 'ENQUEUE_TASKS', tasks }, () => {
        actionBtn.className = 'cv-blaster-float-action-btn success';
        actionBtn.innerHTML = `<span>${cards.length} Diproses</span>`;
        floatToast(`${cards.length} lowongan siap diproses di tab ini`, 'success');
      });
    });

  } else {
    titleEl.innerText = 'lemparjaring';
    subEl.innerText = 'Portal Karir Aktif';
    actionBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>
      <span>Buka Controller</span>
    `;
    actionBtn.addEventListener('click', () => {
      window.cvBlasterOpenDraggableWindow();
    });
  }

  // ============================================================================
  // 2. DRAGGABLE CONTROLLER WINDOW
  // ============================================================================
  let dragWindowEl = null;

  function clampWindowToViewport() {
    if (!dragWindowEl || dragWindowEl.style.display === 'none') return;
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const rect = dragWindowEl.getBoundingClientRect();
    const elemW = rect.width || 360;
    const elemH = rect.height || 450;

    let curLeft = rect.left;
    let curTop = rect.top;

    let clampedLeft = Math.max(10, Math.min(winW - elemW - 10, curLeft));
    let clampedTop = Math.max(10, Math.min(winH - elemH - 10, curTop));

    dragWindowEl.style.left = `${clampedLeft}px`;
    dragWindowEl.style.top = `${clampedTop}px`;
    dragWindowEl.style.right = 'auto';
  }

  window.addEventListener('resize', clampWindowToViewport);

  window.cvBlasterOpenDraggableWindow = function () {
    if (dragWindowEl) {
      dragWindowEl.style.display = 'flex';
      clampWindowToViewport();
      return;
    }

    dragWindowEl = document.createElement('div');
    dragWindowEl.className = 'cv-blaster-draggable-window';
    dragWindowEl.id = 'cv-blaster-drag-window';

    // Header (Drag Handle)
    const header = document.createElement('div');
    header.className = 'cv-blaster-drag-header';
    header.innerHTML = `
      <div class="cv-blaster-drag-header-title">
        <div class="cv-blaster-drag-logo-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M3 9h18"/>
            <path d="M3 15h18"/>
            <path d="M9 3v18"/>
            <path d="M15 3v18"/>
          </svg>
        </div>
        <span>lemparjaring</span>
        <span class="cv-blaster-pill-badge">Tab Aktif</span>
      </div>
      <div class="cv-blaster-drag-header-actions">
        <button class="cv-blaster-drag-btn-icon" id="cv-drag-close" title="Tutup">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `;

    // Make Draggable with Viewport Clamping
    let isDragging = false;
    let startX = 0, startY = 0;
    let initLeft = 0, initTop = 0;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      isDragging = true;
      const rect = dragWindowEl.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      initLeft = rect.left;
      initTop = rect.top;
      header.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      const elemW = dragWindowEl.offsetWidth;
      const elemH = dragWindowEl.offsetHeight;

      const newLeft = Math.max(10, Math.min(winW - elemW - 10, initLeft + dx));
      const newTop = Math.max(10, Math.min(winH - elemH - 10, initTop + dy));

      dragWindowEl.style.left = `${newLeft}px`;
      dragWindowEl.style.top = `${newTop}px`;
      dragWindowEl.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        header.style.cursor = 'grab';
      }
    });

    // Body
    const body = document.createElement('div');
    body.className = 'cv-blaster-drag-body';
    body.innerHTML = `
      <!-- Toast Container -->
      <div class="cv-blaster-toast-container" id="cv-drag-toast-container"></div>

      <!-- Filter & Target Section -->
      <div class="card">
        <div class="card-title">Filter & Target</div>
        <div class="input-row">
          <input type="text" id="cv-drag-kw" placeholder="Posisi kerja" value="full stack developer">
          <input type="text" id="cv-drag-loc" placeholder="Lokasi" value="Surabaya" style="max-width: 110px;">
        </div>
        <div class="input-row">
          <select id="cv-drag-quota">
            <option value="5">Ambil 5 Loker</option>
            <option value="10" selected>Ambil 10 Loker</option>
            <option value="20">Ambil 20 Loker</option>
            <option value="all">Semua di Halaman</option>
          </select>
        </div>
        <div class="btn-row">
          <button class="action-btn secondary" id="cv-drag-btn-search">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <span id="cv-drag-search-text">Cari Surabaya</span>
          </button>
          <button class="action-btn" id="cv-drag-btn-auto">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <span>Lamar di Tab Ini</span>
          </button>
        </div>
      </div>

      <!-- Detected Job Cards Section -->
      <div class="card" id="cv-drag-detected-card">
        <div class="card-title" style="color: #38bdf8;" id="cv-drag-detected-title">Mengecek Halaman...</div>
        <div id="cv-drag-detected-list" class="detected-list"></div>
        <button class="action-btn" id="cv-drag-btn-enqueue" style="display: none; margin-top: 8px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <span id="cv-drag-enqueue-text">Lamar di Tab Ini</span>
        </button>
      </div>

      <!-- Concurrency Status -->
      <div class="footer-info">
        <span>Antrean: <strong style="color: #10b981;">Aktif</strong></span>
        <span>Mode: <strong style="color: #ea580c;">Tab Aktif (In-Place)</strong></span>
      </div>
    `;

    dragWindowEl.appendChild(header);
    dragWindowEl.appendChild(body);
    document.body.appendChild(dragWindowEl);

    const dragToastContainer = dragWindowEl.querySelector('#cv-drag-toast-container');
    const dragToast = createToast(dragToastContainer);

    // Event Handlers
    const btnClose = dragWindowEl.querySelector('#cv-drag-close');
    btnClose.addEventListener('click', () => {
      dragWindowEl.style.display = 'none';
    });

    const dragKw = dragWindowEl.querySelector('#cv-drag-kw');
    const dragLoc = dragWindowEl.querySelector('#cv-drag-loc');
    const dragQuota = dragWindowEl.querySelector('#cv-drag-quota');
    const btnSearch = dragWindowEl.querySelector('#cv-drag-btn-search');
    const dragSearchText = dragWindowEl.querySelector('#cv-drag-search-text');
    const btnAuto = dragWindowEl.querySelector('#cv-drag-btn-auto');
    const detectedTitle = dragWindowEl.querySelector('#cv-drag-detected-title');
    const detectedList = dragWindowEl.querySelector('#cv-drag-detected-list');
    const btnEnqueue = dragWindowEl.querySelector('#cv-drag-btn-enqueue');
    const dragEnqueueText = dragWindowEl.querySelector('#cv-drag-enqueue-text');

    dragLoc.addEventListener('input', () => {
      const l = dragLoc.value.trim();
      dragSearchText.innerText = l ? `Cari ${l}` : 'Cari di Portal';
    });

    btnSearch.addEventListener('click', () => {
      const kw = encodeURIComponent(dragKw.value.trim() || 'full stack developer');
      const loc = encodeURIComponent(dragLoc.value.trim() || 'Surabaya');
      dragToast(`Membuka pencarian ${dragLoc.value.trim()}...`, 'info');
      setTimeout(() => {
        window.location.href = `https://id.indeed.com/jobs?q=${kw}&l=${loc}`;
      }, 300);
    });

    btnAuto.addEventListener('click', () => {
      if (typeof window.cvBlasterStartInTabAutomation === 'function') {
        dragToast('Memulai automasi di tab ini...', 'info');
        dragWindowEl.style.display = 'none';
        window.cvBlasterStartInTabAutomation(dragQuota.value);
      } else {
        const kw = encodeURIComponent(dragKw.value.trim() || 'full stack developer');
        const loc = encodeURIComponent(dragLoc.value.trim() || 'Surabaya');
        window.location.href = `https://id.indeed.com/jobs?q=${kw}&l=${loc}`;
      }
    });

    // Detect jobs currently on page
    if (typeof window.cvBlasterExtractIndeedJobCards === 'function') {
      const cards = window.cvBlasterExtractIndeedJobCards();
      if (cards.length > 0) {
        detectedTitle.innerText = `${cards.length} Lowongan di Halaman`;
        detectedList.innerHTML = cards.slice(0, 3).map(c => `
          <div class="detected-item">
            <span class="detected-item-title">${c.title}</span>
            <span class="detected-item-sub">${c.company || 'Perusahaan'}${c.location ? ' · ' + c.location : ''}</span>
          </div>
        `).join('') + (cards.length > 3 ? `<div class="detected-more">...dan ${cards.length - 3} lowongan lainnya</div>` : '');

        btnEnqueue.style.display = 'flex';
        dragEnqueueText.innerText = `Lamar ${cards.length} Lowongan di Tab Ini`;

        btnEnqueue.addEventListener('click', () => {
          btnEnqueue.disabled = true;
          const limit = dragQuota.value === 'all' ? cards.length : (parseInt(dragQuota.value, 10) || 10);
          dragToast(`Memulai automasi ${limit} lowongan di tab ini...`, 'success');
          dragWindowEl.style.display = 'none';

          if (typeof window.cvBlasterStartInTabAutomation === 'function') {
            window.cvBlasterStartInTabAutomation(limit);
          }
        });
      } else {
        detectedTitle.innerText = 'Memuat Lowongan...';
        detectedList.innerHTML = '<span class="detected-empty">Buka halaman pencarian loker untuk deteksi otomatis.</span>';
      }
    }
  };

  // Listen for message from popup to open draggable window
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'OPEN_DRAGGABLE_WINDOW') {
      window.cvBlasterOpenDraggableWindow();
      sendResponse({ success: true });
      return true;
    }
  });

  // Mount to DOM
  if (document.body) {
    document.body.appendChild(root);
  } else {
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(root));
  }
})();
