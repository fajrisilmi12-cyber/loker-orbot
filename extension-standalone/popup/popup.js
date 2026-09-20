/**
 * lemparjaring Standalone - Popup Controller
 * 100% Serverless, runs purely within Google Chrome using chrome.storage.local.
 */

// Toast notification helper
function showToast(message, type = 'info', duration = 3000) {
  const toast = document.getElementById('global-toast');
  if (!toast) return;
  toast.className = `toast-pill show ${type}`;
  toast.innerText = message;
  clearTimeout(toast.__timer);
  toast.__timer = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// Log entry helper
function appendLog(msg, type = 'normal') {
  const logStream = document.getElementById('log-stream');
  if (!logStream) return;
  const time = new Date().toLocaleTimeString('id-ID');
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.innerText = `[${time}] ${msg}`;
  logStream.prepend(entry);
  while (logStream.children.length > 50) {
    logStream.removeChild(logStream.lastChild);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // ==========================================
  // 1. Navigation Tabs
  // ==========================================
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) targetPanel.classList.add('active');

      if (targetId === 'panel-history') {
        renderHistory();
      }
    });
  });

  // ==========================================
  // 2. Active Tab Inspection & Auto-Apply
  // ==========================================
  const badgeActivePlatform = document.getElementById('badge-active-platform');
  const textJobTitle = document.getElementById('text-active-job-title');
  const textJobCompany = document.getElementById('text-active-job-company');
  const chipLocation = document.getElementById('chip-active-location');
  const chipSalary = document.getElementById('chip-active-salary');
  const btnApplyActive = document.getElementById('btn-apply-active-now');
  const btnEnqueueDetected = document.getElementById('btn-enqueue-detected-jobs');
  const multiJobView = document.getElementById('multi-job-detected-view');
  const singleJobView = document.getElementById('single-job-detected-view');
  const multiJobCountText = document.getElementById('multi-job-count-text');
  const multiJobSnippets = document.getElementById('multi-job-preview-snippets');

  let currentActiveTab = null;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentActiveTab = tab;

    if (tab && tab.url) {
      const url = tab.url.toLowerCase();
      if (url.includes('indeed.com')) {
        badgeActivePlatform.innerText = 'Indeed';
        badgeActivePlatform.style.color = '#38bdf8';
        badgeActivePlatform.style.borderColor = '#0284c7';
      } else if (url.includes('linkedin.com')) {
        badgeActivePlatform.innerText = 'LinkedIn';
        badgeActivePlatform.style.color = '#60a5fa';
        badgeActivePlatform.style.borderColor = '#2563eb';
      } else if (url.includes('jobstreet.')) {
        badgeActivePlatform.innerText = 'JobStreet';
        badgeActivePlatform.style.color = '#c084fc';
        badgeActivePlatform.style.borderColor = '#9333ea';
      } else if (url.includes('glints.com')) {
        badgeActivePlatform.innerText = 'Glints';
        badgeActivePlatform.style.color = '#4ade80';
        badgeActivePlatform.style.borderColor = '#16a34a';
      } else {
        badgeActivePlatform.innerText = 'Non-Portal';
      }

      // Query content script for job details
      chrome.tabs.sendMessage(tab.id, { action: 'GET_PAGE_JOB_INFO' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          return;
        }

        if (response.isMultiJob && response.jobs && response.jobs.length > 0) {
          // Multi-job search results page
          singleJobView.style.display = 'none';
          multiJobView.style.display = 'block';
          multiJobCountText.innerText = `${response.jobs.length} lowongan siap dilamar di halaman ini`;

          multiJobSnippets.innerHTML = '';
          response.jobs.slice(0, 3).forEach(j => {
            const row = document.createElement('div');
            row.style.fontSize = '10px';
            row.style.color = '#94a3b8';
            row.style.marginBottom = '2px';
            row.innerText = `• ${j.title || 'Posisi'} - ${j.company || 'Perusahaan'}`;
            multiJobSnippets.appendChild(row);
          });
        } else if (response.title) {
          // Single job page
          textJobTitle.innerText = response.title;
          textJobCompany.innerText = response.company || 'Perusahaan Terdeteksi';
          chipLocation.innerText = response.location || 'Indonesia';
          chipSalary.innerText = response.salary || 'Gaji Kompetitif';
          btnApplyActive.removeAttribute('disabled');
        }
      });
    }
  } catch (err) {
    console.warn('Tab query error:', err);
  }

  // Single Job Apply Button Click
  if (btnApplyActive) {
    btnApplyActive.addEventListener('click', async () => {
      if (!currentActiveTab) return;
      btnApplyActive.setAttribute('disabled', 'true');
      btnApplyActive.innerText = 'Memproses...';
      appendLog('Memulai otomatisasi formulir di tab ini...', 'normal');
      showToast('Mengisi formulir lamaran...', 'info');

      chrome.storage.local.get(['userConfig'], (cfgRes) => {
        const userConfig = cfgRes.userConfig || {};
        chrome.tabs.sendMessage(
          currentActiveTab.id,
          { action: 'EXECUTE_IN_TAB_APPLY', config: userConfig },
          (res) => {
            btnApplyActive.removeAttribute('disabled');
            btnApplyActive.innerText = 'Lamar Lowongan Ini';

            if (chrome.runtime.lastError) {
              showToast('Gagal terhubung ke halaman (coba refresh halaman).', 'error');
              appendLog('Error: ' + chrome.runtime.lastError.message, 'error');
              return;
            }

            if (res && res.success) {
              showToast('Lamaran berhasil diproses!', 'success');
              appendLog(`Lamaran sukses: ${res.status || 'Terkirim'}`, 'success');
              renderHistory();
            } else {
              showToast(res?.error || 'Proses dihentikan/butuh verifikasi manual', 'error');
              appendLog(res?.error || 'Gagal', 'error');
            }
          }
        );
      });
    });
  }

  // Multi-job Enqueue Button Click
  if (btnEnqueueDetected) {
    btnEnqueueDetected.addEventListener('click', async () => {
      if (!currentActiveTab) return;
      btnEnqueueDetected.setAttribute('disabled', 'true');
      btnEnqueueDetected.innerText = 'Menjalankan Otomasi...';
      appendLog('Memulai pelamaran berurutan di halaman pencarian...', 'normal');
      showToast('Menjalankan In-Tab Runner...', 'info');

      chrome.storage.local.get(['userConfig'], (cfgRes) => {
        const userConfig = cfgRes.userConfig || {};
        chrome.tabs.sendMessage(
          currentActiveTab.id,
          { action: 'EXECUTE_IN_TAB_MULTI_APPLY', config: userConfig },
          (res) => {
            btnEnqueueDetected.removeAttribute('disabled');
            btnEnqueueDetected.innerText = 'Lamar Lowongan di Tab Ini';
            if (chrome.runtime.lastError) {
              showToast('Refresh halaman sebelum memulai otomasi.', 'error');
              return;
            }
            if (res && res.success) {
              showToast(`Selesai! Berhasil melamar ${res.successCount || 0} loker.`, 'success');
              renderHistory();
            }
          }
        );
      });
    });
  }

  // Quick Portal Navigation Buttons
  const portalMap = {
    'btn-portal-indeed': 'https://id.indeed.com/jobs?q=Frontend+Developer&l=Indonesia',
    'btn-portal-linkedin': 'https://www.linkedin.com/jobs/search/?keywords=Developer&f_AL=true',
    'btn-portal-jobstreet': 'https://www.jobstreet.co.id/jobs?keywords=developer',
    'btn-portal-glints': 'https://glints.com/id/opportunities/jobs/explore'
  };

  Object.entries(portalMap).forEach(([id, targetUrl]) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', () => {
        chrome.tabs.create({ url: targetUrl, active: true });
      });
    }
  });

  // Floating Window Trigger
  const btnFloat = document.getElementById('btn-pop-drag-window');
  if (btnFloat) {
    btnFloat.addEventListener('click', async () => {
      if (!currentActiveTab) return;
      chrome.tabs.sendMessage(currentActiveTab.id, { action: 'TOGGLE_FLOATING_ASSISTANT' }, () => {
        if (chrome.runtime.lastError) {
          showToast('Buka halaman portal kerja terlebih dahulu.', 'error');
        } else {
          window.close();
        }
      });
    });
  }

  // Clear Logs
  const btnClearLogs = document.getElementById('btn-clear-logs');
  if (btnClearLogs) {
    btnClearLogs.addEventListener('click', () => {
      const logStream = document.getElementById('log-stream');
      if (logStream) logStream.innerHTML = '<div class="log-entry">Log dibersihkan.</div>';
    });
  }

  // ==========================================
  // 3. Profile & AI Settings Management
  // ==========================================
  const profFullName = document.getElementById('prof-fullname');
  const profPhone = document.getElementById('prof-phone');
  const profEmail = document.getElementById('prof-email');
  const profLocation = document.getElementById('prof-location');
  const profSalary = document.getElementById('prof-salary');
  const profExperience = document.getElementById('prof-experience');
  const profEducation = document.getElementById('prof-education');
  const profSkills = document.getElementById('prof-skills');
  const profGeminiKey = document.getElementById('prof-gemini-key');
  const profGeminiModel = document.getElementById('prof-gemini-model');
  const btnSaveProfile = document.getElementById('btn-save-profile');
  const statusSaved = document.getElementById('status-profile-saved');

  // Load existing profile from chrome.storage.local
  chrome.storage.local.get(['userConfig'], (res) => {
    const cfg = res.userConfig || {};
    if (profFullName && cfg.fullName) profFullName.value = cfg.fullName;
    if (profPhone && cfg.phoneNumber) profPhone.value = cfg.phoneNumber;
    if (profEmail && cfg.email) profEmail.value = cfg.email;
    if (profLocation && cfg.location) profLocation.value = cfg.location;
    if (profSalary && cfg.expectedSalary) profSalary.value = cfg.expectedSalary;
    if (profExperience && cfg.experienceYears) profExperience.value = cfg.experienceYears;
    if (profEducation && cfg.educationLevel) profEducation.value = cfg.educationLevel;
    if (profSkills && cfg.skills) profSkills.value = cfg.skills;
    if (profGeminiKey && cfg.geminiApiKey) profGeminiKey.value = cfg.geminiApiKey;
    if (profGeminiModel && cfg.geminiModel) profGeminiModel.value = cfg.geminiModel;

    const dotCv = document.getElementById('dot-cv-status');
    const textCv = document.getElementById('text-cv-status');
    if (cfg.fullName) {
      if (dotCv) dotCv.style.background = '#22c55e';
      if (textCv) textCv.innerText = `Profil: ${cfg.fullName.split(' ')[0]}`;
    }
  });

  // Save profile changes
  if (btnSaveProfile) {
    btnSaveProfile.addEventListener('click', () => {
      const newConfig = {
        fullName: profFullName.value.trim(),
        phoneNumber: profPhone.value.trim(),
        email: profEmail.value.trim(),
        location: profLocation.value.trim(),
        expectedSalary: profSalary.value ? parseInt(profSalary.value, 10) : 5000000,
        experienceYears: profExperience.value ? parseInt(profExperience.value, 10) : 1,
        educationLevel: profEducation.value,
        skills: profSkills.value.trim(),
        geminiApiKey: profGeminiKey.value.trim(),
        geminiModel: profGeminiModel.value,
        updatedAt: new Date().toISOString()
      };

      chrome.storage.local.set({ userConfig: newConfig }, () => {
        showToast('Profil & Kunci AI berhasil disimpan!', 'success');
        if (statusSaved) {
          statusSaved.style.display = 'inline';
          setTimeout(() => { statusSaved.style.display = 'none'; }, 2500);
        }

        const dotCv = document.getElementById('dot-cv-status');
        const textCv = document.getElementById('text-cv-status');
        if (newConfig.fullName) {
          if (dotCv) dotCv.style.background = '#22c55e';
          if (textCv) textCv.innerText = `Profil: ${newConfig.fullName.split(' ')[0]}`;
        }
      });
    });
  }

  // ==========================================
  // 4. History Management & Client-Side CSV Export
  // ==========================================
  const badgeTotalApplied = document.getElementById('badge-total-applied');
  const historyContainer = document.getElementById('history-container');
  const btnExportCsv = document.getElementById('btn-export-csv');
  const btnClearHistory = document.getElementById('btn-clear-history');

  function renderHistory() {
    chrome.storage.local.get(['applied_jobs'], (res) => {
      const jobs = res.applied_jobs || [];
      if (badgeTotalApplied) badgeTotalApplied.innerText = `${jobs.length} Lamaran`;

      if (!historyContainer) return;
      if (jobs.length === 0) {
        historyContainer.innerHTML = '<p style="color: #64748b; text-align: center; padding: 16px 0;">Belum ada lamaran tercatat.</p>';
        return;
      }

      historyContainer.innerHTML = '';
      jobs.slice(0, 30).forEach(j => {
        const item = document.createElement('div');
        item.className = 'history-item';
        const qCount = (j.questionsAndAnswers && j.questionsAndAnswers.length) || 0;
        item.innerHTML = `
          <div class="history-header">
            <span class="history-title" title="${j.title || ''}">${j.title || 'Lowongan Kerja'}</span>
            <span class="badge-platform">${j.platform || 'portal'}</span>
          </div>
          <div class="history-company">${j.company || 'Perusahaan'} • <span style="color: #64748b;">${j.date || ''}</span></div>
          <div style="margin-top: 4px; display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #22c55e; font-size: 10px;">${j.status || 'Berhasil'}</span>
            ${qCount > 0 ? `<span style="font-size: 9px; color: #ea580c; background: rgba(234, 88, 12, 0.1); padding: 1px 5px; border-radius: 4px;">Q&A (${qCount})</span>` : ''}
          </div>
        `;
        historyContainer.appendChild(item);
      });
    });
  }

  // Initial history render
  renderHistory();

  // Export to CSV
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      chrome.storage.local.get(['applied_jobs'], (res) => {
        const jobs = res.applied_jobs || [];
        if (jobs.length === 0) {
          showToast('Belum ada riwayat lamaran untuk diunduh.', 'error');
          return;
        }

        const headers = ['Perusahaan', 'Posisi', 'Platform', 'Tanggal', 'Status', 'Tautan Lowongan', 'Jumlah Pertanyaan'];
        const csvRows = [headers.join(',')];

        jobs.forEach(j => {
          const qCount = (j.questionsAndAnswers && j.questionsAndAnswers.length) || 0;
          const row = [
            `"${(j.company || '').replace(/"/g, '""')}"`,
            `"${(j.title || '').replace(/"/g, '""')}"`,
            `"${(j.platform || '').replace(/"/g, '""')}"`,
            `"${(j.date || '').replace(/"/g, '""')}"`,
            `"${(j.status || '').replace(/"/g, '""')}"`,
            `"${(j.jobUrl || '').replace(/"/g, '""')}"`,
            qCount
          ];
          csvRows.push(row.join(','));
        });

        const csvString = '\uFEFF' + csvRows.join('\r\n'); // Add UTF-8 BOM
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        const now = new Date().toISOString().slice(0, 10);
        a.download = `riwayat_lamaran_lemparjaring_${now}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('Laporan CSV berhasil diunduh!', 'success');
      });
    });
  }

  // Clear History
  if (btnClearHistory) {
    btnClearHistory.addEventListener('click', () => {
      if (confirm('Kosongkan seluruh riwayat lamaran yang tersimpan di browser ini?')) {
        chrome.storage.local.set({ applied_jobs: [] }, () => {
          showToast('Riwayat lamaran berhasil dikosongkan.', 'info');
          renderHistory();
        });
      }
    });
  }

  // ==========================================
  // 5. Talent Scout X-Ray Sourcing
  // ==========================================
  const talentRole = document.getElementById('talent-role');
  const talentLocation = document.getElementById('talent-location');
  const btnOpenXray = document.getElementById('btn-open-xray-search');

  if (btnOpenXray) {
    btnOpenXray.addEventListener('click', () => {
      const role = (talentRole?.value || 'Frontend Developer').trim();
      const loc = (talentLocation?.value || 'Indonesia').trim();
      const dork = `site:id.linkedin.com/in/ "${role}" "${loc}" "open to work"`;
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(dork)}`;
      chrome.tabs.create({ url: searchUrl, active: true });
    });
  }
});
