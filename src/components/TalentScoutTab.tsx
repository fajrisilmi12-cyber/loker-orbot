'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  ExternalLink, 
  MessageSquare, 
  Download, 
  Sparkles, 
  MapPin, 
  Mail, 
  UserCheck, 
  RefreshCw, 
  Plus, 
  ClipboardPaste, 
  Bookmark, 
  Bot, 
  Loader2, 
  Copy, 
  Check, 
  X, 
  Users, 
  Briefcase, 
  FileText, 
  SlidersHorizontal,
  ArrowRight,
  ShieldCheck,
  Clock,
  Building2,
  CheckCircle2,
  AlertCircle,
  PhoneCall,
  Activity,
  Calendar,
  Layers,
  GraduationCap
} from 'lucide-react';
import { toast } from 'sonner';
import { TalentCandidate, TalentFilter, ParsedTalentPrompt } from '@/lib/talentTypes';
import { generateWhatsAppUrl, getBookmarkletCode, getLinkedInProfileBookmarkletCode, generateOsintContactUrl } from '@/lib/xraySearch';

const SAMPLE_PROMPT_PRESETS = [
  'Staff gudang atau admin inventori di Surabaya dan Sidoarjo, bisa Excel, siap kerja segera, ada nomor WA',
  'Accounting staff junior di Jakarta atau Tangerang, menguasai Accurate dan pajak, siap kerja cepat',
  'Teknisi mesin atau operator produksi di Gresik, lulusan SMK/D3, siap kerja sistem shift',
  'Customer Service atau Admin Online di Surabaya, terbiasa marketplace dan WhatsApp, ramah',
  'Frontend Developer React atau Next.js di Bandung atau Remote, portofolio aktif, siap bergabung segera'
];

