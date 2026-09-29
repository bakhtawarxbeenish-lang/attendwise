import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Layers,
  History,
  Users,
  Settings as SettingsIcon,
  Cloud,
  CloudOff,
  RefreshCw,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import {
  ActiveTab,
  AppSettings,
  AttendanceSession,
  CustomField,
  Student,
  ToastMessage,
} from './types';
import { translations } from './i18n';
import {
  getAccessToken,
  googleSignIn,
  initAuth,
  logout,
} from './services/googleAuth';
import {
  createAttendEaseSpreadsheet,
  syncAllToGoogleSheets,
  syncSessionViaAppsScript,
} from './services/sheetsSync';
import { DashboardView } from './components/DashboardView';
import { FlashCardAttendance } from './components/FlashCardAttendance';
import { HistoryView } from './components/HistoryView';
import { StudentsView } from './components/StudentsView';
import { SettingsView } from './components/SettingsView';
import { ClassManagerModal } from './components/ClassManagerModal';
import { PinLockModal } from './components/PinLockModal';
import { PWAInstallButton } from './components/PWAInstallButton';

const STORAGE_KEYS = {
  CLASSES: 'attendease_classes_v2',
  STUDENTS: 'attendease_students_v2',
  FIELDS: 'attendease_fields_v2',
  SESSIONS: 'attendease_sessions_v2',
  SETTINGS: 'attendease_settings_v2',
};

const DEFAULT_SETTINGS: AppSettings = {
  scriptUrl: '',
  spreadsheetId: '',
  spreadsheetUrl: '',
  connectionMode: 'demo',
  theme: 'light',
  accentColor: '#5c7cfa',
  lowAttendanceThreshold: 75,
  defaultClass: '',
  hapticFeedback: true,
  soundEffects: true,
  language: 'en',
  pinCode: '',
  pinEnabled: false,
};

function hexToRgbString(hex: string): string {
  const clean = hex.replace('#', '');
  const num = parseInt(
    clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean,
    16
  );
  if (Number.isNaN(num)) return '92, 124, 250';
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `${r}, ${g}, ${b}`;
}

