import React, { useMemo, useState } from 'react';
import {
  Sparkles,
  AlertTriangle,
  TrendingUp,
  Download,
  Printer,
  CheckCircle2,
  ArrowRight,
  Calendar,
  Layers,
  Plus,
} from 'lucide-react';
import {
  AppSettings,
  AttendanceSession,
  Student,
} from '../types';
import { translations } from '../i18n';

interface DashboardViewProps {
  classes: string[];
  students: Student[];
  sessions: AttendanceSession[];
  settings: AppSettings;
  onStartClassAttendance: (className: string) => void;
  onOpenStudentProfile: (studentId: string) => void;
  onOpenClassManager: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  classes,
  students,
  sessions,
  settings,
  onStartClassAttendance,
  onOpenStudentProfile,
  onOpenClassManager,
}) => {
  const t = translations[settings.language];
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const currentMonthPrefix = useMemo(() => todayStr.slice(0, 7), [todayStr]);

  const [reportMonth, setReportMonth] = useState<string>(currentMonthPrefix);
  const [reportClass, setReportClass] = useState<string>('');

  // Today's status per class
  const todayClassStatus = useMemo(() => {
    return classes.map((cls) => {
      const clsStudents = students.filter((s) => s.className === cls);
      const todaySess = sessions.find(
        (sess) => sess.className === cls && sess.date === todayStr
      );
      let P = 0;
      let A = 0;
      let L = 0;
      if (todaySess) {
        Object.values(todaySess.records).forEach((val) => {
          if (val === 'P') P++;
          else if (val === 'A') A++;
          else if (val === 'L') L++;
        });
      }
      const total = clsStudents.length;
      const pct = total > 0 && todaySess ? Math.round((P / total) * 100) : null;
      return { className: cls, total, recorded: Boolean(todaySess), P, A, L, pct };
    });
  }, [classes, students, sessions, todayStr]);

  // 7-Day Weekly Trend
  const weeklyTrend = useMemo(() => {
    const days: Array<{ date: string; label: string; pct: number; sessionsCount: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const daySessions = sessions.filter((s) => s.date === dateStr);
      let p = 0;
      let total = 0;
      daySessions.forEach((sess) => {
        Object.values(sess.records).forEach((val) => {
          total++;
          if (val === 'P') p++;
        });
      });
      const pct = total > 0 ? Math.round((p / total) * 100) : 0;
      const label = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
      days.push({ date: dateStr, label, pct, sessionsCount: daySessions.length });
    }
    return days;
  }, [sessions]);

  // Per-student overall stats & Low Attendance Watchlist
  const studentStatsList = useMemo(() => {
    return students
      .map((st) => {
        const clsSessions = sessions.filter((s) => s.className === st.className);
        let P = 0;
        let A = 0;
        let L = 0;
        clsSessions.forEach((sess) => {
          const val = sess.records[st.id];
          if (val === 'P') P++;
          else if (val === 'A') A++;
          else if (val === 'L') L++;
        });
        const total = P + A + L;
        const pct = total > 0 ? Math.round((P / total) * 100) : 100;
        return { student: st, P, A, L, total, pct };
      })
      .sort((a, b) => a.pct - b.pct);
  }, [students, sessions]);

  const lowAttendanceStudents = useMemo(() => {
    return studentStatsList.filter(
      (item) => item.total > 0 && item.pct < settings.lowAttendanceThreshold
    );
  }, [studentStatsList, settings.lowAttendanceThreshold]);

  // Monthly Report per class & student
  const monthlyReportRows = useMemo(() => {
    const clsStudents = students
      .filter((s) => !reportClass || s.className === reportClass)
      .sort((a, b) => a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true }));

    const monthSessions = sessions.filter(
      (s) =>
        (!reportClass || s.className === reportClass) &&
        s.date.startsWith(reportMonth)
    );

    return clsStudents.map((st) => {
      let P = 0;
      let A = 0;
      let L = 0;
      monthSessions.forEach((sess) => {
        const val = sess.records[st.id];
        if (val === 'P') P++;
        else if (val === 'A') A++;
        else if (val === 'L') L++;
      });
      const total = P + A + L;
      const pct = total > 0 ? Math.round((P / total) * 100) : 100;
      return { student: st, P, A, L, total, pct };
    });
  }, [students, sessions, reportClass, reportMonth]);

  const exportMonthlyCsv = () => {
    const headers = ['Roll No', 'Name', 'Class', 'Month', 'Present', 'Absent', 'Leave', 'Total Days', 'Attendance %'];
    const rows = monthlyReportRows.map((r) => [
      `"${r.student.rollNo}"`,
      `"${r.student.name}"`,
      `"${r.student.className}"`,
      `"${reportMonth}"`,
      r.P,
      r.A,
      r.L,
      r.total,
      `${r.pct}%`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AttendEase_Report_${reportClass || 'All'}_${reportMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Hero Quick-Action & Today's Class Cards */}
      <section className="soft-card rounded-3xl p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800/80">
          <div className="space-y-1">
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
              {todayStr} · {classes.length} Classes · {students.length} Students
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
              {t.todayStatus}
            </h1>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5">
            <button
              onClick={onOpenClassManager}
              className="px-4 h-11 rounded-xl accent-soft-bg accent-text font-semibold text-xs inline-flex items-center justify-center gap-1.5 hover:opacity-90 transition cursor-pointer"
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span className="truncate">Manage Classes</span>
            </button>

            <button
              onClick={() => onStartClassAttendance(settings.defaultClass || classes[0] || '')}
              className="px-5 h-11 rounded-xl accent-bg text-white font-semibold text-xs shadow-xs hover:opacity-95 active:scale-[0.99] inline-flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span className="truncate">{t.takeAttendance}</span>
            </button>
          </div>
        </div>

        {/* Today's Class Grid */}
        {classes.length === 0 ? (
          <div className="mt-6 rounded-2xl accent-softer-bg border accent-border p-8 text-center space-y-3">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
              No Classes Added Yet
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Create your classes or sections first, then add students to start taking attendance.
            </p>
            <button
              onClick={onOpenClassManager}
              className="h-10 px-5 rounded-xl accent-bg text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs hover:opacity-95 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Class</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            {todayClassStatus.map((item) => (
              <div
                key={item.className}
                className="rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 p-5 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 truncate">
                      {item.className}
                    </h3>
                    {item.recorded ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Done
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium shrink-0">
                        Pending
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
                    {item.total} Students
                    {item.recorded && ` · ${item.pct}% Present`}
                  </p>
                </div>

                {item.recorded ? (
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      P: {item.P}
                    </span>
                    <span className="text-rose-500 dark:text-rose-400 font-semibold">
                      A: {item.A}
                    </span>
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      L: {item.L}
                    </span>
                    <button
                      onClick={() => onStartClassAttendance(item.className)}
                      className="accent-text font-sans font-semibold hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onStartClassAttendance(item.className)}
                    className="w-full h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:opacity-90 inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <span>Start Flash Cards</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Weekly Trend & Low Attendance Watchlist */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 7-Day Trend Chart */}
        <div className="lg:col-span-7 soft-card rounded-3xl p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-5">
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {t.weeklyTrend}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Daily attendance rate across recorded sessions
              </p>
            </div>
            <TrendingUp className="w-5 h-5 accent-text" />
          </div>

          <div className="grid grid-cols-7 gap-2 sm:gap-3 items-end h-40 pt-4">
            {weeklyTrend.map((day) => (
              <div
                key={day.date}
                className="flex flex-col items-center justify-end h-full gap-2"
              >
                <span className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                  {day.sessionsCount > 0 ? `${day.pct}%` : '—'}
                </span>
                <div className="w-full max-w-[36px] bg-slate-100 dark:bg-slate-800 rounded-xl h-24 flex items-end overflow-hidden p-0.5">
                  <div
                    className={`w-full rounded-lg transition-all duration-300 ${
                      day.sessionsCount > 0
                        ? 'accent-bg'
                        : 'bg-slate-200/70 dark:bg-slate-700/60'
                    }`}
                    style={{
                      height: `${day.sessionsCount > 0 ? Math.max(day.pct, 12) : 8}%`,
                    }}
                  />
                </div>
                <span className="text-[11px] text-slate-400 truncate max-w-full">
                  {day.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Low Attendance Watchlist */}
        <div className="lg:col-span-5 soft-card rounded-3xl p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {t.lowAttendanceAlert}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Students below {settings.lowAttendanceThreshold}% threshold
              </p>
            </div>
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          </div>

          {lowAttendanceStudents.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                No low attendance alerts
              </p>
              <p className="text-xs text-slate-400">
                Students below {settings.lowAttendanceThreshold}% will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto pr-1">
              {lowAttendanceStudents.map((item) => (
                <button
                  key={item.student.id}
                  onClick={() => onOpenStudentProfile(item.student.id)}
                  className="w-full py-2.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50/70 dark:hover:bg-slate-800/40 rounded-lg px-2 transition cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {item.student.name}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {item.student.rollNo} · {item.student.className}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-mono font-bold text-rose-500 tabular-nums">
                      {item.pct}%
                    </span>
                    <p className="text-[11px] font-mono text-slate-400 tabular-nums">
                      {item.P}/{item.total} days
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Monthly Class & Student Report Section */}
      <section className="soft-card rounded-3xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800/80">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Monthly Attendance Report
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Summary breakdown by class and month with CSV and PDF export
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 no-print">
            <select
              value={reportClass}
              onChange={(e) => setReportClass(e.target.value)}
              className="h-10 px-3 rounded-xl bg-slate-50/80 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              <option value="">All Classes</option>
              {classes.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>

            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="month"
                value={reportMonth}
                onChange={(e) => setReportMonth(e.target.value)}
                className="h-10 pl-8 pr-3 rounded-xl bg-slate-50/80 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-200"
              />
            </div>

            <button
              onClick={exportMonthlyCsv}
              className="h-10 px-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t.exportCsv}</span>
            </button>

            <button
              onClick={() => window.print()}
              className="h-10 px-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t.printPdf}</span>
            </button>
          </div>
        </div>

        {monthlyReportRows.length === 0 ? (
          <p className="text-xs text-slate-400 py-8 text-center">
            No students to display in this report yet.
          </p>
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-400">
                  <th className="py-3 pr-4">Roll No</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-3 text-right">Present</th>
                  <th className="py-3 px-3 text-right">Absent</th>
                  <th className="py-3 px-3 text-right">Leave</th>
                  <th className="py-3 pl-4 text-right">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-sm">
                {monthlyReportRows.map((row) => {
                  const isLow =
                    row.total > 0 && row.pct < settings.lowAttendanceThreshold;
                  return (
                    <tr
                      key={row.student.id}
                      onClick={() => onOpenStudentProfile(row.student.id)}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3 pr-4 font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {row.student.rollNo}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-100">
                        {row.student.name}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400">
                        {row.student.className}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {row.P}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-xs text-rose-500 dark:text-rose-400 tabular-nums">
                        {row.A}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-xs text-amber-600 dark:text-amber-400 tabular-nums">
                        {row.L}
                      </td>
                      <td className="py-3 pl-4 text-right font-mono text-xs font-semibold tabular-nums">
                        <span
                          className={
                            isLow
                              ? 'text-rose-500 dark:text-rose-400'
                              : 'text-slate-700 dark:text-slate-200'
                          }
                        >
                          {row.pct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
