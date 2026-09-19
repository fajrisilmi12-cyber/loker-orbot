'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Compass, ChevronRight, ChevronLeft, X, Check, HelpCircle, Layers, FileText, Filter, Sliders, ShieldCheck, Play } from 'lucide-react';

export interface TourStep {
  targetId: string;
  title: string;
  content: string;
  icon: React.ComponentType<{ className?: string }>;
  tab?: 'wizard' | 'logs' | 'questions' | 'history';
  wizardStep?: 1 | 2 | 3;
  preferredPlacement?: 'bottom' | 'top' | 'center';
}

export const ONBOARDING_STEPS: TourStep[] = [
  {
    targetId: 'tour-welcome',
    title: 'Panduan Awal CV Blaster',
    content: 'Platform automasi pengiriman lamaran kerja ke LinkedIn, Indeed, Glints, dan JobStreet secara terarah.',
    icon: Compass,
    preferredPlacement: 'center',
  },
  {
    targetId: 'tour-cv-upload',
    title: '1. Unggah Berkas CV',
    content: 'Pilih dokumen PDF atau DOCX. Sistem mengekstrak data profil untuk pengisian form dan lampiran berkas lamaran.',
    icon: FileText,
    tab: 'wizard',
    wizardStep: 1,
    preferredPlacement: 'bottom',
  },
  {
    targetId: 'tour-criteria-platform',
    title: '2. Kriteria & Pilihan Platform',
    content: 'Tentukan kata kunci posisi, wilayah, kuota harian, serta platform target yang ingin diaktifkan.',
    icon: Filter,
    tab: 'wizard',
    wizardStep: 2,
    preferredPlacement: 'bottom',
  },
  {
    targetId: 'tour-smart-features',
    title: '3. Konfigurasi Filter & Otomasi',
    content: 'Atur generator cover letter, jeda ketik natural, serta batas skor relevansi kualifikasi loker.',
    icon: Sliders,
    tab: 'wizard',
    wizardStep: 2,
    preferredPlacement: 'top',
  },
  {
    targetId: 'tour-cookie-sync',
    title: '4. Sinkronisasi Sesi Browser',
    content: 'Gunakan ekstensi CV Blaster Companion untuk menyinkronkan cookie sesi tanpa login ulang manual.',
    icon: ShieldCheck,
    tab: 'wizard',
    wizardStep: 2,
    preferredPlacement: 'top',
  },
  {
    targetId: 'tour-mode-toggle',
    title: '5. Pemilihan Mode Eksekusi',
    content: 'Gunakan Mode Simulasi untuk pengujian tanpa submit akhir, atau Mode LIVE untuk pengiriman resmi.',
    icon: Layers,
    preferredPlacement: 'bottom',
  },
  {
    targetId: 'tour-start-bot',
    title: '6. Mulai Otomasi',
    content: 'Jalankan bot dalam mode background (Headless) atau jendela terbuka (Headful), lalu pantau log secara langsung.',
    icon: Play,
    preferredPlacement: 'bottom',
  },
];

interface OnboardingTourProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  wizardStep: number;
  setWizardStep: (step: any) => void;
}

