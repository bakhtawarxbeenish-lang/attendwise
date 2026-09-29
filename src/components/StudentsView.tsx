import React, { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Upload,
  SlidersHorizontal,
  Layers,
  Edit3,
  Trash2,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  X,
  Users,
} from 'lucide-react';
import {
  AppSettings,
  AttendanceSession,
  CustomField,
  CustomFieldType,
  Student,
} from '../types';
import { translations } from '../i18n';
import { ConfirmDialog } from './ConfirmDialog';

interface StudentsViewProps {
  classes: string[];
  students: Student[];
  customFields: CustomField[];
  sessions: AttendanceSession[];
  settings: AppSettings;
  selectedStudentId: string | null;
  onSelectStudentId: (id: string | null) => void;
  onSaveStudent: (student: Student) => void;
  onBulkAddStudents: (newStudents: Student[], newClasses: string[]) => void;
  onDeleteStudent: (studentId: string) => void;
  onUpdateCustomFields: (fields: CustomField[]) => void;
  onOpenClassManager: () => void;
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  classes,
  students,
  customFields,
  sessions,
  settings,
  selectedStudentId,
  onSelectStudentId,
  onSaveStudent,
  onBulkAddStudents,
  onDeleteStudent,
  onUpdateCustomFields,
  onOpenClassManager,
}) => {
  const t = translations[settings.language];

  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'rollNo' | 'name' | 'pct'>('rollNo');

  // Modals state
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isStudentFormOpen, setIsStudentFormOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isFieldsModalOpen, setIsFieldsModalOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  // Student form state
  const [formName, setFormName] = useState('');
  const [formRollNo, setFormRollNo] = useState('');
  const [formClass, setFormClass] = useState(classes[0] || '');
  const [isCreatingNewClassInForm, setIsCreatingNewClassInForm] = useState(false);
  const [formCustom, setFormCustom] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  // Bulk CSV state
  const [csvText, setCsvText] = useState('');
  const [csvDefaultClass, setCsvDefaultClass] = useState(classes[0] || '');

  // Custom field form state
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<CustomFieldType>('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');

  const sortedFields = useMemo(
    () => [...customFields].sort((a, b) => a.order - b.order),
    [customFields]
  );

  // Compute attendance stats per student
  const studentStatsMap = useMemo(() => {
    const map: Record<
      string,
      {
        P: number;
        A: number;
        L: number;
        total: number;
        pct: number;
        monthly: Array<{ month: string; pct: number; total: number }>;
      }
    > = {};

    for (const st of students) {
      const clsSessions = sessions.filter((s) => s.className === st.className);
      let P = 0;
      let A = 0;
      let L = 0;
      const monthBuckets: Record<string, { p: number; total: number }> = {};

      for (const sess of clsSessions) {
        const val = sess.records[st.id];
        if (val === 'P' || val === 'A' || val === 'L') {
          if (val === 'P') P++;
          else if (val === 'A') A++;
          else if (val === 'L') L++;

          const m = sess.date.slice(0, 7);
          if (!monthBuckets[m]) monthBuckets[m] = { p: 0, total: 0 };
          monthBuckets[m].total++;
          if (val === 'P') monthBuckets[m].p++;
        }
      }

      const total = P + A + L;
      const pct = total > 0 ? Math.round((P / total) * 100) : 100;
      const monthly = Object.entries(monthBuckets)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([month, data]) => ({
          month,
          pct: data.total > 0 ? Math.round((data.p / data.total) * 100) : 100,
          total: data.total,
        }));

      map[st.id] = { P, A, L, total, pct, monthly };
    }
    return map;
  }, [students, sessions]);

  const filteredStudents = useMemo(() => {
    return students
      .filter((st) => {
        if (classFilter !== 'ALL' && st.className !== classFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            st.name.toLowerCase().includes(q) ||
            st.rollNo.toLowerCase().includes(q) ||
            st.className.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'pct') {
          const pctA = studentStatsMap[a.id]?.pct ?? 100;
          const pctB = studentStatsMap[b.id]?.pct ?? 100;
          return pctA - pctB;
        }
        return a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true });
      });
  }, [students, classFilter, searchQuery, sortBy, studentStatsMap]);

  const openAddStudentModal = () => {
    setEditingStudent(null);
    setFormName('');
    setFormRollNo('');
    const defaultCls =
      classFilter !== 'ALL' && classes.includes(classFilter)
        ? classFilter
        : classes[0] || '';
    setFormClass(defaultCls);
    setIsCreatingNewClassInForm(classes.length === 0);
    setFormCustom({});
    setFormError('');
    setIsStudentFormOpen(true);
  };

  const openEditStudentModal = (st: Student) => {
    setEditingStudent(st);
    setFormName(st.name);
    setFormRollNo(st.rollNo);
    setFormClass(st.className);
    setIsCreatingNewClassInForm(false);
    setFormCustom({ ...st.customFields });
    setFormError('');
    setIsStudentFormOpen(true);
  };

  const handleStudentFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formRollNo.trim() || !formClass.trim()) {
      setFormError('Student Name, Roll Number, and Class are required.');
      return;
    }

    const studentObj: Student = {
      id: editingStudent ? editingStudent.id : `st_${Date.now()}`,
      name: formName.trim(),
      rollNo: formRollNo.trim(),
      className: formClass.trim(),
      customFields: formCustom,
      createdAt: editingStudent
        ? editingStudent.createdAt
        : new Date().toISOString().split('T')[0],
    };

    onSaveStudent(studentObj);
    setIsStudentFormOpen(false);
  };

  const handleBulkImportSubmit = () => {
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const imported: Student[] = [];
    const discoveredClasses = new Set<string>(classes);

    lines.forEach((line, idx) => {
      if (
        idx === 0 &&
        (line.toLowerCase().startsWith('name,') ||
          line.toLowerCase().startsWith('roll'))
      ) {
        return;
      }
      const parts = line.split(',').map((p) => p.trim());
      if (parts.length < 2) return;
      const [rollNo, name, maybeClass] = parts;
      const targetClass =
        maybeClass || csvDefaultClass.trim() || classes[0] || 'Class 1';
      discoveredClasses.add(targetClass);
      imported.push({
        id: `st_${Date.now()}_${idx}`,
        rollNo: rollNo || `${idx + 1}`,
        name: name || `Student ${idx + 1}`,
        className: targetClass,
        customFields: {},
        createdAt: new Date().toISOString().split('T')[0],
      });
    });

    if (imported.length > 0) {
      onBulkAddStudents(imported, Array.from(discoveredClasses));
      setCsvText('');
      setIsBulkModalOpen(false);
    }
  };

  const handleAddCustomField = () => {
    if (!newFieldName.trim()) return;
    const options =
      newFieldType === 'dropdown'
        ? newFieldOptions
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined;
    const nextField: CustomField = {
      id: `cf_${Date.now()}`,
      name: newFieldName.trim(),
      type: newFieldType,
      options,
      order: sortedFields.length,
    };
    onUpdateCustomFields([...sortedFields, nextField]);
    setNewFieldName('');
    setNewFieldOptions('');
  };

  const moveFieldOrder = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sortedFields.length) return;
    const copy = [...sortedFields];
    const temp = copy[index];
    copy[index] = copy[target];
    copy[target] = temp;
    onUpdateCustomFields(copy.map((f, i) => ({ ...f, order: i })));
  };

  const selectedProfileStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) || null,
    [students, selectedStudentId]
  );

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header & Action Toolbar */}
      <div className="soft-card rounded-3xl p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">
              {t.students} ({students.length})
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Manage classes, student details, and extra fields synced with the Students Google Sheet tab
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
            <button
              onClick={onOpenClassManager}
              className="h-10 px-3 rounded-xl accent-soft-bg accent-text text-xs font-semibold hover:opacity-90 inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Classes ({classes.length})</span>
            </button>

            <button
              onClick={() => setIsFieldsModalOpen(true)}
              className="h-10 px-3 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t.customFields}</span>
            </button>

            <button
              onClick={() => {
                setCsvDefaultClass(classes[0] || '');
                setIsBulkModalOpen(true);
              }}
              className="h-10 px-3 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t.bulkImport}</span>
            </button>

            <button
              onClick={openAddStudentModal}
              className="h-10 px-3.5 rounded-xl accent-bg text-white text-xs font-semibold shadow-xs hover:opacity-95 inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span className="truncate">{t.addStudent}</span>
            </button>
          </div>
        </div>

        {/* Search, Class Filter, and Sort */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mt-5">
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchStudents}
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-xs text-slate-800 dark:text-white focus:outline-none"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-white"
            >
              <option value="ALL">All Classes ({students.length})</option>
              {classes.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as 'rollNo' | 'name' | 'pct')
              }
              className="w-full h-10 px-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-white"
            >
              <option value="rollNo">Sort by Roll Number</option>
              <option value="name">Sort by Name (A–Z)</option>
              <option value="pct">Sort by Attendance %</option>
            </select>
          </div>
        </div>
      </div>

      {/* Students Table / Empty State */}
      {filteredStudents.length === 0 ? (
        <div className="soft-card rounded-3xl p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl accent-soft-bg accent-text flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
            {students.length === 0 ? 'No Students Added Yet' : 'No Matching Students'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {students.length === 0
              ? 'Start fresh by adding classes and students individually or importing your class list via CSV.'
              : 'Try adjusting your search query or class filter.'}
          </p>
          {students.length === 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <button
                onClick={onOpenClassManager}
                className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Manage Classes</span>
              </button>
              <button
                onClick={openAddStudentModal}
                className="h-10 px-4 rounded-xl accent-bg text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs hover:opacity-95 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Student</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="soft-card rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800/80 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/40 dark:bg-slate-800/30">
                  <th className="py-3.5 pl-6 pr-3">Roll No</th>
                  <th className="py-3.5 px-3">Student Name</th>
                  <th className="py-3.5 px-3">Class</th>
                  {sortedFields.slice(0, 2).map((f) => (
                    <th key={f.id} className="py-3.5 px-3 hidden md:table-cell">
                      {f.name}
                    </th>
                  ))}
                  <th className="py-3.5 px-3 text-right">Attendance</th>
                  <th className="py-3.5 pl-3 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-sm">
                {filteredStudents.map((st) => {
                  const stats = studentStatsMap[st.id] || {
                    P: 0,
                    A: 0,
                    L: 0,
                    total: 0,
                    pct: 100,
                  };
                  const isLow =
                    stats.total > 0 && stats.pct < settings.lowAttendanceThreshold;

                  return (
                    <tr
                      key={st.id}
                      onClick={() => onSelectStudentId(st.id)}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 pl-6 pr-3 font-mono text-xs font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                        {st.rollNo}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {st.name}
                          </span>
                          {isLow && (
                            <span
                              title={`Below ${settings.lowAttendanceThreshold}% threshold`}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-500"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Low
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-xs text-slate-500 dark:text-slate-400">
                        {st.className}
                      </td>
                      {sortedFields.slice(0, 2).map((f) => (
                        <td
                          key={f.id}
                          className="py-3.5 px-3 text-xs text-slate-500 dark:text-slate-400 hidden md:table-cell"
                        >
                          {st.customFields[f.id] || '—'}
                        </td>
                      ))}
                      <td className="py-3.5 px-3 text-right font-mono text-xs tabular-nums">
                        <span
                          className={`font-bold ${
                            isLow
                              ? 'text-rose-500 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {stats.pct}%
                        </span>
                        <span className="text-slate-400 ml-1.5">
                          ({stats.P}/{stats.total})
                        </span>
                      </td>
                      <td
                        className="py-3.5 pl-3 pr-6 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => openEditStudentModal(st)}
                            aria-label="Edit student"
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setStudentToDelete(st)}
                            aria-label="Delete student"
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- PER-STUDENT PROFILE MODAL ---------------- */}
      {selectedProfileStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-xs p-4"
          onClick={() => onSelectStudentId(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 shadow-xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const st = selectedProfileStudent;
              const stats = studentStatsMap[st.id] || {
                P: 0,
                A: 0,
                L: 0,
                total: 0,
                pct: 100,
                monthly: [],
              };
              const isLow =
                stats.total > 0 && stats.pct < settings.lowAttendanceThreshold;

              return (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl accent-soft-bg accent-text font-display font-bold text-lg flex items-center justify-center">
                        {st.name
                          .split(' ')
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                          {st.name}
                        </h3>
                        <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                          Roll #{st.rollNo} · {st.className}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => onSelectStudentId(null)}
                      className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {isLow && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2.5 text-xs text-rose-600 dark:text-rose-300">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        Low Attendance Alert: Overall rate ({stats.pct}%) is below the {settings.lowAttendanceThreshold}% class threshold.
                      </span>
                    </div>
                  )}

                  {/* Personal Attendance Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70">
                      <p className="text-[11px] text-slate-400">Rate</p>
                      <p className="text-lg font-mono font-bold text-slate-800 dark:text-white tabular-nums">
                        {stats.pct}%
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-500/10">
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                        Present
                      </p>
                      <p className="text-lg font-mono font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                        {stats.P}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-500/10">
                      <p className="text-[11px] text-rose-700 dark:text-rose-300">
                        Absent
                      </p>
                      <p className="text-lg font-mono font-bold text-rose-700 dark:text-rose-300 tabular-nums">
                        {stats.A}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-500/10">
                      <p className="text-[11px] text-amber-700 dark:text-amber-300">
                        Leave
                      </p>
                      <p className="text-lg font-mono font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                        {stats.L}
                      </p>
                    </div>
                  </div>

                  {/* Custom Fields */}
                  {sortedFields.length > 0 && (
                    <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {sortedFields.map((f) => (
                        <div
                          key={f.id}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50"
                        >
                          <p className="text-[11px] text-slate-400">{f.name}</p>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-200 mt-0.5">
                            {st.customFields[f.id] || '—'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Monthly Attendance Mini Chart */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-3">
                      Monthly Attendance Breakdown
                    </p>
                    {stats.monthly.length === 0 ? (
                      <p className="text-xs text-slate-400">
                        No monthly sessions recorded yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {stats.monthly.map((m) => (
                          <div key={m.month} className="space-y-1">
                            <div className="flex justify-between text-xs font-mono">
                              <span className="text-slate-500 dark:text-slate-400">
                                {m.month}
                              </span>
                              <span className="font-semibold text-slate-800 dark:text-white tabular-nums">
                                {m.pct}% ({m.total} days)
                              </span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className="h-full accent-bg rounded-full"
                                style={{ width: `${m.pct}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => {
                        onSelectStudentId(null);
                        openEditStudentModal(st);
                      }}
                      className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Edit Profile
                    </button>
                    <button
                      onClick={() => onSelectStudentId(null)}
                      className="px-4 py-2 rounded-xl accent-bg text-white text-xs font-semibold cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ---------------- ADD / EDIT STUDENT MODAL ---------------- */}
      {isStudentFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-xs p-4">
          <form
            onSubmit={handleStudentFormSubmit}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {editingStudent ? 'Edit Student' : t.addStudent}
              </h3>
              <button
                type="button"
                onClick={() => setIsStudentFormOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <p className="text-xs text-rose-500 bg-rose-500/10 p-2.5 rounded-xl">
                {formError}
              </p>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {t.studentName} *
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Ayesha Siddiqui"
                className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  {t.rollNo} *
                </label>
                <input
                  type="text"
                  required
                  value={formRollNo}
                  onChange={(e) => setFormRollNo(e.target.value)}
                  placeholder="e.g. 01 or CS-01"
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-800 dark:text-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Class *
                  </label>
                  {classes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingNewClassInForm((v) => !v);
                        setFormClass(isCreatingNewClassInForm ? classes[0] || '' : '');
                      }}
                      className="text-[10px] font-semibold accent-text hover:underline cursor-pointer"
                    >
                      {isCreatingNewClassInForm ? 'Select existing' : '+ New Class'}
                    </button>
                  )}
                </div>

                {isCreatingNewClassInForm || classes.length === 0 ? (
                  <input
                    type="text"
                    required
                    value={formClass}
                    onChange={(e) => setFormClass(e.target.value)}
                    placeholder="Enter Class Name"
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white"
                  />
                ) : (
                  <select
                    value={formClass}
                    onChange={(e) => setFormClass(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white"
                  >
                    {classes.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Dynamic Custom Fields Inputs */}
            {sortedFields.map((field) => (
              <div key={field.id}>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  {field.name}
                </label>
                {field.type === 'dropdown' ? (
                  <select
                    value={formCustom[field.id] || ''}
                    onChange={(e) =>
                      setFormCustom((prev) => ({
                        ...prev,
                        [field.id]: e.target.value,
                      }))
                    }
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white"
                  >
                    <option value="">Select {field.name}...</option>
                    {(field.options || []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={
                      field.type === 'number'
                        ? 'number'
                        : field.type === 'date'
                        ? 'date'
                        : field.type === 'phone'
                        ? 'tel'
                        : 'text'
                    }
                    value={formCustom[field.id] || ''}
                    onChange={(e) =>
                      setFormCustom((prev) => ({
                        ...prev,
                        [field.id]: e.target.value,
                      }))
                    }
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-white"
                  />
                )}
              </div>
            ))}

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsStudentFormOpen(false)}
                className="px-4 h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 h-10 rounded-xl accent-bg text-white text-xs font-semibold cursor-pointer"
              >
                Save Student
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------------- BULK CSV IMPORT MODAL ---------------- */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {t.bulkImport}
              </h3>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Paste one student per line in format:{' '}
              <code className="font-mono text-slate-700 dark:text-slate-200">
                RollNo, Full Name, Class (optional)
              </code>
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Default Class (if omitted in line)
              </label>
              <input
                type="text"
                value={csvDefaultClass}
                onChange={(e) => setCsvDefaultClass(e.target.value)}
                placeholder="e.g. Class 10-A"
                className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white"
              />
            </div>
            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`01, Usman Tariq, Class 10-A\n02, Sara Khan, Class 10-A`}
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-white"
            />
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="px-4 h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkImportSubmit}
                className="px-5 h-10 rounded-xl accent-bg text-white text-xs font-semibold cursor-pointer"
              >
                Import Students
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- CUSTOM FIELDS MANAGER MODAL ---------------- */}
      {isFieldsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {t.customFields}
              </h3>
              <button
                onClick={() => setIsFieldsModalOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Custom fields appear on student flash cards and sync as detail columns in the <strong>Students</strong> sheet of your Google Spreadsheet.
            </p>

            {/* Existing Fields List */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedFields.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No custom detail fields added yet (e.g. Father Name, Phone, Section).
                </p>
              ) : (
                sortedFields.map((f, idx) => (
                  <div
                    key={f.id}
                    className="py-2.5 flex items-center justify-between gap-2"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {f.name}
                      </p>
                      <p className="text-xs text-slate-400 font-mono">
                        Type: {f.type}
                        {f.options && f.options.length > 0
                          ? ` (${f.options.join(', ')})`
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveFieldOrder(idx, -1)}
                        disabled={idx === 0}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveFieldOrder(idx, 1)}
                        disabled={idx === sortedFields.length - 1}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          onUpdateCustomFields(
                            sortedFields.filter((item) => item.id !== f.id)
                          )
                        }
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add New Field */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Add Student Detail Column
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  placeholder="Field label (e.g. Father Name, Phone)"
                  className="h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white"
                />
                <select
                  value={newFieldType}
                  onChange={(e) =>
                    setNewFieldType(e.target.value as CustomFieldType)
                  }
                  className="h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white"
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="phone">Phone</option>
                  <option value="date">Date</option>
                  <option value="dropdown">Dropdown</option>
                </select>
              </div>
              {newFieldType === 'dropdown' && (
                <input
                  type="text"
                  value={newFieldOptions}
                  onChange={(e) => setNewFieldOptions(e.target.value)}
                  placeholder="Comma-separated options (e.g. Morning, Evening)"
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white"
                />
              )}
              <button
                onClick={handleAddCustomField}
                className="w-full h-10 rounded-xl accent-bg text-white text-xs font-semibold cursor-pointer"
              >
                Add Field
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(studentToDelete)}
        title="Delete Student?"
        description={
          studentToDelete
            ? `Are you sure you want to remove ${studentToDelete.name} (${studentToDelete.rollNo}) from ${studentToDelete.className}?`
            : ''
        }
        confirmLabel="Delete Student"
        variant="danger"
        onConfirm={() => {
          if (studentToDelete) {
            onDeleteStudent(studentToDelete.id);
            setStudentToDelete(null);
          }
        }}
        onCancel={() => setStudentToDelete(null)}
      />
    </div>
  );
};