export default function TalentScoutTab() {
  const [talents, setTalents] = useState<TalentCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTable, setSearchTable] = useState('');

  // Mode Selection: 'ai_prompt' (Default & modern) or 'manual'
  const [searchMode, setSearchMode] = useState<'ai_prompt' | 'manual'>('ai_prompt');
  const [aiPrompt, setAiPrompt] = useState('Staff gudang atau admin logistik di Surabaya dan Sidoarjo, bisa Excel/WMS, siap kerja segera, utamakan ada nomor WhatsApp');
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [parsedPrompt, setParsedPrompt] = useState<ParsedTalentPrompt | null>(null);

  // Provider matrix: 'linkedin' | 'glints' | 'webResumePdf'
  const [selectedProvider, setSelectedProvider] = useState<'linkedin' | 'glints' | 'webResumePdf'>('linkedin');
  const [googleUrls, setGoogleUrls] = useState<Record<string, string>>({});

  // Manual Filter Fallback
  const [filter, setFilter] = useState<TalentFilter>({
    targetRole: 'Staff Gudang / Admin',
    locations: ['Surabaya', 'Gresik', 'Sidoarjo'],
    onlyOpenToWork: true,
    platforms: ['linkedin'],
    searchMethod: 'xray',
    requireContact: true
  });

  const [xrayQuery, setXrayQuery] = useState('');
  const [googleSearchUrl, setGoogleSearchUrl] = useState('');

  // Modal & Drawer states
  const [isScrapingBrowser, setIsScrapingBrowser] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [showBookmarkletModal, setShowBookmarkletModal] = useState(false);
  const [showProfileBookmarkletModal, setShowProfileBookmarkletModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<TalentCandidate | null>(null);

  // Form input manual
  const [newCandidate, setNewCandidate] = useState<Partial<TalentCandidate>>({
    name: '',
    headline: '',
    profileUrl: '',
    location: 'Surabaya, Jawa Timur',
    phone: '',
    email: '',
    isOpenToWork: true,
    platform: 'linkedin'
  });

  const fetchTalents = async () => {
    try {
      const res = await fetch('/api/talents');
      const data = await res.json();
      if (data.success) {
        setTalents(data.talents || []);
      }
    } catch {
      toast.error('Gagal memuat daftar talenta');
    }
  };

  // Generate AI Prompt-based queries
  const handleGenerateAiPrompt = async (promptToUse?: string) => {
    const text = (promptToUse || aiPrompt).trim();
    if (!text) {
      toast.error('Ketik instruksi kebutuhan talenta terlebih dahulu');
      return;
    }
    setIsGeneratingPrompt(true);
    try {
      const res = await fetch('/api/talents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'parse_prompt', prompt: text })
      });
      const data = await res.json();
      if (data.success && data.parsedPrompt) {
        setParsedPrompt(data.parsedPrompt);
        setGoogleUrls(data.googleUrls || {});
        setXrayQuery(data.parsedPrompt.queries[selectedProvider] || data.parsedPrompt.queries.linkedin);
        setGoogleSearchUrl(data.googleUrls?.[selectedProvider] || data.googleUrls?.linkedin || '');

        // Sync to manual filter state as well
        setFilter({
          ...filter,
          targetRole: data.parsedPrompt.primaryRole,
          locations: data.parsedPrompt.locations,
          onlyOpenToWork: true,
          requireContact: data.parsedPrompt.requireContact
        });

        toast.success('Parameter & query multi-mesin pencari berhasil disusun AI');
      } else {
        toast.error('Gagal menyusun parameter dengan AI');
      }
    } catch {
      toast.error('Terjadi kesalahan saat menyusun prompt');
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  // Generate standard manual query
  const generateManualXray = async () => {
    try {
      const res = await fetch('/api/talents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_xray', filter })
      });
      const data = await res.json();
      if (data.success) {
        setXrayQuery(data.query);
        setGoogleSearchUrl(data.googleUrl);
      }
    } catch {}
  };

  // Initial load
  useEffect(() => {
    fetchTalents();
    handleGenerateAiPrompt();
  }, []);

  // Provider change handler
  const handleSelectProvider = (prov: 'linkedin' | 'glints' | 'webResumePdf') => {
    setSelectedProvider(prov);
    if (parsedPrompt && googleUrls[prov]) {
      setXrayQuery(parsedPrompt.queries[prov]);
      setGoogleSearchUrl(googleUrls[prov]);
    }
  };

  // KPI Stats
  const stats = useMemo(() => {
    const total = talents.length;
    const openToWork = talents.filter(t => t.isOpenToWork).length;
    const withContact = talents.filter(t => t.phone || t.email || (t.contact && /^\+?[0-9]{8,15}$/.test(t.contact))).length;
    const highIntegrity = talents.filter(t => (t.aiHonestyScore ?? 0) >= 85).length;
    return { total, openToWork, withContact, highIntegrity };
  }, [talents]);

  // Filtered table
  const filteredTalents = useMemo(() => {
    if (!searchTable.trim()) return talents;
    const q = searchTable.toLowerCase();
    return talents.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.headline.toLowerCase().includes(q) ||
      (t.location && t.location.toLowerCase().includes(q))
    );
  }, [talents, searchTable]);

  const handleExportCsv = () => {
    window.open('/api/talents?format=csv', '_blank');
    toast.success('Mengunduh data talenta ke format CSV');
  };

  const handleAutoScrapeBrowser = async () => {
    if (!googleSearchUrl) {
      toast.error('Susun query penelusuran terlebih dahulu');
      return;
    }
    setIsScrapingBrowser(true);
    toast.info('Membuka browser untuk mengekstrak hasil penelusuran...');
    try {
      const res = await fetch('/api/talents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'auto_scrape_browser',
          googleUrl: googleSearchUrl,
          filter
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || `${data.count} talenta berhasil diambil`);
        fetchTalents();
      } else {
        toast.error(data.error || 'Gagal mengekstrak data');
      }
    } catch (err: any) {
      toast.error('Terjadi kesalahan: ' + err.message);
    } finally {
      setIsScrapingBrowser(false);
    }
  };

  const handleParsePastedText = async () => {
    if (!pastedText.trim()) {
      toast.error('Tempel teks hasil pencarian terlebih dahulu');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/talents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'parse_paste',
          rawText: pastedText,
          defaultLocation: parsedPrompt?.locations[0] || filter.locations[0] || 'Indonesia'
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${data.count} profil kandidat berhasil diekstrak dan disimpan`);
        setShowPasteModal(false);
        setPastedText('');
        fetchTalents();
      } else {
        toast.error(data.error || 'Gagal mengekstrak teks');
      }
    } catch (err: any) {
      toast.error('Terjadi kesalahan: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveManualCandidate = async () => {
    if (!newCandidate.name || !newCandidate.profileUrl) {
      toast.error('Nama dan tautan profil wajib diisi');
      return;
    }

    setIsLoading(true);
    try {
      const evalRes = await fetch('/api/talents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'evaluate',
          candidate: newCandidate,
          requirement: `Posisi: ${filter.targetRole} di ${filter.locations.join(', ')}`
        })
      });
      const evalData = await evalRes.json();

      const candidateToSave: TalentCandidate = {
        id: `cand_${Date.now()}`,
        name: newCandidate.name || '',
        headline: newCandidate.headline || '',
        platform: newCandidate.platform || 'linkedin',
        profileUrl: newCandidate.profileUrl || '',
        location: newCandidate.location || 'Indonesia',
        phone: newCandidate.phone || '',
        email: newCandidate.email || '',
        contact: newCandidate.phone || newCandidate.email || '',
        isOpenToWork: newCandidate.isOpenToWork ?? true,
        aiHonestyScore: evalData.evaluation?.honestyScore || 90,
        aiHonestyNotes: evalData.evaluation?.notes || ['Data kandidat tersimpan'],
        aiMatchScore: evalData.evaluation?.matchScore || 85,
        availabilityStatus: evalData.evaluation?.availability || 'immediate',
        experiences: [],
        skills: [],
        sourcedDate: new Date().toISOString().split('T')[0],
        status: 'new'
      };

      await fetch('/api/talents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_candidate', candidate: candidateToSave })
      });

      toast.success(`Kandidat ${candidateToSave.name} berhasil disimpan`);
      setShowAddModal(false);
      setNewCandidate({
        name: '',
        headline: '',
        profileUrl: '',
        location: 'Surabaya, Jawa Timur',
        phone: '',
        email: '',
        isOpenToWork: true,
        platform: 'linkedin'
      });
      fetchTalents();
    } catch (err: any) {
      toast.error('Gagal menyimpan kandidat: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyQuery = () => {
    if (!xrayQuery) return;
    navigator.clipboard.writeText(xrayQuery);
    toast.success('Query pencarian disalin ke clipboard');
  };

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8 min-h-0">
      {/* 1. KPI Metric Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Talenta Terdata', value: stats.total, color: 'text-main-theme' },
          { label: 'Status OpenToWork', value: stats.openToWork, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Kontak Terverifikasi', value: stats.withContact, color: 'text-sky-600 dark:text-sky-400' },
          { label: 'Integritas Tinggi (>85)', value: stats.highIntegrity, color: 'text-orange-600 dark:text-orange-400' },
        ].map((stat) => (
          <div key={stat.label} className="p-4 rounded-2xl card-theme border shadow-sm flex flex-col gap-1">
            <span className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</span>
            <span className="text-xs text-muted-theme">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* 2. Semantic AI Talent Prompter & Extraction Card */}
      <div className="card-theme border rounded-3xl p-6 shadow-sm space-y-5">
        {/* Header with Mode Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-subtle-theme pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-500" />
              <h2 className="text-base font-semibold text-main-theme">Mesin Pencari &amp; Evaluator Talenta</h2>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                AI Powered
              </span>
            </div>
            <p className="text-xs text-muted-theme mt-1">
              Ketik instruksi pencarian dalam bahasa sehari-hari. AI akan menyusun sinonim jabatan, memetakan keahlian, dan merakit query multi-platform.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="inline-flex p-1 rounded-xl card-subtle-theme border border-subtle-theme shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setSearchMode('ai_prompt')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                searchMode === 'ai_prompt'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-muted-theme hover:text-main-theme'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Prompt AI</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchMode('manual');
                generateManualXray();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                searchMode === 'manual'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-muted-theme hover:text-main-theme'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filter Manual</span>
            </button>
          </div>
        </div>

        {/* Mode 1: AI Semantic Prompt Input */}
        {searchMode === 'ai_prompt' ? (
          <div className="space-y-3">
            <div className="relative">
              <textarea
                rows={3}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Contoh: Butuh staf admin gudang atau logistik di Surabaya/Sidoarjo yang bisa Excel dan WMS, siap kerja segera, utamakan ada kontak WA..."
                className="w-full input-theme border rounded-2xl p-3.5 text-xs focus:outline-none focus:border-orange-500 transition leading-relaxed"
              />
              <button
                type="button"
                onClick={() => handleGenerateAiPrompt()}
                disabled={isGeneratingPrompt || !aiPrompt.trim()}
                className="absolute right-3 bottom-3 px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-medium text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm"
              >
                {isGeneratingPrompt ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menganalisis...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Susun Parameter</span>
                  </>
                )}
              </button>
            </div>

            {/* Presets / Inspiration chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-[11px] text-muted-theme">
              <span className="font-semibold shrink-0">Contoh Prompt:</span>
              {SAMPLE_PROMPT_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setAiPrompt(preset);
                    handleGenerateAiPrompt(preset);
                  }}
                  className="px-2.5 py-1 rounded-lg card-subtle-theme border border-subtle-theme hover:border-orange-500/50 hover:text-main-theme transition truncate max-w-xs shrink-0 text-left"
                  title={preset}
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Parsed Breakdown Card */}
            {parsedPrompt && (
              <div className="p-3.5 rounded-2xl card-subtle-theme border border-subtle-theme space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between text-xs font-semibold text-main-theme">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Parameter Ditemukan oleh AI</span>
                  </span>
                  <span className="text-[11px] font-normal text-muted-theme">
                    Role Utama: <strong className="text-main-theme">{parsedPrompt.primaryRole}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900/40 border border-subtle-theme space-y-1">
                    <span className="text-[10px] text-muted-theme uppercase font-semibold block">Sinonim Peran</span>
                    <div className="flex flex-wrap gap-1">
                      {parsedPrompt.roleSynonyms.map((s, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-slate-500/10 text-main-theme rounded text-[10px]">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900/40 border border-subtle-theme space-y-1">
                    <span className="text-[10px] text-muted-theme uppercase font-semibold block">Radius Wilayah</span>
                    <div className="flex flex-wrap gap-1">
                      {parsedPrompt.locations.map((loc, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-slate-500/10 text-main-theme rounded text-[10px]">
                          {loc}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900/40 border border-subtle-theme space-y-1">
                    <span className="text-[10px] text-muted-theme uppercase font-semibold block">Keahlian Kunci</span>
                    <div className="flex flex-wrap gap-1">
                      {parsedPrompt.skills.length > 0 ? (
                        parsedPrompt.skills.map((sk, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-slate-500/10 text-main-theme rounded text-[10px]">
                            {sk}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-muted-theme italic">Kualifikasi umum</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Mode 2: Manual Detail Filter */
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-main-theme mb-1.5">Posisi / Jabatan Target</label>
                <input
                  type="text"
                  value={filter.targetRole}
                  onChange={(e) => {
                    const next = { ...filter, targetRole: e.target.value };
                    setFilter(next);
                  }}
                  className="w-full input-theme border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-orange-500 transition"
                  placeholder="Contoh: Staff Gudang / Admin"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-main-theme mb-1.5">Domisili / Wilayah Target</label>
                <input
                  type="text"
                  value={filter.locations.join(', ')}
                  onChange={(e) => {
                    const next = { ...filter, locations: e.target.value.split(',').map(s => s.trim()).filter(Boolean) };
                    setFilter(next);
                  }}
                  className="w-full input-theme border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-orange-500 transition"
                  placeholder="Surabaya, Gresik, Sidoarjo"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-main-theme mb-1.5">Filter Tambahan</label>
                <div className="flex items-center gap-4 pt-2">
                  <label className="flex items-center gap-2 text-xs text-main-theme cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={filter.onlyOpenToWork}
                      onChange={(e) => setFilter({ ...filter, onlyOpenToWork: e.target.checked })}
                      className="w-4 h-4 rounded text-orange-500 focus:ring-0"
                    />
                    <span>Hanya #OpenToWork</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-main-theme cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={filter.requireContact}
                      onChange={(e) => setFilter({ ...filter, requireContact: e.target.checked })}
                      className="w-4 h-4 rounded text-orange-500 focus:ring-0"
                    />
                    <span>Prioritaskan Kontak (HP/WA)</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={generateManualXray}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-medium rounded-xl transition flex items-center gap-1.5 shadow-sm text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Perbarui Query Manual</span>
              </button>
            </div>
          </div>
        )}

        {/* Multi-Provider Tabs & Query Preview */}
        <div className="card-subtle-theme border border-subtle-theme rounded-2xl p-4 space-y-3">
          {/* Provider Selection Tabs */}
          <div className="flex items-center justify-between gap-2 border-b border-subtle-theme pb-2.5 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-muted-theme uppercase tracking-wider mr-1">
                Pilih Mesin Sumber:
              </span>
              <button
                type="button"
                onClick={() => handleSelectProvider('linkedin')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                  selectedProvider === 'linkedin'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'card-theme border border-subtle-theme text-muted-theme hover:text-main-theme'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>LinkedIn (#OpenToWork)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectProvider('glints')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                  selectedProvider === 'glints'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'card-theme border border-subtle-theme text-muted-theme hover:text-main-theme'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Glints Publik</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectProvider('webResumePdf')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                  selectedProvider === 'webResumePdf'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'card-theme border border-subtle-theme text-muted-theme hover:text-main-theme'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Resume PDF Publik</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyQuery}
              className="text-[11px] text-muted-theme hover:text-main-theme flex items-center gap-1 transition"
              title="Salin query aktif"
            >
              <Copy className="w-3 h-3" />
              <span>Salin Query</span>
            </button>
          </div>

          {/* Active Query Display */}
          <div className="font-mono text-xs text-main-theme bg-white dark:bg-zinc-900/60 p-2.5 rounded-xl border border-subtle-theme break-all select-all leading-relaxed">
            {xrayQuery || 'Menyusun parameter penelusuran...'}
          </div>

          {/* Extraction Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleAutoScrapeBrowser}
              disabled={isScrapingBrowser || !googleSearchUrl}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium rounded-xl transition flex items-center gap-2 shadow-sm"
              title="Membuka browser otomatis untuk mengambil hasil ke database"
            >
              {isScrapingBrowser ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Mengekstrak Data...</span>
                </>
              ) : (
                <>
                  <Bot className="w-3.5 h-3.5" />
                  <span>Panen via Browser</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowPasteModal(true)}
              className="px-4 py-2 card-subtle-theme border border-subtle-theme text-main-theme hover:bg-slate-500/10 text-xs font-medium rounded-xl transition flex items-center gap-2 shadow-sm"
              title="Tempel teks yang disalin dari hasil Google untuk diekstrak seketika"
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-muted-theme" />
              <span>Tempel Hasil Pencarian</span>
            </button>

            <button
              type="button"
              onClick={() => setShowBookmarkletModal(true)}
              className="px-4 py-2 card-subtle-theme border border-subtle-theme text-main-theme hover:bg-slate-500/10 text-xs font-medium rounded-xl transition flex items-center gap-2 shadow-sm"
              title="Kirim seluruh profil dari tab Google hanya dengan 1 kali klik bookmark"
            >
              <Bookmark className="w-3.5 h-3.5 text-muted-theme" />
              <span>Bookmarklet Google SERP</span>
            </button>

            <button
              type="button"
              onClick={() => setShowProfileBookmarkletModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-xl transition flex items-center gap-2 shadow-sm"
              title="Ekstrak profil LinkedIn lengkap (riwayat karir, open to work, dan skills) dalam 1 klik"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Bookmarklet Profil LinkedIn</span>
            </button>

            {googleSearchUrl && (
              <a
                href={googleSearchUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-auto px-3.5 py-2 card-subtle-theme border border-subtle-theme text-muted-theme hover:text-main-theme text-xs font-medium rounded-xl transition flex items-center gap-1.5"
                title="Buka penelusuran di Google"
              >
                <span>Buka di Google</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* 3. Candidate Table Card */}
      <div className="card-theme border rounded-3xl overflow-hidden shadow-sm">
        {/* Table Toolbar */}
        <div className="p-5 border-b border-subtle-theme flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-main-theme">Daftar Talenta Terverifikasi</h3>
              <span className="text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                {talents.length}
              </span>
            </div>
            <p className="text-xs text-muted-theme mt-0.5">
              Klik nama kandidat untuk melihat analisis Forensic &amp; Background Check mendalam (tenure, keahlian, riwayat kerja).
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search filter in table */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-theme absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTable}
                onChange={(e) => setSearchTable(e.target.value)}
                placeholder="Cari nama atau jabatan..."
                className="input-theme border rounded-xl pl-8 pr-3 py-1.5 text-xs w-44 sm:w-56 focus:outline-none focus:border-orange-500 transition"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-2 rounded-xl card-subtle-theme border border-subtle-theme text-main-theme hover:opacity-90 text-xs font-medium transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Manual</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={talents.length === 0}
              className="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-medium transition flex items-center gap-1.5 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        {filteredTalents.length === 0 ? (
          <div className="p-12 text-center text-muted-theme space-y-2">
            <Users className="w-8 h-8 mx-auto text-muted-theme/60 mb-2" />
            <p className="text-sm font-medium text-main-theme">Belum ada data kandidat</p>
            <p className="text-xs max-w-md mx-auto">
              Gunakan tombol &quot;Panen via Browser&quot; atau &quot;Tempel Hasil Pencarian&quot; di atas untuk menambahkan kandidat ke daftar ini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="card-subtle-theme border-b border-subtle-theme text-[11px] font-semibold text-muted-theme uppercase">
                <tr>
                  <th className="px-5 py-3">Kandidat</th>
                  <th className="px-4 py-3">Domisili</th>
                  <th className="px-4 py-3">Kontak Langsung</th>
                  <th className="px-4 py-3">Status Karir</th>
                  <th className="px-4 py-3">Integritas &amp; Tenure</th>
                  <th className="px-4 py-3 text-right">Aksi &amp; Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle-theme">
                {filteredTalents.map((cand) => {
                  const hasRealPhone = Boolean(cand.phone && /^\+?[0-9]{8,15}$/.test(cand.phone.replace(/[\s-]/g, '')));
                  const waUrl = hasRealPhone ? generateWhatsAppUrl(cand.phone!, cand.name, 'Perusahaan Kami', parsedPrompt?.primaryRole || filter.targetRole) : null;
                  const osintUrl = generateOsintContactUrl(cand.name, cand.location);

                  return (
                    <tr 
                      key={cand.id} 
                      className="hover:bg-slate-500/5 transition group cursor-pointer"
                      onClick={() => setSelectedCandidate(cand)}
                    >
                      {/* Name & Headline */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-main-theme text-xs shrink-0">
                            {cand.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-main-theme text-xs group-hover:text-orange-600 dark:group-hover:text-orange-400 transition flex items-center gap-1.5">
                              <span>{cand.name}</span>
                              {cand.experiences && cand.experiences.length > 0 && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-normal">
                                  {cand.experiences.length} Pengalaman
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-theme line-clamp-1 mt-0.5">{cand.headline}</div>
                          </div>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="px-4 py-3.5 text-muted-theme whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-muted-theme shrink-0" />
                          <span>{cand.location || 'Indonesia'}</span>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {waUrl ? (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium hover:bg-emerald-500/20 transition"
                            title={`Chat WhatsApp: ${cand.phone}`}
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>WhatsApp</span>
                          </a>
                        ) : cand.email ? (
                          <a
                            href={`mailto:${cand.email}`}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg card-subtle-theme border border-subtle-theme text-muted-theme hover:text-main-theme font-medium"
                          >
                            <Mail className="w-3 h-3" />
                            <span className="truncate max-w-[110px]">{cand.email}</span>
                          </a>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <a
                              href={cand.profileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded card-subtle-theme border border-subtle-theme text-[11px] text-muted-theme hover:text-main-theme transition"
                              title="Buka profil LinkedIn untuk mengirim pesan / connect"
                            >
                              <UserCheck className="w-2.5 h-2.5" />
                              <span>Via LinkedIn</span>
                            </a>
                            <a
                              href={osintUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded card-subtle-theme border border-subtle-theme text-muted-theme hover:text-orange-500 transition"
                              title="Cari jejak nomor kontak / CV PDF kandidat di Google"
                            >
                              <Search className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {cand.isOpenToWork ? (
                          <span className="text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>OpenToWork</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium card-subtle-theme text-muted-theme border border-subtle-theme px-2 py-0.5 rounded-full">
                            Aktif Bekerja
                          </span>
                        )}
                      </td>

                      {/* Honesty Score & Tenure */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  (cand.aiHonestyScore ?? 90) >= 85 ? 'bg-emerald-500' : 'bg-amber-500'
                                }`}
                                style={{ width: `${cand.aiHonestyScore ?? 90}%` }}
                              />
                            </div>
                            <span className="font-mono font-semibold text-main-theme text-xs">
                              {cand.aiHonestyScore ?? 90}%
                            </span>
                          </div>
                          {cand.tenureAnalysis && (
                            <span className="text-[10px] text-muted-theme block">
                              Stabilitas: <strong className="text-emerald-600 dark:text-emerald-400 capitalize">{cand.tenureAnalysis.stabilityRating}</strong>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedCandidate(cand)}
                            className="px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 text-xs font-medium transition flex items-center gap-1"
                            title="Buka Background Check & Riwayat Karir"
                          >
                            <ShieldCheck className="w-3 h-3" />
                            <span>Background Check</span>
                          </button>
                          <a
                            href={cand.profileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 inline-flex rounded-lg card-subtle-theme border border-subtle-theme text-muted-theme hover:text-main-theme transition"
                            title="Buka profil asli"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. MODAL / DRAWER: CANDIDATE FORENSIC & BACKGROUND CHECK */}
      {selectedCandidate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-theme border rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-subtle-theme pb-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-orange-600 text-white font-bold text-lg flex items-center justify-center shrink-0 shadow-sm">
                  {selectedCandidate.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-main-theme">{selectedCandidate.name}</h3>
                    {selectedCandidate.isOpenToWork && (
                      <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>#OpenToWork</span>
                      </span>
                    )}
                    {selectedCandidate.availabilityStatus === 'immediate' && (
                      <span className="text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
                        Siap Kerja Segera
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-theme mt-0.5">{selectedCandidate.headline}</p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-theme mt-1">
                    <MapPin className="w-3 h-3 text-muted-theme" />
                    <span>{selectedCandidate.location}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCandidate(null)}
                className="p-1 rounded-xl text-muted-theme hover:text-main-theme transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* AI Forensic & Background Check Summary */}
            <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  <span className="text-xs font-bold text-main-theme uppercase tracking-wider">
                    Hasil Background Check &amp; Integritas AI
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-theme">Skor Kredibilitas:</span>
                  <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    {selectedCandidate.aiHonestyScore ?? 90}/100
                  </span>
                </div>
              </div>

              {/* Tenure Stability Analysis */}
              {selectedCandidate.tenureAnalysis && (
                <div className="p-3 rounded-xl card-theme border border-subtle-theme space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-orange-500" />
                    <span className="font-semibold text-main-theme">Analisis Stabilitas Karir (Tenure):</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 uppercase">
                      {selectedCandidate.tenureAnalysis.stabilityRating}
                    </span>
                  </div>
                  <p className="text-muted-theme leading-relaxed text-[11px]">
                    {selectedCandidate.tenureAnalysis.notes}
                  </p>
                </div>
              )}

              {/* AI Forensic Bullet Notes */}
              {selectedCandidate.aiHonestyNotes && selectedCandidate.aiHonestyNotes.length > 0 && (
                <div className="space-y-1.5 text-xs">
                  <span className="text-[11px] font-semibold text-muted-theme uppercase block">Catatan Verifikasi:</span>
                  <ul className="space-y-1">
                    {selectedCandidate.aiHonestyNotes.map((note, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-muted-theme text-xs leading-relaxed">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Target Pekerjaan (#OpenToWork Preferences) */}
            {selectedCandidate.openToWorkDetails && (
              <div className="p-4 rounded-2xl card-subtle-theme border border-subtle-theme space-y-2.5">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-blue-500" />
                  <h4 className="text-xs font-bold text-main-theme uppercase tracking-wider">
                    Preferensi Pekerjaan (#OpenToWork)
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {selectedCandidate.openToWorkDetails.positions && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-theme font-semibold uppercase block">Posisi yang Diminati</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedCandidate.openToWorkDetails.positions.map((pos, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px]">
                            {pos}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedCandidate.openToWorkDetails.locations && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-theme font-semibold uppercase block">Wilayah yang Bersedia</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedCandidate.openToWorkDetails.locations.map((loc, i) => (
                          <span key={i} className="px-2 py-0.5 rounded card-theme border border-subtle-theme text-main-theme text-[11px]">
                            {loc}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedCandidate.openToWorkDetails.startDate && (
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-muted-theme font-semibold uppercase block">Kesiapan Mulai</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-xs">
                        {selectedCandidate.openToWorkDetails.startDate}
                      </span>
                    </div>
                  )}

                  {selectedCandidate.openToWorkDetails.workplaceTypes && (
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-muted-theme font-semibold uppercase block">Sistem Kerja</span>
                      <span className="text-muted-theme text-xs">
                        {selectedCandidate.openToWorkDetails.workplaceTypes.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Riwayat Pengalaman Kerja (Career Timeline) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-orange-500" />
                  <h4 className="text-xs font-bold text-main-theme uppercase tracking-wider">
                    Riwayat Pengalaman Kerja ({selectedCandidate.experiences?.length || 0})
                  </h4>
                </div>
                {selectedCandidate.experienceYears && (
                  <span className="text-xs text-muted-theme font-medium">
                    Total Masa Kerja: <strong>{selectedCandidate.experienceYears} Tahun</strong>
                  </span>
                )}
              </div>

              {selectedCandidate.experiences && selectedCandidate.experiences.length > 0 ? (
                <div className="relative pl-6 border-l-2 border-orange-500/30 space-y-4 text-xs">
                  {selectedCandidate.experiences.map((exp, idx) => (
                    <div key={idx} className="relative space-y-1">
                      {/* Timeline Dot */}
                      <span className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-orange-600 border-2 border-white dark:border-zinc-900 shadow-sm" />
                      
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <span className="font-bold text-main-theme text-xs">{exp.title}</span>
                        <span className="text-[11px] font-mono text-orange-600 dark:text-orange-400 font-medium">
                          {exp.duration}
                        </span>
                      </div>
                      
                      <div className="text-muted-theme text-xs font-medium">
                        {exp.company}
                      </div>

                      {exp.description && (
                        <p className="text-muted-theme text-[11px] whitespace-pre-line leading-relaxed pt-0.5">
                          {exp.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl card-subtle-theme border border-subtle-theme text-center text-xs text-muted-theme">
                  Riwayat detail belum terindeks. Gunakan tombol &quot;Bookmarklet Profil LinkedIn&quot; untuk mengekstrak seluruh riwayat kerja otomatis saat membuka tab LinkedIn kandidat.
                </div>
              )}
            </div>

            {/* Riwayat Pendidikan (Education) */}
            {selectedCandidate.education && selectedCandidate.education.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-emerald-500" />
                  <h4 className="text-xs font-bold text-main-theme uppercase tracking-wider">
                    Riwayat Pendidikan &amp; Pelatihan ({selectedCandidate.education.length})
                  </h4>
                </div>
                <div className="p-3.5 rounded-2xl card-subtle-theme border border-subtle-theme space-y-2.5 text-xs">
                  {selectedCandidate.education.map((edu, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <span className="font-bold text-main-theme text-xs">{edu.school}</span>
                        {edu.period && (
                          <span className="text-[11px] font-mono text-muted-theme">{edu.period}</span>
                        )}
                      </div>
                      {edu.fieldOfStudy && (
                        <div className="text-muted-theme text-xs font-medium">
                          Jurusan: <strong className="text-main-theme">{edu.fieldOfStudy}</strong>
                        </div>
                      )}
                      {edu.activities && (
                        <p className="text-[11px] text-muted-theme italic pt-0.5">
                          Aktivitas &amp; Organisasi: {edu.activities}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Keahlian Terverifikasi */}
            {selectedCandidate.skills && selectedCandidate.skills.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-orange-500" />
                  <h4 className="text-xs font-bold text-main-theme uppercase tracking-wider">
                    Keahlian &amp; Skills Terverifikasi ({selectedCandidate.skills.length})
                  </h4>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCandidate.skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg card-subtle-theme border border-subtle-theme text-main-theme text-xs font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Ringkasan Aktivitas & Karakter Profesional (LinkedIn Feed) */}
            {selectedCandidate.activityHighlights && selectedCandidate.activityHighlights.length > 0 && (
              <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-500" />
                    <span className="font-bold text-main-theme uppercase tracking-wider text-xs">
                      Aktivitas &amp; Minat Profesional (LinkedIn Feed)
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-theme">Repost &amp; Wawasan Industri</span>
                </div>
                <div className="space-y-2 pt-1">
                  {selectedCandidate.activityHighlights.map((act, i) => (
                    <div key={i} className="p-2.5 rounded-xl card-theme border border-subtle-theme text-[11px] leading-relaxed text-muted-theme flex items-start gap-2 shadow-2xs">
                      <span className="text-blue-500 font-bold mt-0.5 shrink-0">💬</span>
                      <span>{act}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Footer */}
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-subtle-theme flex-wrap">
              <div className="flex items-center gap-2">
                {selectedCandidate.phone && /^\+?[0-9]{8,15}$/.test(selectedCandidate.phone.replace(/[\s-]/g, '')) ? (
                  <a
                    href={generateWhatsAppUrl(selectedCandidate.phone, selectedCandidate.name, 'Perusahaan Kami', selectedCandidate.headline)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Hubungi via WhatsApp ({selectedCandidate.phone})</span>
                  </a>
                ) : (
                  <a
                    href={selectedCandidate.profileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Hubungi via LinkedIn / InMail</span>
                  </a>
                )}

                <a
                  href={generateOsintContactUrl(selectedCandidate.name, selectedCandidate.location)}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 card-subtle-theme border border-subtle-theme text-muted-theme hover:text-main-theme font-medium text-xs rounded-xl transition flex items-center gap-1.5"
                  title="Cari jejak nomor kontak atau resume PDF kandidat di Google"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Cari Jejak Kontak (OSINT)</span>
                </a>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCandidate(null)}
                className="px-4 py-2 rounded-xl card-subtle-theme border border-subtle-theme text-main-theme text-xs font-medium"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL: TEMPEL CEPAT HASIL PENCARIAN */}
      {showPasteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-theme border rounded-3xl w-full max-w-xl p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-subtle-theme pb-3">
              <div className="flex items-center gap-2">
                <ClipboardPaste className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-semibold text-main-theme">Tempel Hasil Pencarian</h3>
              </div>
              <button
                type="button"
                onClick={() => { setShowPasteModal(false); setPastedText(''); }}
                className="p-1 rounded-lg text-muted-theme hover:text-main-theme transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-muted-theme leading-relaxed">
                Salin teks hasil pencarian dari tab Google (Ctrl + A lalu Ctrl + C), kemudian tempelkan di kotak di bawah ini:
              </p>
              <textarea
                rows={8}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Tempel teks hasil pencarian di sini..."
                className="w-full input-theme border rounded-xl p-3 text-xs font-mono focus:outline-none focus:border-orange-500 leading-relaxed transition"
                autoFocus
              />
              <p className="text-[11px] text-muted-theme">
                Sistem akan mengekstrak nama, jabatan, domisili, tautan profil, dan nomor kontak yang tertera.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-subtle-theme">
              <button
                type="button"
                onClick={() => { setShowPasteModal(false); setPastedText(''); }}
                className="px-4 py-2 rounded-xl card-subtle-theme border border-subtle-theme text-muted-theme hover:text-main-theme text-xs font-medium"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleParsePastedText}
                disabled={isLoading || !pastedText.trim()}
                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-xs font-medium shadow-sm flex items-center gap-1.5 transition"
              >
                {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Ekstrak &amp; Simpan Data</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL: PANDUAN BOOKMARKLET GOOGLE SERP */}
      {showBookmarkletModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-theme border rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-subtle-theme pb-3">
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-semibold text-main-theme">Bookmarklet Penelusuran Google</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBookmarkletModal(false)}
                className="p-1 rounded-lg text-muted-theme hover:text-main-theme transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-muted-theme">
              <p className="leading-relaxed">
                Tarik tombol di bawah ini ke baris bookmark browser Anda. Saat membuka tab hasil pencarian Google, klik bookmark ini untuk mengirim seluruh daftar profil ke aplikasi ini secara instan.
              </p>

              <div className="p-4 card-subtle-theme border border-subtle-theme rounded-2xl text-center space-y-2">
                <span className="text-[11px] text-muted-theme block">Tarik tombol ini ke Bookmarks Bar:</span>
                <a
                  href={getBookmarkletCode()}
                  onClick={(e) => { e.preventDefault(); toast.info('Tarik tombol ini ke Bookmarks Bar browser Anda'); }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs rounded-xl shadow-sm cursor-grab active:cursor-grabbing transition"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Kirim ke lemparjaring</span>
                </a>
              </div>

              <div className="space-y-1 text-[11px]">
                <span className="font-semibold text-main-theme block">Langkah penggunaan:</span>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Buka pencarian di Google.</li>
                  <li>Klik tombol bookmark di browser.</li>
                  <li>Daftar kandidat akan otomatis terkirim dan tersimpan di tabel ini.</li>
                </ol>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-subtle-theme">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(getBookmarkletCode());
                  toast.success('Kode bookmarklet disalin ke clipboard');
                }}
                className="text-xs text-orange-600 dark:text-orange-400 hover:underline font-medium"
              >
                Salin Kode Script
              </button>
              <button
                type="button"
                onClick={() => setShowBookmarkletModal(false)}
                className="px-4 py-2 rounded-xl card-subtle-theme border border-subtle-theme text-main-theme text-xs font-medium"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: BOOKMARKLET PROFIL LINKEDIN 1-KLIK */}
      {showProfileBookmarkletModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-theme border rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-subtle-theme pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-semibold text-main-theme">Bookmarklet Profil LinkedIn (1-Klik)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowProfileBookmarkletModal(false)}
                className="p-1 rounded-lg text-muted-theme hover:text-main-theme transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-muted-theme">
              <p className="leading-relaxed">
                Fitur ini mengekstrak seluruh <strong>riwayat kerja lengkap</strong>, durasi kerja, status <strong>#OpenToWork</strong>, preferensi lokasi, dan keahlian langsung saat Anda membuka tab profil LinkedIn kandidat di browser Anda.
              </p>

              <div className="p-4 card-subtle-theme border border-subtle-theme rounded-2xl text-center space-y-2">
                <span className="text-[11px] text-muted-theme block">Tarik tombol ini ke Bookmarks Bar browser:</span>
                <a
                  href={getLinkedInProfileBookmarkletCode()}
                  onClick={(e) => { e.preventDefault(); toast.info('Tarik tombol ini ke Bookmarks Bar browser Anda'); }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl shadow-sm cursor-grab active:cursor-grabbing transition"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Ekstrak Profil ke lemparjaring</span>
                </a>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <span className="font-semibold text-main-theme block">Cara pakai di LinkedIn:</span>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Buka profil LinkedIn kandidat mana saja (contoh: tab Mochamad Dhiki Nofianto).</li>
                  <li>Klik tombol bookmark &quot;Ekstrak Profil ke lemparjaring&quot; di browser Anda.</li>
                  <li>Data riwayat kerja &amp; background check AI langsung tersimpan di tabel dashboard!</li>
                </ol>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-subtle-theme">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(getLinkedInProfileBookmarkletCode());
                  toast.success('Kode bookmarklet profil disalin ke clipboard');
                }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                Salin Kode Script
              </button>
              <button
                type="button"
                onClick={() => setShowProfileBookmarkletModal(false)}
                className="px-4 py-2 rounded-xl card-subtle-theme border border-subtle-theme text-main-theme text-xs font-medium"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL: TAMBAH KANDIDAT MANUAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-theme border rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-subtle-theme pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-semibold text-main-theme">Tambah Profil Kandidat</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-muted-theme hover:text-main-theme transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-medium text-main-theme mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={newCandidate.name}
                  onChange={(e) => setNewCandidate({ ...newCandidate, name: e.target.value })}
                  className="w-full input-theme border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-orange-500 transition"
                  placeholder="Nama kandidat"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-main-theme mb-1">Headline / Jabatan</label>
                <input
                  type="text"
                  value={newCandidate.headline}
                  onChange={(e) => setNewCandidate({ ...newCandidate, headline: e.target.value })}
                  className="w-full input-theme border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-orange-500 transition"
                  placeholder="Contoh: Staff Gudang | Administrasi Logistik"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-main-theme mb-1">Tautan Profil</label>
                <input
                  type="url"
                  required
                  value={newCandidate.profileUrl}
                  onChange={(e) => setNewCandidate({ ...newCandidate, profileUrl: e.target.value })}
                  className="w-full input-theme border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-orange-500 transition"
                  placeholder="https://id.linkedin.com/in/username"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-main-theme mb-1">Nomor WhatsApp / HP</label>
                  <input
                    type="text"
                    value={newCandidate.phone}
                    onChange={(e) => setNewCandidate({ ...newCandidate, phone: e.target.value })}
                    className="w-full input-theme border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-orange-500 transition"
                    placeholder="08123456789"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-main-theme mb-1">Domisili Kota</label>
                  <input
                    type="text"
                    value={newCandidate.location}
                    onChange={(e) => setNewCandidate({ ...newCandidate, location: e.target.value })}
                    className="w-full input-theme border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-orange-500 transition"
                    placeholder="Surabaya / Sidoarjo"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-subtle-theme">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl card-subtle-theme border border-subtle-theme text-muted-theme hover:text-main-theme text-xs font-medium"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveManualCandidate}
                disabled={isLoading}
                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium shadow-sm flex items-center gap-1.5 transition"
              >
                {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Simpan &amp; Analisis AI</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