export default function App() {
  // Fresh empty state on first launch (no demo data)
  const [classes, setClasses] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CLASSES);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [students, setStudents] = useState<Student[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STUDENTS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [customFields, setCustomFields] = useState<CustomField[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FIELDS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [sessions, setSessions] = useState<AttendanceSession[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('attendance');
  const [selectedClassForAttendance, setSelectedClassForAttendance] = useState<string>(
    settings.defaultClass || classes[0] || ''
  );
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isClassManagerOpen, setIsClassManagerOpen] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [googleUser, setGoogleUser] = useState<{
    email: string | null;
    displayName: string | null;
  } | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(() =>
    Boolean(settings.pinEnabled && settings.pinCode)
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const t = translations[settings.language];

  const showToast = useCallback(
    (type: ToastMessage['type'], text: string) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { id, type, text }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, 3200);
    },
    []
  );

  // Persist to localStorage immediately
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(classes));
    } catch (e) {
      console.error(e);
    }
  }, [classes]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
    } catch (e) {
      console.error(e);
    }
  }, [students]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.FIELDS, JSON.stringify(customFields));
    } catch (e) {
      console.error(e);
    }
  }, [customFields]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    } catch (e) {
      console.error(e);
    }
  }, [sessions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error(e);
    }
  }, [settings]);

  // Apply dynamic soft accent color CSS variables + Light/Dark/System theme
  useEffect(() => {
    const root = document.documentElement;
    const rgb = hexToRgbString(settings.accentColor);
    root.style.setProperty('--accent', settings.accentColor);
    root.style.setProperty('--accent-rgb', rgb);
    root.style.setProperty('--accent-soft', `rgba(${rgb}, 0.12)`);
    root.style.setProperty('--accent-softer', `rgba(${rgb}, 0.05)`);
    root.style.setProperty('--accent-border', `rgba(${rgb}, 0.22)`);

    const applyDark = (isDark: boolean) => {
      root.classList.toggle('dark', isDark);
    };

    if (settings.theme === 'dark') {
      applyDark(true);
    } else if (settings.theme === 'light') {
      applyDark(false);
    } else {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      applyDark(mq.matches);
      const handler = (e: MediaQueryListEvent) => applyDark(e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [settings.accentColor, settings.theme]);

  // Initialize Firebase Google Auth listener
  useEffect(() => {
    const unsub = initAuth(
      (user) => {
        setGoogleUser({ email: user.email, displayName: user.displayName });
      },
      () => {
        setGoogleUser(null);
      }
    );
    return () => unsub();
  }, []);

  // Online / Offline listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('info', 'Back online — ready to sync.');
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast('warning', 'Working offline — saved locally.');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showToast]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  // ---------------- CLASS MANAGEMENT (ADD / EDIT / DELETE) ----------------
  const handleAddClass = useCallback(
    (className: string) => {
      const trimmed = className.trim();
      if (!trimmed) return;
      setClasses((prev) => {
        if (prev.includes(trimmed)) return prev;
        return [...prev, trimmed];
      });
      setSelectedClassForAttendance(trimmed);
      if (!settings.defaultClass) {
        updateSettings({ defaultClass: trimmed });
      }
      showToast('success', `Class "${trimmed}" added.`);
    },
    [settings.defaultClass, updateSettings, showToast]
  );

  const handleRenameClass = useCallback(
    (oldName: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed || oldName === trimmed) return;
      setClasses((prev) => prev.map((c) => (c === oldName ? trimmed : c)));
      setStudents((prev) =>
        prev.map((st) => (st.className === oldName ? { ...st, className: trimmed } : st))
      );
      setSessions((prev) =>
        prev.map((sess) =>
          sess.className === oldName ? { ...sess, className: trimmed } : sess
        )
      );
      if (selectedClassForAttendance === oldName) {
        setSelectedClassForAttendance(trimmed);
      }
      if (settings.defaultClass === oldName) {
        updateSettings({ defaultClass: trimmed });
      }
      showToast('success', `Renamed "${oldName}" to "${trimmed}".`);
    },
    [selectedClassForAttendance, settings.defaultClass, updateSettings, showToast]
  );

  const handleDeleteClass = useCallback(
    (className: string) => {
      setClasses((prev) => {
        const next = prev.filter((c) => c !== className);
        if (selectedClassForAttendance === className) {
          setSelectedClassForAttendance(next[0] || '');
        }
        if (settings.defaultClass === className) {
          updateSettings({ defaultClass: next[0] || '' });
        }
        return next;
      });
      showToast('info', `Class "${className}" deleted.`);
    },
    [selectedClassForAttendance, settings.defaultClass, updateSettings, showToast]
  );

  // ---------------- CLOUD SYNC (2-SHEET GOOGLE SHEETS & APPS SCRIPT) ----------------
  const handleSyncAll = useCallback(
    async (
      customSessions?: AttendanceSession[],
      customStudents?: Student[],
      customFieldsOverride?: CustomField[]
    ) => {
      const targetSessions = customSessions || sessions;
      const targetStudents = customStudents || students;
      const targetFields = customFieldsOverride || customFields;

      if (!isOnline) {
        showToast('warning', 'Offline: Saved locally and queued for sync.');
        return;
      }

      if (settings.connectionMode === 'demo' && !settings.spreadsheetId && !settings.scriptUrl) {
        setSessions((prev) =>
          prev.map((s) => ({ ...s, syncStatus: 'synced', errorMessage: undefined }))
        );
        showToast(
          'success',
          'Saved locally! Connect Google Sheets in Settings to sync Students & Attendance sheets.'
        );
        return;
      }

      setIsSyncing(true);
      try {
        if (settings.connectionMode === 'sheets_oauth' || settings.spreadsheetId.trim()) {
          let token = await getAccessToken();
          if (!token) {
            const authRes = await googleSignIn();
            if (!authRes) throw new Error('Google Sign-In cancelled');
            token = authRes.accessToken;
            setGoogleUser({
              email: authRes.user.email,
              displayName: authRes.user.displayName,
            });
          }

          if (!settings.spreadsheetId.trim()) {
            const created = await createAttendEaseSpreadsheet(
              token,
              classes,
              targetStudents,
              targetFields,
              targetSessions
            );
            updateSettings({
              spreadsheetId: created.spreadsheetId,
              spreadsheetUrl: created.spreadsheetUrl,
              connectionMode: 'sheets_oauth',
            });
          } else {
            await syncAllToGoogleSheets(
              token,
              settings.spreadsheetId,
              classes,
              targetStudents,
              targetFields,
              targetSessions
            );
          }

          setSessions((prev) =>
            prev.map((s) => ({ ...s, syncStatus: 'synced', errorMessage: undefined }))
          );
          showToast(
            'success',
            'Synced both "Students" and "Attendance" sheets in Google Sheets!'
          );
          return;
        }

        if (settings.scriptUrl.trim()) {
          const dummySession: AttendanceSession = targetSessions[0] || {
            id: 'sync_init',
            className: classes[0] || 'General',
            date: new Date().toISOString().split('T')[0],
            records: {},
            syncStatus: 'synced',
            updatedAt: new Date().toISOString(),
          };
          await syncSessionViaAppsScript(
            settings.scriptUrl.trim(),
            dummySession,
            targetStudents,
            targetFields,
            targetSessions,
            classes
          );

          setSessions((prev) =>
            prev.map((s) => ({ ...s, syncStatus: 'synced', errorMessage: undefined }))
          );
          showToast('success', 'Synced Students & all Class sheets with color formatting!');
        }
      } catch (err: any) {
        const msg = err?.message || 'Cloud sync failed';
        setSessions((prev) =>
          prev.map((s) =>
            s.syncStatus === 'pending' ? { ...s, syncStatus: 'failed', errorMessage: msg } : s
          )
        );
        showToast('error', msg);
      } finally {
        setIsSyncing(false);
      }
    },
    [
      sessions,
      students,
      customFields,
      isOnline,
      settings.connectionMode,
      settings.spreadsheetId,
      settings.scriptUrl,
      classes,
      showToast,
      updateSettings,
    ]
  );

  const handleSaveSession = useCallback(
    (newSession: AttendanceSession, syncImmediately: boolean) => {
      setSessions((prev) => {
        const filtered = prev.filter(
          (s) => !(s.className === newSession.className && s.date === newSession.date)
        );
        const updated = [newSession, ...filtered].sort((a, b) => b.date.localeCompare(a.date));
        if (syncImmediately) {
          setTimeout(() => handleSyncAll(updated), 50);
        }
        return updated;
      });
      showToast('success', `Attendance saved for ${newSession.className} (${newSession.date})`);
    },
    [handleSyncAll, showToast]
  );

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      showToast('info', 'Attendance session deleted.');
    },
    [showToast]
  );

  const handleSaveStudent = useCallback(
    (student: Student) => {
      if (student.className && !classes.includes(student.className)) {
        setClasses((prev) =>
          prev.includes(student.className) ? prev : [...prev, student.className]
        );
      }
      setStudents((prev) => {
        const exists = prev.some((s) => s.id === student.id);
        return exists
          ? prev.map((s) => (s.id === student.id ? student : s))
          : [...prev, student];
      });
      showToast('success', `Saved student ${student.name}`);
    },
    [classes, showToast]
  );

  const handleBulkAddStudents = useCallback(
    (newStudents: Student[], newClasses: string[]) => {
      setStudents((prev) => [...prev, ...newStudents]);
      if (newClasses.length > 0) {
        setClasses((prev) => Array.from(new Set([...prev, ...newClasses])));
      }
      showToast('success', `Imported ${newStudents.length} students.`);
    },
    [showToast]
  );

  const handleDeleteStudent = useCallback(
    (studentId: string) => {
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
      showToast('info', 'Student removed.');
    },
    [showToast]
  );

  const handleGoogleSignIn = useCallback(async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser({
          email: res.user.email,
          displayName: res.user.displayName,
        });
        updateSettings({ connectionMode: 'sheets_oauth' });
        showToast('success', `Signed in as ${res.user.email}`);
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Google Sign-In failed');
    }
  }, [showToast, updateSettings]);

  const handleGoogleLogout = useCallback(async () => {
    await logout();
    setGoogleUser(null);
    updateSettings({ connectionMode: settings.scriptUrl ? 'apps_script' : 'demo' });
    showToast('info', 'Disconnected Google Account.');
  }, [settings.scriptUrl, showToast, updateSettings]);

  const handleCreateGoogleSheet = useCallback(async () => {
    setIsSyncing(true);
    try {
      let token = await getAccessToken();
      if (!token) {
        const res = await googleSignIn();
        if (!res) throw new Error('Sign-in cancelled');
        token = res.accessToken;
        setGoogleUser({
          email: res.user.email,
          displayName: res.user.displayName,
        });
      }
      const created = await createAttendEaseSpreadsheet(
        token,
        classes,
        students,
        customFields,
        sessions
      );
      updateSettings({
        spreadsheetId: created.spreadsheetId,
        spreadsheetUrl: created.spreadsheetUrl,
        connectionMode: 'sheets_oauth',
      });
      setSessions((prev) => prev.map((s) => ({ ...s, syncStatus: 'synced' })));
      showToast(
        'success',
        'Created Google Sheet with "Students" & "Attendance" tabs!'
      );
    } catch (err: any) {
      showToast('error', err?.message || 'Could not create Google Sheet');
    } finally {
      setIsSyncing(false);
    }
  }, [classes, students, customFields, sessions, updateSettings, showToast]);

  const pendingSyncCount = useMemo(
    () => sessions.filter((s) => s.syncStatus !== 'synced').length,
    [sessions]
  );

  const navItems: Array<{ id: ActiveTab; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'attendance', label: t.attendance, icon: Layers },
    { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard },
    { id: 'history', label: t.history, icon: History },
    { id: 'students', label: t.students, icon: Users },
    { id: 'settings', label: t.settings, icon: SettingsIcon },
  ];

  const isRtl = settings.language === 'ur';

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="app-canvas min-h-screen flex flex-col md:flex-row text-slate-700 dark:text-slate-200"
    >
      {/* Optional PIN Lock Overlay */}
      {isLocked && settings.pinCode && (
        <PinLockModal
          expectedPin={settings.pinCode}
          onUnlock={() => setIsLocked(false)}
        />
      )}

      {/* Global Class Manager Modal (Add, Rename, Delete Classes) */}
      <ClassManagerModal
        open={isClassManagerOpen}
        classes={classes}
        students={students}
        onClose={() => setIsClassManagerOpen(false)}
        onAddClass={handleAddClass}
        onRenameClass={handleRenameClass}
        onDeleteClass={handleDeleteClass}
      />

      {/* Desktop Sidebar Navigation */}
      <aside className="no-print hidden md:flex md:w-64 lg:w-72 flex-col justify-between border-r border-slate-200/60 dark:border-slate-800/70 bg-white/75 dark:bg-slate-900/75 backdrop-blur-xl p-5 shrink-0">
        <div className="space-y-6">
          {/* Brand Logo */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl accent-soft-bg accent-text">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <span className="font-bold text-lg tracking-tight text-slate-800 dark:text-slate-100 block leading-none">
                  AttendEase
                </span>
                <span className="text-[11px] font-medium text-slate-400">
                  Smart Attendance
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1" aria-label="Main Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? 'accent-bg text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                  {item.id === 'history' && pendingSyncCount > 0 && (
                    <span
                      className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-mono font-bold ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {pendingSyncCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Cloud & Offline Status Card in Sidebar */}
        <div className="space-y-3 pt-5 border-t border-slate-200/60 dark:border-slate-800/70">
          <div className="rounded-2xl accent-softer-bg border accent-border p-3.5 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                {isOnline ? (
                  <Cloud className="h-4 w-4 text-emerald-500" />
                ) : (
                  <CloudOff className="h-4 w-4 text-amber-500" />
                )}
                {!isOnline
                  ? t.offlineMode
                  : settings.connectionMode === 'sheets_oauth'
                  ? t.connectedSheets
                  : settings.connectionMode === 'apps_script'
                  ? t.connectedScript
                  : 'Local Ready'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleSyncAll()}
              disabled={isSyncing}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700 py-2 text-xs font-semibold text-slate-600 dark:text-slate-200 hover:bg-slate-50 transition cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : t.syncNow}
            </button>
          </div>
          <PWAInstallButton compact />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-24 md:pb-6">
        {/* Top Responsive Header */}
        <header className="no-print sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-3.5 py-2.5 sm:px-6 md:px-8">
          <div className="flex items-center gap-2 md:hidden min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl accent-soft-bg accent-text shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="font-bold text-sm sm:text-base tracking-tight text-slate-800 dark:text-slate-100 truncate">
              AttendEase
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            {settings.connectionMode !== 'demo' ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {settings.connectionMode === 'sheets_oauth'
                  ? 'Google Sheets Connected (Students & Attendance Tabs)'
                  : t.connectedScript}
              </span>
            ) : (
              <span>
                {classes.length} Classes · {students.length} Students · {sessions.length} Sessions
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsClassManagerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white/90 dark:bg-slate-800 px-2.5 sm:px-3 py-1.5 min-h-[36px] text-xs font-semibold text-slate-600 dark:text-slate-200 hover:bg-slate-50 transition cursor-pointer"
            >
              <Layers className="h-3.5 w-3.5 accent-text shrink-0" />
              <span>Classes</span>
              <span className="font-mono text-[11px] opacity-75">({classes.length})</span>
            </button>

            <button
              type="button"
              onClick={() => handleSyncAll()}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 rounded-xl accent-soft-bg accent-text px-2.5 sm:px-3 py-1.5 min-h-[36px] text-xs font-semibold hover:opacity-90 transition cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden xs:inline sm:inline">
                {isSyncing ? 'Syncing' : t.syncNow}
              </span>
            </button>
          </div>
        </header>

        {/* Active View Container */}
        <main className="flex-1 mx-auto w-full max-w-5xl px-3.5 py-4 sm:px-6 sm:py-5 md:px-8">
          {activeTab === 'attendance' && (
            <FlashCardAttendance
              classes={classes}
              students={students}
              customFields={customFields}
              sessions={sessions}
              settings={settings}
              initialClass={selectedClassForAttendance}
              onSaveSession={handleSaveSession}
              onNavigateToStudents={() => setActiveTab('students')}
              onOpenClassManager={() => setIsClassManagerOpen(true)}
              onQuickAddClass={handleAddClass}
            />
          )}

          {activeTab === 'dashboard' && (
            <DashboardView
              classes={classes}
              students={students}
              sessions={sessions}
              settings={settings}
              onStartClassAttendance={(cls) => {
                setSelectedClassForAttendance(cls);
                setActiveTab('attendance');
              }}
              onOpenStudentProfile={(studentId) => {
                setSelectedStudentId(studentId);
                setActiveTab('students');
              }}
              onOpenClassManager={() => setIsClassManagerOpen(true)}
            />
          )}

          {activeTab === 'history' && (
            <HistoryView
              classes={classes}
              students={students}
              sessions={sessions}
              settings={settings}
              onUpdateSession={handleSaveSession}
              onDeleteSession={handleDeleteSession}
              onRetrySyncSession={() => handleSyncAll()}
            />
          )}

          {activeTab === 'students' && (
            <StudentsView
              classes={classes}
              students={students}
              customFields={customFields}
              sessions={sessions}
              settings={settings}
              selectedStudentId={selectedStudentId}
              onSelectStudentId={setSelectedStudentId}
              onSaveStudent={handleSaveStudent}
              onBulkAddStudents={handleBulkAddStudents}
              onDeleteStudent={handleDeleteStudent}
              onUpdateCustomFields={setCustomFields}
              onOpenClassManager={() => setIsClassManagerOpen(true)}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              classes={classes}
              students={students}
              customFields={customFields}
              sessions={sessions}
              googleUser={googleUser}
              isSyncing={isSyncing}
              pendingCount={pendingSyncCount}
              onUpdateSettings={updateSettings}
              onGoogleSignIn={handleGoogleSignIn}
              onGoogleLogout={handleGoogleLogout}
              onCreateGoogleSheet={handleCreateGoogleSheet}
              onSyncNow={() => handleSyncAll()}
              onClearLocalData={() => {
                setClasses([]);
                setStudents([]);
                setCustomFields([]);
                setSessions([]);
                showToast('info', 'All local classes, students, and sessions cleared.');
              }}
              onShowToast={showToast}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="no-print fixed bottom-0 inset-x-0 z-30 flex md:hidden items-center justify-around border-t border-slate-200/70 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl px-1 py-1.5"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 min-h-[44px] text-[10px] sm:text-[11px] font-semibold transition cursor-pointer ${
                active
                  ? 'accent-text'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'
              }`}
            >
              <div
                className={`flex h-7 w-10 items-center justify-center rounded-xl transition ${
                  active ? 'accent-soft-bg' : ''
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <span className="truncate max-w-[64px]">{item.label}</span>
              {item.id === 'history' && pendingSyncCount > 0 && (
                <span className="absolute top-1 right-3 h-2 w-2 rounded-full bg-amber-500" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Soft Toast Notifications */}
      <div className="no-print fixed bottom-20 md:bottom-6 inset-x-3 sm:inset-x-auto sm:right-4 z-50 flex flex-col gap-2 sm:max-w-sm sm:w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-xs font-semibold shadow-md backdrop-blur-xl transition-all ${
              toast.type === 'success'
                ? 'border-emerald-500/25 bg-white/95 dark:bg-slate-900/95 text-emerald-700 dark:text-emerald-300'
                : toast.type === 'error'
                ? 'border-rose-500/25 bg-white/95 dark:bg-slate-900/95 text-rose-600 dark:text-rose-300'
                : toast.type === 'warning'
                ? 'border-amber-500/25 bg-white/95 dark:bg-slate-900/95 text-amber-700 dark:text-amber-300'
                : 'border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200'
            }`}
          >
            <span className="flex-1">{toast.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
