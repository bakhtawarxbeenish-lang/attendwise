import { AttendanceSession, CustomField, Student } from '../types';

export const DEMO_CLASSES: string[] = [
  'BSCS - Section A',
  'BBA - Semester 3',
  'FSc Pre-Eng - 11B',
];

export const DEMO_CUSTOM_FIELDS: CustomField[] = [
  { id: 'cf_phone', name: 'Guardian Phone', type: 'phone', order: 0 },
  { id: 'cf_blood', name: 'Blood Group', type: 'dropdown', options: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+'], order: 1 },
  { id: 'cf_track', name: 'Academic Track', type: 'dropdown', options: ['Regular', 'Honors', 'Scholarship'], order: 2 },
];

export const DEMO_STUDENTS: Student[] = [
  // BSCS - Section A
  { id: 'st_101', name: 'Ayesha Siddiqui', rollNo: 'CS-01', className: 'BSCS - Section A', customFields: { cf_phone: '+92 300 4128901', cf_blood: 'O+', cf_track: 'Honors' }, createdAt: '2026-09-01' },
  { id: 'st_102', name: 'Bilal Ahmed Khan', rollNo: 'CS-02', className: 'BSCS - Section A', customFields: { cf_phone: '+92 321 9845120', cf_blood: 'B+', cf_track: 'Regular' }, createdAt: '2026-09-01' },
  { id: 'st_103', name: 'Daniyal Raza', rollNo: 'CS-03', className: 'BSCS - Section A', customFields: { cf_phone: '+92 333 5510293', cf_blood: 'A+', cf_track: 'Scholarship' }, createdAt: '2026-09-01' },
  { id: 'st_104', name: 'Fatima Noor', rollNo: 'CS-04', className: 'BSCS - Section A', customFields: { cf_phone: '+92 301 7742319', cf_blood: 'O+', cf_track: 'Honors' }, createdAt: '2026-09-01' },
  { id: 'st_105', name: 'Hamza Tariq', rollNo: 'CS-05', className: 'BSCS - Section A', customFields: { cf_phone: '+92 345 6621098', cf_blood: 'AB+', cf_track: 'Regular' }, createdAt: '2026-09-01' },
  { id: 'st_106', name: 'Hira Mansoor', rollNo: 'CS-06', className: 'BSCS - Section A', customFields: { cf_phone: '+92 312 8834901', cf_blood: 'B-', cf_track: 'Scholarship' }, createdAt: '2026-09-01' },
  { id: 'st_107', name: 'Kamran Javed', rollNo: 'CS-07', className: 'BSCS - Section A', customFields: { cf_phone: '+92 300 1192837', cf_blood: 'A+', cf_track: 'Regular' }, createdAt: '2026-09-01' },
  { id: 'st_108', name: 'Maham Zahid', rollNo: 'CS-08', className: 'BSCS - Section A', customFields: { cf_phone: '+92 322 4401928', cf_blood: 'O-', cf_track: 'Honors' }, createdAt: '2026-09-01' },
  { id: 'st_109', name: 'Saad Ur Rehman', rollNo: 'CS-09', className: 'BSCS - Section A', customFields: { cf_phone: '+92 334 9918273', cf_blood: 'B+', cf_track: 'Regular' }, createdAt: '2026-09-01' },
  { id: 'st_110', name: 'Zainab Bukhari', rollNo: 'CS-10', className: 'BSCS - Section A', customFields: { cf_phone: '+92 302 6654321', cf_blood: 'A+', cf_track: 'Scholarship' }, createdAt: '2026-09-01' },

  // BBA - Semester 3
  { id: 'st_201', name: 'Areeba Farooq', rollNo: 'BBA-01', className: 'BBA - Semester 3', customFields: { cf_phone: '+92 300 5541230', cf_blood: 'B+', cf_track: 'Honors' }, createdAt: '2026-09-01' },
  { id: 'st_202', name: 'Fahad Mustafa Ali', rollNo: 'BBA-02', className: 'BBA - Semester 3', customFields: { cf_phone: '+92 321 7765432', cf_blood: 'O+', cf_track: 'Regular' }, createdAt: '2026-09-01' },
  { id: 'st_203', name: 'Laiba Sheikh', rollNo: 'BBA-03', className: 'BBA - Semester 3', customFields: { cf_phone: '+92 333 9087123', cf_blood: 'A+', cf_track: 'Scholarship' }, createdAt: '2026-09-01' },
  { id: 'st_204', name: 'Omer Farooq', rollNo: 'BBA-04', className: 'BBA - Semester 3', customFields: { cf_phone: '+92 345 1239876', cf_blood: 'AB+', cf_track: 'Regular' }, createdAt: '2026-09-01' },
  { id: 'st_205', name: 'Sana Mir', rollNo: 'BBA-05', className: 'BBA - Semester 3', customFields: { cf_phone: '+92 311 3344556', cf_blood: 'O+', cf_track: 'Honors' }, createdAt: '2026-09-01' },
  { id: 'st_206', name: 'Taha Hashmi', rollNo: 'BBA-06', className: 'BBA - Semester 3', customFields: { cf_phone: '+92 304 8877665', cf_blood: 'B+', cf_track: 'Regular' }, createdAt: '2026-09-01' },

  // FSc Pre-Eng - 11B
  { id: 'st_301', name: 'Abdullah Qureshi', rollNo: 'PE-01', className: 'FSc Pre-Eng - 11B', customFields: { cf_phone: '+92 300 2233445', cf_blood: 'A+', cf_track: 'Scholarship' }, createdAt: '2026-09-01' },
  { id: 'st_302', name: 'Emaan Malik', rollNo: 'PE-02', className: 'FSc Pre-Eng - 11B', customFields: { cf_phone: '+92 321 6677889', cf_blood: 'O+', cf_track: 'Honors' }, createdAt: '2026-09-01' },
  { id: 'st_303', name: 'Hassan Nisar', rollNo: 'PE-03', className: 'FSc Pre-Eng - 11B', customFields: { cf_phone: '+92 332 4455667', cf_blood: 'B+', cf_track: 'Regular' }, createdAt: '2026-09-01' },
  { id: 'st_304', name: 'Khadija Tul Kubra', rollNo: 'PE-04', className: 'FSc Pre-Eng - 11B', customFields: { cf_phone: '+92 346 9988776', cf_blood: 'O-', cf_track: 'Honors' }, createdAt: '2026-09-01' },
  { id: 'st_305', name: 'Muneeb Butt', rollNo: 'PE-05', className: 'FSc Pre-Eng - 11B', customFields: { cf_phone: '+92 315 1122334', cf_blood: 'A-', cf_track: 'Regular' }, createdAt: '2026-09-01' },
  { id: 'st_306', name: 'Noor Ul Ain', rollNo: 'PE-06', className: 'FSc Pre-Eng - 11B', customFields: { cf_phone: '+92 308 5566778', cf_blood: 'B+', cf_track: 'Scholarship' }, createdAt: '2026-09-01' },
];

function getRelativeDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

export function generateDemoSessions(): AttendanceSession[] {
  return [
    {
      id: 'sess_demo_1',
      date: getRelativeDate(1),
      className: 'BSCS - Section A',
      records: {
        st_101: 'P', st_102: 'P', st_103: 'P', st_104: 'P', st_105: 'A',
        st_106: 'P', st_107: 'A', st_108: 'P', st_109: 'L', st_110: 'P',
      },
      syncStatus: 'synced',
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'sess_demo_2',
      date: getRelativeDate(2),
      className: 'BSCS - Section A',
      records: {
        st_101: 'P', st_102: 'A', st_103: 'P', st_104: 'P', st_105: 'A',
        st_106: 'P', st_107: 'A', st_108: 'P', st_109: 'P', st_110: 'P',
      },
      syncStatus: 'synced',
      updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: 'sess_demo_3',
      date: getRelativeDate(3),
      className: 'BSCS - Section A',
      records: {
        st_101: 'P', st_102: 'P', st_103: 'L', st_104: 'P', st_105: 'A',
        st_106: 'P', st_107: 'P', st_108: 'P', st_109: 'P', st_110: 'P',
      },
      syncStatus: 'synced',
      updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    {
      id: 'sess_demo_4',
      date: getRelativeDate(4),
      className: 'BSCS - Section A',
      records: {
        st_101: 'P', st_102: 'P', st_103: 'P', st_104: 'P', st_105: 'P',
        st_106: 'P', st_107: 'A', st_108: 'P', st_109: 'A', st_110: 'P',
      },
      syncStatus: 'synced',
      updatedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    },
    {
      id: 'sess_demo_5',
      date: getRelativeDate(5),
      className: 'BSCS - Section A',
      records: {
        st_101: 'P', st_102: 'A', st_103: 'P', st_104: 'P', st_105: 'A',
        st_106: 'L', st_107: 'A', st_108: 'P', st_109: 'P', st_110: 'P',
      },
      syncStatus: 'synced',
      updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
    {
      id: 'sess_demo_6',
      date: getRelativeDate(1),
      className: 'BBA - Semester 3',
      records: {
        st_201: 'P', st_202: 'P', st_203: 'P', st_204: 'A', st_205: 'P', st_206: 'L',
      },
      syncStatus: 'synced',
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'sess_demo_7',
      date: getRelativeDate(2),
      className: 'BBA - Semester 3',
      records: {
        st_201: 'P', st_202: 'A', st_203: 'P', st_204: 'A', st_205: 'P', st_206: 'P',
      },
      syncStatus: 'synced',
      updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: 'sess_demo_8',
      date: getRelativeDate(1),
      className: 'FSc Pre-Eng - 11B',
      records: {
        st_301: 'P', st_302: 'P', st_303: 'A', st_304: 'P', st_305: 'P', st_306: 'P',
      },
      syncStatus: 'synced',
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ];
}

export const DEMO_SESSIONS: AttendanceSession[] = generateDemoSessions();

