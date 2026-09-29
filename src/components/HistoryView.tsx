import React, { useMemo, useState } from 'react';
import {
  Search,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  ArrowLeft,
  Save,
  Calendar,
  FileDown,
  RotateCcw,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AppSettings,
  AttendanceSession,
  AttendanceStatus,
  Student,
} from '../types';
import { translations } from '../i18n';
import { ConfirmDialog } from './ConfirmDialog';

interface HistoryViewProps {
  classes: string[];
  students: Student[];
  sessions: AttendanceSession[];
  settings: AppSettings;
  onUpdateSession: (session: AttendanceSession, syncNow: boolean) => void;
  onDeleteSession: (sessionId: string) => void;
  onRetrySyncSession: (session: AttendanceSession) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  classes,
  students,
  sessions,
  settings,
  onUpdateSession,
  onDeleteSession,
  onRetrySyncSession,
}) => {
  const t = translations[settings.language];

  // Filters
  const [filterClass, setFilterClass] = useState<string>('ALL');
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Detail modal / view state
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [detailSearch, setDetailSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | AttendanceStatus>('ALL');
  const [draftRecords, setDraftRecords] = useState<Record<string, AttendanceStatus>>({});
  const [hasEditedDraft, setHasEditedDraft] = useState(false);

  // Delete confirmation
  const [sessionToDelete, setSessionToDelete] = useState<AttendanceSession | null>(null);

  const filteredSessions = useMemo(() => {
    return [...sessions]
      .filter((sess) => {
        if (filterClass !== 'ALL' && sess.className !== filterClass) return false;
        if (filterMonth && !sess.date.startsWith(filterMonth)) return false;
        if (dateFrom && sess.date < dateFrom) return false;
        if (dateTo && sess.date > dateTo) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [sessions, filterClass, filterMonth, dateFrom, dateTo]);

  // Compute summary metrics for the selected class & date range
  const rangeSummary = useMemo(() => {
    const relevantStudents = students
      .filter((st) => filterClass === 'ALL' || st.className === filterClass)
      .sort((a, b) => {
        const clsCmp = a.className.localeCompare(b.className);
        if (clsCmp !== 0) return clsCmp;
        return a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true });
      });

    let totalP = 0;
    let totalA = 0;
    let totalL = 0;

    const studentRows = relevantStudents.map((st) => {
      let P = 0;
      let A = 0;
      let L = 0;

      for (const sess of filteredSessions) {
        if (sess.className !== st.className) continue;
        const status = sess.records[st.id];
        if (status === 'P') {
          P++;
          totalP++;
        } else if (status === 'A') {
          A++;
          totalA++;
        } else if (status === 'L') {
          L++;
          totalL++;
        }
      }

      const totalDays = P + A + L;
      const pct = totalDays > 0 ? Math.round((P / totalDays) * 100) : 100;
      return {
        student: st,
        P,
        A,
        L,
        totalDays,
        pct,
      };
    });

    // Also include session-level totals even if some records belong to students not currently in roster
    let rawSessionP = 0;
    let rawSessionA = 0;
    let rawSessionL = 0;
    for (const sess of filteredSessions) {
      Object.values(sess.records).forEach((val) => {
        if (val === 'P') rawSessionP++;
        else if (val === 'A') rawSessionA++;
        else if (val === 'L') rawSessionL++;
      });
    }

    const finalP = relevantStudents.length > 0 ? totalP : rawSessionP;
    const finalA = relevantStudents.length > 0 ? totalA : rawSessionA;
    const finalL = relevantStudents.length > 0 ? totalL : rawSessionL;
    const grandTotal = finalP + finalA + finalL;
    const overallPct = grandTotal > 0 ? Math.round((finalP / grandTotal) * 100) : 0;

    return {
      studentRows,
      totalP: finalP,
      totalA: finalA,
      totalL: finalL,
      overallPct,
    };
  }, [students, filteredSessions, filterClass]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || null,
    [sessions, activeSessionId]
  );

  const openSessionDetail = (sess: AttendanceSession) => {
    setActiveSessionId(sess.id);
    setDraftRecords({ ...sess.records });
    setHasEditedDraft(false);
    setDetailSearch('');
    setStatusFilter('ALL');
  };

  // Generate & Download PDF Report for Selected Class and Date Range
  const handleDownloadPdfReport = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const classLabel = filterClass === 'ALL' ? 'All Classes' : filterClass;

    let dateRangeLabel = 'All Recorded Dates';
    if (dateFrom && dateTo) {
      dateRangeLabel = `${dateFrom} to ${dateTo}`;
    } else if (dateFrom) {
      dateRangeLabel = `From ${dateFrom}`;
    } else if (dateTo) {
      dateRangeLabel = `Up to ${dateTo}`;
    } else if (filterMonth) {
      dateRangeLabel = `Month: ${filterMonth}`;
    } else if (filteredSessions.length > 0) {
      const dates = filteredSessions.map((s) => s.date).sort();
      dateRangeLabel =
        dates.length > 1 ? `${dates[0]} to ${dates[dates.length - 1]}` : dates[0];
    }

    // Header Banner
    doc.setFillColor(92, 124, 250);
    doc.roundedRect(40, 36, 515, 68, 10, 10, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('AttendEase — Summary Attendance Report', 56, 62);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Class: ${classLabel}   |   Date Range: ${dateRangeLabel}   |   Generated: ${new Date().toISOString().split('T')[0]}`,
      56,
      84
    );

    // Summary KPIs Row
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const kpiText = `Sessions: ${filteredSessions.length}    |    Students: ${rangeSummary.studentRows.length}    |    Present: ${rangeSummary.totalP}    |    Absent: ${rangeSummary.totalA}    |    Leave: ${rangeSummary.totalL}    |    Overall Rate: ${rangeSummary.overallPct}%`;
    doc.text(kpiText, 40, 126);

    let currentY = 142;

    // 1. Per-Student Attendance Summary Table
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('1. Student Attendance Summary', 40, currentY);

    const studentTableBody =
      rangeSummary.studentRows.length > 0
        ? rangeSummary.studentRows.map((row) => {
            const isLow =
              row.totalDays > 0 && row.pct < settings.lowAttendanceThreshold;
            return [
              row.student.rollNo,
              row.student.name,
              row.student.className,
              String(row.P),
              String(row.A),
              String(row.L),
              String(row.totalDays),
              `${row.pct}%`,
              row.totalDays === 0 ? 'No Records' : isLow ? 'Low' : 'Good',
            ];
          })
        : [['—', 'No students found for the selected filter', '—', '0', '0', '0', '0', '0%', '—']];

    autoTable(doc, {
      startY: currentY + 10,
      margin: { left: 40, right: 40 },
      head: [
        [
          'Roll No',
          'Student Name',
          'Class',
          'Present',
          'Absent',
          'Leave',
          'Total Days',
          'Rate %',
          'Status',
        ],
      ],
      body: studentTableBody,
      styles: {
        fontSize: 9,
        cellPadding: 6,
        textColor: [51, 65, 85],
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [30, 41, 59],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [249, 250, 252],
      },
    });

    const afterStudentsY = (doc as any).lastAutoTable?.finalY || currentY + 80;

    // 2. Sessions Breakdown Table
    if (filteredSessions.length > 0) {
      const nextHeadingY = afterStudentsY + 26;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('2. Recorded Sessions in Date Range', 40, nextHeadingY);

      const sessionRows = [...filteredSessions]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((sess) => {
          let p = 0;
          let a = 0;
          let l = 0;
          Object.values(sess.records).forEach((v) => {
            if (v === 'P') p++;
            else if (v === 'A') a++;
            else if (v === 'L') l++;
          });
          const tot = p + a + l;
          const pct = tot > 0 ? `${Math.round((p / tot) * 100)}%` : '0%';
          return [
            sess.date,
            sess.className,
            String(p),
            String(a),
            String(l),
            String(tot),
            pct,
          ];
        });

      autoTable(doc, {
        startY: nextHeadingY + 10,
        margin: { left: 40, right: 40 },
        head: [
          ['Date', 'Class', 'Present (P)', 'Absent (A)', 'Leave (L)', 'Total Marked', 'Attendance %'],
        ],
        body: sessionRows,
        styles: {
          fontSize: 9,
          cellPadding: 6,
          textColor: [51, 65, 85],
        },
        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [30, 41, 59],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [249, 250, 252],
        },
      });
    }

    const safeClass = classLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeRange = dateRangeLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`AttendEase_Report_${safeClass}_${safeRange}.pdf`);
  };

  // ---------------- SESSION DETAIL VIEW ----------------
  if (activeSession) {
    const classStudents = students
      .filter((s) => s.className === activeSession.className)
      .sort((a, b) => a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true }));

    const filteredDetailStudents = classStudents.filter((st) => {
      const currentStatus = draftRecords[st.id] || 'P';
      if (statusFilter !== 'ALL' && currentStatus !== statusFilter) return false;
      if (detailSearch.trim()) {
        const q = detailSearch.toLowerCase();
        return (
          st.name.toLowerCase().includes(q) ||
          st.rollNo.toLowerCase().includes(q)
        );
      }
      return true;
    });

    let P = 0;
    let A = 0;
    let L = 0;
    Object.values(draftRecords).forEach((val) => {
      if (val === 'P') P++;
      else if (val === 'A') A++;
      else if (val === 'L') L++;
    });

    const handleSaveChanges = () => {
      onUpdateSession(
        {
          ...activeSession,
          records: draftRecords,
          syncStatus: 'pending',
          updatedAt: new Date().toISOString(),
        },
        true
      );
      setHasEditedDraft(false);
    };

    return (
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="soft-card rounded-3xl p-5 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveSessionId(null)}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Back to history"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  {activeSession.date} · {P} Present · {A} Absent · {L} Leave
                </p>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {activeSession.className}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSessionToDelete(activeSession)}
                className="px-3.5 h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>

              {hasEditedDraft && (
                <button
                  onClick={handleSaveChanges}
                  className="px-4 h-10 rounded-xl accent-bg text-white text-xs font-semibold shadow-xs hover:opacity-95 inline-flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{t.saveAndSync}</span>
                </button>
              )}
            </div>
          </div>

          {/* Search & Status Segmented Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 my-5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={detailSearch}
                onChange={(e) => setDetailSearch(e.target.value)}
                placeholder={t.searchStudents}
                className="w-full h-10 pl-10 pr-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
              {(['ALL', 'P', 'A', 'L'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    statusFilter === tab
                      ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  {tab === 'ALL'
                    ? t.all
                    : tab === 'P'
                    ? 'Present'
                    : tab === 'A'
                    ? 'Absent'
                    : 'Leave'}
                </button>
              ))}
            </div>
          </div>

          {/* Editable Student Attendance List */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredDetailStudents.map((st) => {
              const status = draftRecords[st.id] || 'P';
              return (
                <div
                  key={st.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                      {st.name}
                    </p>
                    <p className="text-xs font-mono text-slate-400">
                      {st.rollNo}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
                    {(['P', 'A', 'L'] as AttendanceStatus[]).map((code) => {
                      const active = status === code;
                      return (
                        <button
                          key={code}
                          onClick={() => {
                            setDraftRecords((prev) => ({ ...prev, [st.id]: code }));
                            setHasEditedDraft(true);
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                            active
                              ? code === 'P'
                                ? 'bg-emerald-500 text-white'
                                : code === 'A'
                                ? 'bg-rose-500 text-white'
                                : 'bg-amber-500 text-white'
                              : 'text-slate-500 dark:text-slate-400'
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
        </div>

        <ConfirmDialog
          open={Boolean(sessionToDelete)}
          title="Delete Attendance Session?"
          description={
            sessionToDelete
              ? `Are you sure you want to delete the attendance session for ${sessionToDelete.className} on ${sessionToDelete.date}?`
              : ''
          }
          confirmLabel="Delete Session"
          variant="danger"
          onConfirm={() => {
            if (sessionToDelete) {
              onDeleteSession(sessionToDelete.id);
              setSessionToDelete(null);
              setActiveSessionId(null);
            }
          }}
          onCancel={() => setSessionToDelete(null)}
        />
      </div>
    );
  }

  const hasActiveFilters =
    filterClass !== 'ALL' || Boolean(filterMonth) || Boolean(dateFrom) || Boolean(dateTo);

  // ---------------- SESSIONS LIST VIEW ----------------
  return (
    <div className="space-y-5">
      <div className="soft-card rounded-3xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">
              {t.history}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Filter by class and date range, inspect sessions, or download a summary PDF report
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setFilterClass('ALL');
                  setFilterMonth('');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="h-10 px-3 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDownloadPdfReport}
              className="w-full sm:w-auto h-10 px-4 rounded-xl accent-bg text-white text-xs font-semibold shadow-xs hover:opacity-95 inline-flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <FileDown className="w-4 h-4 shrink-0" />
              <span>Download PDF Report</span>
            </button>
          </div>
        </div>

        {/* Filter Bar: Class, Month, Date Range */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Class
            </label>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-white"
            >
              <option value="ALL">All Classes</option>
              {classes.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Month
            </label>
            <input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-white"
            />
          </div>
        </div>

        {/* Live Filtered Range Summary Strip */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            <span>
              Sessions: <strong className="text-slate-800 dark:text-slate-100">{filteredSessions.length}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Students: <strong className="text-slate-800 dark:text-slate-100">{rangeSummary.studentRows.length}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              P: {rangeSummary.totalP}
            </span>
            <span className="text-rose-500 dark:text-rose-400 font-semibold">
              A: {rangeSummary.totalA}
            </span>
            <span className="text-amber-600 dark:text-amber-400 font-semibold">
              L: {rangeSummary.totalL}
            </span>
          </div>

          <div className="font-mono text-xs font-semibold accent-text tabular-nums">
            Range Attendance Rate: {rangeSummary.overallPct}%
          </div>
        </div>
      </div>

      {/* Session Cards List */}
      {filteredSessions.length === 0 ? (
        <div className="soft-card rounded-3xl p-10 sm:p-12 text-center space-y-2">
          <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            No Attendance Sessions Found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Start a new flash-card attendance session or adjust your class and date range filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSessions.map((sess) => {
            let P = 0;
            let A = 0;
            let L = 0;
            Object.values(sess.records).forEach((val) => {
              if (val === 'P') P++;
              else if (val === 'A') A++;
              else if (val === 'L') L++;
            });
            const total = P + A + L;
            const pct = total > 0 ? Math.round((P / total) * 100) : 0;

            return (
              <div
                key={sess.id}
                onClick={() => openSessionDetail(sess)}
                className="soft-card rounded-2xl p-5 hover:opacity-95 transition-all cursor-pointer flex flex-col justify-between gap-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
                      <span>{sess.date}</span>
                      <span aria-hidden="true">·</span>
                      <span>{pct}% Present</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mt-1">
                      {sess.className}
                    </h3>
                  </div>

                  {/* Sync Status Indicator + Retry / Delete */}
                  <div
                    className="flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {sess.syncStatus === 'synced' && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{t.synced}</span>
                      </span>
                    )}
                    {sess.syncStatus === 'pending' && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{t.pending}</span>
                      </span>
                    )}
                    {sess.syncStatus === 'failed' && (
                      <button
                        onClick={() => onRetrySyncSession(sess)}
                        className="inline-flex items-center gap-1 text-xs text-rose-500 font-semibold hover:underline cursor-pointer"
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{t.failed} · {t.retry}</span>
                        <RefreshCw className="w-3 h-3" />
                      </button>
                    )}

                    <button
                      onClick={() => setSessionToDelete(sess)}
                      aria-label="Delete session"
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs font-mono tabular-nums">
                  <div className="flex items-center gap-4">
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      P: {P}
                    </span>
                    <span className="text-rose-500 dark:text-rose-400 font-semibold">
                      A: {A}
                    </span>
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      L: {L}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 font-sans font-medium text-slate-400">
                    <span>Details</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(sessionToDelete)}
        title="Delete Attendance Session?"
        description={
          sessionToDelete
            ? `Are you sure you want to permanently remove the attendance record for ${sessionToDelete.className} on ${sessionToDelete.date}?`
            : ''
        }
        confirmLabel="Delete Session"
        variant="danger"
        onConfirm={() => {
          if (sessionToDelete) {
            onDeleteSession(sessionToDelete.id);
            setSessionToDelete(null);
          }
        }}
        onCancel={() => setSessionToDelete(null)}
      />
    </div>
  );
};
