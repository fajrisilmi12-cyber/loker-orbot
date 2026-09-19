'use client';

import React from 'react';
import { ExternalLink, Building2, MapPin, Calendar, Briefcase, FileText, Banknote, Check, X, Clock, Minus } from 'lucide-react';

export interface QuestionAnswerItem {
  question: string;
  answer: string;
  type?: string;
}

export interface AppliedJobCard {
  company: string;
  title: string;
  platform: string;
  jobUrl: string;
  date: string;
  status: string;
  salary?: string;
  location?: string;
  workType?: string;
  questionsAndAnswers?: QuestionAnswerItem[];
}

const PLATFORM_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  glints:     { bg: 'bg-green-500/15 border-green-500/30', text: 'text-green-400', dot: 'bg-green-400' },
  linkedin:   { bg: 'bg-blue-500/15 border-blue-500/30',   text: 'text-blue-400',  dot: 'bg-blue-400' },
  indeed:     { bg: 'bg-purple-500/15 border-purple-500/30', text: 'text-purple-400', dot: 'bg-purple-400' },
  jobstreet:  { bg: 'bg-orange-500/15 border-orange-500/30', text: 'text-orange-400', dot: 'bg-orange-400' },
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string; icon: any }> = {
  applied:    { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Dilamar',  icon: Check },
  success:    { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Dilamar',  icon: Check },
  failed:     { bg: 'bg-rose-500/15',    text: 'text-rose-400',    label: 'Gagal',    icon: X },
  skipped:    { bg: 'bg-slate-500/15',   text: 'text-slate-400',   label: 'Dilewati', icon: Minus },
  pending:    { bg: 'bg-amber-500/15',   text: 'text-amber-400',   label: 'Pending',  icon: Clock },
};

export function formatJobDate(dateStr: string): string {
  if (!dateStr) return '–';
  const clean = dateStr.trim();

  // Handle format "19/9/2026, 17.12.36" or "19/09/2026 17:12:36" or "19/9/2026"
  const dmyMatch = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2})[.:](\d{1,2}))?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const hour = dmyMatch[4] ? `${dmyMatch[4].padStart(2, '0')}:${(dmyMatch[5] || '00').padStart(2, '0')}` : '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const monthName = months[month] || `Bulan ${month + 1}`;
    return hour ? `${day} ${monthName} ${year}, ${hour}` : `${day} ${monthName} ${year}`;
  }

  try {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    }
  } catch {}

  return clean;
}

interface JobCardProps {
  job: AppliedJobCard;
  index: number;
  onViewDetail?: (job: AppliedJobCard) => void;
}

export default function JobCard({ job, index, onViewDetail }: JobCardProps) {
  const platformKey = job.platform?.toLowerCase() || 'glints';
  const platformStyle = PLATFORM_STYLES[platformKey] || PLATFORM_STYLES.glints;
  const statusKey = job.status?.toLowerCase() || 'applied';
  const statusStyle = STATUS_STYLES[statusKey] || STATUS_STYLES.applied;

  const qaCount = job.questionsAndAnswers?.length || 0;

  return (
    <div
      className="group relative flex flex-col gap-3 p-4 rounded-2xl border border-subtle-theme card-theme hover:border-orange-500/40 transition-all duration-200 hover:shadow-lg hover:shadow-orange-500/5 hover:-translate-y-0.5"
      style={{ animationDelay: `${(index % 12) * 30}ms` }}
    >
      {/* Header: Company + Platform Badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="shrink-0 w-8 h-8 rounded-xl bg-slate-500/10 border border-subtle-theme flex items-center justify-center">
            <Building2 className="w-4 h-4 text-muted-theme" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-theme truncate leading-tight">{job.company || 'Perusahaan'}</p>
          </div>
        </div>

        {/* Platform Badge */}
        <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${platformStyle.bg} ${platformStyle.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${platformStyle.dot}`} />
          {job.platform || 'Platform'}
        </span>
      </div>

      {/* Job Title */}
      <h3 className="text-sm font-semibold text-main-theme leading-snug line-clamp-2 group-hover:text-orange-400 transition-colors">
        {job.title || 'Posisi Tidak Diketahui'}
      </h3>

      {/* Meta Info (Location, Salary, Date) */}
      <div className="flex flex-col gap-1 text-[11px] text-muted-theme">
        {job.location && (
          <div className="flex items-center gap-1.5 truncate">
            <MapPin className="w-3 h-3 shrink-0 text-orange-400/80" />
            <span className="truncate">{job.location}</span>
          </div>
        )}
        {job.salary && job.salary !== 'Gaji Tidak Ditampilkan' && (
          <div className="flex items-center gap-1.5 truncate text-emerald-400">
            <Banknote className="w-3 h-3 shrink-0" />
            <span className="truncate">{job.salary}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3 h-3 shrink-0" />
          <span>{formatJobDate(job.date)}</span>
        </div>
      </div>

      {/* Footer: Status + Q&A Button + Link */}
      <div className="flex items-center justify-between pt-2 border-t border-subtle-theme mt-auto gap-1.5">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold ${statusStyle.bg} ${statusStyle.text}`}>
          {React.createElement(statusStyle.icon, { className: 'w-2.5 h-2.5 shrink-0' })}
          <span>{statusStyle.label}</span>
        </span>

        <div className="flex items-center gap-1.5 ml-auto">
          {onViewDetail && (
            <button
              onClick={() => onViewDetail(job)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 text-[10px] font-medium transition"
              title="Lihat riwayat pertanyaan & jawaban bot"
            >
              <FileText className="w-3 h-3" />
              <span>{qaCount > 0 ? `${qaCount} Q&A` : 'Detail'}</span>
            </button>
          )}

          {job.jobUrl ? (
            <a
              href={job.jobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg card-subtle-theme border border-subtle-theme text-[10px] font-medium text-muted-theme hover:text-orange-400 hover:border-orange-500/30 transition-colors"
            >
              <span>Buka</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          ) : (
            <span className="text-[10px] text-muted-theme/40">No URL</span>
          )}
        </div>
      </div>
    </div>
  );
}
