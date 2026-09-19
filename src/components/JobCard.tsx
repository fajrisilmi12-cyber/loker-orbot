'use client';

import React from 'react';
import { ExternalLink, Building2, MapPin, Calendar, Briefcase } from 'lucide-react';

export interface AppliedJobCard {
  company: string;
  title: string;
  platform: string;
  jobUrl: string;
  date: string;
  status: string;
}

const PLATFORM_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  glints:     { bg: 'bg-green-500/15 border-green-500/30', text: 'text-green-400', dot: 'bg-green-400' },
  linkedin:   { bg: 'bg-blue-500/15 border-blue-500/30',   text: 'text-blue-400',  dot: 'bg-blue-400' },
  indeed:     { bg: 'bg-purple-500/15 border-purple-500/30', text: 'text-purple-400', dot: 'bg-purple-400' },
  jobstreet:  { bg: 'bg-orange-500/15 border-orange-500/30', text: 'text-orange-400', dot: 'bg-orange-400' },
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  applied:    { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: '✓ Dilamar' },
  success:    { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: '✓ Dilamar' },
  failed:     { bg: 'bg-rose-500/15',    text: 'text-rose-400',    label: '✗ Gagal' },
  skipped:    { bg: 'bg-slate-500/15',   text: 'text-slate-400',   label: '— Dilewati' },
  pending:    { bg: 'bg-amber-500/15',   text: 'text-amber-400',   label: '⏳ Pending' },
};

function formatDate(dateStr: string): string {
  if (!dateStr) return '–';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

interface JobCardProps {
  job: AppliedJobCard;
  index: number;
}

export default function JobCard({ job, index }: JobCardProps) {
  const platformKey = job.platform?.toLowerCase() || 'glints';
  const platformStyle = PLATFORM_STYLES[platformKey] || PLATFORM_STYLES.glints;
  const statusKey = job.status?.toLowerCase() || 'applied';
  const statusStyle = STATUS_STYLES[statusKey] || STATUS_STYLES.applied;

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
            <p className="text-[11px] text-muted-theme truncate leading-tight">{job.company || 'Perusahaan'}</p>
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

      {/* Meta Info */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-theme">
          <Calendar className="w-3 h-3 shrink-0" />
          <span>{formatDate(job.date)}</span>
        </div>
      </div>

      {/* Footer: Status + Link */}
      <div className="flex items-center justify-between pt-2 border-t border-subtle-theme mt-auto">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold ${statusStyle.bg} ${statusStyle.text}`}>
          {statusStyle.label}
        </span>

        {job.jobUrl ? (
          <a
            href={job.jobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-theme hover:text-orange-400 transition-colors"
          >
            Buka ↗
          </a>
        ) : (
          <span className="text-[10px] text-muted-theme/40">Tidak ada link</span>
        )}
      </div>
    </div>
  );
}
