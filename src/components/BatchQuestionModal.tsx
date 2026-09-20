'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Play, Pause, RotateCcw, CheckCircle2, AlertCircle, X, HelpCircle, Lightbulb, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface BatchQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFinished?: () => void;
}

export default function BatchQuestionModal({ isOpen, onClose, onFinished }: BatchQuestionModalProps) {
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [lastQuestion, setLastQuestion] = useState('');
  const [lastAnswer, setLastAnswer] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isRunningRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      fetchProgress();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const fetchProgress = async () => {
    try {
      const res = await fetch('/api/questions/batch-answer');
      const data = await res.json();
      if (data.success) {
        setTotalQuestions(data.total || 0);
        setCurrentIndex(data.currentIndex || 0);
        setProgress(data.progress || 0);
        setIsDone(data.completed || false);
      }
    } catch (err) {
      console.error('Failed to fetch batch progress:', err);
    }
  };

  const startBatchProcess = async () => {
    if (isRunning) return;
    setIsRunning(true);
    isRunningRef.current = true;
    setErrorMsg(null);

    let nextIdx = currentIndex;

    try {
      while (isRunningRef.current) {
        const res = await fetch('/api/questions/batch-answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ startIndex: nextIdx, chunkSize: 20 }),
        });

        const data = await res.json();

        if (!data.success) {
          throw new Error(data.error || 'Terjadi kesalahan saat memproses pertanyaan');
        }

        setCurrentIndex(data.nextIndex);
        setProgress(data.progress);
        setTotalQuestions(data.total);

        if (data.currentSampleQuestion) {
          setLastQuestion(data.currentSampleQuestion);
          setLastAnswer(data.currentSampleAnswer || '');
        }

        if (data.completed || data.nextIndex >= data.total) {
          setIsDone(true);
          setIsRunning(false);
          isRunningRef.current = false;
          toast.success('Seluruh 1.000 pertanyaan berhasil dipersonalisasi dengan profil Anda!');
          if (onFinished) onFinished();
          break;
        }

        nextIdx = data.nextIndex;

        // Jeda kecil antar chunk agar browser lancar dan aman dari rate limit API
        await new Promise(r => setTimeout(r, 600));
      }
    } catch (err: any) {
      console.error('Batch Answer Error:', err);
      setErrorMsg(err.message || String(err));
      setIsRunning(false);
      isRunningRef.current = false;
      toast.error(`Gagal di pertanyaan ke-${nextIdx}: ${err.message || err}`);
    }
  };

  const pauseBatchProcess = () => {
    setIsRunning(false);
    isRunningRef.current = false;
    toast.info('Proses dihentikan sementara (Paused). Anda bisa melanjutkannya kapan saja.');
  };

  const resetProcess = () => {
    setIsRunning(false);
    isRunningRef.current = false;
    setCurrentIndex(0);
    setProgress(0);
    setIsDone(false);
    setErrorMsg(null);
    setLastQuestion('');
    setLastAnswer('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                Personalisasi 1.000 Pertanyaan Bank (Batch AI)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                AI akan membaca profil CV Anda dan menyiapkan jawaban presisi secara offline di memori bot.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (isRunning) pauseBatchProcess();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6">
          {/* Progress Bar & Percent */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-semibold">
              <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                Progres Pengisian
                {isRunning && (
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                )}
              </span>
              <span className="text-blue-600 dark:text-blue-400 font-mono text-base">
                {progress}% ({currentIndex} / {totalQuestions})
              </span>
            </div>
            <div className="w-full h-3.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          </div>

          {/* Real-time Processing Card */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span>PERTANYAAN TERAKHIR YANG DIJAWAB AI</span>
              <span className="text-[11px] font-mono">Chunk per 20 soal</span>
            </div>

            {lastQuestion ? (
              <div className="space-y-1.5 animate-in fade-in duration-150">
                <div className="flex items-start gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-200 line-clamp-2">
                  <HelpCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>&ldquo;{lastQuestion}&rdquo;</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                  <span className="line-clamp-2">Jawaban Anda: {lastAnswer || 'Dipilih opsi terdekat'}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                {isRunning
                  ? 'Sedang menghubungi AI untuk batch pertama...'
                  : 'Klik tombol "Mulai Proses AI" di bawah untuk memulai penjawab otomatis.'}
              </p>
            )}
          </div>

          {/* Info Card */}
          <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 text-xs text-blue-800 dark:text-blue-300 space-y-1 leading-relaxed">
            <p className="font-semibold flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-blue-500 shrink-0" />
              <span>Keuntungan Pre-Answer:</span>
            </p>
            <p>
              Begitu bank soal selesai dijawab, bot saat melamar di <strong>Glints, LinkedIn, JobStreet, & Indeed</strong> akan merespons dalam <strong>0 detik</strong> tanpa jeda panggilan AI live!
            </p>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <button
            onClick={resetProcess}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset dari Awal
          </button>

          <div className="flex items-center gap-3">
            {isRunning ? (
              <button
                onClick={pauseBatchProcess}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm shadow-md transition-all active:scale-95"
              >
                <Pause className="w-4 h-4" />
                Jeda (Pause)
              </button>
            ) : isDone ? (
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md transition-all active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                Selesai (Tutup)
              </button>
            ) : (
              <button
                onClick={startBatchProcess}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm shadow-md transition-all active:scale-95"
              >
                <Play className="w-4 h-4 fill-current" />
                {currentIndex > 0 ? 'Lanjutkan Proses AI' : 'Mulai Proses AI'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
