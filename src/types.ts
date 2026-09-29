export type AttendanceStatus = 'P' | 'A' | 'L';

export type CustomFieldType = 'text' | 'number' | 'phone' | 'date' | 'dropdown';

export interface CustomField {
  id: string;
  name: string;
  type: CustomFieldType;
  options?: string[]; // Used when type === 'dropdown'
  order: number;
}

export interface Student {
  id: string;
  name: string;
  rollNo: string;
  className: string;
  customFields: Record<string, string>;
  createdAt: string;
}

export type SyncStatus = 'synced' | 'pending' | 'failed';

export interface AttendanceSession {
  id: string;
  date: string; // YYYY-MM-DD
  className: string;
  records: Record<string, AttendanceStatus>; // studentId -> 'P' | 'A' | 'L'
  syncStatus: SyncStatus;
  updatedAt: string;
  errorMessage?: string;
}

export interface SyncQueueItem {
  id: string;
  action: 'saveAttendance' | 'syncStudents' | 'syncFields';
  payload: {
    sessionId?: string;
    date?: string;
    className?: string;
    records?: Record<string, AttendanceStatus>;
  };
  timestamp: number;
  retries: number;
  error?: string;
}

export type ConnectionMode = 'demo' | 'sheets_oauth' | 'apps_script';

export interface AppSettings {
  scriptUrl: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  connectionMode: ConnectionMode;
  theme: 'light' | 'dark' | 'system';
  accentColor: string;
  lowAttendanceThreshold: number;
  defaultClass: string;
  hapticFeedback: boolean;
  soundEffects: boolean;
  language: 'en' | 'ur';
  pinCode: string;
  pinEnabled: boolean;
}

export type ActiveTab = 'dashboard' | 'attendance' | 'history' | 'students' | 'reports' | 'settings';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  text: string;
}
