import React, { useState } from 'react';
import {
  Cloud,
  Code2,
  Copy,
  Check,
  Palette,
  Sun,
  Moon,
  Monitor,
  Volume2,
  Vibrate,
  Shield,
  RefreshCw,
  Download,
  Printer,
  Trash2,
  ExternalLink,
  Activity,
  ChevronDown,
  ChevronUp,
  Sparkles,
  LogOut,
  FileSpreadsheet,
} from 'lucide-react';
import {
  AppSettings,
  AttendanceSession,
  CustomField,
  Student,
} from '../types';
import { translations } from '../i18n';
import { APPS_SCRIPT_CODE, testAppsScriptConnection } from '../services/sheetsSync';
import { ConfirmDialog } from './ConfirmDialog';
import { PWAInstallButton } from './PWAInstallButton';

interface SettingsViewProps {
  settings: AppSettings;
  classes: string[];
  students: Student[];
  customFields: CustomField[];
  sessions: AttendanceSession[];
  googleUser: { email: string | null; displayName: string | null } | null;
  isSyncing: boolean;
  pendingCount: number;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onGoogleSignIn: () => Promise<void>;
  onGoogleLogout: () => Promise<void>;
  onCreateGoogleSheet: () => Promise<void>;
  onSyncNow: () => Promise<void>;
  onClearLocalData: () => void;
  onShowToast: (type: 'success' | 'error' | 'info' | 'warning', text: string) => void;
}

