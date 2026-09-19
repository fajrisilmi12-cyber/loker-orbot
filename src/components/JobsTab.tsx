'use client';

import React, { useState, useMemo } from 'react';
import { Search, Download, RefreshCw, Briefcase, LayoutGrid, List, ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import JobCard, { AppliedJobCard } from './JobCard';

const PLATFORMS = ['Semua', 'Glints', 'LinkedIn', 'Indeed', 'Jobstreet'];
const STATUSES = ['Semua', 'Dilamar', 'Gagal', 'Dilewati'];
const PAGE_SIZE = 12;

const STATUS_FILTER_MAP: Record<string, string[]> = {
  'Dilamar': ['applied', 'success'],
  'Gagal':   ['failed'],
  'Dilewati': ['skipped'],
};

interface JobsTabProps {
  jobs: AppliedJobCard[];
  onRefresh: () => void;
  onExportCsv: () => void;
}

export default function JobsTab({ jobs, onRefresh, onExportCsv }: JobsTabProps) {
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState('Semua');
  const [statusFilter, setStatusFilter] = useState('Semua');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);

  // Stats summary
  const stats = useMemo(() => {
    const total = jobs.length;
    const byPlatform: Record<string, number> = {};
    let today = 0;
    const todayStr = new Date().toISOString().slice(0, 10);

    jobs.forEach(j => {
      const p = j.platform?.toLowerCase() || 'lain';
      byPlatform[p] = (byPlatform[p] || 0) + 1;
      if (j.date?.startsWith(todayStr)) today++;
    });

    return { total, byPlatform, today };
  }, [jobs]);

  // Filtered + searched jobs
  const filtered = useMemo(() => {
    let result = [...jobs];

    if (platformFilter !== 'Semua') {
      result = result.filter(j => j.platform?.toLowerCase() === platformFilter.toLowerCase());
    }

    if (statusFilter !== 'Semua') {
      const keys = STATUS_FILTER_MAP[statusFilter] || [];
      result = result.filter(j => keys.includes(j.status?.toLowerCase() || ''));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(j =>
        j.title?.toLowerCase().includes(q) ||
        j.company?.toLowerCase().includes(q)
      );
    }

    // Sort newest first
    result.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return result;
  }, [jobs, platformFilter, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleFilterChange = (setter: (v: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-6 p-6 min-h-0">
      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Lamaran', value: stats.total, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
          { label: 'Hari Ini', value: stats.today, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { label: 'LinkedIn', value: stats.byPlatform['linkedin'] || 0, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
          { label: 'Glints', value: stats.byPlatform['glints'] || 0, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
        ].map(stat => (
          <div key={stat.label} className={`p-3.5 rounded-2xl border ${stat.bg} flex flex-col gap-1`}>
            <span className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</span>
            <span className="text-[11px] text-muted-theme font-medium">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-theme" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Cari posisi atau perusahaan..."
            className="w-full pl-8 pr-4 py-2 text-xs rounded-xl input-theme border border-subtle-theme focus:outline-none focus:border-orange-500 transition"
          />
        </div>

        {/* Platform Filter */}
        <div className="flex items-center gap-1 p-1 rounded-xl card-subtle-theme border border-subtle-theme">
          {PLATFORMS.map(p => (
            <button
              key={p}
              onClick={() => handleFilterChange(setPlatformFilter, p)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition whitespace-nowrap ${
                platformFilter === p
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-muted-theme hover:text-main-theme'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1 p-1 rounded-xl card-subtle-theme border border-subtle-theme">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => handleFilterChange(setStatusFilter, s)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition whitespace-nowrap ${
                statusFilter === s
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-muted-theme hover:text-main-theme'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-2 rounded-xl card-subtle-theme border border-subtle-theme text-muted-theme hover:text-main-theme transition"
            title="Ganti tampilan"
          >
            {viewMode === 'grid' ? <List className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onRefresh}
            className="p-2 rounded-xl card-subtle-theme border border-subtle-theme text-muted-theme hover:text-main-theme transition"
            title="Refresh data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium card-subtle-theme border border-subtle-theme text-muted-theme hover:text-main-theme transition"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Result Count */}
      <div className="flex items-center justify-between text-[11px] text-muted-theme">
        <span>
          Menampilkan <b className="text-main-theme">{filtered.length}</b> dari <b className="text-main-theme">{jobs.length}</b> lamaran
          {search && <> · hasil pencarian &ldquo;<b className="text-orange-400">{search}</b>&rdquo;</>}
        </span>
        {totalPages > 1 && (
          <span>Halaman {page} / {totalPages}</span>
        )}
      </div>

      {/* Cards Grid or List */}
      {paginated.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="p-5 rounded-2xl bg-slate-500/10 border border-subtle-theme">
            <Briefcase className="w-10 h-10 text-muted-theme/40" />
          </div>
          <div>
            <p className="text-sm font-semibold text-main-theme">Belum ada lamaran ditemukan</p>
            <p className="text-xs text-muted-theme mt-1">
              {jobs.length === 0
                ? 'Jalankan bot untuk mulai melamar lowongan secara otomatis.'
                : 'Coba ubah filter atau kata kunci pencarian.'}
            </p>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginated.map((job, idx) => (
            <JobCard key={`${job.company}-${job.title}-${job.date}-${idx}`} job={job} index={idx} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {paginated.map((job, idx) => (
            <div
              key={`${job.company}-${job.title}-${job.date}-${idx}`}
              className="flex items-center gap-4 p-3.5 rounded-xl border border-subtle-theme card-theme hover:border-orange-500/30 transition group"
            >
              <div className="w-8 h-8 shrink-0 rounded-xl bg-slate-500/10 border border-subtle-theme flex items-center justify-center">
                <Briefcase className="w-3.5 h-3.5 text-muted-theme" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-main-theme truncate group-hover:text-orange-400 transition-colors">{job.title}</p>
                <p className="text-[11px] text-muted-theme truncate">{job.company}</p>
              </div>
              <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 font-medium border border-orange-500/20">
                {job.platform}
              </span>
              <span className="shrink-0 text-[10px] text-muted-theme">{job.date?.slice(0, 10)}</span>
              {job.jobUrl && (
                <a
                  href={job.jobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-[10px] text-muted-theme hover:text-orange-400 transition"
                >
                  ↗
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-xl card-subtle-theme border border-subtle-theme text-muted-theme hover:text-main-theme disabled:opacity-40 transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) pageNum = i + 1;
            else if (page <= 3) pageNum = i + 1;
            else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
            else pageNum = page - 2 + i;
            return (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className={`w-8 h-8 rounded-xl text-xs font-semibold transition ${
                  page === pageNum
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'card-subtle-theme border border-subtle-theme text-muted-theme hover:text-main-theme'
                }`}
              >
                {pageNum}
              </button>
            );
          })}

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-xl card-subtle-theme border border-subtle-theme text-muted-theme hover:text-main-theme disabled:opacity-40 transition"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