export function OnboardingTour({
  activeTab,
  setActiveTab,
  wizardStep,
  setWizardStep,
}: OnboardingTourProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    try {
      const hasSeen = localStorage.getItem('cv_blaster_onboarding_completed');
      if (!hasSeen) {
        const timer = setTimeout(() => {
          setIsOpen(true);
          setCurrentStep(0);
        }, 800);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);

  const stepData = ONBOARDING_STEPS[currentStep];
  const StepIcon = stepData?.icon || Compass;

  const updatePosition = useCallback(() => {
    if (!isOpen || !stepData) return;

    if (stepData.targetId === 'tour-welcome') {
      setTargetRect(null);
      setPopoverPos(null); // Centered
      return;
    }

    const el = document.getElementById(stepData.targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);

      // Calculate popover positioning avoiding covering the target
      const popoverWidth = 360;
      const popoverHeight = 220;
      const margin = 14;

      // Center horizontally relative to target
      let left = rect.left + rect.width / 2 - popoverWidth / 2;
      // Keep within screen horizontally
      left = Math.max(16, Math.min(window.innerWidth - popoverWidth - 16, left));

      // Decide whether to put below or above
      const spaceBelow = window.innerHeight - (rect.bottom + margin);
      const spaceAbove = rect.top - margin;

      let top = 0;
      if (stepData.preferredPlacement === 'top' && spaceAbove >= popoverHeight) {
        top = rect.top - popoverHeight - margin;
      } else if (spaceBelow >= popoverHeight) {
        top = rect.bottom + margin;
      } else if (spaceAbove >= popoverHeight) {
        top = rect.top - popoverHeight - margin;
      } else {
        // Fallback: place on right or left if available, or bottom
        top = Math.max(16, Math.min(window.innerHeight - popoverHeight - 16, rect.bottom + margin));
      }

      setPopoverPos({ top, left });
    } else {
      setTargetRect(null);
      setPopoverPos(null);
    }
  }, [isOpen, stepData]);

  useEffect(() => {
    if (!isOpen || !stepData) return;

    if (stepData.tab && activeTab !== stepData.tab) {
      setActiveTab(stepData.tab);
    }
    if (stepData.wizardStep && wizardStep !== stepData.wizardStep) {
      setWizardStep(stepData.wizardStep);
    }

    const timer = setTimeout(() => {
      updatePosition();
    }, 200);

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, currentStep, stepData, activeTab, wizardStep, setActiveTab, setWizardStep, updatePosition]);

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    try {
      localStorage.setItem('cv_blaster_onboarding_completed', 'true');
    } catch {}
    setIsOpen(false);
  };

  const handleManualStart = () => {
    setCurrentStep(0);
    setIsOpen(true);
  };

  const pad = 8;
  const rad = 14;

  return (
    <>
      <button
        type="button"
        onClick={handleManualStart}
        className="p-2 rounded-xl border border-subtle-theme card-theme text-muted-theme hover:text-orange-500 hover:border-orange-500/40 transition flex items-center gap-1.5 text-xs shadow-sm cursor-pointer"
        title="Panduan Penggunaan"
      >
        <HelpCircle className="w-4 h-4 text-orange-500" />
        <span className="hidden sm:inline font-medium">Panduan</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 pointer-events-auto">
          {/* SVG CUTOUT SPOTLIGHT (100% crystal clear target cutout, no blur on target) */}
          <svg
            className="fixed inset-0 w-full h-full pointer-events-auto z-40 transition-all duration-200"
            onClick={handleComplete}
          >
            <defs>
              <mask id="spotlight-cutout">
                {/* Everything white = dimmed overlay */}
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {/* Black cutout = 100% clear and transparent over the target element */}
                {targetRect && (
                  <rect
                    x={targetRect.left - pad}
                    y={targetRect.top - pad}
                    width={targetRect.width + pad * 2}
                    height={targetRect.height + pad * 2}
                    rx={rad}
                    ry={rad}
                    fill="black"
                  />
                )}
              </mask>
            </defs>

            {/* Dark semi-transparent backdrop applying the cutout mask (NO backdrop-blur to keep target sharp) */}
            <rect
              x="0"
              y="0"
              width="100%" height="100%"
              fill="rgba(0, 0, 0, 0.65)"
              mask="url(#spotlight-cutout)"
            />
          </svg>

          {/* Crisp highlight border outline directly around the cutout */}
          {targetRect && (
            <div
              className="fixed pointer-events-none z-40 rounded-2xl border-2 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.35)] transition-all duration-200"
              style={{
                top: targetRect.top - pad,
                left: targetRect.left - pad,
                width: targetRect.width + pad * 2,
                height: targetRect.height + pad * 2,
              }}
            />
          )}

          {/* Popover Card Positioned OUTSIDE the target element */}
          <div
            className={`fixed z-50 w-full max-w-[360px] p-5 rounded-2xl bg-slate-900 border border-slate-700 text-slate-100 shadow-2xl transition-all duration-200 ${
              !popoverPos ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' : ''
            }`}
            style={popoverPos ? { top: `${popoverPos.top}px`, left: `${popoverPos.left}px` } : {}}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
                  <StepIcon className="w-4 h-4" />
                </div>
                <span className="text-xs font-medium text-slate-400">
                  Langkah {currentStep + 1} dari {ONBOARDING_STEPS.length}
                </span>
              </div>
              <button
                type="button"
                onClick={handleComplete}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h3 className="text-sm font-semibold text-white mb-1.5 leading-snug">
              {stepData.title}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-5">
              {stepData.content}
            </p>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <div className="flex items-center gap-1">
                {ONBOARDING_STEPS.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentStep(idx)}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === currentStep
                        ? 'w-5 bg-orange-500'
                        : 'w-1.5 bg-slate-700 hover:bg-slate-500'
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                {currentStep > 0 && (
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-300 transition flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Sebelumnya</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleNext}
                  className="px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium transition flex items-center gap-1 shadow-sm cursor-pointer"
                >
                  {currentStep === ONBOARDING_STEPS.length - 1 ? (
                    <>
                      <span>Selesai</span>
                      <Check className="w-3.5 h-3.5 text-white" />
                    </>
                  ) : (
                    <>
                      <span>Lanjut</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