export const SOFT_ACCENT_PRESETS = [
  { name: 'Soft Periwinkle', hex: '#5c7cfa' },
  { name: 'Sage Mint', hex: '#38a169' },
  { name: 'Sky Breeze', hex: '#0ea5e9' },
  { name: 'Lavender Mist', hex: '#8b5cf6' },
  { name: 'Soft Rose', hex: '#ec4899' },
  { name: 'Warm Peach', hex: '#f97316' },
  { name: 'Teal Calm', hex: '#14b8a6' },
  { name: 'Serene Slate', hex: '#64748b' },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  classes,
  students,
  sessions,
  googleUser,
  isSyncing,
  pendingCount,
  onUpdateSettings,
  onGoogleSignIn,
  onGoogleLogout,
  onCreateGoogleSheet,
  onSyncNow,
  onClearLocalData,
  onShowToast,
}) => {
  const t = translations[settings.language];

  const [testingScript, setTestingScript] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    latencyMs: number;
    message: string;
  } | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [confirmCreateSheetOpen, setConfirmCreateSheetOpen] = useState(false);
  const [confirmSyncSheetOpen, setConfirmSyncSheetOpen] = useState(false);

  const handleTestScript = async () => {
    if (!settings.scriptUrl.trim()) {
      onShowToast('warning', 'Please paste a Google Apps Script Web App URL first.');
      return;
    }
    setTestingScript(true);
    setTestResult(null);
    try {
      const res = await testAppsScriptConnection(settings.scriptUrl.trim());
      setTestResult(res);
      if (res.ok) {
        onUpdateSettings({ connectionMode: 'apps_script' });
        onShowToast('success', `Connected in ${res.latencyMs}ms`);
      } else {
        onShowToast('error', res.message);
      }
    } finally {
      setTestingScript(false);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_CODE);
      setCopiedCode(true);
      onShowToast('success', 'Code.gs copied to clipboard!');
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      onShowToast('error', 'Could not copy automatically. Please select and copy manually.');
    }
  };

  const handleExportAllCsv = () => {
    const uniqueDates = Array.from(new Set(sessions.map((s) => s.date))).sort();
    const headers = ['Roll No', 'Student Name', 'Class', ...uniqueDates];
    const rows: string[][] = [headers];

    const sortedStudents = [...students].sort((a, b) =>
      a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true })
    );

    for (const st of sortedStudents) {
      const dateCells = uniqueDates.map((d) => {
        const sess = sessions.find((s) => s.date === d && s.records[st.id]);
        return sess ? sess.records[st.id] : '';
      });
      rows.push([st.rollNo, st.name, st.className, ...dateCells]);
    }

    const csvContent = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AttendEase_Attendance_Matrix_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast('success', 'CSV attendance matrix downloaded.');
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
            {t.settings}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Configure 2-Sheet Google Sheets sync (Students & Attendance), soft dynamic themes, and data tools.
          </p>
        </div>
        <PWAInstallButton />
      </div>

      {/* 1. Appearance, Soft Dynamic Theme & Language */}
      <section className="soft-card rounded-3xl p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl accent-soft-bg accent-text">
            <Palette className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Soft Dynamic Theme & Appearance
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Choose a soft pastel color palette and Light, Dark, or System mode.
            </p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Theme Mode */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
              {t.themeMode}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'light', label: 'Soft Light', icon: Sun },
                  { id: 'dark', label: 'Soft Dark', icon: Moon },
                  { id: 'system', label: 'System', icon: Monitor },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = settings.theme === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onUpdateSettings({ theme: item.id })}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 px-3 text-xs font-semibold transition cursor-pointer ${
                      active
                        ? 'accent-bg text-white border-transparent shadow-xs'
                        : 'border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Language (English / Urdu RTL) */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
              {t.language}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onUpdateSettings({ language: 'en' })}
                className={`rounded-xl border py-2.5 px-3 text-xs font-semibold transition cursor-pointer ${
                  settings.language === 'en'
                    ? 'accent-bg text-white border-transparent shadow-xs'
                    : 'border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                English (LTR)
              </button>
              <button
                type="button"
                onClick={() => onUpdateSettings({ language: 'ur' })}
                className={`rounded-xl border py-2.5 px-3 text-xs font-semibold transition cursor-pointer ${
                  settings.language === 'ur'
                    ? 'accent-bg text-white border-transparent shadow-xs'
                    : 'border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                اردو (Urdu RTL)
              </button>
            </div>
          </div>

          {/* Dynamic Soft Color Picker */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
              {t.accentColor} (Dynamic Soft Palette)
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {SOFT_ACCENT_PRESETS.map((preset) => {
                const selected = settings.accentColor.toLowerCase() === preset.hex.toLowerCase();
                return (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => onUpdateSettings({ accentColor: preset.hex })}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition cursor-pointer ${
                      selected
                        ? 'accent-soft-bg accent-border accent-text'
                        : 'border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full"
                      style={{ backgroundColor: preset.hex }}
                    />
                    <span>{preset.name}</span>
                  </button>
                );
              })}

              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">
                <input
                  type="color"
                  value={settings.accentColor}
                  onChange={(e) => onUpdateSettings({ accentColor: e.target.value })}
                  className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
                />
                <span>Custom ({settings.accentColor})</span>
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Google Sheets OAuth Direct Integration (2-Sheet Architecture) */}
      <section className="soft-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Google Sheets Direct Sync (Students + Per-Class Tabs)
                </h2>
                {settings.connectionMode === 'sheets_oauth' && (
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    · Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Creates a separate <strong>Students</strong> sheet for details/fields and an automatic sheet tab for <strong>every Class</strong> with color-toned headings and P / A / L cells.
              </p>
            </div>
          </div>

          {googleUser ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {googleUser.email || googleUser.displayName}
              </span>
              <button
                type="button"
                onClick={onGoogleLogout}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                Disconnect
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onGoogleSignIn}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition cursor-pointer"
            >
              <Cloud className="h-4 w-4" />
              Connect Google Account
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              Spreadsheet URL or ID
            </label>
            <input
              type="text"
              value={settings.spreadsheetId}
              onChange={(e) =>
                onUpdateSettings({
                  spreadsheetId: e.target.value,
                  connectionMode: e.target.value.trim() ? 'sheets_oauth' : settings.connectionMode,
                })
              }
              placeholder="Paste Google Sheet URL or ID (or click Create New)"
              className="w-full rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 px-3.5 py-2.5 text-xs text-slate-800 dark:text-white focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmCreateSheetOpen(true)}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 rounded-xl accent-bg px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:opacity-95 disabled:opacity-50 transition cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              Create 2-Tab Google Sheet
            </button>

            {settings.spreadsheetUrl && (
              <a
                href={settings.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700 px-3.5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open Sheet
              </a>
            )}
          </div>
        </div>
      </section>

      {/* 3. Google Apps Script Web App URL Connection */}
      <section className="soft-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl accent-soft-bg accent-text">
              <Code2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Google Apps Script Web App URL
                </h2>
                {settings.connectionMode === 'apps_script' && (
                  <span className="text-xs font-semibold accent-text">
                    · Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Connect via a deployed Google Apps Script Web App URL (creates Students & Attendance sheets).
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="url"
            value={settings.scriptUrl}
            onChange={(e) =>
              onUpdateSettings({
                scriptUrl: e.target.value,
                connectionMode: e.target.value.trim() ? 'apps_script' : settings.connectionMode,
              })
            }
            placeholder="https://script.google.com/macros/s/AKfycb.../exec"
            className="flex-1 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 px-3.5 py-2.5 text-xs font-mono text-slate-800 dark:text-white focus:outline-none"
          />
          <button
            type="button"
            onClick={handleTestScript}
            disabled={testingScript}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <Activity className={`h-4 w-4 ${testingScript ? 'animate-spin' : ''}`} />
            {testingScript ? 'Testing...' : t.testConnection}
          </button>
        </div>

        {testResult && (
          <div
            className={`rounded-xl border p-3.5 text-xs flex items-center justify-between ${
              testResult.ok
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300'
            }`}
          >
            <span>{testResult.message}</span>
            <span className="font-mono font-bold">{testResult.latencyMs} ms</span>
          </div>
        )}

        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowGuide((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl bg-slate-100/70 dark:bg-slate-800/60 px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <span>{t.howToConnect}</span>
            {showGuide ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showGuide && (
            <div className="mt-3 space-y-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-4 text-xs text-slate-600 dark:text-slate-300">
              <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                <li>Create or open a Google Sheet in Google Drive.</li>
                <li>
                  Click <strong>Extensions → Apps Script</strong> in the top menu.
                </li>
                <li>
                  Replace everything in <code className="font-mono">Code.gs</code> with the script
                  below and click <strong>Save</strong>.
                </li>
                <li>
                  Click <strong>Deploy → New deployment</strong>, choose type{' '}
                  <strong>Web app</strong>, set <em>Execute as</em> to <strong>Me</strong>, and{' '}
                  <em>Who has access</em> to <strong>Anyone</strong>.
                </li>
                <li>
                  Copy the generated <strong>Web App URL</strong>, paste it above, and tap{' '}
                  <strong>Test Connection</strong>.
                </li>
              </ol>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Code.gs (2-Sheet Script: Students & Attendance)
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="inline-flex items-center gap-1.5 rounded-lg accent-bg px-3 py-1.5 text-xs font-semibold text-white shadow-xs cursor-pointer"
                  >
                    {copiedCode ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedCode ? 'Copied!' : 'Copy Code.gs'}
                  </button>
                </div>
                <pre className="max-h-72 overflow-auto rounded-xl bg-slate-900 p-3.5 font-mono text-[11px] leading-relaxed text-slate-200">
                  <code>{APPS_SCRIPT_CODE}</code>
                </pre>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 4. Attendance Rules, Haptics & PIN Lock */}
      <section className="soft-card rounded-3xl p-5 sm:p-6 space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t.threshold}
              </label>
              <span className="font-mono text-sm font-bold accent-text">
                {settings.lowAttendanceThreshold}%
              </span>
            </div>
            <input
              type="range"
              min={50}
              max={95}
              step={5}
              value={settings.lowAttendanceThreshold}
              onChange={(e) =>
                onUpdateSettings({ lowAttendanceThreshold: Number(e.target.value) })
              }
              className="w-full cursor-pointer"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Students below {settings.lowAttendanceThreshold}% receive a warning indicator.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              Default Class / Section
            </label>
            <select
              value={settings.defaultClass}
              onChange={(e) => onUpdateSettings({ defaultClass: e.target.value })}
              className="w-full rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs text-slate-800 dark:text-white"
            >
              {classes.length === 0 ? (
                <option value="">No classes yet</option>
              ) : (
                classes.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t.soundAndHaptics}
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onUpdateSettings({ soundEffects: !settings.soundEffects })}
                className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
                  settings.soundEffects
                    ? 'accent-bg text-white border-transparent'
                    : 'border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Volume2 className="h-4 w-4" />
                Sound: {settings.soundEffects ? 'On' : 'Off'}
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ hapticFeedback: !settings.hapticFeedback })}
                className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
                  settings.hapticFeedback
                    ? 'accent-bg text-white border-transparent'
                    : 'border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Vibrate className="h-4 w-4" />
                Haptics: {settings.hapticFeedback ? 'On' : 'Off'}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                {t.pinLock}
              </span>
              <button
                type="button"
                onClick={() => onUpdateSettings({ pinEnabled: !settings.pinEnabled })}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  settings.pinEnabled
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-slate-200/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                {settings.pinEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
            <input
              type="password"
              maxLength={4}
              value={settings.pinCode}
              onChange={(e) =>
                onUpdateSettings({ pinCode: e.target.value.replace(/\D/g, '').slice(0, 4) })
              }
              placeholder="4-digit PIN (e.g. 1234)"
              className="w-full rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-mono tracking-widest text-slate-800 dark:text-white"
            />
          </div>
        </div>
      </section>

      {/* 5. Data Tools: Manual Sync, CSV/PDF Export, Clear Data */}
      <section className="soft-card rounded-3xl p-5 sm:p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
          Data Tools & Cloud Backup
        </h2>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => setConfirmSyncSheetOpen(true)}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 rounded-xl accent-bg px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:opacity-95 disabled:opacity-50 transition cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {t.syncNow} {pendingCount > 0 ? `(${pendingCount} pending)` : ''}
          </button>

          <button
            type="button"
            onClick={handleExportAllCsv}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-200 hover:bg-slate-50 transition cursor-pointer"
          >
            <Download className="h-4 w-4" />
            {t.exportCsv}
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-200 hover:bg-slate-50 transition cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            {t.printPdf}
          </button>

          <button
            type="button"
            onClick={() => setConfirmClearOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-2.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/15 transition cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
            {t.clearLocalData}
          </button>
        </div>
      </section>

      {/* Confirmation Modals */}
      <ConfirmDialog
        open={confirmCreateSheetOpen}
        title="Create New Color-Styled Google Sheet?"
        description="AttendEase will create a new Google Spreadsheet with a dedicated 'Students' information sheet plus a separate attendance sheet for each Class, complete with color-toned headers, fields, and P/A/L status colors."
        details={[
          `Students Sheet: ${students.length} students & ${classes.length} classes`,
          `Class Sheets: ${classes.length > 0 ? classes.join(', ') : 'Auto-created as you add classes'}`,
        ]}
        confirmLabel="Create & Sync Sheet"
        onConfirm={() => {
          setConfirmCreateSheetOpen(false);
          onCreateGoogleSheet();
        }}
        onCancel={() => setConfirmCreateSheetOpen(false)}
      />

      <ConfirmDialog
        open={confirmSyncSheetOpen}
        title="Sync Students & Attendance to Google Sheet?"
        description="This will update the 'Students' detail sheet and the 'Attendance' date matrix sheet in your connected Google Spreadsheet."
        details={[
          `Students: ${students.length}`,
          `Recorded Sessions: ${sessions.length}`,
        ]}
        confirmLabel="Sync Now"
        onConfirm={() => {
          setConfirmSyncSheetOpen(false);
          onSyncNow();
        }}
        onCancel={() => setConfirmSyncSheetOpen(false)}
      />

      <ConfirmDialog
        open={confirmClearOpen}
        title="Clear All Local Data?"
        description="This will reset all classes, students, custom fields, and attendance sessions on this browser so you have a completely fresh workspace."
        confirmLabel="Clear Everything"
        variant="danger"
        onConfirm={() => {
          setConfirmClearOpen(false);
          onClearLocalData();
        }}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </div>
  );
};
