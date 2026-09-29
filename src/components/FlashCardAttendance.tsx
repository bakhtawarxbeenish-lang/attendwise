import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import {
  Check,
  X,
  Clock,
  RotateCcw,
  Calendar,
  Users,
  Sparkles,
  Edit3,
  Trash2,
  CloudUpload,
  Keyboard,
  Plus,
  Layers,
} from 'lucide-react';
import {
  AppSettings,
  AttendanceSession,
  AttendanceStatus,
  CustomField,
  Student,
} from '../types';
import { translations } from '../i18n';
import { triggerFeedback } from '../utils/soundHaptics';
import { ConfirmDialog } from './ConfirmDialog';

interface FlashCardAttendanceProps {
  classes: string[];
  students: Student[];
  customFields: CustomField[];
  sessions: AttendanceSession[];
  settings: AppSettings;
  initialClass?: string;
  onSaveSession: (session: AttendanceSession, syncImmediately: boolean) => void;
  onNavigateToStudents: () => void;
  onOpenClassManager: () => void;
  onQuickAddClass: (className: string) => void;
}

export const FlashCardAttendance: React.FC<FlashCardAttendanceProps> = ({
  classes,
  students,
  customFields,
  sessions,
  settings,
  initialClass,
  onSaveSession,
  onNavigateToStudents,
  onOpenClassManager,
  onQuickAddClass,
}) => {
  const t = translations[settings.language];
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const [selectedClass, setSelectedClass] = useState<string>(
    initialClass || settings.defaultClass || classes[0] || ''
  );
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [stage, setStage] = useState<'setup' | 'deck' | 'summary'>('setup');
  const [quickClassName, setQuickClassName] = useState('');

  // Keep selectedClass valid when classes are added, edited, or deleted
  useEffect(() => {
    if (initialClass && classes.includes(initialClass)) {
      setSelectedClass(initialClass);
    } else if (!selectedClass || !classes.includes(selectedClass)) {
      setSelectedClass(classes[0] || '');
    }
  }, [classes, initialClass, selectedClass]);

  // Active deck state
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});
  const [historyStack, setHistoryStack] = useState<
    Array<{ studentId: string; status: AttendanceStatus }>
  >([]);
  const [exitDirection, setExitDirection] = useState<'P' | 'A' | 'L' | null>(null);
  const [showEditAllInSummary, setShowEditAllInSummary] = useState(false);

  // Duplicate session overwrite confirmation
  const [duplicateConfirmOpen, setDuplicateConfirmOpen] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);

  const classStudents = useMemo(() => {
    if (!selectedClass) return [];
    return students
      .filter((s) => s.className === selectedClass)
      .sort((a, b) => a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true }));
  }, [students, selectedClass]);

  const existingSession = useMemo(() => {
    if (!selectedClass) return undefined;
    return sessions.find(
      (s) => s.className === selectedClass && s.date === selectedDate
    );
  }, [sessions, selectedClass, selectedDate]);

  // Compute historical attendance rate per student for context on the flashcard
  const studentAttendanceRates = useMemo(() => {
    const map: Record<string, { pct: number; total: number }> = {};
    const classSessions = sessions.filter((s) => s.className === selectedClass);
    for (const st of classStudents) {
      let p = 0;
      let total = 0;
      for (const sess of classSessions) {
        const val = sess.records[st.id];
        if (val === 'P' || val === 'A' || val === 'L') {
          total++;
          if (val === 'P') p++;
        }
      }
      map[st.id] = {
        pct: total > 0 ? Math.round((p / total) * 100) : 100,
        total,
      };
    }
    return map;
  }, [sessions, selectedClass, classStudents]);

  const beginDeck = (prefillRecords?: Record<string, AttendanceStatus>) => {
    setRecords(prefillRecords ? { ...prefillRecords } : {});
    setHistoryStack([]);
    setCurrentIndex(0);
    setExitDirection(null);
    setShowEditAllInSummary(false);
    setStage('deck');
  };

  const handleStartClick = () => {
    if (classStudents.length === 0) return;
    if (existingSession) {
      setDuplicateConfirmOpen(true);
    } else {
      beginDeck();
    }
  };

  const markCurrentStudent = (status: AttendanceStatus) => {
    if (stage !== 'deck' || currentIndex >= classStudents.length) return;
    const student = classStudents[currentIndex];
    if (!student) return;

    setExitDirection(status);
    triggerFeedback(status, {
      sound: settings.soundEffects,
      haptics: settings.hapticFeedback,
    });

    const nextRecords = { ...records, [student.id]: status };
    setRecords(nextRecords);
    setHistoryStack((prev) => [...prev, { studentId: student.id, status }]);

    setTimeout(() => {
      if (currentIndex + 1 >= classStudents.length) {
        triggerFeedback('complete', {
          sound: settings.soundEffects,
          haptics: settings.hapticFeedback,
        });
        setStage('summary');
      } else {
        setCurrentIndex((prev) => prev + 1);
      }
      setExitDirection(null);
    }, 120);
  };

  const handleUndo = () => {
    if (stage !== 'deck' || historyStack.length === 0 || currentIndex === 0) return;
    triggerFeedback('undo', {
      sound: settings.soundEffects,
      haptics: settings.hapticFeedback,
    });
    const prevStack = [...historyStack];
    const last = prevStack.pop();
    setHistoryStack(prevStack);
    if (last) {
      setRecords((prev) => {
        const copy = { ...prev };
        delete copy[last.studentId];
        return copy;
      });
    }
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  // Keyboard shortcuts on desktop: P, A, L, Backspace
  useEffect(() => {
    if (stage !== 'deck') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === 'p' || e.key === 'ArrowRight') {
        e.preventDefault();
        markCurrentStudent('P');
      } else if (key === 'a' || e.key === 'ArrowLeft') {
        e.preventDefault();
        markCurrentStudent('A');
      } else if (key === 'l' || e.key === 'ArrowUp') {
        e.preventDefault();
        markCurrentStudent('L');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Live counts
  const counts = useMemo(() => {
    let P = 0;
    let A = 0;
    let L = 0;
    Object.values(records).forEach((st) => {
      if (st === 'P') P++;
      else if (st === 'A') A++;
      else if (st === 'L') L++;
    });
    return { P, A, L };
  }, [records]);

  const handleSaveSession = () => {
    const session: AttendanceSession = {
      id: existingSession?.id || `sess_${selectedClass}_${selectedDate}_${Date.now()}`,
      className: selectedClass,
      date: selectedDate,
      records,
      syncStatus: 'pending',
      updatedAt: new Date().toISOString(),
    };
    onSaveSession(session, true);
    setStage('setup');
  };

  // Motion values for the top draggable card
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-220, 0, 220], [-12, 0, 12]);
  const presentOpacity = useTransform(x, [25, 120], [0, 1]);
  const absentOpacity = useTransform(x, [-25, -120], [0, 1]);
  const leaveOpacity = useTransform(y, [-25, -110], [0, 1]);

  useEffect(() => {
    x.set(0);
    y.set(0);
  }, [currentIndex, stage, x, y]);

  const sortedFields = useMemo(
    () => [...customFields].sort((a, b) => a.order - b.order),
    [customFields]
  );

  // ---------------- STAGE 1: SETUP ----------------
  if (stage === 'setup') {
    return (
      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-5">
        <div className="soft-card rounded-3xl p-4 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <p className="text-xs font-medium accent-text">
                Fast Flash-Card Attendance
              </p>
              <h1 className="text-xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                {t.takeAttendance}
              </h1>
            </div>
            <button
              type="button"
              onClick={onOpenClassManager}
              className="inline-flex items-center gap-1.5 rounded-2xl accent-soft-bg accent-text px-3.5 py-2 min-h-[40px] text-xs font-semibold hover:opacity-90 transition cursor-pointer"
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span>Classes ({classes.length})</span>
            </button>
          </div>

          {classes.length === 0 ? (
            <div className="rounded-2xl accent-softer-bg border accent-border p-5 space-y-4">
              <div>
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Welcome! Start by creating your first Class
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Your workspace is fresh and clean. Enter a class or section name below to begin.
                </p>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const trimmed = quickClassName.trim();
                  if (!trimmed) return;
                  onQuickAddClass(trimmed);
                  setSelectedClass(trimmed);
                  setQuickClassName('');
                }}
                className="flex flex-col sm:flex-row gap-2.5"
              >
                <input
                  type="text"
                  value={quickClassName}
                  onChange={(e) => setQuickClassName(e.target.value)}
                  placeholder="e.g. Class 10 - Section A, BSCS Semester 4"
                  className="flex-1 h-11 px-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                />
                <button
                  type="submit"
                  className="h-11 px-5 rounded-xl accent-bg text-white text-xs font-semibold inline-flex items-center justify-center gap-2 shadow-xs hover:opacity-95 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Class</span>
                </button>
              </form>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {t.selectClass}
                    </label>
                    <button
                      type="button"
                      onClick={onOpenClassManager}
                      className="text-[11px] font-semibold accent-text hover:underline cursor-pointer"
                    >
                      + Add / Edit / Delete
                    </button>
                  </div>
                  <div className="relative">
                    <Users className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={selectedClass}
                      onChange={(e) => setSelectedClass(e.target.value)}
                      className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none"
                    >
                      {classes.map((cls) => (
                        <option key={cls} value={cls}>
                          {cls}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                    {t.selectDate}
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-sm font-mono font-medium text-slate-800 dark:text-slate-100 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 text-sm text-slate-500 dark:text-slate-400">
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                    {classStudents.length}
                  </span>
                  <span>students in {selectedClass}</span>
                  {existingSession && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-amber-600 dark:text-amber-400 font-medium text-xs">
                        Recorded for {selectedDate}
                      </span>
                    </>
                  )}
                </div>

                {classStudents.length > 0 ? (
                  <button
                    onClick={handleStartClick}
                    className="w-full sm:w-auto px-6 h-11 rounded-xl accent-bg text-white font-semibold text-sm shadow-xs hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer whitespace-nowrap"
                  >
                    {existingSession ? 'Update / Retake Attendance' : t.startAttendance}
                  </button>
                ) : (
                  <button
                    onClick={onNavigateToStudents}
                    className="w-full sm:w-auto px-5 h-11 rounded-xl accent-bg text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 shadow-xs hover:opacity-95 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Students to {selectedClass}</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Soft Gesture & Keyboard Guide */}
        <div className="soft-card rounded-2xl p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 mb-3">
            <Keyboard className="w-4 h-4 accent-text" />
            <span>Quick Swipe Gestures & Keyboard Shortcuts</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
              <span className="font-medium text-emerald-700 dark:text-emerald-300">
                Swipe Right → Present
              </span>
              <kbd className="font-mono px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700">
                P
              </kbd>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-rose-500/8 border border-rose-500/15">
              <span className="font-medium text-rose-700 dark:text-rose-300">
                Swipe Left ← Absent
              </span>
              <kbd className="font-mono px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700">
                A
              </kbd>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/8 border border-amber-500/15">
              <span className="font-medium text-amber-700 dark:text-amber-300">
                Swipe Up ↑ Leave
              </span>
              <kbd className="font-mono px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700">
                L
              </kbd>
            </div>
          </div>
        </div>

        <ConfirmDialog
          open={duplicateConfirmOpen}
          title="Attendance Already Recorded"
          description={`An attendance session for ${selectedClass} on ${selectedDate} already exists. Would you like to update it?`}
          confirmLabel="Update Session"
          cancelLabel="Cancel"
          onConfirm={() => {
            setDuplicateConfirmOpen(false);
            beginDeck(existingSession?.records);
          }}
          onCancel={() => setDuplicateConfirmOpen(false)}
        />
      </div>
    );
  }

  // ---------------- STAGE 2: FLASH-CARD DECK ----------------
  if (stage === 'deck') {
    const currentStudent = classStudents[currentIndex];
    const nextStudent = classStudents[currentIndex + 1];
    const progressPct = Math.round((currentIndex / classStudents.length) * 100);
    const stStats = currentStudent
      ? studentAttendanceRates[currentStudent.id] || { pct: 100, total: 0 }
      : { pct: 100, total: 0 };

    return (
      <div className="max-w-lg mx-auto space-y-4 select-none">
        {/* Top Progress Header */}
        <div className="soft-card rounded-2xl p-4">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                {selectedClass}
              </span>
              <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                {selectedDate}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                {currentIndex + 1} / {classStudents.length}
              </span>
              <button
                onClick={handleUndo}
                disabled={currentIndex === 0}
                title="Undo last card (Backspace)"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t.undo}</span>
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full accent-bg transition-all duration-150"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Live P / A / L Counter Row */}
          <div className="mt-3 flex items-center justify-between text-xs font-mono tabular-nums pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              Present: {counts.P}
            </span>
            <span className="text-rose-500 dark:text-rose-400 font-semibold">
              Absent: {counts.A}
            </span>
            <span className="text-amber-600 dark:text-amber-400 font-semibold">
              Leave: {counts.L}
            </span>
          </div>
        </div>

        {/* Card Stack Area */}
        <div className="relative h-[310px] sm:h-[380px] w-full flex items-center justify-center">
          {/* Background Next Card Preview */}
          {nextStudent && (
            <div
              key={`preview_${nextStudent.id}`}
              className="absolute inset-x-4 top-4 bottom-0 rounded-3xl bg-white/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/60 scale-[0.96] translate-y-2.5 pointer-events-none flex flex-col justify-between p-6 opacity-60"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400">
                  {nextStudent.rollNo}
                </span>
              </div>
              <div className="my-auto text-center">
                <p className="text-lg font-bold text-slate-400 dark:text-slate-500">
                  {nextStudent.name}
                </p>
              </div>
              <div />
            </div>
          )}

          {/* Active Draggable Flash Card */}
          <AnimatePresence mode="popLayout">
            {currentStudent && (
              <motion.div
                key={currentStudent.id}
                style={{ x, y, rotate }}
                drag
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                dragElastic={0.85}
                onDragEnd={(_, info) => {
                  if (info.offset.x > 85) {
                    markCurrentStudent('P');
                  } else if (info.offset.x < -85) {
                    markCurrentStudent('A');
                  } else if (info.offset.y < -75) {
                    markCurrentStudent('L');
                  }
                }}
                initial={{ scale: 0.96, opacity: 0, y: 12 }}
                animate={
                  exitDirection === 'P'
                    ? { x: 340, rotate: 14, opacity: 0 }
                    : exitDirection === 'A'
                    ? { x: -340, rotate: -14, opacity: 0 }
                    : exitDirection === 'L'
                    ? { y: -300, opacity: 0 }
                    : { scale: 1, opacity: 1, x: 0, y: 0, rotate: 0 }
                }
                transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                className="relative w-full h-full rounded-3xl soft-card p-6 sm:p-8 flex flex-col justify-between cursor-grab active:cursor-grabbing overflow-hidden"
              >
                {/* Dynamic Soft Color-Tinted Drag Overlays */}
                <motion.div
                  style={{ opacity: presentOpacity }}
                  className="absolute inset-0 bg-emerald-500/12 pointer-events-none flex items-start justify-start p-6"
                >
                  <span className="px-3.5 py-1 rounded-xl border border-emerald-500/50 bg-white/80 dark:bg-slate-900/80 text-emerald-700 dark:text-emerald-300 font-bold text-xs tracking-wide">
                    PRESENT (P)
                  </span>
                </motion.div>

                <motion.div
                  style={{ opacity: absentOpacity }}
                  className="absolute inset-0 bg-rose-500/12 pointer-events-none flex items-start justify-end p-6"
                >
                  <span className="px-3.5 py-1 rounded-xl border border-rose-500/50 bg-white/80 dark:bg-slate-900/80 text-rose-700 dark:text-rose-300 font-bold text-xs tracking-wide">
                    ABSENT (A)
                  </span>
                </motion.div>

                <motion.div
                  style={{ opacity: leaveOpacity }}
                  className="absolute inset-0 bg-amber-500/12 pointer-events-none flex items-start justify-center p-6"
                >
                  <span className="px-3.5 py-1 rounded-xl border border-amber-500/50 bg-white/80 dark:bg-slate-900/80 text-amber-700 dark:text-amber-300 font-bold text-xs tracking-wide">
                    LEAVE (L)
                  </span>
                </motion.div>

                {/* Card Top Metadata Row */}
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-mono font-semibold text-sm text-slate-700 dark:text-slate-200">
                    Roll #{currentStudent.rollNo}
                  </span>
                  <div className="flex items-center gap-1.5 font-mono tabular-nums">
                    <span>Overall: {stStats.pct}%</span>
                    {stStats.total > 0 && stStats.pct < settings.lowAttendanceThreshold && (
                      <span className="text-rose-500 dark:text-rose-400 font-semibold">
                        · Low
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Center Student Identity */}
                <div className="my-auto text-center space-y-2.5 py-3">
                  <div className="w-16 h-16 rounded-2xl accent-soft-bg accent-text font-display font-bold text-2xl flex items-center justify-center mx-auto">
                    {currentStudent.name
                      .split(' ')
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                    {currentStudent.name}
                  </h2>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {currentStudent.className}
                  </p>
                </div>

                {/* Custom Fields Grid */}
                {sortedFields.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3.5 border-t border-slate-100 dark:border-slate-800/80">
                    {sortedFields.map((field) => {
                      const val = currentStudent.customFields[field.id];
                      return (
                        <div
                          key={field.id}
                          className="rounded-xl bg-slate-50/80 dark:bg-slate-800/50 px-3 py-1.5 text-left"
                        >
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                            {field.name}
                          </p>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate mt-0.5">
                            {val || '—'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Soft Low-Contrast Tactile Bottom Action Controls */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-1">
          <button
            onClick={() => markCurrentStudent('A')}
            className="h-12 sm:h-13 rounded-2xl bg-rose-500/12 hover:bg-rose-500/20 border border-rose-500/25 active:scale-95 text-rose-700 dark:text-rose-300 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer"
          >
            <X className="w-4 h-4 shrink-0" />
            <span className="truncate">{t.absent} (A)</span>
          </button>

          <button
            onClick={() => markCurrentStudent('L')}
            className="h-12 sm:h-13 rounded-2xl bg-amber-500/12 hover:bg-amber-500/20 border border-amber-500/25 active:scale-95 text-amber-700 dark:text-amber-300 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer"
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span className="truncate">{t.leave} (L)</span>
          </button>

          <button
            onClick={() => markCurrentStudent('P')}
            className="h-12 sm:h-13 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 active:scale-95 text-emerald-700 dark:text-emerald-300 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4 shrink-0" />
            <span className="truncate">{t.present} (P)</span>
          </button>
        </div>
      </div>
    );
  }

  // ---------------- STAGE 3: SUMMARY SCREEN ----------------
  const totalCount = classStudents.length;
  const attendancePct =
    totalCount > 0 ? Math.round((counts.P / totalCount) * 100) : 0;

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const pStroke = totalCount > 0 ? (counts.P / totalCount) * circumference : 0;
  const aStroke = totalCount > 0 ? (counts.A / totalCount) * circumference : 0;
  const lStroke = totalCount > 0 ? (counts.L / totalCount) * circumference : 0;

  const absentOrLeaveStudents = classStudents.filter(
    (s) => records[s.id] === 'A' || records[s.id] === 'L'
  );

  const displayedStudents = showEditAllInSummary
    ? classStudents
    : absentOrLeaveStudents;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="soft-card rounded-3xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center sm:text-left">
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
              {selectedClass} · {selectedDate}
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">
              {t.summaryTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Review today’s attendance before saving to your sheet.
            </p>
          </div>

          {/* Animated SVG Donut Chart */}
          <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                className="text-slate-100 dark:text-slate-800"
              />
              <motion.circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke="#34d399"
                strokeWidth="12"
                strokeDasharray={`${pStroke} ${circumference}`}
                strokeDashoffset={0}
                initial={{ strokeDasharray: `0 ${circumference}` }}
                animate={{ strokeDasharray: `${pStroke} ${circumference}` }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
              />
              <motion.circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke="#fb7185"
                strokeWidth="12"
                strokeDasharray={`${aStroke} ${circumference}`}
                strokeDashoffset={-pStroke}
                initial={{ strokeDasharray: `0 ${circumference}` }}
                animate={{ strokeDasharray: `${aStroke} ${circumference}` }}
                transition={{ duration: 0.45, delay: 0.05, ease: 'easeOut' }}
              />
              <motion.circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke="#fbbf24"
                strokeWidth="12"
                strokeDasharray={`${lStroke} ${circumference}`}
                strokeDashoffset={-(pStroke + aStroke)}
                initial={{ strokeDasharray: `0 ${circumference}` }}
                animate={{ strokeDasharray: `${lStroke} ${circumference}` }}
                transition={{ duration: 0.45, delay: 0.1, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-mono font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                {attendancePct}%
              </span>
              <span className="text-[10px] text-slate-400">
                Present
              </span>
            </div>
          </div>
        </div>

        {/* Summary Metric Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80 text-center">
          <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50">
            <p className="text-[11px] text-slate-400">Total</p>
            <p className="text-lg font-mono font-bold text-slate-800 dark:text-slate-100 mt-0.5 tabular-nums">
              {totalCount}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-500/10">
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300">Present</p>
            <p className="text-lg font-mono font-bold text-emerald-700 dark:text-emerald-300 mt-0.5 tabular-nums">
              {counts.P}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-rose-500/10">
            <p className="text-[11px] text-rose-700 dark:text-rose-300">Absent</p>
            <p className="text-lg font-mono font-bold text-rose-700 dark:text-rose-300 mt-0.5 tabular-nums">
              {counts.A}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-amber-500/10">
            <p className="text-[11px] text-amber-700 dark:text-amber-300">Leave</p>
            <p className="text-lg font-mono font-bold text-amber-700 dark:text-amber-300 mt-0.5 tabular-nums">
              {counts.L}
            </p>
          </div>
        </div>

        {/* Absent / Leave or Full Editable Student List */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {showEditAllInSummary
                ? `All Students (${classStudents.length})`
                : `Absent & Leave Students (${absentOrLeaveStudents.length})`}
            </h3>
            <button
              onClick={() => setShowEditAllInSummary((prev) => !prev)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold accent-text hover:underline cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>
                {showEditAllInSummary
                  ? 'Show Only Absent / Leave'
                  : t.editStudentStatus}
              </span>
            </button>
          </div>

          {displayedStudents.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">
              100% Attendance! Every student is marked Present today.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/70 max-h-64 overflow-y-auto pr-1">
              {displayedStudents.map((st) => {
                const status = records[st.id] || 'P';
                return (
                  <div
                    key={st.id}
                    className="py-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                        {st.name}
                      </p>
                      <p className="text-xs font-mono text-slate-400">
                        {st.rollNo}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800 p-1 rounded-xl shrink-0">
                      {(['P', 'A', 'L'] as AttendanceStatus[]).map((code) => {
                        const active = status === code;
                        return (
                          <button
                            key={code}
                            onClick={() =>
                              setRecords((prev) => ({ ...prev, [st.id]: code }))
                            }
                            className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                              active
                                ? code === 'P'
                                  ? 'bg-emerald-500 text-white'
                                  : code === 'A'
                                  ? 'bg-rose-500 text-white'
                                  : 'bg-amber-500 text-white'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                            }`}
                          >
                            {code}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Summary Actions */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <button
            onClick={() => setDiscardConfirmOpen(true)}
            className="px-4 h-11 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 inline-flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>{t.discard}</span>
          </button>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <button
              onClick={() => setShowEditAllInSummary((v) => !v)}
              className="px-4 h-11 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{t.editStudentStatus}</span>
            </button>

            <button
              onClick={handleSaveSession}
              className="px-6 h-11 rounded-xl accent-bg text-white font-semibold text-xs shadow-xs hover:opacity-95 active:scale-[0.99] inline-flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <CloudUpload className="w-4 h-4" />
              <span>{t.saveAndSync}</span>
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={discardConfirmOpen}
        title="Discard Unsaved Session?"
        description={`Are you sure you want to discard the attendance session for ${selectedClass} (${selectedDate})?`}
        confirmLabel="Discard Session"
        variant="danger"
        onConfirm={() => {
          setDiscardConfirmOpen(false);
          setStage('setup');
        }}
        onCancel={() => setDiscardConfirmOpen(false)}
      />
    </div>
  );
};
